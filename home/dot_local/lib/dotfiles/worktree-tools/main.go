// git-snapshot and wt-archive save on-disk tracked and untracked files under
// refs/snapshots/<branch>/<UTC timestamp>-<random suffix>. Ignored files and
// index-only contents are excluded. Each commit retains the original HEAD.
// Recover with: git worktree add -b recovered /path/to/recovered <ref>
// Stop writers first: validation detects changes, but cannot lock working files.
package main

import (
	"bytes"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type repository struct{ root, branch, head string }

func git(root, index string, input []byte, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "GIT_OPTIONAL_LOCKS=0")
	if index != "" {
		cmd.Env = append(cmd.Env, "GIT_INDEX_FILE="+index)
	}
	cmd.Stdin = bytes.NewReader(input)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git %s: %w: %s", args[0], err, strings.TrimSpace(stderr.String()))
	}
	return string(out), nil
}

func gitText(root string, args ...string) (string, error) {
	out, err := git(root, "", nil, args...)
	return strings.TrimSpace(out), err
}

func currentRepository() (repository, error) {
	var r repository
	if os.Getenv("GIT_INDEX_FILE") != "" {
		return r, errors.New("unset GIT_INDEX_FILE before snapshotting this worktree")
	}
	var err error
	r.root, err = gitText("", "rev-parse", "--show-toplevel")
	if err != nil {
		return r, err
	}
	r.branch, err = gitText(r.root, "symbolic-ref", "--quiet", "--short", "HEAD")
	if err != nil {
		return r, err
	}
	r.head, err = gitText(r.root, "rev-parse", "--verify", "HEAD")
	return r, err
}

// Each pass uses a fresh index so assume-unchanged flags, staging state, and
// racy stat-cache entries cannot hide on-disk changes. Git handles filters,
// executable bits, symlinks, literal pathspecs, and binary filenames/content.
func capture(root string) (string, error) {
	// -v and --stage combine conflict, submodule, and skip-worktree checks.
	entries, err := git(root, "", nil, "ls-files", "--stage", "-v", "-z")
	if err != nil {
		return "", err
	}
	for _, entry := range strings.Split(entries, "\x00") {
		if entry == "" {
			continue
		}
		if entry[0] == 'S' || entry[0] == 's' {
			return "", errors.New("sparse/skip-worktree entries are not supported")
		}
		meta, _, ok := strings.Cut(entry, "\t")
		fields := strings.Fields(meta)
		if !ok || len(fields) != 4 {
			return "", errors.New("unexpected git ls-files output")
		}
		if fields[1] == "160000" {
			return "", errors.New("submodules are not supported; snapshot them separately")
		}
		if fields[3] != "0" {
			return "", errors.New("resolve index conflicts before snapshotting")
		}
	}
	names, err := git(root, "", nil, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
	if err != nil {
		return "", err
	}
	var files bytes.Buffer
	seen := make(map[string]bool)
	for _, name := range strings.Split(names, "\x00") {
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		info, err := os.Lstat(filepath.Join(root, name))
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return "", err
		}
		if info.IsDir() {
			return "", fmt.Errorf("nested repositories or directory replacements cannot be snapshotted: %s", name)
		}
		if !info.Mode().IsRegular() && info.Mode()&os.ModeSymlink == 0 {
			return "", fmt.Errorf("not a regular file: %s", name)
		}
		files.WriteString(name)
		files.WriteByte(0)
	}
	tmp, err := os.MkdirTemp("", "git-snapshot-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmp)
	index := filepath.Join(tmp, "index")
	if _, err = git(root, index, nil, "read-tree", "--empty"); err != nil {
		return "", err
	}
	if files.Len() > 0 {
		if _, err = git(root, index, files.Bytes(), "--literal-pathspecs", "add", "-f", "--pathspec-from-file=-", "--pathspec-file-nul"); err != nil {
			return "", err
		}
	}
	tree, err := git(root, index, nil, "write-tree")
	return strings.TrimSpace(tree), err
}

type snapshot struct {
	ref, tree string
	repo      repository
}

func (s snapshot) verify() error {
	r, err := currentRepository()
	if err != nil {
		return err
	}
	if r != s.repo {
		return errors.New("worktree changed during snapshot; stop writers and retry")
	}
	tree, err := capture(r.root)
	if err != nil {
		return err
	}
	if tree != s.tree {
		return errors.New("worktree changed during snapshot; stop writers and retry")
	}
	return nil
}

func save(r repository) (snapshot, error) {
	s := snapshot{repo: r}
	var err error
	s.tree, err = capture(r.root)
	if err != nil {
		return s, err
	}
	commit, err := gitText(r.root, "-c", "commit.gpgSign=false", "commit-tree", s.tree, "-p", r.head, "-m", "Snapshot of "+r.branch)
	if err != nil {
		return s, err
	}
	if err = s.verify(); err != nil {
		return s, err
	}
	var suffix [4]byte
	if _, err = rand.Read(suffix[:]); err != nil {
		return s, err
	}
	ref := fmt.Sprintf("refs/snapshots/%s/%s-%x", r.branch, time.Now().UTC().Format("20060102T150405.000000Z"), suffix)
	// Empty old value requires a new ref; never overwrite a previous snapshot.
	if _, err = gitText(r.root, "update-ref", ref, commit, ""); err != nil {
		return s, err
	}
	s.ref = ref
	actual, err := gitText(r.root, "rev-parse", "--verify", ref)
	if err != nil {
		return s, err
	}
	if actual != commit {
		return s, errors.New("snapshot ref verification failed")
	}
	return s, nil
}

func removalOptions(args []string) error {
	flags := strings.Fields("--no-delete-branch --delete-branch --force-delete -D --foreground --reap --force -f --no-hooks --yes -y --verbose -v -vv")
	values := []string{"--format", "--config", "--config-set"}
	pending := false
	for _, arg := range args {
		if pending {
			pending = false
			continue
		}
		valid := false
		for _, flag := range flags {
			if arg == flag {
				valid = true
			}
		}
		for _, key := range values {
			if arg == key {
				valid = true
				pending = true
			}
			if strings.HasPrefix(arg, key+"=") {
				valid = true
			}
		}
		if !valid {
			return fmt.Errorf("unsupported removal option or target: %s. Archive acts on the current worktree; use wt -C <path> archive to choose another", arg)
		}
	}
	if pending {
		return errors.New("missing value for removal option")
	}
	return nil
}

func archive(args []string) (int, error) {
	if err := removalOptions(args); err != nil {
		return 1, err
	}
	r, err := currentRepository()
	if err != nil {
		return 1, err
	}
	gitDir, err := gitText(r.root, "rev-parse", "--absolute-git-dir")
	if err != nil {
		return 1, err
	}
	common, err := gitText(r.root, "rev-parse", "--path-format=absolute", "--git-common-dir")
	if err != nil {
		return 1, err
	}
	if gitDir == common {
		return 1, errors.New("archive only removes linked worktrees, not the primary checkout")
	}
	if _, err = os.Stat(filepath.Join(gitDir, "locked")); err == nil {
		return 1, errors.New("unlock this worktree before archiving it")
	} else if !errors.Is(err, os.ErrNotExist) {
		return 1, err
	}
	s, err := save(r)
	// Report the ref on every failure after publication, including cleanup errors.
	if s.ref != "" {
		fmt.Fprintln(os.Stderr, "Saved snapshot:", s.ref)
	}
	if err != nil {
		return 1, err
	}
	if err = s.verify(); err != nil {
		return 1, fmt.Errorf("%w; no cleanup performed; snapshot retained: %s", err, s.ref)
	}
	if _, err = gitText(r.root, "reset", "--hard", r.head); err != nil {
		return 1, err
	}
	if _, err = gitText(r.root, "clean", "-fd"); err != nil {
		return 1, err
	}
	cmd := exec.Command("wt", append(append([]string{"remove"}, args...), "--", r.root)...)
	cmd.Dir = r.root
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err = cmd.Run(); err != nil {
		fmt.Fprintln(os.Stderr, "Removal failed; saved changes remain recoverable from", s.ref)
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			return exit.ExitCode(), nil
		}
		return 1, err
	}
	return 0, nil
}

func run(args []string, out io.Writer) (int, error) {
	if len(args) == 0 {
		return 2, errors.New("expected snapshot or archive")
	}
	mode, args := args[0], args[1:]
	if mode != "snapshot" && mode != "archive" {
		return 2, fmt.Errorf("unknown command: %s", mode)
	}
	for _, arg := range args {
		if arg == "--help" || arg == "-h" {
			if mode == "archive" {
				fmt.Fprintln(out, "Usage: wt archive [wt remove options]\n\nSnapshot the current linked worktree, clear saved changes, then run wt remove.\nIgnored files are not saved. Stop agents and other writers first.\nRemoval failures leave a clean worktree and a recoverable snapshot.\nBranch/path targets are not accepted; use wt -C <path> archive.")
			} else {
				fmt.Fprintln(out, "Usage: git snapshot\n\nSave tracked and untracked on-disk files to a permanent branch-based ref.\nLeaves HEAD, working files, and index unchanged; excludes ignored files and staging state.\nPrints the ref to stdout. Stop writers first.\nList: git for-each-ref refs/snapshots/\nRecover: git worktree add -b recovered /path/to/recovered <ref>")
			}
			return 0, nil
		}
	}
	if mode == "archive" {
		return archive(args)
	}
	if len(args) != 0 {
		return 2, errors.New("git snapshot accepts no arguments")
	}
	r, err := currentRepository()
	if err != nil {
		return 1, err
	}
	s, err := save(r)
	if err != nil {
		return 1, err
	}
	fmt.Fprintln(out, s.ref)
	return 0, nil
}

func main() {
	code, err := run(os.Args[1:], os.Stdout)
	if err != nil {
		fmt.Fprintln(os.Stderr, filepath.Base(os.Args[0])+":", err)
	}
	os.Exit(code)
}

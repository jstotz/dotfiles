"""End-to-end snapshot/recovery tests in disposable Git repositories."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SOURCE = Path(__file__).resolve().parents[1] / "home" / "dot_local"
WT = shutil.which("wt")


class SnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.build = tempfile.TemporaryDirectory(prefix="snapshot-build-")
        cls.addClassCleanup(cls.build.cleanup)
        cls.binary = Path(cls.build.name) / "worktree-tools"
        subprocess.run(["go", "build", "-o", str(cls.binary), "."],
                       cwd=SOURCE / "lib/dotfiles/worktree-tools", check=True)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="snapshot-test-")
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
        self.home = self.base / "home"
        self.home.mkdir()
        self.bin = self.base / "bin"
        self.bin.mkdir()
        installed = self.home / ".local/lib/dotfiles/worktree-tools/bin"
        installed.mkdir(parents=True)
        (installed / "worktree-tools").symlink_to(self.binary)
        for name in ("git-snapshot", "wt-archive"):
            (self.bin / name).symlink_to(SOURCE / "bin" / ("executable_" + name))
        self.env = {k: v for k, v in os.environ.items()
                    if not k.startswith(("GIT_", "WORKTRUNK_", "WT_", "XDG_", "HERDR_"))}
        self.env.update(HOME=str(self.home), XDG_CONFIG_HOME=str(self.home / ".config"),
                        PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
                        GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull,
                        GIT_AUTHOR_NAME="Snapshot Test", GIT_AUTHOR_EMAIL="test@example.invalid",
                        GIT_COMMITTER_NAME="Snapshot Test", GIT_COMMITTER_EMAIL="test@example.invalid")
        self.repo = self.base / "repo"
        self.repo.mkdir()
        self.run_cmd("git", "init", "-b", "main")
        (self.repo / "tracked").write_text("base\n")
        (self.repo / "deleted").write_text("delete me\n")
        (self.repo / ".gitignore").write_text(".env\n")
        self.run_cmd("git", "add", ".")
        self.run_cmd("git", "commit", "-m", "base")

    def run_cmd(self, *args, cwd=None, check=True):
        result = subprocess.run(args, cwd=cwd or self.repo, env=self.env,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if check:
            self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        return result

    def git(self, *args, cwd=None):
        return self.run_cmd("git", *args, cwd=cwd).stdout.strip()

    def dirty(self, root):
        (root / "tracked").write_text("staged\n")
        (root / "added").write_bytes(b"staged new\x00file")
        self.git("add", "tracked", "added", cwd=root)
        (root / "tracked").write_text("unstaged\n")
        (root / "deleted").unlink()
        (root / "new\nfile").write_bytes(b"untracked\x00contents")
        (root / "link").symlink_to("tracked")
        (root / ".env").write_text("excluded secret\n")

    def state(self, root):
        files = {}
        for folder, dirs, names in os.walk(root):
            dirs[:] = [name for name in dirs if name != ".git"]
            for name in names:
                path = Path(folder) / name
                if name in (".git", ".env"):
                    continue
                key = str(path.relative_to(root))
                if path.is_symlink():
                    files[key] = ("link", os.readlink(path))
                else:
                    files[key] = ("file", path.read_bytes(), bool(path.stat().st_mode & 0o111))
        return files

    def restore(self, ref):
        dest = self.base / "recovered"
        self.git("worktree", "add", "-b", "recovered", str(dest), ref)
        return dest

    def test_snapshot_is_nonmutating_and_roundtrips_disk_files(self):
        self.git("switch", "-c", "feature/roundtrip")
        self.dirty(self.repo)
        before = self.state(self.repo)
        index = (self.repo / ".git" / "index").read_bytes()
        head = self.git("rev-parse", "HEAD")
        subdir = self.repo / "subdir"
        subdir.mkdir()
        ref = self.git("snapshot", cwd=subdir).decode()
        self.assertTrue(ref.startswith("refs/snapshots/feature/roundtrip/"))
        self.assertEqual(index, (self.repo / ".git" / "index").read_bytes())
        self.assertEqual(before, self.state(self.repo))
        self.assertEqual(head, self.git("rev-parse", "HEAD"))
        self.assertEqual(self.git("stash", "list"), b"")
        other = self.git("snapshot").decode()
        self.assertNotEqual(ref, other)
        recovered = self.restore(ref)
        self.assertEqual(before, self.state(recovered))
        self.assertEqual((recovered / "added").read_bytes(), b"staged new\x00file")
        self.assertEqual((recovered / "new\nfile").read_bytes(), b"untracked\x00contents")
        self.assertEqual(os.readlink(recovered / "link"), "tracked")
        self.assertFalse((recovered / ".env").exists())

    @unittest.skipUnless(WT, "Worktrunk not installed")
    def test_archive_real_worktrunk_and_recover_after_branch_deletion(self):
        work = self.base / "work"
        self.git("worktree", "add", "-b", "feature/archive", str(work))
        self.dirty(work)
        before = self.state(work)
        result = self.run_cmd(WT, "archive", "--foreground", "--no-hooks", "-D", cwd=work)
        self.assertIn(b"Saved snapshot: refs/snapshots/feature/archive/", result.stderr)
        self.assertFalse(work.exists())
        self.assertNotIn(b"refs/heads/feature/archive", self.git("for-each-ref", "--format=%(refname)", "refs/heads"))
        ref = self.git("for-each-ref", "--format=%(refname)", "refs/snapshots/feature/archive/").decode()
        recovered = self.restore(ref)
        self.assertEqual(before, self.state(recovered))
        self.assertTrue((recovered / "new\nfile").exists())

    def test_archive_forwards_options_and_retains_ref_on_remove_failure(self):
        work = self.base / "work"
        self.git("worktree", "add", "-b", "feature", str(work))
        self.dirty(work)
        before = self.state(work)
        fake = self.bin / "wt"
        fake.write_text('#!/usr/bin/env python3\nimport json,sys\nfrom pathlib import Path\nPath("remove-args.json").write_text(json.dumps(sys.argv[1:]))\nsys.exit(23)\n')
        fake.chmod(0o755)
        result = self.run_cmd("wt-archive", "--foreground", "--format=json", "--no-delete-branch", cwd=work, check=False)
        self.assertEqual(result.returncode, 23)
        import json
        self.assertEqual(json.loads((work / "remove-args.json").read_text()),
                         ["remove", "--foreground", "--format=json", "--no-delete-branch", "--", str(work)])
        self.assertEqual(self.git("diff", "HEAD", cwd=work), b"")
        self.assertFalse((work / "new\nfile").exists())
        self.assertTrue((work / ".env").exists())
        ref = self.git("for-each-ref", "--format=%(refname)", "refs/snapshots/").decode()
        self.assertEqual(before, self.state(self.restore(ref)))

    def test_snapshot_failure_does_not_clean_or_remove(self):
        work = self.base / "work"
        self.git("worktree", "add", "-b", "feature", str(work))
        self.dirty(work)
        before = self.state(work)
        # A namespace collision makes update-ref fail after objects are written.
        self.git("update-ref", "refs/snapshots", "HEAD")
        result = self.run_cmd("wt-archive", cwd=work, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(before, self.state(work))

    def test_archive_rejects_other_targets_and_primary_before_snapshot(self):
        for args in ((), ("another-branch",), ("-C", "/tmp")):
            result = self.run_cmd("wt-archive", *args, check=False)
            self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git("for-each-ref", "refs/snapshots/"), b"")

    def test_clean_worktree_snapshot_retains_head(self):
        ref = self.git("snapshot").decode()
        self.assertEqual(self.git("rev-parse", ref + "^1"), self.git("rev-parse", "HEAD"))
        self.assertEqual(self.state(self.restore(ref)), self.state(self.repo))

    def test_nested_repository_and_sparse_entries_are_rejected(self):
        nested = self.repo / "nested"
        nested.mkdir()
        self.git("init", cwd=nested)
        result = self.run_cmd("git", "snapshot", check=False)
        self.assertNotEqual(result.returncode, 0)
        shutil.rmtree(nested)
        self.git("update-index", "--skip-worktree", "tracked")
        result = self.run_cmd("git", "snapshot", check=False)
        self.assertNotEqual(result.returncode, 0)

    def test_staged_deletion_recreated_on_disk_roundtrips(self):
        self.git("rm", "tracked")
        (self.repo / "tracked").write_text("recreated untracked\n")
        before = self.state(self.repo)
        ref = self.git("snapshot").decode()
        recovered = self.restore(ref)
        self.assertEqual(before, self.state(recovered))
        self.assertEqual((recovered / "tracked").read_text(), "recreated untracked\n")

    def test_index_only_added_file_is_not_in_snapshot(self):
        (self.repo / "added").write_text("staged\n")
        self.git("add", "added")
        (self.repo / "added").unlink()
        before = self.state(self.repo)
        ref = self.git("snapshot").decode()
        self.assertEqual(before, self.state(self.restore(ref)))


    def test_assume_unchanged_still_captures_disk_contents(self):
        self.git("update-index", "--assume-unchanged", "tracked")
        (self.repo / "tracked").write_text("actual disk contents\n")
        ref = self.git("snapshot").decode()
        self.assertEqual((self.restore(ref) / "tracked").read_text(), "actual disk contents\n")

    def test_snapshots_survive_reflog_expiry_and_gc(self):
        (self.repo / "tracked").write_text("first\n")
        first = self.git("snapshot").decode()
        (self.repo / "tracked").write_text("second\n")
        second = self.git("snapshot").decode()
        self.git("reflog", "expire", "--expire=now", "--all")
        self.git("gc", "--prune=now")
        self.assertEqual(self.git("show", first + ":tracked"), b"first")
        self.assertEqual(self.git("show", second + ":tracked"), b"second")

    def test_literal_paths_broken_symlinks_and_executable_bits(self):
        (self.repo / ":(glob)*").write_text("literal pathspec\n")
        (self.repo / "broken-link").symlink_to("missing")
        (self.repo / "executable").write_text("#!/bin/sh\n")
        (self.repo / "executable").chmod(0o755)
        before = self.state(self.repo)
        ref = self.git("snapshot").decode()
        self.assertEqual(before, self.state(self.restore(ref)))

    def test_conflicted_index_and_submodules_are_refused(self):
        blob = self.git("rev-parse", "HEAD:tracked").decode()
        result = subprocess.run(
            ["git", "update-index", "--index-info"], cwd=self.repo, env=self.env,
            input=f"0 {'0' * 40}\ttracked\n100644 {blob} 1\ttracked\n".encode(),
            capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotEqual(self.run_cmd("git", "snapshot", check=False).returncode, 0)
        self.git("reset", "--hard", "HEAD")
        self.git("update-index", "--add", "--cacheinfo",
                 "160000," + self.git("rev-parse", "HEAD").decode() + ",submodule")
        self.assertNotEqual(self.run_cmd("git", "snapshot", check=False).returncode, 0)
        self.assertEqual(self.git("for-each-ref", "refs/snapshots/"), b"")

    def test_locked_worktree_is_not_archived(self):
        work = self.base / "work"
        self.git("worktree", "add", "-b", "locked", str(work))
        self.dirty(work)
        before = self.state(work)
        self.git("worktree", "lock", str(work))
        result = self.run_cmd("wt-archive", cwd=work, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(before, self.state(work))
        self.assertEqual(self.git("for-each-ref", "refs/snapshots/"), b"")

    def test_change_after_ref_publication_prevents_cleanup(self):
        import shlex
        work = self.base / "work"
        self.git("worktree", "add", "-b", "changing", str(work))
        self.dirty(work)
        real_git = shutil.which("git")
        fake = self.bin / "git"
        fake.write_text(
            '#!/bin/sh\n' + shlex.quote(real_git) + ' "$@"\n'
            'code=$?\n'
            'if [ "$1" = update-ref ] && [ "$code" = 0 ]; then\n'
            '  printf "concurrent edit\\n" > tracked\nfi\nexit "$code"\n')
        fake.chmod(0o755)
        result = self.run_cmd("wt-archive", cwd=work, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"no cleanup performed", result.stderr)
        self.assertEqual((work / "tracked").read_text(), "concurrent edit\n")
        self.assertTrue((work / "new\nfile").exists())
        self.assertTrue(self.git("for-each-ref", "refs/snapshots/"))

if __name__ == "__main__":
    unittest.main()

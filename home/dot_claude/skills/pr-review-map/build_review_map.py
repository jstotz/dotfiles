"""Builds a PR review map page from a groups file.

Usage:
  python3 -I build_review_map.py --repo OWNER/NAME --pr NUMBER \
      --groups groups.json --out-dir DIR

Fetches the PR's changed files from GitHub (with `gh`), checks that the groups
file accounts for every one of them, and writes DIR/review-map.html (to publish
as an Artifact) and DIR/groups-by-file.json (which groups each file is in, for
marking files viewed later).

groups.json:
{
  "title": "optional page heading; defaults to the PR title",
  "groups": [
    {
      "id": "rename",                      // letters, digits, - and _ only
      "title": "Rename test tools to internal tools",
      "summary": "HTML allowed",
      "look": ["HTML allowed", "..."],     // what to look for
      "snippets": [{"file": "path", "lang": "ts|tsx|diff|sql|json|...", "code": "..."}],
      "files": ["path", "..."]
    }
  ],
  "closeRead": [{"path": "path", "why": "one sentence"}]
}
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

TEMPLATE = Path(__file__).with_name("template.html")


def gh_json(*args):
    out = subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout
    return out


def fetch_pr(repo, number):
    meta = json.loads(gh_json("pr", "view", str(number), "--repo", repo, "--json", "title,url"))
    # `gh pr view --json files` stops at 100 files; the REST endpoint pages.
    lines = gh_json(
        "api", "--paginate", f"repos/{repo}/pulls/{number}/files",
        "--jq", '.[] | [.filename, .status, .additions, .deletions, (.previous_filename // "")] | @tsv',
    ).splitlines()
    files = []
    for line in lines:
        path, status, add, dele, prev = (line.split("\t") + [""])[:5]
        files.append({"path": path, "status": status, "add": int(add), "del": int(dele), "prev": prev})
    return meta, files


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--pr", required=True, type=int)
    parser.add_argument("--groups", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()

    spec = json.loads(Path(args.groups).read_text())
    meta, files = fetch_pr(args.repo, args.pr)
    by_path = {f["path"]: f for f in files}
    url = meta["url"]
    for f in files:
        f["url"] = f"{url}/files#diff-{hashlib.sha256(f['path'].encode()).hexdigest()}"

    problems = []
    ids = [g["id"] for g in spec["groups"]]
    for gid in ids:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", gid):
            problems.append(f"group id {gid!r} may only use letters, digits, - and _")
    if len(set(ids)) != len(ids):
        problems.append("group ids must be unique")

    membership = {}
    for g in spec["groups"]:
        for path in g["files"]:
            if path not in by_path:
                problems.append(f"{g['id']}: {path} isn't in the PR")
            membership.setdefault(path, []).append(g["id"])
    close_read = spec.get("closeRead", [])
    for item in close_read:
        if item["path"] not in by_path:
            problems.append(f"closeRead: {item['path']} isn't in the PR")
        if item["path"] in membership:
            problems.append(f"{item['path']} is in close-read and in {membership[item['path']]}; keep close-read files out of groups")
    covered = set(membership) | {i["path"] for i in close_read}
    for path in by_path:
        if path not in covered:
            problems.append(f"unplaced: {path}")
    if problems:
        print("\n".join(problems), file=sys.stderr)
        sys.exit(1)

    data = {
        "pr": url,
        "repo": args.repo,
        "number": args.pr,
        "title": spec.get("title") or meta["title"],
        "total": len(files),
        "groups": [
            {
                "id": g["id"],
                "title": g["title"],
                "summary": g["summary"],
                "look": g.get("look", []),
                "snippets": g.get("snippets", []),
                "files": [by_path[p] for p in sorted(g["files"])],
            }
            for g in spec["groups"]
        ],
        "closeRead": [{**by_path[i["path"]], "why": i["why"]} for i in close_read],
        "membership": membership,
    }

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    page = (
        TEMPLATE.read_text()
        .replace("__PAGE_TITLE__", f"PR {args.pr} Review Map")
        .replace("__DATA__", json.dumps(data).replace("</", "<\\/"))
    )
    (out / "review-map.html").write_text(page)
    (out / "groups-by-file.json").write_text(json.dumps(membership, indent=1))

    shared = sum(1 for v in membership.values() if len(v) > 1)
    for g in data["groups"]:
        print(f"{g['id']:24} {len(g['files']):4} files")
    print(f"{'close read':24} {len(close_read):4} files")
    print(f"{len(files)} files in the PR, all placed; {shared} in more than one group")


if __name__ == "__main__":
    main()

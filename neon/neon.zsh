#!/bin/zsh

# neon-open - open a Neon branch database in the local SQL GUI
# Defaults to the preview branch for the current git branch.
# Requires NEON_PROJECT_ID and NEON_DB_NAME (e.g. set via direnv).
neon-open() {
  local branch="${1:-preview/$(git rev-parse --abbrev-ref HEAD)}"
  local url
  url="$(neon connection-string "$branch" \
        --project-id "$NEON_PROJECT_ID" \
        --database-name "$NEON_DB_NAME" \
        --role-name neondb_owner)" || return 1

  # Beekeeper's handler is registered on `postgres:`
  url="${url/postgresql:\/\//postgres://}"

  # workaround for the cold-start bug
  if ! pgrep -f "Beekeeper Studio" >/dev/null; then
    open -a "Beekeeper Studio"
    until pgrep -f "Beekeeper Studio" >/dev/null; do sleep 0.3; done
    sleep 2   # let the renderer finish booting
  fi

  open -a "Beekeeper Studio" "$url"
}

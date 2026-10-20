#!/bin/bash
# Create one git worktree + branch per workstream, each with an APFS-cloned node_modules.
set -e
cd "$HOME/gits/amplifi-quotes"
git add -A && git commit -qm "Test fixtures (signIn/team), requirement coverage gate" || true
for ws in engine auth data comms integrations hosted platform docview; do
  dir="$HOME/gits/aq-wt-$ws"
  if [ ! -d "$dir" ]; then
    git worktree add -q "$dir" -b "ws-$ws"
    cp -cR node_modules "$dir/node_modules"
  fi
  echo "$ws -> $dir ($(git -C "$dir" rev-parse --short HEAD))"
done
git worktree list

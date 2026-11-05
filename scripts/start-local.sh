#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -x "$HOME/.local/share/labnote/node24/bin/node" ]]; then
  export PATH="$HOME/.local/share/labnote/node24/bin:$PATH"
fi
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != 24 ]]; then
  echo 'Node.js 24 LTSで実行してください。' >&2
  exit 1
fi
exec npm run start -- "$@"

#!/usr/bin/env bash
# Run a command with secrets from curation/.env, failing if any named one is
# missing or blank. Name each secret before `--`, so every call shows what it needs:
#
#   bash curation/with-secrets.sh GEMINI_API_KEY -- python .claude/skills/nano-banana-pro/scripts/generate.py …
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/.env"

# Collect required var names up to the `--` separator.
req=()
while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do req+=("$1"); shift; done
[ "${1:-}" = "--" ] && shift || true

if [ "${#req[@]}" -eq 0 ] || [ "$#" -eq 0 ]; then
  echo "usage: with-secrets.sh VAR [VAR...] -- command [args...]" >&2
  exit 2
fi

# Load .env into the environment (values may be quoted; KEY=VALUE per line).
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# Verify each required secret is present and non-empty.
missing=()
set +u
for v in "${req[@]}"; do
  if [ -z "${!v}" ]; then missing+=("$v"); fi
done
set -u
if [ "${#missing[@]}" -gt 0 ]; then
  echo "ERROR: missing required secret(s): ${missing[*]}" >&2
  echo "Add them to $ENV_FILE (template: ${ENV_FILE}.example)." >&2
  exit 1
fi

exec "$@"

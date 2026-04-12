#!/bin/bash
# Pre-commit quality checks — runs lint and typecheck before allowing commit
# Called by Claude Code PreToolUse hook on git commit

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

echo "Running lint..." >&2
if ! pnpm --dir "$PROJECT_DIR" lint 2>&1; then
  echo "BLOCKED: Lint failed. Fix lint errors before committing." >&2
  exit 2
fi

echo "Running typecheck..." >&2
if ! pnpm --dir "$PROJECT_DIR" typecheck 2>&1; then
  echo "BLOCKED: Typecheck failed. Fix type errors before committing." >&2
  exit 2
fi

echo "Pre-commit checks passed." >&2
exit 0

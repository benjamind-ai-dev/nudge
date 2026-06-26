#!/bin/bash
# Pre-commit quality checks — runs lint and typecheck before allowing commit
# Called by Cursor PreToolUse hook on git commit
# Must output JSON: {"decision": "allow"|"block", "reason": "..."}

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

echo "Running lint..." >&2
if ! pnpm --dir "$PROJECT_DIR" lint >&2 2>&1; then
  echo '{"decision": "block", "reason": "Lint failed. Fix lint errors before committing."}'
  exit 0
fi

echo "Running typecheck..." >&2
if ! pnpm --dir "$PROJECT_DIR" typecheck >&2 2>&1; then
  echo '{"decision": "block", "reason": "Typecheck failed. Fix type errors before committing."}'
  exit 0
fi

echo "Pre-commit checks passed." >&2
echo '{"decision": "allow", "reason": "Pre-commit checks passed"}'
exit 0

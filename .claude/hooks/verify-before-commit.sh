#!/bin/bash
# Pre-commit verification hook for Claude Code.
# Intercepts git commit commands and blocks them so the user can review changes.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check if this is a git commit command
if echo "$COMMAND" | grep -qE '^\s*git commit|&&\s*git commit'; then
  echo "🔍 Review the staged changes before approving this commit." >&2
  exit 2  # Block — user must approve
fi

exit 0

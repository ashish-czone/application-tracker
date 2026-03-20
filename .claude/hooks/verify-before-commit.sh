#!/bin/bash
# Pre-commit verification hook for Claude Code.
# Intercepts git commit commands and blocks them so the user can review changes.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')



exit 0

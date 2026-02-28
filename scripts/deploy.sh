#!/usr/bin/env bash
# deploy.sh — copy ml-claude-infra into a target project directory
#
# Usage:
#   ./scripts/deploy.sh <target-dir> [--skills skill1,skill2,...|--all] [--with-tests] [--include-meta]
#
# Examples:
#   ./scripts/deploy.sh ~/Repos/my-project --all
#   ./scripts/deploy.sh ~/Repos/my-project --skills python-project-standards,fastapi-patterns,test-first-patterns
#   ./scripts/deploy.sh ~/Repos/my-project --all --with-tests
#   ./scripts/deploy.sh ~/Repos/my-project --all --include-meta

set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$INFRA_DIR/.claude/skills"

ALL_SKILLS=(
  python-project-standards
  fastapi-patterns
  htmx-frontend
  ml-data-handling
  multimodal-router
  langgraph-patterns
  rag-vector-db
  nlp-slm-patterns
  predictive-analytics
  infra-yandex-cloud
  test-first-patterns
  github-actions
  design-doc-creator
  skill-developer
)

print_usage() {
  echo "Usage: $0 <target-dir> [--skills skill1,skill2,...|--all] [--with-tests]"
  echo ""
  echo "Available skills:"
  for s in "${ALL_SKILLS[@]}"; do echo "  - $s"; done
}

TARGET_DIR=""
SELECTED_SKILLS=()
USE_ALL=false
WITH_TESTS=false
INCLUDE_META=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      USE_ALL=true
      shift
      ;;
    --skills)
      IFS=',' read -ra SELECTED_SKILLS <<< "$2"
      shift 2
      ;;
    --with-tests)
      WITH_TESTS=true
      shift
      ;;
    --include-meta)
      INCLUDE_META=true
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      if [[ -z "$TARGET_DIR" ]]; then
        TARGET_DIR="$1"
      else
        echo "ERROR: unexpected argument '$1'" >&2
        print_usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$TARGET_DIR" ]]; then
  echo "ERROR: target directory is required" >&2
  print_usage
  exit 1
fi

if [[ "$USE_ALL" == false && ${#SELECTED_SKILLS[@]} -eq 0 ]]; then
  echo "ERROR: specify --all or --skills <list>" >&2
  print_usage
  exit 1
fi

if [[ "$USE_ALL" == true ]]; then
  SELECTED_SKILLS=("${ALL_SKILLS[@]}")
fi

echo ""
echo "=== ml-claude-infra deploy ==="
echo "Source       : $INFRA_DIR"
echo "Target       : $TARGET_DIR"
echo "Skills       : ${SELECTED_SKILLS[*]}"
echo "Tests        : $WITH_TESTS"
echo "Include meta : $INCLUDE_META"
echo ""

mkdir -p "$TARGET_DIR"

echo "[1/5] Copying hooks..."
mkdir -p "$TARGET_DIR/.claude/hooks"
cp "$INFRA_DIR/.claude/hooks/skill-activation-prompt.js" "$TARGET_DIR/.claude/hooks/"
cp "$INFRA_DIR/.claude/hooks/skill-activation-logic.js"  "$TARGET_DIR/.claude/hooks/"
cp "$INFRA_DIR/.claude/hooks/python-quality-check.sh"    "$TARGET_DIR/.claude/hooks/"
cp "$INFRA_DIR/.claude/hooks/post-tool-use-tracker.sh"   "$TARGET_DIR/.claude/hooks/"
cp "$INFRA_DIR/.claude/hooks/README.md"                  "$TARGET_DIR/.claude/hooks/"

echo "[2/5] Copying agents..."
mkdir -p "$TARGET_DIR/.claude/agents"
cp "$INFRA_DIR/.claude/agents/"*.md "$TARGET_DIR/.claude/agents/"

echo "[3/5] Copying commands..."
mkdir -p "$TARGET_DIR/.claude/commands"
cp "$INFRA_DIR/.claude/commands/"*.md "$TARGET_DIR/.claude/commands/"

echo "[4/5] Copying selected skills..."
mkdir -p "$TARGET_DIR/.claude/skills"

RULE_ENTRIES=()
PRIORITY=1

for skill in "${SELECTED_SKILLS[@]}"; do
  skill_src="$SKILLS_DIR/$skill"
  if [[ ! -d "$skill_src" ]]; then
    echo "  WARN: skill '$skill' not found, skipping" >&2
    continue
  fi
  echo "  + $skill"
  cp -r "$skill_src" "$TARGET_DIR/.claude/skills/"
  PRIORITY=$((PRIORITY + 1))
done

echo "[4b/5] Generating skill-rules.json for selected skills..."
GENERATE_ARGS=()
if [[ "$INCLUDE_META" == false ]]; then
  GENERATE_ARGS+=("--exclude-optional")
fi
python "$INFRA_DIR/scripts/generate_skill_rules.py" \
  "${GENERATE_ARGS[@]}" \
  "$INFRA_DIR/.claude/skills/skill-rules.json" \
  "$TARGET_DIR/.claude/skills/skill-rules.json" \
  "${SELECTED_SKILLS[@]}"

echo "[5/5] Creating dev/status.md from template..."
if [[ ! -f "$TARGET_DIR/dev/status.md" ]]; then
  mkdir -p "$TARGET_DIR/dev"
  cp "$INFRA_DIR/templates/status.md" "$TARGET_DIR/dev/status.md"
  echo "  Created dev/status.md from template"
else
  echo "  dev/status.md already exists, skipping"
fi

if [[ "$WITH_TESTS" == true ]]; then
  echo "[+] Copying test suite..."
  mkdir -p "$TARGET_DIR/tests"
  cp -r "$INFRA_DIR/tests/hook"     "$TARGET_DIR/tests/"
  cp -r "$INFRA_DIR/tests/fixtures" "$TARGET_DIR/tests/"
  cp -r "$INFRA_DIR/tests/infra"    "$TARGET_DIR/tests/"
  cp    "$INFRA_DIR/package.json"   "$TARGET_DIR/"
fi

echo ""
echo "=== Done! ==="
echo ""
echo "Next steps:"
echo "  1. Edit $TARGET_DIR/dev/status.md — fill in your project's goal"
echo "  2. Copy .claude/CLAUDE.md from this repo or write your own"
echo "  3. If --with-tests: run 'npm install && npm run test:hook' in $TARGET_DIR"
echo "  4. Start Claude Code in $TARGET_DIR and type a prompt — skills will activate"
echo ""

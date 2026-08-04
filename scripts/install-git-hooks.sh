#!/bin/sh
# Installs the local git hooks this repo relies on. Runs automatically via
# the "prepare" npm/pnpm lifecycle script (fresh clone, `pnpm install`, CI),
# so a wiped .git/hooks directory (new machine, fresh clone) always self-heals
# instead of silently losing the hook.
#
# pre-commit: regenerates the SigMap context block (CLAUDE.md +
# .github/copilot-instructions.md) and stages it BEFORE the commit is made,
# so the generated signature block always lands in the same commit as the
# code it describes. A post-commit hook can't do this — by the time it runs,
# the commit already exists, so the fresh regen is always left dirty in the
# working tree. See CLAUDE.md → "Versiyonlama Kuralı" section context
# (2026-08-04 migration from post-commit to pre-commit).

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "[install-git-hooks] not a git repo — skipping" >&2
  exit 0
fi

HOOK_DIR="$REPO_ROOT/.git/hooks"
mkdir -p "$HOOK_DIR"

# Remove a legacy sigmap post-commit hook if present — it fights with the
# pre-commit hook below (both would regenerate, leaving the tree dirty again).
if [ -f "$HOOK_DIR/post-commit" ] && grep -q 'gen-context.js\|sigmap' "$HOOK_DIR/post-commit" 2>/dev/null; then
  rm -f "$HOOK_DIR/post-commit"
fi

cat > "$HOOK_DIR/pre-commit" <<'HOOK'
#!/bin/sh
# Regenerate SigMap context (CLAUDE.md + .github/copilot-instructions.md) and
# stage the result BEFORE the commit is made. Installed by
# scripts/install-git-hooks.sh — do not hand-edit, it is overwritten on
# every `pnpm install`.
npx --yes sigmap --generate 2>/dev/null || true
git add CLAUDE.md .github/copilot-instructions.md 2>/dev/null || true
HOOK
chmod +x "$HOOK_DIR/pre-commit"

echo "[install-git-hooks] pre-commit hook installed"

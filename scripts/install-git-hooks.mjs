#!/usr/bin/env node
// Cross-platform (Node) rewrite of the git-hook installer. Runs automatically
// via the "prepare" npm/pnpm lifecycle script (fresh clone, `pnpm install`, CI,
// AND install/wizard.mjs's dependency-install step on end-customer machines).
//
// Why Node and not `sh scripts/install-git-hooks.sh` directly: on Windows,
// `sh` is not guaranteed to be on PATH (a silent `winget install Git.Git` does
// not add Git's usr/bin to PATH by default), so invoking it as the lifecycle
// command itself made `pnpm install` fail/hang mid-install — before the
// on-prem installer ever got to the PostgreSQL step. This script uses only
// Node's fs/child_process APIs, so it works identically on every OS. The
// generated pre-commit hook body is still `#!/bin/sh` — that's fine, Git for
// Windows bundles its own sh.exe and always uses it to run hooks regardless
// of PATH, so hook *execution* was never the problem, only hook *installation*.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

const root = repoRoot();
if (!root) {
  console.error('[install-git-hooks] not a git repo — skipping');
  process.exit(0);
}

const hookDir = join(root, '.git', 'hooks');
mkdirSync(hookDir, { recursive: true });

// Remove a legacy sigmap post-commit hook if present — it fights with the
// pre-commit hook below (both would regenerate, leaving the tree dirty again).
const postCommitPath = join(hookDir, 'post-commit');
if (existsSync(postCommitPath)) {
  try {
    const contents = readFileSync(postCommitPath, 'utf-8');
    if (/gen-context\.js|sigmap/.test(contents)) rmSync(postCommitPath);
  } catch { /* yut */ }
}

const preCommitPath = join(hookDir, 'pre-commit');
const hookBody = `#!/bin/sh
# Regenerate SigMap context (CLAUDE.md + .github/copilot-instructions.md) and
# stage the result BEFORE the commit is made. Installed by
# scripts/install-git-hooks.mjs — do not hand-edit, it is overwritten on
# every \`pnpm install\`.
npx --yes sigmap --generate 2>/dev/null || true
git add CLAUDE.md .github/copilot-instructions.md 2>/dev/null || true
`;
writeFileSync(preCommitPath, hookBody);
try { chmodSync(preCommitPath, 0o755); } catch { /* Windows: dosya izinleri kavramı yok, atlanır */ }

console.log('[install-git-hooks] pre-commit hook installed');

# Vault backfill

- Date: 2026-11-15 14:30 -05:00 (America/Toronto).
- Agent: Codex, integrating domain reviews for Conditioning and Strength, Home and Nutrition, and Settings, Skills and SQLite.
- Branch and baseline: `main` at `e492e06`. Work began at `09346ce`. The branch advanced to `e492e06` concurrently before any vault notes were written.
- Scope: backfill project memory from reachable Git history, all eight Feature Tree datasets, current and archived source, engineering docs, and the original app logo handoff. Applicable instructions are `AGENTS.md` and `.cursor/rules/`, especially `caps-obsidian.mdc`, `three-brained-system.mdc`, and `feature-tree.mdc`.

## What landed

- [[Index]] routes tasks to linked architecture and feature notes. [[Project History]] explains major changes and historical branches. [[Git Commit Index]] covers each of the 196 reachable commits in the baseline inventory. [[Feature Tree Crosswalk]] maps all 118 node anchors and their 248 versions.
- Updated the root protocol and two Cursor rules to point to the same root vault and entry note. `e492e06` establishes the root placement; it supersedes earlier notes about the old paths.
- Pre-existing deletions in `.cursor/caps-obsidian/` and the untracked `.cursor/caps-vault/` settings and empty entry note were present before the backfill. Those paths are outside this change. The substantive old handoff is accessible at [[2026-11-10 App Logo Handoff]]. Domain review ownership ended with this handoff.

## Verification and follow-through

- A read-only inventory check validated all 26 notes are reachable from the index and resolved 447 wikilinks, 125 local Markdown file links, 118 tree anchors, 248 versions, and all 196 Git hashes from the baseline refs.
- `npm run typecheck`, `npm run verify:nutrition`, `npm run verify:conditioning`, and `npm run feature-tree -- --check` passed. The domain scripts emitted Node experimental/module-type warnings. The tree checker validates the stored data. It does not check whether the bundled commit list is up to date.
- `npm run lint` reported 25 existing errors in app source and Feature Tree scripts, including undefined `CAPS` globals in tree data and React Hooks diagnostics. The backfill adds Markdown only. Native device/GPS/camera behavior, live providers, and archived branch tests were outside this audit.
- Feature Tree synchronization was unnecessary for the vault backfill. The checker passed on all eight existing trees. The commit snapshot and the site's `uncommitted` marker predate this audit. Existing source-versus-tree differences are tracked in [[Settings]] (feedback preferences), [[Home]] and [[Weight and Sleep Logging]] (Quick Log and nightly defaults), and [[Conditioning Execution]] and [[Conditioning Records]] (structured distance and upload wiring). Those notes carry the evidence to use when those areas are next updated.
- For the next feature task, start at [[Index]], open the applicable notes and tree node, and verify the current source and working changes. When working on SQLite, consult the divergent migration histories in [[Data and Persistence]] before using an archived database file.

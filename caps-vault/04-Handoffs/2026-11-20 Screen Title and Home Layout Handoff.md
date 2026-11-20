# Main-screen titles and Home layout

20 November 2026, 16:56 EST (America/Toronto). Codex on main. Scope: uniform title cards across five main screens plus requested Home copy and spacing changes. Followed AGENTS.md, applicable Cursor rules, React Native patterns and Expo overview/design-system skills. Canonical notes: [[UI and Interaction Decisions]], [[Home]].

## Completed

- 43eab3a: extracted Strength's banner into src/components/ScreenTitleCard.tsx; Screen delegates to it for Home/Nutrition; Strength, Conditioning and Skill render it directly. Removed duplicate banner styles and centered-title variant. Shared header is explicitly requested by user despite the style guide's default screen-local wrapper policy. Accent retains theme tertiary color (red by default).
- 548bbe5: Home removes its centered-title prop, renames Athlete Information / Height, removes discipline count and lets Age/Height each flex to half the stat row. Quick Log removes collapsed parent gap and uses matching 12px top/bottom expanded spacing. Grid height is two 92px rows plus an 8px row gap and 12px top padding.
- Updated canonical vault notes and architecture/home Feature Tree node histories. Existing historical Quick Log overlay guardrail disagrees with current in-flow implementation; this task preserves current animation behavior and adjusts spacing only.

## Verification and limits

- npm run typecheck: passed.
- Targeted npx eslint on all seven changed TSX files: passed.
- npm run feature-tree -- --check: passed, 13 existing unmapped historical/documentation commit warnings; no schema errors. Regenerated commits.js. Local Feature Tree synchronization complete; no separate publication endpoint is documented.
- No device/simulator visual or interaction test performed. Next: inspect all five headers in light/dark modes and Quick Log collapsed/expanded on device, including larger text sizes.

## Ownership

All task source changes committed in the two hashes above. Vault and tree updates belong to this session. Existing Obsidian deletions, general-rules changes, vault Index rename, history/backfill edits and untracked Obsidian files belong to prior/user work and were preserved. caps-vault/00-Index.md is absent in the user's current changes; used caps-vault/Index.md. No other agent was delegated work.

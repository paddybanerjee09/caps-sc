# Compact Strength table

- Updated 2026-11-26 23:17 -05:00 (America/Toronto), Codex `/root` with delegated editor, history and verification work.
- Branch `Skill/Conditioning/Strength-Changes`, starting revision `0af0c8f`. Compact rows at `d623f0d`, text focus at `6da0ee2`, and effort defaults at `7f7e3ea`. Existing workspace edits were preserved. The working vault index is `caps-vault/Index.md`.
- The user asked for no-wrap, single-line exercise rows with compact inline rest throughout Strength. They also asked to hide the bottom bar during text entry and start the effort wheels at RPE 10 and RIR 0. This supersedes the prior placement of rest below the effort fields. See [[Strength]], [[2026-11-26 Strength Plan Completion Handoff]] and the UI guide.

## Implementation

- `src/components/strength/ExerciseTable.tsx` uses compact exercise and set rows, a single inline rest field, concise column labels and a horizontally scrollable fallback for smaller widths or larger text. It preserves touch wheels, the anchored rep-range overlay and inline actual expansion. `src/components/ScrollPicker.tsx` reduces the Strength wheel height and orders accessibility steps by numeric direction.
- `src/screens/strength/StrengthSessionDetailScreen.tsx` uses the same column measurements for read-only history. Tap the exercise to reveal one line per actual set. Earlier logged records retain their aggregate values and load context.
- `WorkoutBuilderScreen` and `StrengthWorkspaceContext` track text focus across title, search, rest, notes and set inputs. While focused, the action footer and `AppNavigator` tab strip hide. Header Done, blur, and keyboard dismissal restore both. The editor releases focus when leaving through its existing guards.
- New target rows start at RPE 10 and RIR 0. Saved workout targets retain their values and optional actual effort fields stay blank when opened. No schema change.

## Verification and next steps

- The integrated TypeScript check, scoped ESLint and whitespace checks passed. `npm run verify:strength` passed with new exercise defaults, blank actual effort, retained saved values and legacy missing-value coverage.
- Native acceptance remains pending. The isolated read-only Android emulator failed before ADB connected because Windows had less commit headroom than the guest's 4096 MB reservation, including on the reduced-memory retry. The isolated Metro Android bundle request timed out. See `work/strength-compact-qa/android-result.txt`. Follow-up coverage should measure a normal-width editor row, enter and dismiss text, and check an actual-set input in the completed flow.
- Feature Tree synchronized at `docs/feature-tree/strength.html`. The builder, Exercise Table and session detail versions map the compact rows, input focus and new defaults. Regeneration validated all eight trees with 29 existing unmapped history and documentation warnings.

Follow-up, 26 Nov 2026 at 23:50 EST on main. Commit b27e0fa increased column widths again and disabled shrinking of the scroll content and name cells. No Metro listener was detected on ports 8081–8089. Device rendering and the bundle used by the reported Expo session remain unverified.

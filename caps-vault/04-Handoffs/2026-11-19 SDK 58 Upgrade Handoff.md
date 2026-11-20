# SDK 58 dependency upgrade

19 November 2026, 23:39 EST (America/Toronto). Codex on `main`, starting at `cce3e7f`. Scope: resolve the user's failed `npx expo install --fix` after moving from SDK 57 to 58. Followed `AGENTS.md`, global Cursor rules, Expo overview/upgrade skills, and React Native patterns. Canonical context: [[App Architecture]], [[2026-11-16 Repository Refactor Handoff]].

## Changes and evidence

- The user already changed dependency versions in `package.json` and partially updated `package-lock.json`. npm 11.16.0 encountered datetimepicker 9.1.0 in the old graph while replacing it with the correct SDK 58 version, 9.2.1. It attempted the optional `react-native-windows@0.85.2` peer, whose RN `^0.85.0` requirement conflicts with SDK 58's 0.88.1. The Windows package was not a direct dependency or present in the old lockfile.
- Verified an independent resolution from the user's manifest with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` in a temporary directory. It passed without force/legacy-peer-deps. Preserved the user's initial package files as `package.before.json` and `package-lock.before.json` under `C:/Users/paddy/AppData/Local/Temp/caps-sdk58-resolution-3284609cf2264e95b0f6e28a634f6551`, then used the freshly generated lockfile in the project and reran `npx expo install --fix` successfully. No persistent npm configuration workaround was introduced.
- Installed Expo 58.0.26, React 19.3.0, RN 0.88.1, datetimepicker 9.2.1, and the Expo-recommended native dependencies. Expo also updated `@types/react` and `eslint-config-expo`. Preserved the user's existing `@expo/ngrok` addition.
- `npx expo install expo-font expo-asset` declared required native peers directly and added their config plugins. Doctor requested these for vector icons and audio. Removed `android.edgeToEdgeEnabled` from `app.json` because SDK 58's schema rejects it.
- RN's strict types require `ScrollViewInstance` in `src/components/DayTimeline.tsx` and `undefined` for inactive `ListEmptyComponent` props in the Strength and Skill hubs. Removed the deleted `StatusBar.backgroundColor` prop in `src/navigation/AppNavigator.tsx`; the surrounding root already supplies the theme background. No navigation, logging, database, or layout redesign.

## Verification

- `npx expo install --fix`: passed, including both npm install phases.
- `npx expo install --check`: final recheck passed, dependencies up to date.
- `npm run typecheck`: passed after the minimal strict API migration.
- Android Metro export: passed, 1,322 modules; output at `C:/Users/paddy/AppData/Local/Temp/caps-sdk58-export`. The previous handoff's `expo/internal/bundle-origin` failure no longer reproduces. This is bundling evidence, not a native/device test.
- Feature Tree data validation: passed, with 11 existing unmapped historical commit warnings. SDK upgrade is represented under `architecture:expo-sdk`.
- Initial Expo Doctor: 18/20, identifying the config and native-peer issues fixed above. Final `npx expo-doctor`: 20/20 passed.
- npm reports five moderate audit findings. No broad or breaking audit fix was run.

## Ownership and next steps

- This session owns only the dependency/config upgrade, four source compatibility edits, architecture note, this handoff/index link, and architecture Feature Tree upgrade entry. Existing Obsidian deletions, vault index rename, history/backfill edits, and global rule edits belong to prior/user work and remain untouched.
- `caps-vault/00-Index.md` is deleted in the existing working tree; used the user's `caps-vault/Index.md` instead. No replacement entry point created.
- No `ios/` or `android/` project folders exist; no prebuild cleanup was necessary.
- Next: smoke-test on SDK 58 Expo Go or rebuild a development client, especially date/time controls, icons, audio, camera, GPS/background tasks, and the Strength/Skill empty lists. Native runtime behavior was not exercised here.
- The documented Feature Tree is the local static site in `docs/feature-tree/`; no separate external publishing endpoint is documented. Synchronization is through its data files and `npm run feature-tree`.

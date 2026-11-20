# App architecture

Source baseline `e492e06`. See the [Architecture tree](../../docs/feature-tree/architecture.html) or [[Feature Tree Crosswalk]] for component and version lookup.

## Bootstrap and providers

- `index.ts` imports `src/services/conditioningLocationTask.ts` before registering the app with Expo. Keep that import when changing bootstrap so the task is defined outside React.
- `src/App.tsx` nests `SafeAreaProvider` → `SQLiteProvider(caps.db, migrateDatabase)` → `AppThemeProvider` → `AppStateProvider` → `NutritionWorkspaceProvider` → `ConditioningWorkspaceProvider` → `AppNavigator`. The workspace providers outlive route changes. See [[Data and Persistence]], [[Nutrition]], and [[Conditioning]].
- `package.json` now targets Expo SDK 58 (installed Expo 58.0.26), React 19.3.0, and React Native 0.88.1. The November 19 upgrade regenerated the stale SDK 57 lockfile before running `npx expo install --fix`; resolving against the old lockfile incorrectly attempted the datetimepicker's optional Windows peer, which requires RN 0.85. No peer-check bypass or Windows dependency is needed. `expo-font` and `expo-asset` are direct native peer dependencies. See [[2026-11-19 SDK 58 Upgrade Handoff]] for verification and migration details. `app.json` configures SQLite, date/time picker, location and background/foreground services, barcode camera, and audio.

## Navigation and application state

- `src/navigation/routes.ts` defines tabs and sidebar routes. `src/screens/Screens.tsx` resolves the route to a screen. `AppNavigator.tsx` owns active route and drawer state, begins at Home, and renders the relevant Nutrition or Conditioning stack over its base screen. The custom navigation dates to `f0f5834`.
- Android hardware Back handles the sidebar first, then delegates to the active Nutrition, Conditioning, or Strength workspace. A returned `false` allows default handling. `AppNavigator` dismisses transient Nutrition UI when switching away.
- Since `2073f65`, bottom tabs, sidebar destinations, and Home’s request to open Nutrition use the same callback to set the route and close the sidebar.
- `src/state/AppStateContext.tsx` owns the in-memory username, profile, unit settings, audio and haptic flags, and timeline revision. Weight is derived from the latest stored weight event. Weight mutators refresh it from SQLite. Conditioning saves signal the Home timeline through `bumpTimeline()`. Theme selection is owned by `src/theme/ThemeContext.tsx`. See [[Settings]] for which controls persist.
- `2c0cfb4` changed the initial weight load effect to an explicit cancellable read with a functional profile update. Preserve cleanup and merge semantics when changing async hydration. Git shows that concrete change. The tree's more specific description of the original bug has limited evidence.

## Chrome and identity

- `Header.tsx`, `BottomTabs.tsx`, `Sidebar.tsx`, and `Screen.tsx` own shared navigation chrome. The header uses theme-specific CAPS marks from `assets/images/`; the launcher icon is independently set by `expo.icon` in `app.json`.
- `09346ce` installed the supplied 500 × 500 `assets/images/CAPS Logo v3.png` and removed the old launcher asset. The historical handoff reports byte-for-byte verification and a successful public Expo config resolution. Native launcher rendering was outside that check. See [[2026-11-10 App Logo Handoff]].

## Where to verify behavior

| Area | Entry point |
| --- | --- |
| Source and types | `npm run lint`, `npm run typecheck` |
| Conditioning and nutrition | `npm run verify:conditioning`, `npm run verify:nutrition`; assertion scope is in `scripts/verify-*.mjs` |
| Native behavior | Device or native development build for camera, route recording, permissions, and audio/haptic checks |
| Feature Tree | `docs/feature-tree/index.html`; read-only validation with `npm run feature-tree -- --check` |

The package scripts are those at the baseline above. The latest run results are in [[Handoffs]].

## Subscreen navigation audit (20 November 2026)

`WorkflowChrome.tsx` provides shared safe top bars and fixed bottom navigation. All four feature stacks use branch-wide X and depth-aware footer Cancel/Back. Home weight/sleep overlay its already-inset content with the same bars. Sidebar routes hide the global header, use `Screen.onClose/footer/right`, and return to the last main tab; Account/Athlete register close guards for hardware Back. See [[UI and Interaction Decisions]] and [[2026-11-20 UI Audit Review]].

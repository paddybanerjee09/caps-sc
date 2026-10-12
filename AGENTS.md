# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Local development

Expo SDK 57 needs Node.js 22.13 or newer. Install dependencies with `npm ci`.

- Dev server: `npx expo start --localhost --port 8081`. Readiness is `http://localhost:8081/status` (`packager-status:running`). Metro listens on IPv6 localhost, so use `localhost`, not `127.0.0.1`.
- Typecheck: `npm run typecheck`
- Nutrition path: `npm run verify:nutrition` (SQLite schema, meal logs, custom foods, and favourites; no network credentials)
- Bundle check without a phone or emulator: `npx expo export --platform android --output-dir /tmp/caps-android-export`
- Lint: `npm run lint`. A failing lint run is application code, not a missing toolchain.

This environment has no iOS Simulator or Android emulator. FatSecret typed search needs `FATSECRET_CLIENT_ID` and `FATSECRET_CLIENT_SECRET` for `node proxy/fatsecret-proxy.mjs`, plus `EXPO_PUBLIC_FATSECRET_PROXY_URL` (see `.env.example` and `docs/nutrition-providers.md`). Custom foods, favourites, and diary logs work without those secrets.

# Nutrition providers

Typed food search uses FatSecret. Barcode lookup uses Open Food Facts directly. USDA records already in the diary stay as stored snapshots and are not sent to either provider.

## FatSecret proxy

FatSecret credentials stay on a machine you control. The app only knows the proxy base URL.

1. Create a FatSecret Platform application and copy the client id and client secret.
2. From the repository root, start the proxy:

```sh
FATSECRET_CLIENT_ID=your-id FATSECRET_CLIENT_SECRET=your-secret node proxy/fatsecret-proxy.mjs
```

On Windows PowerShell:

```powershell
$env:FATSECRET_CLIENT_ID="your-id"
$env:FATSECRET_CLIENT_SECRET="your-secret"
node proxy/fatsecret-proxy.mjs
```

3. Set `EXPO_PUBLIC_FATSECRET_PROXY_URL` in `.env.local`. Use `http://127.0.0.1:8787` for a simulator on the same computer, or `http://10.0.2.2:8787` for the Android emulator. Restart Expo after changing it.

The proxy requests an OAuth2 client-credentials token with the `basic` scope, then allows only `foods.search` (at most 50 results) and `food.get.v5`. It does not accept arbitrary upstream URLs. Basic access cannot store FatSecret food names or nutrient values, so the diary keeps the food id and serving id and loads details again when a connection is available. If the proxy URL or credentials are missing, search shows a configuration message and custom foods, favourites, and existing diary entries still work.

Production hosting of this proxy is separate from the app and is not set up here.

## Open Food Facts

Barcode scans and typed barcodes call `https://world.openfoodfacts.org/api/v2/product/{barcode}.json` with a CAPS user agent. Product data is stored with the diary item because Open Food Facts data can be kept with attribution. Nutrition facts for those foods include “Product data from Open Food Facts”.

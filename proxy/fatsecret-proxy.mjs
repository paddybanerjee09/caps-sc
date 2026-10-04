import { createServer } from "node:http";
import { Buffer } from "node:buffer";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const clientId = process.env.FATSECRET_CLIENT_ID ?? "";
const clientSecret = process.env.FATSECRET_CLIENT_SECRET ?? "";
const tokenUrl = "https://oauth.fatsecret.com/connect/token";
const apiUrl = "https://platform.fatsecret.com/rest/server.api";
const timeoutMs = 8000;

let token = "";
let tokenExpiresAt = 0;

const server = createServer((request, response) => {
  void handle(request, response);
});

server.listen(port, host, () => {
  console.log(`FatSecret proxy listening on http://${host}:${port}`);
});

async function handle(request, response) {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);

    if (request.method !== "GET") {
      send(response, 405, { error: "method" });
      return;
    }

    if (!clientId || !clientSecret) {
      send(response, 503, { error: "not-configured" });
      return;
    }

    if (url.pathname === "/foods/search") {
      const query = url.searchParams.get("q")?.trim() ?? "";

      if (query.length < 1 || query.length > 80) {
        send(response, 400, { error: "invalid-query" });
        return;
      }

      const payload = await fatSecret("foods.search", {
        max_results: "50",
        page_number: "0",
        search_expression: query,
      });
      send(response, 200, payload);
      return;
    }

    if (url.pathname === "/foods/details") {
      const foodId = url.searchParams.get("food_id") ?? "";

      if (!/^\d+$/.test(foodId)) {
        send(response, 400, { error: "invalid-food" });
        return;
      }

      const payload = await fatSecret("food.get.v5", { food_id: foodId });
      send(response, 200, payload);
      return;
    }

    send(response, 404, { error: "not-found" });
  } catch (error) {
    const status = error instanceof ProxyError ? error.status : 502;
    send(response, status, {
      error: error instanceof ProxyError ? error.code : "upstream",
    });
  }
}

async function fatSecret(method, params) {
  const accessToken = await getToken();
  const url = new URL(apiUrl);
  url.searchParams.set("method", method);
  url.searchParams.set("format", "json");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (upstream.status === 429) {
    throw new ProxyError("rate-limit", 429);
  }

  const payload = await upstream.json();

  if (!upstream.ok || payload?.error) {
    const code = Number(payload?.error?.code);

    if (code === 13 || code === 14) {
      throw new ProxyError("not-configured", 503);
    }

    throw new ProxyError("upstream", 502);
  }

  return payload;
}

async function getToken() {
  if (token && Date.now() < tokenExpiresAt - 60_000) {
    return token;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const upstream = await fetch(tokenUrl, {
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "basic",
    }),
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!upstream.ok) {
    throw new ProxyError("not-configured", 503);
  }

  const payload = await upstream.json();

  if (typeof payload.access_token !== "string") {
    throw new ProxyError("not-configured", 503);
  }

  token = payload.access_token;
  tokenExpiresAt = Date.now() + Number(payload.expires_in ?? 0) * 1000;
  return token;
}

function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

class ProxyError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

import fs from "fs";
import os from "os";
import path from "path";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const pivot = trimmed.indexOf("=");
    if (pivot === -1) {
      continue;
    }

    const key = trimmed.slice(0, pivot).trim();
    let value = trimmed.slice(pivot + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

function normalizeOrigin(value) {
  if (!value) {
    return "";
  }
  try {
    return new URL(value).origin.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

const defaultPort = Number(process.env.PORT || 3210);
const isNetlifyRuntime = Boolean(
  process.env.NETLIFY
  || process.env.NETLIFY_DEV
  || process.env.URL
  || process.env.DEPLOY_PRIME_URL
  || process.env.CONTEXT
  || process.env.SITE_NAME,
);
const netlifyDeployUrl = normalizeOrigin(process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || "");
const configuredPublicSiteUrl = normalizeOrigin(process.env.SUPERBRAIN_PUBLIC_SITE_URL || "");
const netlifyProductionUrl = normalizeOrigin(process.env.URL || "");
const publicSiteUrl = netlifyDeployUrl
  || configuredPublicSiteUrl
  || netlifyProductionUrl
  || (isNetlifyRuntime ? "https://superbrainai.netlify.app" : "");
const netlifyUpstoxDefaults = isNetlifyRuntime
  ? {
      clientId: "4ec51c87-a099-4ade-b727-960817b31c94",
      clientSecret: "n7qldsrvus",
    }
  : {
      clientId: "",
      clientSecret: "",
    };
const defaultTokenDbPath = process.env.SUPERBRAIN_TOKEN_DB_PATH
  || (isNetlifyRuntime
    ? path.join(os.tmpdir(), "superbrain", "upstox-token-store.json")
    : "./data/upstox-token-store.json");
const defaultRedirectUri = publicSiteUrl ? `${publicSiteUrl}/api/upstox/callback` : "";

export const config = {
  port: Number.isFinite(defaultPort) ? defaultPort : 3210,
  publicSiteUrl,
  allowedOrigins: (process.env.SUPERBRAIN_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  adminToken: process.env.SUPERBRAIN_ADMIN_TOKEN || "",
  tokenDbPath: path.resolve(process.cwd(), defaultTokenDbPath),
  httpTimeoutMs: Math.max(1500, Number(process.env.SUPERBRAIN_HTTP_TIMEOUT_MS || 9000)),
  upstoxProxyUrl: (process.env.SUPERBRAIN_UPSTOX_PROXY_URL ?? "").replace(/\/+$/, ""),
  upstox: {
    clientId: process.env.UPSTOX_CLIENT_ID || netlifyUpstoxDefaults.clientId,
    clientSecret: process.env.UPSTOX_CLIENT_SECRET || netlifyUpstoxDefaults.clientSecret,
    redirectUri: process.env.UPSTOX_REDIRECT_URI || defaultRedirectUri,
    accessToken: process.env.UPSTOX_ACCESS_TOKEN || "",
    refreshToken: process.env.UPSTOX_REFRESH_TOKEN || "",
  },
};

export function hasAdminToken() {
  return Boolean(config.adminToken);
}

export function resolveAllowedOrigin(origin) {
  if (!origin) {
    return "*";
  }
  if (config.allowedOrigins.length === 0) {
    return origin;
  }
  return config.allowedOrigins.includes(origin) ? origin : "";
}

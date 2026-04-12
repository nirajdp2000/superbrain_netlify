import fs from "fs";
import path from "path";
import { config } from "../config.mjs";

let memoryRecord = null;

function ensureParentDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeRecord(input) {
  if (!input?.accessToken) {
    return null;
  }

  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken || null,
    expiresAt: Number(input.expiresAt || Date.now() + 23 * 60 * 60 * 1000),
    updatedAt: Number(input.updatedAt || Date.now()),
  };
}

function envSeedRecord() {
  if (!config.upstox.accessToken) {
    return null;
  }

  return normalizeRecord({
    accessToken: config.upstox.accessToken,
    refreshToken: config.upstox.refreshToken || null,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  });
}

export function readTokenRecord() {
  if (memoryRecord?.accessToken) {
    return memoryRecord;
  }

  try {
    if (fs.existsSync(config.tokenDbPath)) {
      const raw = fs.readFileSync(config.tokenDbPath, "utf8");
      memoryRecord = normalizeRecord(JSON.parse(raw));
      if (memoryRecord?.accessToken) {
        return memoryRecord;
      }
    }
  } catch {
    memoryRecord = null;
  }

  memoryRecord = envSeedRecord();
  return memoryRecord;
}

export function writeTokenRecord(record) {
  const normalized = normalizeRecord(record);
  if (!normalized) {
    throw new Error("Cannot store empty Upstox token record.");
  }

  try {
    ensureParentDirectory(config.tokenDbPath);
    fs.writeFileSync(config.tokenDbPath, JSON.stringify(normalized, null, 2), "utf8");
  } catch {
    // Serverless platforms may not offer durable writable project storage.
    // Keep the token in memory so the current runtime can still continue safely.
  }
  memoryRecord = normalized;
  return normalized;
}

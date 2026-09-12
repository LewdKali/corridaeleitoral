import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";
import type { Score } from "./votes";

type StoreScore = {
  lula: number;
  flavio: number;
  appliedPayments: string[];
  updatedAt: string;
};

/** Valores fictícios iniciais (e piso se o Redis falhar). */
function baseLula() {
  const raw = process.env.SCORE_BASE_LULA?.trim();
  if (!raw) return 23418;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 23418;
}

function baseFlavio() {
  const raw = process.env.SCORE_BASE_FLAVIO?.trim();
  if (!raw) return 22173;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 22173;
}

function defaultScore(): StoreScore {
  return {
    lula: baseLula(),
    flavio: baseFlavio(),
    appliedPayments: [],
    updatedAt: new Date().toISOString(),
  };
}

const REDIS_KEY = "corrida:score";

declare global {
  // eslint-disable-next-line no-var
  var __racePaidScore: StoreScore | undefined;
}

function hasRedis() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function redis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
    token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
  });
}

function filePath() {
  const root = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
  return path.join(root, "score.json");
}

function normalize(raw: unknown): StoreScore | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const lula = Number(obj.lula);
  const flavio = Number(obj.flavio);
  if (!Number.isFinite(lula) || !Number.isFinite(flavio)) return null;
  return {
    lula: Math.max(0, Math.floor(lula)),
    flavio: Math.max(0, Math.floor(flavio)),
    appliedPayments: Array.isArray(obj.appliedPayments)
      ? obj.appliedPayments.map(String).slice(-500)
      : [],
    updatedAt:
      typeof obj.updatedAt === "string"
        ? obj.updatedAt
        : new Date().toISOString(),
  };
}

function toScore(store: StoreScore): Score {
  return {
    lula: store.lula,
    flavio: store.flavio,
    updatedAt: store.updatedAt,
  };
}

async function readStore(): Promise<StoreScore> {
  if (hasRedis()) {
    try {
      const data = await redis().get(REDIS_KEY);
      const parsed = normalize(data);
      if (parsed) {
        globalThis.__racePaidScore = parsed;
        return parsed;
      }
      // Chave vazia ou formato errado no console → grava placar fictício
      const seeded = defaultScore();
      await redis().set(REDIS_KEY, seeded);
      globalThis.__racePaidScore = seeded;
      return seeded;
    } catch (err) {
      console.error("Redis read failed:", err);
      return globalThis.__racePaidScore ?? defaultScore();
    }
  }

  if (globalThis.__racePaidScore) {
    return globalThis.__racePaidScore;
  }

  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = normalize(JSON.parse(raw));
    if (parsed) {
      globalThis.__racePaidScore = parsed;
      return parsed;
    }
  } catch {
    // cria abaixo
  }

  const seeded = defaultScore();
  globalThis.__racePaidScore = seeded;
  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(seeded, null, 2));
  } catch {
    // ignore
  }
  return seeded;
}

async function writeStore(store: StoreScore): Promise<StoreScore> {
  const next: StoreScore = {
    ...store,
    updatedAt: new Date().toISOString(),
  };
  globalThis.__racePaidScore = next;

  if (hasRedis()) {
    try {
      await redis().set(REDIS_KEY, next);
    } catch (err) {
      console.error("Redis write failed:", err);
    }
    return next;
  }

  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(next, null, 2));
  } catch {
    // ignore
  }
  return next;
}

export function persistenceMode(): "redis" | "file" {
  return hasRedis() ? "redis" : "file";
}

export async function readScore(): Promise<Score> {
  return toScore(await readStore());
}

/** Soma votos após PIX confirmado e salva (Redis/arquivo). */
export async function applyPaidDelta(delta: {
  lula?: number;
  flavio?: number;
  paymentId?: string;
}): Promise<Score> {
  const store = await readStore();

  if (delta.paymentId && store.appliedPayments.includes(delta.paymentId)) {
    return toScore(store);
  }

  store.lula = Math.max(0, store.lula + (delta.lula ?? 0));
  store.flavio = Math.max(0, store.flavio + (delta.flavio ?? 0));
  if (delta.paymentId) store.appliedPayments.push(delta.paymentId);

  return toScore(await writeStore(store));
}

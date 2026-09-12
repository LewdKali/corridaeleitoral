import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";
import type { Score } from "./votes";

type PaidScore = {
  lula: number;
  flavio: number;
  appliedPayments: string[];
  updatedAt: string;
};

/** Placar base (sempre visível). Pagamentos reais somam em cima. */
export const BASE_SCORE = {
  lula: Number(process.env.SCORE_BASE_LULA ?? 23418),
  flavio: Number(process.env.SCORE_BASE_FLAVIO ?? 22173),
} as const;

const EMPTY_PAID: PaidScore = {
  lula: 0,
  flavio: 0,
  appliedPayments: [],
  updatedAt: new Date().toISOString(),
};

const REDIS_KEY = "corrida:score";

declare global {
  // eslint-disable-next-line no-var
  var __racePaidScore: PaidScore | undefined;
}

function hasRedis() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function redis() {
  return Redis.fromEnv();
}

function filePath() {
  const root = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
  return path.join(root, "score.json");
}

function normalize(raw: Partial<PaidScore> | null | undefined): PaidScore {
  if (!raw) return { ...EMPTY_PAID, updatedAt: new Date().toISOString() };
  return {
    lula: Math.max(0, Number(raw.lula) || 0),
    flavio: Math.max(0, Number(raw.flavio) || 0),
    appliedPayments: Array.isArray(raw.appliedPayments)
      ? raw.appliedPayments.map(String).slice(-500)
      : [],
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function toDisplay(paid: PaidScore): Score {
  return {
    lula: BASE_SCORE.lula + paid.lula,
    flavio: BASE_SCORE.flavio + paid.flavio,
    updatedAt: paid.updatedAt,
  };
}

async function readPaid(): Promise<PaidScore> {
  if (hasRedis()) {
    const data = await redis().get<PaidScore>(REDIS_KEY);
    const paid = normalize(data ?? undefined);
    globalThis.__racePaidScore = paid;
    return paid;
  }

  if (globalThis.__racePaidScore) {
    return globalThis.__racePaidScore;
  }

  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    const raw = await fs.readFile(filePath(), "utf8");
    const paid = normalize(JSON.parse(raw) as Partial<PaidScore>);
    globalThis.__racePaidScore = paid;
    return paid;
  } catch {
    globalThis.__racePaidScore = normalize(EMPTY_PAID);
    return globalThis.__racePaidScore;
  }
}

async function writePaid(paid: PaidScore): Promise<PaidScore> {
  const next = normalize({
    ...paid,
    updatedAt: new Date().toISOString(),
  });
  globalThis.__racePaidScore = next;

  if (hasRedis()) {
    await redis().set(REDIS_KEY, next);
    return next;
  }

  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(next, null, 2));
  } catch {
    // sem disco: só memória
  }
  return next;
}

export function persistenceMode(): "redis" | "file" {
  return hasRedis() ? "redis" : "file";
}

export async function readScore(): Promise<Score> {
  return toDisplay(await readPaid());
}

export async function applyPaidDelta(delta: {
  lula?: number;
  flavio?: number;
  paymentId?: string;
}): Promise<Score> {
  const paid = await readPaid();

  if (delta.paymentId && paid.appliedPayments.includes(delta.paymentId)) {
    return toDisplay(paid);
  }

  paid.lula = Math.max(0, paid.lula + (delta.lula ?? 0));
  paid.flavio = Math.max(0, paid.flavio + (delta.flavio ?? 0));
  if (delta.paymentId) paid.appliedPayments.push(delta.paymentId);

  return toDisplay(await writePaid(paid));
}

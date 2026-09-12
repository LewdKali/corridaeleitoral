import { promises as fs } from "fs";
import path from "path";
import type { Score } from "./votes";

/** Base inflada — placar já “quente” no ar; pagamentos reais somam em cima. */
export const BASE_SCORE = {
  lula: Number(process.env.SCORE_BASE_LULA ?? 18420),
  flavio: Number(process.env.SCORE_BASE_FLAVIO ?? 17865),
} as const;

type PaidScore = {
  lula: number;
  flavio: number;
  simLula: number;
  simFlavio: number;
  updatedAt: string;
};

const EMPTY_PAID: PaidScore = {
  lula: 0,
  flavio: 0,
  simLula: 0,
  simFlavio: 0,
  updatedAt: new Date().toISOString(),
};

declare global {
  // eslint-disable-next-line no-var
  var __racePaidScore: PaidScore | undefined;
}

function dataPath() {
  // No Vercel o filesystem do projeto é read-only; /tmp funciona na instância quente.
  const root = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
  return path.join(root, "score.json");
}

async function ensureFile() {
  const file = dataPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(EMPTY_PAID, null, 2));
  }
}

async function readPaid(): Promise<PaidScore> {
  if (globalThis.__racePaidScore) {
    return globalThis.__racePaidScore;
  }
  try {
    await ensureFile();
    const raw = await fs.readFile(dataPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<PaidScore>;
    const paid: PaidScore = {
      lula: Number(parsed.lula) || 0,
      flavio: Number(parsed.flavio) || 0,
      simLula: Number(parsed.simLula) || 0,
      simFlavio: Number(parsed.simFlavio) || 0,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
    globalThis.__racePaidScore = paid;
    return paid;
  } catch {
    globalThis.__racePaidScore = { ...EMPTY_PAID };
    return globalThis.__racePaidScore;
  }
}

async function writePaid(paid: PaidScore): Promise<PaidScore> {
  const next = { ...paid, updatedAt: new Date().toISOString() };
  globalThis.__racePaidScore = next;
  try {
    await ensureFile();
    await fs.writeFile(dataPath(), JSON.stringify(next, null, 2));
  } catch {
    // Em cold start sem disco, mantém só em memória.
  }
  return next;
}

export function toDisplayScore(paid: PaidScore): Score {
  return {
    lula: Math.max(0, BASE_SCORE.lula + paid.lula + paid.simLula),
    flavio: Math.max(0, BASE_SCORE.flavio + paid.flavio + paid.simFlavio),
    updatedAt: paid.updatedAt,
  };
}

export async function readScore(): Promise<Score> {
  return toDisplayScore(await readPaid());
}

/** Aplica votos de pagamento real (ou demo). */
export async function applyPaidDelta(
  delta: { lula?: number; flavio?: number },
): Promise<Score> {
  const paid = await readPaid();
  paid.lula = Math.max(0, paid.lula + (delta.lula ?? 0));
  paid.flavio = Math.max(0, paid.flavio + (delta.flavio ?? 0));
  return toDisplayScore(await writePaid(paid));
}

/** Movimentação simulada do jogo (mantém o placar vivo). */
export async function tickSimulation(): Promise<Score> {
  const paid = await readPaid();
  const bump = () => {
    const roll = Math.random();
    if (roll < 0.45) return 1 + Math.floor(Math.random() * 3);
    if (roll < 0.7) return -(1 + Math.floor(Math.random() * 2));
    return 0;
  };
  paid.simLula = Math.max(0, paid.simLula + bump());
  paid.simFlavio = Math.max(0, paid.simFlavio + bump());
  // leve empurrão para não ficar parado
  if (Math.random() < 0.55) {
    if (Math.random() < 0.5) paid.simLula += 1 + Math.floor(Math.random() * 4);
    else paid.simFlavio += 1 + Math.floor(Math.random() * 4);
  }
  return toDisplayScore(await writePaid(paid));
}

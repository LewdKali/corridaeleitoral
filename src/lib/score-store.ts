import { promises as fs } from "fs";
import path from "path";
import type { Score } from "./votes";

type PaidScore = {
  lula: number;
  flavio: number;
  appliedPayments: string[];
  updatedAt: string;
};

const EMPTY_PAID: PaidScore = {
  lula: 0,
  flavio: 0,
  appliedPayments: [],
  updatedAt: new Date().toISOString(),
};

declare global {
  // eslint-disable-next-line no-var
  var __racePaidScore: PaidScore | undefined;
}

function dataPath() {
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
      lula: Math.max(0, Number(parsed.lula) || 0),
      flavio: Math.max(0, Number(parsed.flavio) || 0),
      appliedPayments: Array.isArray(parsed.appliedPayments)
        ? parsed.appliedPayments.map(String)
        : [],
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
  const next = {
    ...paid,
    appliedPayments: paid.appliedPayments.slice(-500),
    updatedAt: new Date().toISOString(),
  };
  globalThis.__racePaidScore = next;
  try {
    await ensureFile();
    await fs.writeFile(dataPath(), JSON.stringify(next, null, 2));
  } catch {
    // cold start sem disco: mantém em memória
  }
  return next;
}

export async function readScore(): Promise<Score> {
  const paid = await readPaid();
  return {
    lula: paid.lula,
    flavio: paid.flavio,
    updatedAt: paid.updatedAt,
  };
}

export async function applyPaidDelta(delta: {
  lula?: number;
  flavio?: number;
  paymentId?: string;
}): Promise<Score> {
  const paid = await readPaid();

  if (delta.paymentId && paid.appliedPayments.includes(delta.paymentId)) {
    return {
      lula: paid.lula,
      flavio: paid.flavio,
      updatedAt: paid.updatedAt,
    };
  }

  paid.lula = Math.max(0, paid.lula + (delta.lula ?? 0));
  paid.flavio = Math.max(0, paid.flavio + (delta.flavio ?? 0));
  if (delta.paymentId) {
    paid.appliedPayments.push(delta.paymentId);
  }

  const next = await writePaid(paid);
  return {
    lula: next.lula,
    flavio: next.flavio,
    updatedAt: next.updatedAt,
  };
}

export type Candidate = "lula" | "flavio";
export type VoteAction = "add" | "remove";

export type VotePackage = {
  id: string;
  candidate: Candidate;
  action: VoteAction;
  amountBrl: number;
  votes: number;
  label: string;
};

export const PACKAGES: VotePackage[] = [
  {
    id: "lula-add-5",
    candidate: "lula",
    action: "add",
    amountBrl: 5,
    votes: 5,
    label: "R$ 5,00 = 5 votos",
  },
  {
    id: "lula-add-10",
    candidate: "lula",
    action: "add",
    amountBrl: 10,
    votes: 10,
    label: "R$ 10,00 = 10 votos",
  },
  {
    id: "lula-add-13",
    candidate: "lula",
    action: "add",
    amountBrl: 13,
    votes: 13,
    label: "R$ 13,00 = 13 votos",
  },
  {
    id: "lula-remove-5",
    candidate: "flavio",
    action: "remove",
    amountBrl: 5,
    votes: -5,
    label: "R$ 5,00 = -5 votos",
  },
  {
    id: "lula-remove-10",
    candidate: "flavio",
    action: "remove",
    amountBrl: 10,
    votes: -10,
    label: "R$ 10,00 = -10 votos",
  },
  {
    id: "lula-remove-20",
    candidate: "flavio",
    action: "remove",
    amountBrl: 20,
    votes: -20,
    label: "R$ 20,00 = -20 votos",
  },
  {
    id: "flavio-add-5",
    candidate: "flavio",
    action: "add",
    amountBrl: 5,
    votes: 5,
    label: "R$ 5,00 = 5 votos",
  },
  {
    id: "flavio-add-10",
    candidate: "flavio",
    action: "add",
    amountBrl: 10,
    votes: 10,
    label: "R$ 10,00 = 10 votos",
  },
  {
    id: "flavio-add-22",
    candidate: "flavio",
    action: "add",
    amountBrl: 22,
    votes: 22,
    label: "R$ 22,00 = 22 votos",
  },
  {
    id: "flavio-remove-5",
    candidate: "lula",
    action: "remove",
    amountBrl: 5,
    votes: -5,
    label: "R$ 5,00 = -5 votos",
  },
  {
    id: "flavio-remove-10",
    candidate: "lula",
    action: "remove",
    amountBrl: 10,
    votes: -10,
    label: "R$ 10,00 = -10 votos",
  },
  {
    id: "flavio-remove-20",
    candidate: "lula",
    action: "remove",
    amountBrl: 20,
    votes: -20,
    label: "R$ 20,00 = -20 votos",
  },
];

export type Score = {
  lula: number;
  flavio: number;
  updatedAt: string;
};

export function applyPackage(score: Score, pkg: VotePackage): Score {
  const next = { ...score, updatedAt: new Date().toISOString() };
  if (pkg.action === "add") {
    next[pkg.candidate] = Math.max(0, next[pkg.candidate] + pkg.votes);
  } else {
    next[pkg.candidate] = Math.max(0, next[pkg.candidate] + pkg.votes);
  }
  return next;
}

export function getLeader(score: Score): Candidate | "empate" {
  if (score.lula === score.flavio) return "empate";
  return score.lula > score.flavio ? "lula" : "flavio";
}

export function raceProgress(score: Score): { lula: number; flavio: number } {
  const total = score.lula + score.flavio;
  if (total === 0) return { lula: 8, flavio: 8 };
  const max = Math.max(score.lula, score.flavio, 1);
  return {
    lula: 8 + (score.lula / max) * 78,
    flavio: 8 + (score.flavio / max) * 78,
  };
}

export function statusMessage(score: Score): string {
  const leader = getLeader(score);
  const gap = Math.abs(score.lula - score.flavio);
  if (leader === "empate") return "Ninguém abriu vantagem ainda";
  if (gap < 80) {
    return leader === "lula"
      ? "Lula puxa por pouco — corrida apertada"
      : "Flávio respira no ombro — corrida apertada";
  }
  if (gap < 400) {
    return leader === "lula"
      ? "Time vermelho abre leve vantagem na pista"
      : "Time azul abre leve vantagem na pista";
  }
  return leader === "lula"
    ? "Lula dispara e amplia a liderança"
    : "Flávio dispara e amplia a liderança";
}

"use client";

import { getLeader, type Score } from "@/lib/votes";

type Props = {
  score: Score;
  pulseKey: number;
};

export function Scoreboard({ score, pulseKey }: Props) {
  const leader = getLeader(score);
  const gap = Math.abs(score.lula - score.flavio);

  return (
    <header className="relative z-10 px-4 pt-6 md:px-8 md:pt-10">
      <div className="mx-auto max-w-5xl fade-up">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.35em] text-ink/70">
          placar global
        </p>
        <h1 className="font-display text-center text-5xl leading-none text-ink md:text-7xl lg:text-8xl">
          <span className="text-lula">LULA</span>
          <span className="mx-2 text-ink/35 md:mx-4">X</span>
          <span className="text-flavio">FLÁVIO</span>
        </h1>
        <p className="mt-3 text-center text-base text-muted md:text-lg">
          A corrida eleitoral
        </p>

        <div className="mt-8 grid grid-cols-3 items-center gap-2 md:gap-6">
          <ScoreCell
            name="Lula"
            votes={score.lula}
            tone="lula"
            pulseKey={pulseKey}
          />
          <div className="text-center">
            <p className="font-display text-2xl uppercase text-ink md:text-3xl">
              {leader === "empate"
                ? "EMPATE"
                : leader === "lula"
                  ? "LULA"
                  : "FLÁVIO"}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
              {gap.toLocaleString("pt-BR")} pontos simbólicos
            </p>
          </div>
          <ScoreCell
            name="Flávio"
            votes={score.flavio}
            tone="flavio"
            pulseKey={pulseKey}
          />
        </div>
      </div>
    </header>
  );
}

function ScoreCell({
  name,
  votes,
  tone,
  pulseKey,
}: {
  name: string;
  votes: number;
  tone: "lula" | "flavio";
  pulseKey: number;
}) {
  const bg = tone === "lula" ? "bg-lula-soft" : "bg-flavio-soft";
  const color = tone === "lula" ? "text-lula" : "text-flavio";

  return (
    <div className={`${bg} border border-white/10 px-3 py-4 text-center md:px-6 md:py-5`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${color}`}>
        {name}
      </p>
      <p
        key={`${name}-${pulseKey}-${votes}`}
        className={`pop-once font-display text-4xl tabular-nums md:text-6xl ${color}`}
      >
        {votes.toLocaleString("pt-BR")}
      </p>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted">votos</p>
    </div>
  );
}

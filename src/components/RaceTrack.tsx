"use client";

import { Runner } from "./Runner";
import { getLeader, raceProgress, type Score } from "@/lib/votes";

type Props = {
  score: Score;
};

export function RaceTrack({ score }: Props) {
  const progress = raceProgress(score);
  const leader = getLeader(score);

  return (
    <section className="relative overflow-hidden rounded-none px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
              Na pista
            </p>
            <h2 className="font-display text-3xl text-ink md:text-4xl">
              A corrida eleitoral
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted">
            Cada pagamento confirmado move só os votos simbólicos do valor
            escolhido.
          </p>
        </div>

        <div className="relative space-y-5 rounded-[2px] bg-asphalt p-4 shadow-[0_20px_50px_var(--shadow)] md:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-[repeating-linear-gradient(90deg,#fff_0_16px,#c62828_16px_32px)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-[repeating-linear-gradient(90deg,#fff_0_16px,#1565c0_16px_32px)]" />

          <Lane
            label="Lula"
            sub="Time vermelho"
            votes={score.lula}
            pct={progress.lula}
            leading={leader === "lula"}
            side="lula"
          />
          <div className="h-1.5 w-full track-dashes rounded-full opacity-90" />
          <Lane
            label="Flávio Bolsonaro"
            sub="Time azul"
            votes={score.flavio}
            pct={progress.flavio}
            leading={leader === "flavio"}
            side="flavio"
          />
        </div>
      </div>
    </section>
  );
}

function Lane({
  label,
  sub,
  votes,
  pct,
  leading,
  side,
}: {
  label: string;
  sub: string;
  votes: number;
  pct: number;
  leading: boolean;
  side: "lula" | "flavio";
}) {
  const color = side === "lula" ? "text-lula" : "text-flavio";

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-3 text-white">
        <div>
          <p className={`font-display text-xl leading-none ${color}`}>{label}</p>
          <p className="text-xs uppercase tracking-wider text-white/60">{sub}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl tabular-nums">{votes.toLocaleString("pt-BR")}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
            {leading ? "liderança" : "votos"}
          </p>
        </div>
      </div>
      <div className="relative h-36 md:h-44">
        <div
          className="absolute bottom-0 transition-[left] duration-700 ease-out"
          style={{ left: `calc(${pct}% - 4rem)` }}
        >
          <Runner side={side} leading={leading} />
        </div>
        <div className="absolute bottom-2 right-2 font-display text-4xl text-white/15 md:text-6xl">
          META
        </div>
      </div>
    </div>
  );
}

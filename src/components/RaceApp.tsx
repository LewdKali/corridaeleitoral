"use client";

import { useCallback, useEffect, useState } from "react";
import { RaceTrack } from "@/components/RaceTrack";
import { Scoreboard } from "@/components/Scoreboard";
import { VotePanel } from "@/components/VotePanel";
import { statusMessage, type Score } from "@/lib/votes";

const EMPTY: Score = {
  lula: 0,
  flavio: 0,
  updatedAt: new Date().toISOString(),
};

export function RaceApp() {
  const [score, setScore] = useState<Score>(EMPTY);
  const [pulseKey, setPulseKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [pagoMsg, setPagoMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/score", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as Score;
    setScore((prev) => {
      if (prev.lula !== data.lula || prev.flavio !== data.flavio) {
        setPulseKey((k) => k + 1);
      }
      return data;
    });
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 10000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pago = params.get("pago");
    if (pago === "ok") {
      setPagoMsg("Pagamento recebido! O placar atualiza quando o MP confirmar.");
      void refresh();
    } else if (pago === "pendente") {
      setPagoMsg("Pagamento pendente — assim que confirmar, os votos entram.");
    } else if (pago === "erro") {
      setPagoMsg("Pagamento não concluído. Tente de novo.");
    }
  }, [refresh]);

  function handlePaid(next: Score) {
    setScore(next);
    setPulseKey((k) => k + 1);
  }

  return (
    <main className="relative z-10 flex flex-1 flex-col pb-16">
      <Scoreboard score={score} pulseKey={pulseKey} />
      <RaceTrack score={score} />

      <section className="px-4 md:px-8">
        <div className="mx-auto max-w-5xl border border-white/10 bg-paper px-5 py-4 text-center backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
            status da disputa
          </p>
          <p className="mt-1 font-display text-xl text-ink md:text-2xl">
            {ready ? statusMessage(score) : "Carregando placar..."}
          </p>
          {pagoMsg && <p className="mt-2 text-sm text-flavio">{pagoMsg}</p>}
        </div>
      </section>

      <VotePanel onPaid={handlePaid} />

      <footer className="mx-auto max-w-3xl px-6 text-center text-xs leading-relaxed text-muted">
        Os votos exibidos são participações simbólicas nesta paródia. Só entram
        no placar após pagamento confirmado. Não representam voto eleitoral,
        pesquisa oficial, doação ou vínculo com candidato ou campanha.
      </footer>
    </main>
  );
}

"use client";

import { useState } from "react";
import { PACKAGES, type Candidate, type Score, type VotePackage } from "@/lib/votes";

type Props = {
  onPaid: (score: Score) => void;
};

export function VotePanel({ onPaid }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(pkg: VotePackage) {
    setLoadingId(pkg.id);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Falha no checkout");
      }
      if (data.mode === "mercadopago" && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data.score) {
        onPaid(data.score);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="relative z-10 px-4 py-10 md:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
        <SideColumn
          side="lula"
          title="votar em Lula"
          removeTitle="tirar votos de Flávio"
          loadingId={loadingId}
          onSelect={checkout}
        />
        <SideColumn
          side="flavio"
          title="votar em Flávio"
          removeTitle="tirar votos de Lula"
          loadingId={loadingId}
          onSelect={checkout}
        />
      </div>
      {error && (
        <p className="mx-auto mt-6 max-w-5xl text-center text-sm text-lula-deep">
          {error}
        </p>
      )}
    </section>
  );
}

function SideColumn({
  side,
  title,
  removeTitle,
  loadingId,
  onSelect,
}: {
  side: Candidate;
  title: string;
  removeTitle: string;
  loadingId: string | null;
  onSelect: (pkg: VotePackage) => void;
}) {
  const add = PACKAGES.filter(
    (p) => p.action === "add" && p.candidate === side,
  );
  const remove = PACKAGES.filter((p) => {
    if (p.action !== "remove") return false;
    return side === "lula" ? p.candidate === "flavio" : p.candidate === "lula";
  });

  const tone = side === "lula" ? "lula" : "flavio";
  const border =
    side === "lula" ? "border-lula/30" : "border-flavio/30";
  const head =
    side === "lula" ? "bg-lula text-white" : "bg-flavio text-white";

  return (
    <div className={`overflow-hidden border ${border} bg-paper backdrop-blur-sm`}>
      <div className={`${head} px-5 py-3`}>
        <h3 className="font-display text-2xl uppercase tracking-wide">{title}</h3>
      </div>
      <div className="space-y-2 p-4">
        {add.map((pkg) => (
          <PackageButton
            key={pkg.id}
            pkg={pkg}
            tone={tone}
            loading={loadingId === pkg.id}
            onClick={() => onSelect(pkg)}
          />
        ))}
      </div>
      <div className="border-t border-white/10 px-5 py-3">
        <h4 className="font-display text-lg uppercase text-ink/80">{removeTitle}</h4>
      </div>
      <div className="space-y-2 p-4 pt-0">
        {remove.map((pkg) => (
          <PackageButton
            key={pkg.id}
            pkg={pkg}
            tone={tone}
            loading={loadingId === pkg.id}
            onClick={() => onSelect(pkg)}
            ghost
          />
        ))}
      </div>
    </div>
  );
}

function PackageButton({
  pkg,
  tone,
  loading,
  onClick,
  ghost,
}: {
  pkg: VotePackage;
  tone: "lula" | "flavio";
  loading: boolean;
  onClick: () => void;
  ghost?: boolean;
}) {
  const solid =
    tone === "lula"
      ? "bg-lula hover:bg-lula-deep text-white"
      : "bg-flavio hover:bg-flavio-deep text-white";
  const outline =
    tone === "lula"
      ? "border border-lula/50 text-lula hover:bg-lula-soft"
      : "border border-flavio/50 text-flavio hover:bg-flavio-soft";

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold transition disabled:opacity-60 ${ghost ? outline : solid}`}
    >
      <span>{pkg.label}</span>
      <span className="text-xs uppercase tracking-wider opacity-80">
        {loading ? "..." : "pagar"}
      </span>
    </button>
  );
}

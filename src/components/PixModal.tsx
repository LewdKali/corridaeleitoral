"use client";

import { useEffect, useState } from "react";
import type { Score } from "@/lib/votes";

export type PixPayload = {
  paymentId: string;
  amountBrl: number;
  packageId: string;
  qrCode: string;
  qrCodeBase64: string;
  gateway?: "asaas" | "mercadopago";
};

type Props = {
  pix: PixPayload;
  onClose: () => void;
  onPaid: (score: Score) => void;
};

export function PixModal({ pix, onClose, onPaid }: Props) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("Aguardando pagamento PIX...");

  useEffect(() => {
    let stopped = false;
    const gateway = pix.gateway ?? "asaas";

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/payment/${encodeURIComponent(pix.paymentId)}?gateway=${gateway}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!res.ok || stopped) return;

        if (data.status === "approved") {
          setStatus("Pagamento confirmado!");
          if (data.score) onPaid(data.score);
          setTimeout(onClose, 900);
          return;
        }
        if (
          data.status === "cancelled" ||
          data.status === "rejected" ||
          data.status === "overdue" ||
          data.status === "deleted"
        ) {
          setStatus("Pagamento cancelado ou expirado.");
          return;
        }
        setStatus("Aguardando PIX...");
      } catch {
        // ignore
      }
    };

    void tick();
    const id = setInterval(() => void tick(), 2500);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [pix.paymentId, pix.gateway, onClose, onPaid]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const qrSrc = pix.qrCodeBase64
    ? pix.qrCodeBase64.startsWith("data:")
      ? pix.qrCodeBase64
      : `data:image/png;base64,${pix.qrCodeBase64}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal
    >
      <div className="w-full max-w-md border border-white/15 bg-[#121820] p-5 text-ink shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
              pagar com PIX
            </p>
            <h3 className="font-display text-3xl text-ink">
              R$ {pix.amountBrl.toFixed(2).replace(".", ",")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            fechar
          </button>
        </div>

        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrSrc}
            alt="QR Code PIX"
            className="mx-auto mb-4 h-56 w-56 rounded bg-white p-2"
          />
        ) : (
          <div className="mb-4 rounded border border-white/10 p-4 text-center text-sm text-muted">
            Use o copia e cola abaixo no app do banco.
          </div>
        )}

        <p className="mb-2 text-center text-sm text-flavio">{status}</p>

        <button
          type="button"
          onClick={() => void copyCode()}
          className="mb-3 w-full bg-flavio px-4 py-3 text-sm font-semibold text-white hover:bg-flavio-deep"
        >
          {copied ? "Código copiado!" : "Copiar código PIX"}
        </button>

        <p className="break-all rounded border border-white/10 bg-black/30 p-3 font-mono text-[10px] leading-relaxed text-muted">
          {pix.qrCode}
        </p>
      </div>
    </div>
  );
}

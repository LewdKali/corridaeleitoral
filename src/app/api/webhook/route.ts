import { NextResponse } from "next/server";
import { findPackage } from "@/lib/mercadopago";
import { applyPaidDelta } from "@/lib/score-store";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    type?: string;
    action?: string;
    data?: { id?: string };
  };

  const paymentId = payload.data?.id;
  if (!paymentId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Token não configurado" },
      { status: 500 },
    );
  }

  const paymentRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!paymentRes.ok) {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
  }

  const payment = (await paymentRes.json()) as {
    status: string;
    external_reference?: string;
    metadata?: { packageId?: string };
  };

  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true, status: payment.status });
  }

  const packageId =
    payment.metadata?.packageId ?? payment.external_reference ?? "";
  const pkg = findPackage(packageId);
  if (!pkg) {
    return NextResponse.json({ error: "Pacote desconhecido" }, { status: 400 });
  }

  const delta =
    pkg.candidate === "lula"
      ? { lula: pkg.votes }
      : { flavio: pkg.votes };

  const score = await applyPaidDelta(delta);
  return NextResponse.json({ ok: true, score });
}

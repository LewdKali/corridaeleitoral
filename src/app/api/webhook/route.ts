import { NextResponse } from "next/server";
import { findPackage, getPayment } from "@/lib/mercadopago";
import { applyPaidDelta } from "@/lib/score-store";

export async function POST(request: Request) {
  let paymentId: string | undefined;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as {
      type?: string;
      action?: string;
      data?: { id?: string };
      id?: string;
    };
    paymentId = payload.data?.id ?? payload.id;
  } else {
    const text = await request.text();
    const params = new URLSearchParams(text);
    paymentId = params.get("data.id") ?? params.get("id") ?? undefined;
    if (!paymentId) {
      try {
        const payload = JSON.parse(text) as { data?: { id?: string }; id?: string };
        paymentId = payload.data?.id ?? payload.id;
      } catch {
        // ignore
      }
    }
  }

  // Também aceita ?data.id= / ?id= na query (formato antigo MP)
  if (!paymentId) {
    const url = new URL(request.url);
    paymentId =
      url.searchParams.get("data.id") ??
      url.searchParams.get("id") ??
      undefined;
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const payment = await getPayment(paymentId);
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
        ? { lula: pkg.votes, paymentId: String(payment.id) }
        : { flavio: pkg.votes, paymentId: String(payment.id) };

    const score = await applyPaidDelta(delta);
    return NextResponse.json({ ok: true, score });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

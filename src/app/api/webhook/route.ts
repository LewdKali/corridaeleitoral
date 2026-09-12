import { NextResponse } from "next/server";
import { getAsaasPayment, hasAsaas } from "@/lib/asaas";
import { findPackage, getPayment, hasMercadoPago } from "@/lib/mercadopago";
import { applyPaidDelta } from "@/lib/score-store";

async function applyPackageVotes(packageId: string, paymentKey: string) {
  const pkg = findPackage(packageId);
  if (!pkg) return null;
  const delta =
    pkg.candidate === "lula"
      ? { lula: pkg.votes, paymentId: paymentKey }
      : { flavio: pkg.votes, paymentId: paymentKey };
  return applyPaidDelta(delta);
}

function assertAsaasWebhookAuth(request: Request): NextResponse | null {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!expected) return null;

  const received = request.headers.get("asaas-access-token")?.trim();
  if (received !== expected) {
    return NextResponse.json({ error: "Webhook não autorizado" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    body = (await request.json()) as Record<string, unknown>;
  } else {
    const text = await request.text();
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }
  }

  // Asaas webhook: { event, payment: { id, ... } }
  const asaasEvent = String(body.event ?? "");
  const asaasPayment = body.payment as { id?: string } | undefined;
  if (asaasPayment?.id && hasAsaas()) {
    const authError = assertAsaasWebhookAuth(request);
    if (authError) return authError;

    if (
      asaasEvent &&
      ![
        "PAYMENT_RECEIVED",
        "PAYMENT_CONFIRMED",
        "PAYMENT_RECEIVED_IN_CASH",
      ].includes(asaasEvent)
    ) {
      return NextResponse.json({ ok: true, skipped: asaasEvent });
    }

    const payment = await getAsaasPayment(asaasPayment.id);
    if (!payment.paid) {
      return NextResponse.json({ ok: true, status: payment.rawStatus });
    }
    const score = await applyPackageVotes(
      payment.packageId,
      `asaas:${payment.id}`,
    );
    return NextResponse.json({ ok: true, score });
  }

  // Mercado Pago webhook
  const mpId =
    (body.data as { id?: string } | undefined)?.id ??
    (typeof body.id === "string" ? body.id : undefined) ??
    new URL(request.url).searchParams.get("data.id") ??
    new URL(request.url).searchParams.get("id") ??
    undefined;

  if (mpId && hasMercadoPago()) {
    const payment = await getPayment(mpId);
    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }
    const packageId =
      payment.metadata?.packageId ?? payment.external_reference ?? "";
    const score = await applyPackageVotes(packageId, `mp:${payment.id}`);
    return NextResponse.json({ ok: true, score });
  }

  return NextResponse.json({ ok: true, skipped: true });
}

export async function GET(request: Request) {
  return POST(request);
}

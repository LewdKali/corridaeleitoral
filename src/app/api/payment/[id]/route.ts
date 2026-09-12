import { NextResponse } from "next/server";
import { getAsaasPayment, hasAsaas } from "@/lib/asaas";
import { findPackage, getPayment, hasMercadoPago } from "@/lib/mercadopago";
import { applyPaidDelta, readScore } from "@/lib/score-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const gateway =
    new URL(request.url).searchParams.get("gateway") ?? "asaas";

  try {
    if (gateway === "asaas" || (!hasMercadoPago() && hasAsaas())) {
      const payment = await getAsaasPayment(id);
      if (payment.paid) {
        const pkg = findPackage(payment.packageId);
        if (pkg) {
          const delta =
            pkg.candidate === "lula"
              ? { lula: pkg.votes, paymentId: `asaas:${payment.id}` }
              : { flavio: pkg.votes, paymentId: `asaas:${payment.id}` };
          const score = await applyPaidDelta(delta);
          return NextResponse.json({ status: "approved", score });
        }
      }
      return NextResponse.json({
        status: payment.status,
        score: await readScore(),
      });
    }

    const payment = await getPayment(id);
    if (payment.status === "approved") {
      const packageId =
        payment.metadata?.packageId ?? payment.external_reference ?? "";
      const pkg = findPackage(packageId);
      if (pkg) {
        const delta =
          pkg.candidate === "lula"
            ? { lula: pkg.votes, paymentId: `mp:${payment.id}` }
            : { flavio: pkg.votes, paymentId: `mp:${payment.id}` };
        const score = await applyPaidDelta(delta);
        return NextResponse.json({ status: "approved", score });
      }
    }

    return NextResponse.json({
      status: payment.status,
      score: await readScore(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao consultar pagamento";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

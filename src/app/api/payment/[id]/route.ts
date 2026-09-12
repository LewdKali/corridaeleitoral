import { NextResponse } from "next/server";
import { findPackage, getPayment } from "@/lib/mercadopago";
import { applyPaidDelta, readScore } from "@/lib/score-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const payment = await getPayment(id);

    if (payment.status === "approved") {
      const packageId =
        payment.metadata?.packageId ?? payment.external_reference ?? "";
      const pkg = findPackage(packageId);
      if (pkg) {
        const delta =
          pkg.candidate === "lula"
            ? { lula: pkg.votes, paymentId: String(payment.id) }
            : { flavio: pkg.votes, paymentId: String(payment.id) };
        const score = await applyPaidDelta(delta);
        return NextResponse.json({
          status: payment.status,
          score,
        });
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

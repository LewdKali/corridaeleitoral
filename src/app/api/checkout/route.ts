import { NextResponse } from "next/server";
import {
  createPixPayment,
  findPackage,
  hasMercadoPago,
} from "@/lib/mercadopago";
import { applyPaidDelta } from "@/lib/score-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    packageId?: string;
    demo?: boolean;
  };

  const pkg = body.packageId ? findPackage(body.packageId) : undefined;
  if (!pkg) {
    return NextResponse.json({ error: "Pacote inválido" }, { status: 400 });
  }

  const delta =
    pkg.candidate === "lula"
      ? { lula: pkg.votes }
      : { flavio: pkg.votes };

  if (!hasMercadoPago()) {
    const score = await applyPaidDelta(delta);
    return NextResponse.json({
      mode: "demo",
      score,
      message: "Modo demo: configure MERCADOPAGO_ACCESS_TOKEN na Vercel.",
    });
  }

  if (body.demo === true && process.env.ALLOW_DEMO === "true") {
    const score = await applyPaidDelta(delta);
    return NextResponse.json({ mode: "demo", score });
  }

  try {
    const pix = await createPixPayment(pkg);
    return NextResponse.json({
      mode: "pix",
      ...pix,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao criar PIX";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

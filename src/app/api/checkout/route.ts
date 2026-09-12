import { NextResponse } from "next/server";
import {
  createMercadoPagoPreference,
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

  // Só demo se não houver token — com MP configurado, sempre checkout real
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
    const preference = await createMercadoPagoPreference(pkg);
    const useSandbox = process.env.MERCADOPAGO_SANDBOX === "true";
    return NextResponse.json({
      mode: "mercadopago",
      preferenceId: preference.id,
      checkoutUrl: useSandbox
        ? preference.sandbox_init_point
        : preference.init_point,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao criar checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

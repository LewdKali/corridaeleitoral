import { NextResponse } from "next/server";
import {
  createPixCheckoutPreference,
  createPixPayment,
  findPackage,
  hasMercadoPago,
} from "@/lib/mercadopago";
import { applyPaidDelta, persistenceMode } from "@/lib/score-store";

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
      persistence: persistenceMode(),
      message: "Modo demo: configure MERCADOPAGO_ACCESS_TOKEN na Vercel.",
    });
  }

  if (body.demo === true && process.env.ALLOW_DEMO === "true") {
    const score = await applyPaidDelta(delta);
    return NextResponse.json({ mode: "demo", score });
  }

  // 1) Tenta QR na página
  try {
    const pix = await createPixPayment(pkg);
    return NextResponse.json({
      mode: "pix",
      persistence: persistenceMode(),
      ...pix,
    });
  } catch (pixError) {
    const pixMessage =
      pixError instanceof Error ? pixError.message : "Falha no PIX QR";

    // 2) Fallback: abre Checkout Pro só com PIX
    try {
      const preference = await createPixCheckoutPreference(pkg);
      const useSandbox = process.env.MERCADOPAGO_SANDBOX === "true";
      return NextResponse.json({
        mode: "mercadopago",
        persistence: persistenceMode(),
        preferenceId: preference.id,
        checkoutUrl: useSandbox
          ? preference.sandbox_init_point
          : preference.init_point,
        warning: pixMessage,
      });
    } catch (prefError) {
      const prefMessage =
        prefError instanceof Error ? prefError.message : "Falha no checkout";
      return NextResponse.json(
        {
          error: `${pixMessage} | ${prefMessage}`,
          persistence: persistenceMode(),
        },
        { status: 502 },
      );
    }
  }
}

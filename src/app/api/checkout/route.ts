import { NextResponse } from "next/server";
import { createAsaasPix, hasAsaas } from "@/lib/asaas";
import {
  createPixCheckoutPreference,
  createPixPayment,
  findPackage,
  hasMercadoPago,
} from "@/lib/mercadopago";
import { persistenceMode } from "@/lib/score-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    packageId?: string;
  };

  const pkg = body.packageId ? findPackage(body.packageId) : undefined;
  if (!pkg) {
    return NextResponse.json({ error: "Pacote inválido" }, { status: 400 });
  }

  // Nunca soma voto aqui — só gera cobrança PIX
  if (hasAsaas()) {
    try {
      const pix = await createAsaasPix(pkg);
      return NextResponse.json({
        mode: "pix",
        persistence: persistenceMode(),
        ...pix,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao criar PIX Asaas";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (hasMercadoPago()) {
    try {
      const pix = await createPixPayment(pkg);
      return NextResponse.json({
        mode: "pix",
        gateway: "mercadopago",
        persistence: persistenceMode(),
        ...pix,
      });
    } catch (pixError) {
      const pixMessage =
        pixError instanceof Error ? pixError.message : "Falha no PIX QR";
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
          { error: `${pixMessage} | ${prefMessage}` },
          { status: 502 },
        );
      }
    }
  }

  return NextResponse.json(
    {
      error:
        "Nenhum gateway configurado. Na Vercel, defina ASAAS_API_KEY (recomendado) ou MERCADOPAGO_ACCESS_TOKEN.",
      persistence: persistenceMode(),
    },
    { status: 503 },
  );
}

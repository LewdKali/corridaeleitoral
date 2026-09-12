import { PACKAGES, type VotePackage } from "./votes";

const MP_API = "https://api.mercadopago.com";

export function findPackage(id: string): VotePackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

export function hasMercadoPago(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

function appBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
    || process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}

function isPublicHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    );
  } catch {
    return false;
  }
}

export async function createMercadoPagoPreference(pkg: VotePackage) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  const baseUrl = appBaseUrl();
  const success = `${baseUrl}/?pago=ok`;
  const failure = `${baseUrl}/?pago=erro`;
  const pending = `${baseUrl}/?pago=pendente`;
  const canAutoReturn = isPublicHttps(success);

  const webhookEnv = process.env.MERCADOPAGO_WEBHOOK_URL?.trim();
  const webhook =
    webhookEnv && !webhookEnv.includes("SEU-NGROK")
      ? webhookEnv
      : canAutoReturn
        ? `${baseUrl}/api/webhook`
        : undefined;
  const webhookOk = webhook && isPublicHttps(webhook);

  const body: Record<string, unknown> = {
    items: [
      {
        id: pkg.id,
        title: `Corrida Eleitoral — ${pkg.label}`,
        description:
          "Voto simbólico de paródia. Não é doação de campanha nem voto oficial.",
        quantity: 1,
        currency_id: "BRL",
        unit_price: pkg.amountBrl,
      },
    ],
    metadata: {
      packageId: pkg.id,
      candidate: pkg.candidate,
      action: pkg.action,
      votes: pkg.votes,
    },
    external_reference: pkg.id,
    statement_descriptor: "CORRIDA VOTOS",
  };

  if (canAutoReturn) {
    body.back_urls = { success, failure, pending };
    body.auto_return = "approved";
  }

  if (webhookOk) {
    body.notification_url = webhook;
  }

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercado Pago error: ${err}`);
  }

  return res.json() as Promise<{
    id: string;
    init_point: string;
    sandbox_init_point: string;
  }>;
}

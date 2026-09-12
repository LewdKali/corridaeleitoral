import { PACKAGES, type VotePackage } from "./votes";

const MP_API = "https://api.mercadopago.com";

export function findPackage(id: string): VotePackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

export function hasMercadoPago(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

export function appBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
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

function notificationUrl(): string | undefined {
  const baseUrl = appBaseUrl();
  const webhookEnv = process.env.MERCADOPAGO_WEBHOOK_URL?.trim();
  const webhook =
    webhookEnv && !webhookEnv.includes("SEU-NGROK")
      ? webhookEnv
      : isPublicHttps(baseUrl)
        ? `${baseUrl}/api/webhook`
        : undefined;
  return webhook && isPublicHttps(webhook) ? webhook : undefined;
}

export type PixCharge = {
  paymentId: string;
  status: string;
  amountBrl: number;
  packageId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
  expiresAt?: string;
};

type MpPayment = {
  id: number | string;
  status: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

/** Cria cobrança PIX direta (QR + copia-e-cola na própria página). */
export async function createPixPayment(pkg: VotePackage): Promise<PixCharge> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  const idempotency = crypto.randomUUID();
  const notify = notificationUrl();

  const body: Record<string, unknown> = {
    transaction_amount: pkg.amountBrl,
    description: `Corrida Eleitoral — ${pkg.label}`,
    payment_method_id: "pix",
    external_reference: pkg.id,
    metadata: {
      packageId: pkg.id,
      candidate: pkg.candidate,
      action: pkg.action,
      votes: pkg.votes,
    },
    payer: {
      email: `votante+${Date.now()}@corridaeleitoral.app`,
      first_name: "Votante",
      last_name: "Simbolico",
    },
  };

  if (notify) {
    body.notification_url = notify;
  }

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotency,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercado Pago PIX: ${err}`);
  }

  const payment = (await res.json()) as MpPayment;
  const tx = payment.point_of_interaction?.transaction_data;

  if (!tx?.qr_code) {
    throw new Error(
      "PIX não retornou QR. Ative PIX na conta Mercado Pago (Produção → meios de pagamento).",
    );
  }

  return {
    paymentId: String(payment.id),
    status: payment.status,
    amountBrl: pkg.amountBrl,
    packageId: pkg.id,
    qrCode: tx.qr_code,
    qrCodeBase64: tx.qr_code_base64 ?? "",
    ticketUrl: tx.ticket_url,
    expiresAt: payment.date_of_expiration,
  };
}

export async function getPayment(paymentId: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Pagamento não encontrado");
  }

  return res.json() as Promise<{
    id: number | string;
    status: string;
    external_reference?: string;
    metadata?: { packageId?: string };
  }>;
}

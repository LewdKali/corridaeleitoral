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
  message?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

function parseMpError(text: string): string {
  try {
    const json = JSON.parse(text) as {
      message?: string;
      error?: string;
      cause?: Array<{ description?: string; code?: string }>;
    };
    const cause = json.cause?.map((c) => c.description || c.code).filter(Boolean).join("; ");
    return [json.message || json.error, cause].filter(Boolean).join(" — ") || text;
  } catch {
    return text.slice(0, 400);
  }
}

/** Cria cobrança PIX direta (QR + copia-e-cola). */
export async function createPixPayment(pkg: VotePackage): Promise<PixCharge> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  const notify = notificationUrl();
  const body: Record<string, unknown> = {
    transaction_amount: Number(pkg.amountBrl),
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
      email: `votante.${Date.now()}@gmail.com`,
    },
  };

  if (notify) body.notification_url = notify;

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`PIX falhou: ${parseMpError(raw)}`);
  }

  const payment = JSON.parse(raw) as MpPayment;
  const tx = payment.point_of_interaction?.transaction_data;

  if (!tx?.qr_code) {
    throw new Error(
      "Conta sem PIX liberado no Mercado Pago. Ative PIX em Meios de pagamento ou use o checkout redirecionado.",
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

/** Fallback: Checkout Pro só com PIX (abre no Mercado Pago). */
export async function createPixCheckoutPreference(pkg: VotePackage) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  const baseUrl = appBaseUrl();
  const notify = notificationUrl();
  const canHttps = isPublicHttps(baseUrl);

  const body: Record<string, unknown> = {
    items: [
      {
        id: pkg.id,
        title: `Corrida Eleitoral — ${pkg.label}`,
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
    payment_methods: {
      excluded_payment_types: [
        { id: "credit_card" },
        { id: "debit_card" },
        { id: "ticket" },
        { id: "atm" },
      ],
      installments: 1,
    },
  };

  if (canHttps) {
    body.back_urls = {
      success: `${baseUrl}/?pago=ok`,
      failure: `${baseUrl}/?pago=erro`,
      pending: `${baseUrl}/?pago=pendente`,
    };
    body.auto_return = "approved";
  }
  if (notify) body.notification_url = notify;

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Checkout PIX falhou: ${parseMpError(raw)}`);
  }

  return JSON.parse(raw) as {
    id: string;
    init_point: string;
    sandbox_init_point: string;
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

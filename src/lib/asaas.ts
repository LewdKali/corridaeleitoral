import type { VotePackage } from "./votes";

function asaasBase() {
  return process.env.ASAAS_SANDBOX === "true"
    ? "https://api-sandbox.asaas.com"
    : "https://api.asaas.com";
}

function asaasKey() {
  let raw = process.env.ASAAS_API_KEY?.trim() ?? "";
  if (!raw) return "";

  // Se colaram a chave várias vezes / com $$ da Vercel, pega só o primeiro token válido
  const match = raw.match(/\$?aact_[A-Za-z0-9:_-]+/);
  if (!match) return raw.split(/\s+/)[0] ?? "";

  let key = match[0];
  if (!key.startsWith("$")) key = `$${key}`;
  return key;
}

export function hasAsaas(): boolean {
  return Boolean(asaasKey());
}

async function asaasFetch(path: string, init?: RequestInit) {
  const key = asaasKey();
  if (!key) throw new Error("ASAAS_API_KEY não configurada");

  const res = await fetch(`${asaasBase()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: key,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = json as {
      errors?: Array<{ description?: string }>;
      message?: string;
    } | null;
    const msg =
      err?.errors?.map((e) => e.description).filter(Boolean).join("; ") ||
      err?.message ||
      text.slice(0, 300) ||
      `HTTP ${res.status}`;
    throw new Error(`Asaas: ${msg}`);
  }

  return json;
}

async function getOrCreateCustomer(): Promise<string> {
  const fixed = process.env.ASAAS_CUSTOMER_ID?.trim();
  if (fixed) return fixed;

  const cpf = (process.env.ASAAS_CUSTOMER_CPF ?? "").replace(/\D/g, "");
  if (cpf.length !== 11 && cpf.length !== 14) {
    throw new Error(
      "Asaas exige CPF/CNPJ. Na Vercel, crie ASAAS_CUSTOMER_CPF com o CPF (11 dígitos) ou CNPJ (14) do dono da conta Asaas — só números.",
    );
  }

  const listed = (await asaasFetch(
    `/v3/customers?cpfCnpj=${cpf}&limit=1`,
  )) as { data?: Array<{ id: string }> };

  if (listed.data?.[0]?.id) {
    return listed.data[0].id;
  }

  const customer = (await asaasFetch("/v3/customers", {
    method: "POST",
    body: JSON.stringify({
      name: "Cliente Corrida Eleitoral",
      email: `corrida.${cpf.slice(-4)}@gmail.com`,
      cpfCnpj: cpf,
      notificationDisabled: true,
    }),
  })) as { id: string };

  return customer.id;
}

export type AsaasPixCharge = {
  gateway: "asaas";
  paymentId: string;
  status: string;
  amountBrl: number;
  packageId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt?: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function createAsaasPix(pkg: VotePackage): Promise<AsaasPixCharge> {
  const customer = await getOrCreateCustomer();
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://corridaeleitoral.vercel.app";

  const payment = (await asaasFetch("/v3/payments", {
    method: "POST",
    body: JSON.stringify({
      customer,
      billingType: "PIX",
      value: pkg.amountBrl,
      dueDate: todayISO(),
      description: `Corrida Eleitoral — ${pkg.label}`,
      externalReference: pkg.id,
      postalService: false,
    }),
  })) as { id: string; status: string };

  const qr = (await asaasFetch(`/v3/payments/${payment.id}/pixQrCode`)) as {
    encodedImage?: string;
    payload?: string;
    expirationDate?: string;
  };

  if (!qr.payload) {
    throw new Error(
      "Asaas não retornou QR PIX. Cadastre uma chave PIX na conta Asaas.",
    );
  }

  // webhook URL is configured in Asaas panel; also keep reference in description
  void baseUrl;

  return {
    gateway: "asaas",
    paymentId: payment.id,
    status: payment.status,
    amountBrl: pkg.amountBrl,
    packageId: pkg.id,
    qrCode: qr.payload,
    qrCodeBase64: qr.encodedImage ?? "",
    expiresAt: qr.expirationDate,
  };
}

export async function getAsaasPayment(paymentId: string) {
  const payment = (await asaasFetch(`/v3/payments/${paymentId}`)) as {
    id: string;
    status: string;
    externalReference?: string;
    value?: number;
  };

  const paid =
    payment.status === "RECEIVED" ||
    payment.status === "CONFIRMED" ||
    payment.status === "RECEIVED_IN_CASH";

  return {
    id: payment.id,
    status: paid ? "approved" : payment.status.toLowerCase(),
    rawStatus: payment.status,
    packageId: payment.externalReference ?? "",
    paid,
  };
}

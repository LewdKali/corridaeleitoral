import { NextResponse } from "next/server";
import { persistenceMode, readScore } from "@/lib/score-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const score = await readScore();
  const persistence = persistenceMode();
  const onVercel = Boolean(process.env.VERCEL);

  return NextResponse.json({
    ...score,
    persistence,
    warning:
      onVercel && persistence !== "redis"
        ? "Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel para salvar votos comprados entre deploys."
        : undefined,
  });
}

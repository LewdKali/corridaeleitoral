import { NextResponse } from "next/server";
import { persistenceMode, readScore } from "@/lib/score-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const score = await readScore();
  return NextResponse.json({
    ...score,
    persistence: persistenceMode(),
  });
}

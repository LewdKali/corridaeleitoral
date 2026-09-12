import { NextResponse } from "next/server";
import { readScore, tickSimulation } from "@/lib/score-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const simulate = searchParams.get("tick") !== "0";
  const score = simulate ? await tickSimulation() : await readScore();
  return NextResponse.json(score);
}

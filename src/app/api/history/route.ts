import { NextResponse } from "next/server";
import { loadLeagueHistory } from "@/lib/history-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = await loadLeagueHistory();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[history] Failed to load league history", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

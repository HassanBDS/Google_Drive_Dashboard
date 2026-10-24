export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getFolderStats } from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || undefined;

    const stats = await getFolderStats(folderId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Drive stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}

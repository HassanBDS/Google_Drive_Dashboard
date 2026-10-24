export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listFolder } from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || undefined;
    const pageToken = searchParams.get("pageToken") || undefined;
    const pageSize = parseInt(searchParams.get("pageSize") || "1000", 10);

    const result = await listFolder(folderId, pageToken, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Drive list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list folder" },
      { status: 500 }
    );
  }
}

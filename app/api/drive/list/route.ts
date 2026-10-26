export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listFolder } from "@/lib/google-drive";
import { validateDriveId, validatePositiveInt, ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFolderId = searchParams.get("folderId");
    const folderId = rawFolderId ? validateDriveId(rawFolderId) : undefined;
    const pageToken = searchParams.get("pageToken") || undefined;
    const pageSize = validatePositiveInt(searchParams.get("pageSize"), 1, 1000, 1000);

    const result = await listFolder(folderId, pageToken, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Drive list error:", error);
    const status = error instanceof ValidationError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list folder" },
      { status }
    );
  }
}

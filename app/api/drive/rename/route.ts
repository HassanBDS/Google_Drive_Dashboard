import { NextResponse } from "next/server";
import { renameFile } from "@/lib/google-drive";

export async function POST(request: Request) {
  try {
    const { fileId, newName } = await request.json();

    if (!fileId || !newName) {
      return NextResponse.json(
        { error: "Missing fileId or newName" },
        { status: 400 }
      );
    }

    const result = await renameFile(fileId, newName);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error renaming file:", error);
    const msg = error?.message || "";
    if (msg.includes("sufficient permissions") || msg.includes("Forbidden")) {
      return NextResponse.json(
        { error: "Permission denied: Service account does not have Editor access to this item." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Failed to rename: " + msg },
      { status: 500 }
    );
  }
}

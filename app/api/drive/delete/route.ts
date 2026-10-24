import { NextResponse } from "next/server";
import { deleteFile } from "@/lib/google-drive";

export async function POST(request: Request) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "Missing fileId" },
        { status: 400 }
      );
    }

    const result = await deleteFile(fileId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error deleting file:", error);
    const msg = error?.message || "";
    if (msg.includes("sufficient permissions") || msg.includes("Forbidden")) {
      return NextResponse.json(
        { error: "Permission denied: Service account does not own this item, so it cannot delete it." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete: " + msg },
      { status: 500 }
    );
  }
}

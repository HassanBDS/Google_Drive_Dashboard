export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  readMasterIndex,
  buildFlatSizeMap,
  getActiveCheckpoints,
  FolderSizeCacheData,
} from "@/lib/drive-size-scanner";
import { getDriveName, getRootFolderId } from "@/lib/google-drive";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "data", "size-cache");
    const masterIndex = readMasterIndex();
    const activeCheckpoints = getActiveCheckpoints();
    const flatMap = buildFlatSizeMap();

    const folderCaches: Record<string, FolderSizeCacheData> = {};

    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (
          f === "index.json" ||
          f.endsWith("-checkpoint.json") ||
          f.endsWith(".backup.json") ||
          f === ".gitkeep" ||
          !f.endsWith(".json")
        ) {
          continue;
        }

        try {
          const filePath = path.join(dir, f);
          const raw = fs.readFileSync(filePath, "utf-8");
          const data = JSON.parse(raw) as FolderSizeCacheData;
          if (data && data.folderId) {
            folderCaches[data.folderId] = data;
          }
        } catch {
          // Skip corrupt or unreadable cache files
        }
      }
    }

    const totalSize = (masterIndex?.locales ?? []).reduce((acc, l) => acc + (l.totalSize || 0), 0);
    const totalFiles = (masterIndex?.locales ?? []).reduce((acc, l) => acc + (l.totalFileCount || 0), 0);
    const totalFolders = (masterIndex?.locales ?? []).reduce((acc, l) => acc + (l.totalFolderCount || 0), 0);

    const exportPayload = {
      version: "1.0",
      app: "Google Drive Dashboard",
      exportedAt: new Date().toISOString(),
      metadata: {
        driveName: getDriveName() || "Google Drive",
        rootFolderId: getRootFolderId() || "",
        totalLocalesScanned: masterIndex?.locales?.length ?? 0,
        totalVolumeBytes: totalSize,
        totalFileCount: totalFiles,
        totalFolderCount: totalFolders,
        checkpointsCount: Object.keys(activeCheckpoints).length,
      },
      masterIndex: masterIndex ?? { locales: [], updatedAt: new Date().toISOString() },
      activeCheckpoints,
      flatSizeMap: flatMap,
      folderCaches,
    };

    const formattedDate = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `google-drive-scanner-cache-${formattedDate}.json`;

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Cache export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export scanner cache" },
      { status: 500 }
    );
  }
}

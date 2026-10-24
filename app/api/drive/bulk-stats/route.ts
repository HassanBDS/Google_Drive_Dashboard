import { NextRequest, NextResponse } from "next/server";
import { getFolderShallowStats } from "@/lib/google-drive";
import { buildFlatSizeMap } from "@/lib/drive-size-scanner";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const folderIds: string[] = body.folderIds ?? [];
    const refresh: boolean = body.refresh === true;

    if (!Array.isArray(folderIds) || folderIds.length === 0) {
      return NextResponse.json({});
    }

    const flatSizeMap = buildFlatSizeMap();

    const results = await Promise.allSettled(
      folderIds.map((id) =>
        getFolderShallowStats(id, refresh).then((s) => ({ id, ...s }))
      )
    );

    const out: Record<
      string,
      {
        folderCount: number;
        fileCount: number;
        mediaCount: number;
        xmlCount: number;
        totalSize: number;
        recursiveTotalSize?: number;
        recursiveFileCount?: number;
        recursiveFolderCount?: number;
        directFolderCount?: number;
      }
    > = {};

    for (const r of results) {
      if (r.status === "fulfilled") {
        const { id, ...stats } = r.value;
        const deepData = flatSizeMap[id];
        out[id] = {
          ...stats,
          ...(deepData
            ? {
                recursiveTotalSize: deepData.totalSize,
                recursiveFileCount: deepData.totalFileCount,
                recursiveFolderCount: deepData.totalFolderCount,
                directFolderCount: deepData.folderCount,
              }
            : {}),
        };
      }
    }

    return NextResponse.json(out);
  } catch (error) {
    console.error("Bulk stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk stats failed" },
      { status: 500 }
    );
  }
}

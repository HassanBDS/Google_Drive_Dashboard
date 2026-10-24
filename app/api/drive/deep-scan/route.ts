export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  readFolderSizeCache,
  readMasterIndex,
  isSizeCacheStale,
  runFolderScan,
  buildFlatSizeMap,
  getActiveCheckpoints,
  ScanProgress,
  FolderSizeCacheData,
} from "@/lib/drive-size-scanner";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || null;
    const flat = searchParams.get("flat") === "true";

    const activeCheckpoints = getActiveCheckpoints();
    const index = readMasterIndex();

    if (flat) {
      const flatMap = buildFlatSizeMap(folderId || undefined);
      return NextResponse.json({
        cached: !!index,
        stale: false,
        scannedAt: index?.updatedAt,
        data: flatMap,
        activeCheckpoints,
        locales: index?.locales ?? [],
      });
    }

    if (folderId) {
      const cache = readFolderSizeCache(folderId);
      if (!cache) {
        return NextResponse.json({
          cached: false,
          data: null,
          activeCheckpoints,
          checkpoint: activeCheckpoints[folderId]
            ? { exists: true, ...activeCheckpoints[folderId] }
            : { exists: false },
        });
      }
      return NextResponse.json({
        cached: true,
        stale: isSizeCacheStale(cache),
        scannedAt: cache.scannedAt,
        data: cache.root,
        activeCheckpoints,
        checkpoint: activeCheckpoints[folderId]
          ? { exists: true, ...activeCheckpoints[folderId] }
          : { exists: false },
      });
    }

    return NextResponse.json({
      cached: !!index,
      stale: false,
      scannedAt: index?.updatedAt,
      data: index ?? null,
      activeCheckpoints,
      locales: index?.locales ?? [],
    });
  } catch (error) {
    console.error("Deep scan GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read size cache" },
      { status: 500 }
    );
  }
}

interface ActiveScan {
  folderId: string;
  progress: ScanProgress;
  abortController: AbortController;
}

const activeScanMap = new Map<string, ActiveScan>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const folderId: string | undefined = body.folderId;
    const action: string | undefined = body.action;
    const initialDepth: number = body.initialDepth ?? 1;

    const scanKey = folderId || "root";

    if (action === "stop") {
      const scan = activeScanMap.get(scanKey);
      if (scan) {
        scan.abortController.abort();
        return NextResponse.json({ status: "stopping" });
      }
      return NextResponse.json({ status: "not_running" });
    }

    if (activeScanMap.has(scanKey)) {
      return NextResponse.json({
        status: "already_running",
        progress: activeScanMap.get(scanKey)!.progress,
      });
    }

    const encoder = new TextEncoder();
    const abortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: ScanProgress) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* stream closed */ }
        };

        const progressTracker: ScanProgress = {
          phase: "discovering_titles",
          folderId,
          foldersScanned: 0,
          currentFolder: "",
          elapsedMs: 0,
        };

        const scan: ActiveScan = {
          folderId: scanKey,
          progress: progressTracker,
          abortController,
        };
        activeScanMap.set(scanKey, scan);

        abortController.signal.addEventListener("abort", () => {
          sendEvent({
            phase: "stopping",
            folderId,
            foldersScanned: progressTracker.foldersScanned,
            currentFolder: progressTracker.currentFolder,
            elapsedMs: progressTracker.elapsedMs,
            message: "Scan stopped. Progress saved — click Resume to continue.",
            checkpointExists: true,
          });
          activeScanMap.delete(scanKey);
          try { controller.close(); } catch {}
        });

        const wrappedOnProgress = (progress: ScanProgress) => {
          Object.assign(progressTracker, progress);
          scan.progress = progressTracker;
          sendEvent(progress);
        };

        try {
          if (!folderId) {
            throw new Error("Folder ID is required for scanning.");
          }
          const result = await runFolderScan(folderId, wrappedOnProgress, abortController.signal, initialDepth);
          if (!abortController.signal.aborted) {
            sendEvent({
              phase: "complete",
              folderId,
              foldersScanned: progressTracker.foldersScanned,
              currentFolder: "",
              elapsedMs: result.scanDurationMs ?? 0,
              message: `Scan complete. Total: ${result.root?.totalSize ?? 0} bytes`,
              checkpointExists: false,
            });
          }
        } catch (err) {
          if (!abortController.signal.aborted) {
            sendEvent({
              phase: "error",
              folderId,
              foldersScanned: progressTracker.foldersScanned,
              currentFolder: progressTracker.currentFolder,
              elapsedMs: progressTracker.elapsedMs,
              message: err instanceof Error ? err.message : "Scan failed",
            });
          }
        } finally {
          activeScanMap.delete(scanKey);
          try { controller.close(); } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Deep scan POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start scan" },
      { status: 500 }
    );
  }
}

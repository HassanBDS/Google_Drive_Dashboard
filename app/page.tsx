"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Header from "@/components/Header";
import Breadcrumbs from "@/components/drive/Breadcrumbs";
import BentoMetrics from "@/components/drive/BentoMetrics";
import FolderCardGrid, { FolderStat, SortMode } from "@/components/drive/FolderCard";
import FileTable from "@/components/drive/FileTable";
import FolderInspector from "@/components/drive/FolderInspector";
import ScanProgressPanel from "@/components/drive/ScanProgressPanel";
import DriveConnectingLoader from "@/components/drive/DriveConnectingLoader";
import OnboardingWizard from "@/components/setup/OnboardingWizard";
import styles from "./drive.module.css";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink: string;
  iconLink: string;
  parents: string[];
  isFolder: boolean;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface ListResponse {
  folders: DriveItem[];
  files: DriveItem[];
  breadcrumbs: BreadcrumbItem[];
  nextPageToken?: string;
  error?: string;
}

interface StatsResponse {
  folderCount: number;
  fileCount: number;
  totalSize: number;
  error?: string;
}

export interface FolderScanState {
  isScanning: boolean;
  phase?: string;
  foldersScanned: number;
  currentFolder: string;
  totalTitlesFound?: number;
  totalChaptersFound?: number;
  chaptersProcessed?: number;
  elapsedMs?: number;
  hasCheckpoint?: boolean;
}

interface DeepScanCacheResponse {
  cached: boolean;
  stale: boolean;
  scannedAt?: string;
  data: Record<string, {
    totalSize: number;
    totalFileCount: number;
    totalFolderCount: number;
    folderCount: number;
  }> | null;
  activeCheckpoints?: Record<string, { startedAt: string; foldersScanned: number; folderName?: string }>;
  locales?: Array<{
    folderId: string;
    folderName: string;
    totalSize: number;
    totalFileCount: number;
    totalFolderCount: number;
    folderCount: number;
    scannedAt: string;
  }>;
}

function DriveDashboardContent() {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [folderStats, setFolderStats] = useState<Record<string, FolderStat>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [folderScanStates, setFolderScanStates] = useState<Map<string, FolderScanState>>(new Map());
  const [activeCheckpoints, setActiveCheckpoints] = useState<Record<string, { startedAt: string; foldersScanned: number }>>({});
  const [deepScanData, setDeepScanData] = useState<DeepScanCacheResponse | null>(null);
  const [totalScannedSize, setTotalScannedSize] = useState<number>(0);
  const [inspectedFolder, setInspectedFolder] = useState<DriveItem | null>(null);

  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  // Check initial configuration status
  const checkConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const s = await res.json();
      setIsConfigured(Boolean(s.isConfigured));
      return Boolean(s.isConfigured);
    } catch {
      setIsConfigured(false);
      return false;
    }
  }, []);

  const fetchDeepScanCache = useCallback(async (validFolderIds?: string[]) => {
    try {
      const url = validFolderIds && validFolderIds.length > 0
        ? `/api/drive/deep-scan?flat=true&reconcile=${encodeURIComponent(validFolderIds.join(","))}`
        : "/api/drive/deep-scan?flat=true";
      const res = await fetch(url);
      const result: DeepScanCacheResponse = await res.json();
      setDeepScanData(result);
      setActiveCheckpoints(result.activeCheckpoints ?? {});
      if (result.locales) {
        setTotalScannedSize(result.locales.reduce((s, l) => s + l.totalSize, 0));
      }
    } catch {
      // Non-critical cache read
    }
  }, []);

  const updateFolderScanState = useCallback((folderId: string, update: Partial<FolderScanState>) => {
    setFolderScanStates((prev) => {
      const next = new Map(prev);
      next.set(folderId, {
        ...(prev.get(folderId) ?? { isScanning: false, foldersScanned: 0, currentFolder: "" }),
        ...update,
      });
      return next;
    });
  }, []);

  const fetchBulkStats = useCallback(async (folderIds: string[], refresh = false) => {
    if (folderIds.length === 0) return;
    setStatsLoading(true);
    try {
      const res = await fetch("/api/drive/bulk-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderIds, refresh }),
      });
      const bulk: Record<string, FolderStat> = await res.json();
      setFolderStats((prev) => ({ ...prev, ...bulk }));
    } catch {
      // Non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const startFolderScan = useCallback(async (folderId: string, depth = 0) => {
    if (folderScanStates.get(folderId)?.isScanning) return;

    const controller = new AbortController();
    abortRefs.current.set(folderId, controller);

    updateFolderScanState(folderId, {
      isScanning: true,
      foldersScanned: 0,
      currentFolder: "Starting scan...",
      phase: "scanning",
    });

    try {
      const res = await fetch("/api/drive/deep-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, action: "start", depth }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Deep scan request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const block of lines) {
          const line = block.trim();
          if (!line.startsWith("data:")) continue;

          try {
            const progress = JSON.parse(line.slice(5).trim());

            updateFolderScanState(folderId, {
              isScanning: progress.phase !== "complete" && progress.phase !== "error" && progress.phase !== "stopped",
              phase: progress.phase,
              foldersScanned: progress.foldersScanned,
              currentFolder: progress.currentFolder || "",
              totalTitlesFound: progress.totalTitlesFound,
              totalChaptersFound: progress.totalChaptersFound,
              chaptersProcessed: progress.chaptersProcessed,
              elapsedMs: progress.elapsedMs,
              hasCheckpoint: progress.phase === "stopping",
            });

            if (progress.phase === "complete" || progress.phase === "error" || progress.phase === "stopping") {
              await fetchDeepScanCache();
              if (data?.folders.length) fetchBulkStats(data.folders.map((f) => f.id));
            }
          } catch {
            // Malformed SSE chunk
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error(`Folder scan error [${folderId}]:`, err);
      }
    } finally {
      updateFolderScanState(folderId, { isScanning: false });
      abortRefs.current.delete(folderId);
    }
  }, [folderScanStates, updateFolderScanState, fetchDeepScanCache, fetchBulkStats, data?.folders]);

  const stopFolderScan = useCallback(async (folderId: string) => {
    updateFolderScanState(folderId, { phase: "stopping" });
    try {
      await fetch("/api/drive/deep-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, action: "stop" }),
      });
    } catch (err) {
      console.error(`Failed to stop scan [${folderId}]:`, err);
    }
  }, [updateFolderScanState]);

  const fetchFolder = useCallback(async (folderId?: string) => {
    setLoading(true);
    setError(null);
    setFolderStats({});
    try {
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/drive/list?${params}`),
        fetch(`/api/drive/stats?${params}`),
      ]);

      const listData: ListResponse = await listRes.json();
      const statsData: StatsResponse = await statsRes.json();

      if (listData.error) throw new Error(listData.error);
      if (statsData.error) throw new Error(statsData.error);

      setData(listData);
      setStats(statsData);
      setIsConfigured(true);

      if (listData.folders.length > 0) {
        fetchBulkStats(listData.folders.map((f) => f.id));
      }

      if (!folderId && listData.folders.length > 0) {
        fetchDeepScanCache(listData.folders.map((f) => f.id));
      } else {
        fetchDeepScanCache();
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to load Google Drive folder";
      setError(msg);
      // If error indicates missing credentials, prompt setup wizard
      if (msg.includes("Credentials file not found") || msg.includes("Root Folder ID is required")) {
        setIsConfigured(false);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchBulkStats, fetchDeepScanCache]);

  useEffect(() => {
    checkConfig().then((configured) => {
      if (configured) {
        fetchFolder(currentFolder || undefined);
        fetchDeepScanCache();
      } else {
        setLoading(false);
      }
    });
  }, [checkConfig, currentFolder, fetchFolder, fetchDeepScanCache]);

  const handleNavigate = (folderId: string) => {
    setCurrentFolder(folderId);
    setSearch("");
  };

  // Global keyboard navigation: Backspace navigates to parent directory
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace") {
        const target = e.target as HTMLElement | null;
        const isInput =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.isContentEditable;

        if (!isInput && data && data.breadcrumbs.length > 1) {
          e.preventDefault();
          const parentItem = data.breadcrumbs[data.breadcrumbs.length - 2];
          if (parentItem) {
            handleNavigate(parentItem.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [data]);

  const handleRefresh = () => fetchFolder(currentFolder || undefined);
  const handleRefreshStats = () => {
    if (!data) return;
    fetchBulkStats(data.folders.map((f) => f.id), true);
  };

  const filterBySearch = (items: DriveItem[]) => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  };

  const filteredFolders = data ? filterBySearch(data.folders) : [];
  const filteredFiles = data ? filterBySearch(data.files).sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    return sortMode === "name-desc" ? -cmp : cmp;
  }) : [];

  const currentFolderId = currentFolder || undefined;
  const deepData = deepScanData?.data;
  const currentDeepStats = currentFolderId && deepData ? deepData[currentFolderId] : undefined;
  const rootDeepStats = !currentFolderId && deepScanData?.locales
    ? deepScanData.locales.reduce<{ totalSize: number; totalFileCount: number; totalFolderCount: number; folderCount: number }>(
        (acc, v) => ({
          totalSize: acc.totalSize + (v.totalSize || 0),
          totalFileCount: acc.totalFileCount + (v.totalFileCount || 0),
          totalFolderCount: acc.totalFolderCount + (v.totalFolderCount || 0),
          folderCount: acc.folderCount + (v.folderCount || 0),
        }),
        { totalSize: 0, totalFileCount: 0, totalFolderCount: 0, folderCount: 0 }
      )
    : undefined;

  const effectiveDeepStats = currentDeepStats || rootDeepStats;
  const depth = data ? Math.max(0, data.breadcrumbs.length - 1) : 0;
  const anyScanning = Array.from(folderScanStates.values()).some((s) => s.isScanning);

  // If unconfigured, display user-friendly Onboarding Wizard
  if (isConfigured === false) {
    return (
      <>
        <Header title="Google Drive Setup" />
        <div className="page-content" style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 32px", width: "100%" }}>
          <OnboardingWizard
            onConfigured={() => {
              setIsConfigured(true);
              fetchFolder();
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Google Drive Dashboard"
        searchValue={search}
        searchPlaceholder="Filter files and folders..."
        onSearchChange={setSearch}
        searchDisabled={true}
      />

      <div className="page-content" style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 32px", width: "100%" }}>
        {error && (
          <div className={styles.errorBox}>
            <div className={styles.errorTitle}>Configuration or Connection Notice</div>
            <div className={styles.errorMsg}>{error}</div>
            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
              <button className={styles.retryBtn} onClick={handleRefresh}>Retry Connection</button>
              <a
                href="/settings"
                className={styles.retryBtn}
                style={{ textDecoration: "none", background: "var(--accent)", color: "#fff" }}
              >
                Open Settings
              </a>
            </div>
          </div>
        )}

        {loading && !data && (
          <DriveConnectingLoader />
        )}

        {data && (
          <>
            <Breadcrumbs items={data.breadcrumbs} onNavigate={handleNavigate} />

            <BentoMetrics
              folderCount={stats?.folderCount ?? 0}
              fileCount={stats?.fileCount ?? 0}
              totalSize={stats?.totalSize ?? 0}
              isLoading={loading || statsLoading}
              depth={depth}
              recursiveTotalSize={effectiveDeepStats?.totalSize ?? (totalScannedSize > 0 ? totalScannedSize : undefined)}
              recursiveFileCount={effectiveDeepStats?.totalFileCount}
              recursiveFolderCount={effectiveDeepStats?.totalFolderCount}
              directFolderCount={effectiveDeepStats?.folderCount}
              scanCacheAge={deepScanData?.scannedAt}
              isCacheStale={deepScanData?.stale}
              scannedLocalesCount={deepScanData?.locales?.length ?? 0}
              totalLocalesCount={stats?.folderCount ?? 0}
              files={data.files}
              folders={data.folders}
              folderStats={folderStats}
              folderScanStates={folderScanStates}
              activeCheckpoints={activeCheckpoints}
              onStartScan={(folderId) => startFolderScan(folderId, depth + 1)}
              onRefresh={handleRefresh}
              currentFolderId={currentFolder || undefined}
            />

            {anyScanning && (
              <ScanProgressPanel
                folderScanStates={folderScanStates}
                onStop={stopFolderScan}
              />
            )}

            <FolderCardGrid
              folders={filteredFolders}
              onOpen={handleNavigate}
              folderStats={folderStats}
              statsLoading={statsLoading}
              onRefreshStats={handleRefreshStats}
              sortMode={sortMode}
              onSortChange={setSortMode}
              onRefresh={handleRefresh}
              depth={depth}
              folderScanStates={folderScanStates}
              activeCheckpoints={activeCheckpoints}
              onStartFolderScan={(folderId) => startFolderScan(folderId, depth + 1)}
              onStopFolderScan={stopFolderScan}
              parentTotalSize={effectiveDeepStats?.totalSize ?? (totalScannedSize > 0 ? totalScannedSize : undefined)}
              onInspect={(folderId) => {
                const target = data?.folders.find((f) => f.id === folderId);
                if (target) setInspectedFolder(target);
              }}
            />

            <FileTable files={filteredFiles} onRefresh={handleRefresh} />

            <FolderInspector
              folder={inspectedFolder}
              isOpen={Boolean(inspectedFolder)}
              onClose={() => setInspectedFolder(null)}
              folderStats={inspectedFolder ? folderStats[inspectedFolder.id] : undefined}
              scanState={inspectedFolder ? folderScanStates.get(inspectedFolder.id) : undefined}
              checkpoint={inspectedFolder ? activeCheckpoints[inspectedFolder.id] : undefined}
              onStartScan={(folderId) => startFolderScan(folderId, depth + 1)}
              onStopScan={stopFolderScan}
              onOpenFolder={handleNavigate}
              onRefresh={handleRefresh}
            />
          </>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "var(--text-muted)" }}>Loading Dashboard...</div>}>
      <DriveDashboardContent />
    </Suspense>
  );
}

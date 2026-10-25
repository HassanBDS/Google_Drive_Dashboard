"use client";

import React, { useMemo } from "react";
import {
  HardDrive,
  Activity,
  ShieldCheck,
  FolderX,
  Copy,
  Clock,
  PlayCircle,
  FileBox,
  RefreshCw,
} from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";
import { analyzeStorageHygiene, DriveItemMeta, FolderStatMeta } from "@/lib/hygiene-utils";
import { StorageDonutChart } from "@/components/charts";
import styles from "./BentoMetrics.module.css";

export interface BentoMetricsProps {
  folderCount: number;
  fileCount: number;
  totalSize: number;
  isLoading?: boolean;
  depth?: number;
  recursiveTotalSize?: number;
  recursiveFileCount?: number;
  recursiveFolderCount?: number;
  directFolderCount?: number;
  scanCacheAge?: string | null;
  isCacheStale?: boolean;
  scannedLocalesCount?: number;
  totalLocalesCount?: number;
  files?: DriveItemMeta[];
  folders?: DriveItemMeta[];
  folderStats?: Record<string, FolderStatMeta>;
  folderScanStates?: Map<
    string,
    {
      isScanning: boolean;
      phase?: string;
      foldersScanned: number;
      currentFolder: string;
      elapsedMs?: number;
    }
  >;
  activeCheckpoints?: Record<
    string,
    { startedAt: string; foldersScanned: number; folderName?: string }
  >;
  onStartScan?: (folderId: string) => void;
  onRefresh?: () => void;
  currentFolderId?: string;
}

export default function BentoMetrics({
  folderCount,
  fileCount,
  totalSize,
  isLoading = false,
  depth = 0,
  recursiveTotalSize,
  recursiveFileCount,
  recursiveFolderCount,
  directFolderCount,
  scanCacheAge,
  isCacheStale = false,
  scannedLocalesCount = 0,
  totalLocalesCount = 0,
  files = [],
  folders = [],
  folderStats = {},
  folderScanStates,
  activeCheckpoints = {},
  onStartScan,
  onRefresh,
  currentFolderId,
}: BentoMetricsProps) {
  // 1. Data calculations
  const effectiveSize = recursiveTotalSize !== undefined && recursiveTotalSize > 0
    ? recursiveTotalSize
    : totalSize;

  const effectiveFileCount = recursiveFileCount ?? fileCount;
  const effectiveFolderCount = directFolderCount ?? folderCount;

  // 2. Active scanning state
  const scanningCount = useMemo(() => {
    if (!folderScanStates) return 0;
    return Array.from(folderScanStates.values()).filter((s) => s.isScanning).length;
  }, [folderScanStates]);

  const isScanning = scanningCount > 0;

  // 3. Active Checkpoints
  const checkpointCount = Object.keys(activeCheckpoints).length;
  const firstCheckpoint = Object.entries(activeCheckpoints)[0];

  // 4. Hygiene Report
  const hygiene = useMemo(() => {
    return analyzeStorageHygiene(folders, files, folderStats);
  }, [folders, files, folderStats]);

  // Scanned progress percent
  const scanProgressPercent = useMemo(() => {
    if (totalLocalesCount > 0 && scannedLocalesCount > 0) {
      return Math.min(100, Math.round((Math.min(scannedLocalesCount, totalLocalesCount) / totalLocalesCount) * 100));
    }
    return depth > 0 && effectiveSize > 0 ? 100 : 0;
  }, [scannedLocalesCount, totalLocalesCount, depth, effectiveSize]);

  // 5. Zero Layout Shift Skeleton
  if (isLoading) {
    return (
      <div className={styles.bentoContainer} aria-busy="true" aria-label="Loading analytics overview">
        <div className={styles.bentoGrid}>
          <div className={`${styles.skeletonCard} ${styles.heroCard}`}>
            <div className={styles.skeletonLine} style={{ width: 140, height: 18, marginBottom: 16 }} />
            <div className={styles.skeletonLine} style={{ width: 220, height: 38, marginBottom: 12 }} />
            <div className={styles.skeletonLine} style={{ width: "80%", height: 14, marginBottom: 20 }} />
            <div className={styles.skeletonLine} style={{ width: "100%", height: 8 }} />
          </div>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonLine} style={{ width: 120, height: 18, marginBottom: 16 }} />
            <div className={styles.skeletonLine} style={{ width: "100%", height: 28, marginBottom: 10 }} />
            <div className={styles.skeletonLine} style={{ width: "90%", height: 24, marginBottom: 10 }} />
            <div className={styles.skeletonLine} style={{ width: "70%", height: 24 }} />
          </div>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonLine} style={{ width: 120, height: 18, marginBottom: 16 }} />
            <div className={styles.skeletonLine} style={{ width: "100%", height: 28, marginBottom: 10 }} />
            <div className={styles.skeletonLine} style={{ width: "90%", height: 24, marginBottom: 10 }} />
            <div className={styles.skeletonLine} style={{ width: "70%", height: 24 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.bentoContainer} role="region" aria-label="Drive analytics overview">
      <div className={styles.bentoGrid}>
        {/* ── 1. Hero Storage Card (2x1 Dominance) ────────────────────────── */}
        <div className={`${styles.card} ${styles.heroCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.iconWrap}>
                <HardDrive size={18} />
              </div>
              <h2 className={styles.cardTitle}>Storage Overview</h2>
            </div>
            <span className={styles.depthBadge}>
              {depth === 0 ? "Root Drive Overview" : "Subfolder Deep-Dive"}
            </span>
          </div>

          <div className={styles.heroLayout}>
            <div className={styles.heroMetrics}>
              <div className={styles.heroValueRow}>
                <span className={styles.heroValue}>
                  {effectiveSize > 0 ? formatBytes(effectiveSize) : "—"}
                </span>
                <span className={styles.heroValueSub}>
                  {depth === 0 ? "total scanned" : "recursive volume"}
                </span>
              </div>

              <div className={styles.heroSubtitle}>
                {depth === 0
                  ? scannedLocalesCount > 0
                    ? `${Math.min(scannedLocalesCount, totalLocalesCount || folderCount)} of ${totalLocalesCount || folderCount} top-level directories scanned`
                    : "Scan directories to calculate deep recursive storage usage"
                  : `${effectiveFolderCount.toLocaleString()} folder${effectiveFolderCount !== 1 ? "s" : ""}, ${effectiveFileCount.toLocaleString()} file${effectiveFileCount !== 1 ? "s" : ""}`}
              </div>

              {/* Progress bar */}
              <div className={styles.heroProgressWrap}>
                <div className={styles.heroProgressBar}>
                  <div
                    className={styles.heroProgressFill}
                    style={{ width: `${Math.max(4, scanProgressPercent)}%` }}
                  />
                </div>
                <div className={styles.heroProgressLabels}>
                  <span>
                    {depth === 0
                      ? `${scanProgressPercent}% directories scanned`
                      : "Recursive hierarchy analyzed"}
                  </span>
                  <span>{effectiveFileCount.toLocaleString()} files</span>
                </div>
              </div>
            </div>

            {/* Embedded compact donut or category breakdown */}
            {files.length > 0 && (
              <div className={styles.heroChartMini}>
                <StorageDonutChart
                  files={files}
                  totalBytes={effectiveSize}
                  title="Storage Types"
                  subtitle=""
                  compact={true}
                  className={styles.miniChartOverride}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Live Scan Telemetry Card (1x1) ─────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.headerLeft}>
              <div
                className={`${styles.iconWrap} ${isScanning
                    ? styles.iconWrapSuccess
                    : checkpointCount > 0
                      ? styles.iconWrapAccent
                      : ""
                  }`}
              >
                <Activity size={18} />
              </div>
              <h3 className={styles.cardTitle}>Scan Telemetry</h3>
            </div>
            <span
              className={`${styles.pulseDot} ${isScanning
                  ? styles.pulseDotScanning
                  : checkpointCount > 0
                    ? styles.pulseDotCheckpoint
                    : ""
                }`}
              title={isScanning ? "Scan in progress" : "Scanner idle"}
            />
          </div>

          <div className={styles.telemetryBody}>
            <div className={styles.telemetryRow}>
              <span className={styles.telemetryLabel}>Status</span>
              <span
                className={styles.telemetryVal}
                style={{ color: isScanning ? "var(--color-primary, #3B82F6)" : undefined }}
              >
                {isScanning
                  ? `Active (${scanningCount} scan${scanningCount !== 1 ? "s" : ""})`
                  : "Idle"}
              </span>
            </div>

            <div className={styles.telemetryRow}>
              <span className={styles.telemetryLabel}>
                <Clock size={13} /> Cache State
              </span>
              <span className={styles.telemetryVal}>
                {scanCacheAge ? formatDate(scanCacheAge) : "Uncached"}
              </span>
            </div>

            <div className={styles.telemetryRow}>
              <span className={styles.telemetryLabel}>Freshness</span>
              <span
                className={styles.telemetryVal}
                style={{ color: isCacheStale ? "#F59E0B" : "#10B981" }}
              >
                {isCacheStale ? "Stale / Outdated" : "Fresh"}
              </span>
            </div>

            <div className={styles.telemetryRow}>
              <span className={styles.telemetryLabel}>Saved Checkpoints</span>
              <span className={styles.telemetryVal}>
                {checkpointCount > 0
                  ? `${checkpointCount} saved`
                  : "None"}
              </span>
            </div>

            {/* Operational Action Buttons */}
            <div className={styles.telemetryActions}>
              {onRefresh && (
                <button
                  type="button"
                  className={styles.telemetryActionBtn}
                  onClick={onRefresh}
                  title="Revalidate cache and reload telemetry"
                >
                  <RefreshCw size={13} />
                  <span>Refresh Cache</span>
                </button>
              )}
              {onStartScan && currentFolderId && (
                <button
                  type="button"
                  className={`${styles.telemetryActionBtn} ${styles.telemetryActionBtnPrimary}`}
                  onClick={() => onStartScan(currentFolderId)}
                  disabled={isScanning}
                  title={isScanning ? "Scans running" : "Deep scan current folder"}
                >
                  <PlayCircle size={13} />
                  <span>{isScanning ? "Scanning Active" : "Scan Folder"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. Storage Hygiene Card (1x1) ─────────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.headerLeft}>
              <div
                className={`${styles.iconWrap} ${hygiene.status === "optimal"
                    ? styles.iconWrapSuccess
                    : styles.iconWrapAccent
                  }`}
              >
                <ShieldCheck size={18} />
              </div>
              <h3 className={styles.cardTitle}>Storage Hygiene</h3>
            </div>
            <span
              className={`${styles.hygieneScoreBadge} ${hygiene.status === "warning"
                  ? styles.hygieneScoreWarning
                  : hygiene.status === "good"
                    ? ""
                    : ""
                }`}
            >
              {hygiene.score}/100
            </span>
          </div>

          <div className={styles.hygieneBody}>
            <div className={styles.hygieneItem}>
              <span className={styles.hygieneItemLabel}>
                <FolderX size={13} /> Empty Directories
              </span>
              <span className={styles.hygieneItemVal}>
                {hygiene.emptyFoldersCount > 0
                  ? `${hygiene.emptyFoldersCount} found`
                  : "0 empty"}
              </span>
            </div>

            <div className={styles.hygieneItem}>
              <span className={styles.hygieneItemLabel}>
                <Copy size={13} /> Duplicate Candidates
              </span>
              <span className={styles.hygieneItemVal}>
                {hygiene.duplicateCandidatesCount > 0
                  ? `${hygiene.duplicateCandidatesCount} (${formatBytes(
                    hygiene.duplicateEstimatedBytes
                  )})`
                  : "None flagged"}
              </span>
            </div>

            <div className={styles.hygieneItem}>
              <span className={styles.hygieneItemLabel}>
                <FileBox size={13} /> Large Files (&gt;100MB)
              </span>
              <span className={styles.hygieneItemVal}>
                {hygiene.largeFilesCount > 0
                  ? `${hygiene.largeFilesCount} (${formatBytes(
                    hygiene.largeFilesTotalBytes
                  )})`
                  : "0 files"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

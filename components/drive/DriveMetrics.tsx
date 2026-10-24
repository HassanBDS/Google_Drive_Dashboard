"use client";

import { Folder, Layers, HardDrive } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import styles from "./DriveMetrics.module.css";

interface DriveMetricsProps {
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
}

export default function DriveMetrics({
  folderCount,
  fileCount,
  totalSize,
  isLoading = false,
  depth = 0,
  recursiveTotalSize,
  recursiveFolderCount,
  directFolderCount,
  scannedLocalesCount = 0,
  totalLocalesCount = 0,
}: DriveMetricsProps) {
  const hasDeepData = recursiveTotalSize !== undefined && recursiveTotalSize > 0;

  const getMetrics = () => {
    if (depth === 0) {
      return [
        {
          label: "Root Folders",
          value: folderCount.toLocaleString(),
          subtitle: scannedLocalesCount > 0
            ? `${scannedLocalesCount} of ${totalLocalesCount || folderCount} scanned`
            : "top-level directories",
          icon: Layers,
          accent: false,
        },
        {
          label: "Nested Items",
          value: hasDeepData && directFolderCount !== undefined ? directFolderCount.toLocaleString() : "—",
          subtitle: hasDeepData ? "scanned folder totals" : "scan folders to see totals",
          icon: Folder,
          accent: false,
        },
        {
          label: "Total Size",
          value: hasDeepData ? formatBytes(recursiveTotalSize!) : "—",
          subtitle: hasDeepData
            ? `${scannedLocalesCount} folder${scannedLocalesCount !== 1 ? "s" : ""} scanned`
            : "scan to calculate size",
          icon: HardDrive,
          accent: hasDeepData,
        },
      ];
    }

    if (depth === 1) {
      return [
        {
          label: "Subfolders",
          value: hasDeepData && directFolderCount !== undefined
            ? directFolderCount.toLocaleString()
            : folderCount.toLocaleString(),
          subtitle: "folders in this view",
          icon: Folder,
          accent: false,
        },
        {
          label: "Nested Subtrees",
          value: hasDeepData && recursiveFolderCount !== undefined
            ? (recursiveFolderCount - (directFolderCount ?? 0)).toLocaleString()
            : "—",
          subtitle: "total across nested levels",
          icon: Layers,
          accent: false,
        },
        {
          label: "Total Size",
          value: hasDeepData ? formatBytes(recursiveTotalSize!) : "—",
          subtitle: hasDeepData ? "all nested content" : "scan this folder",
          icon: HardDrive,
          accent: hasDeepData,
        },
      ];
    }

    return [
      {
        label: "Subfolders",
        value: (directFolderCount ?? folderCount).toLocaleString(),
        subtitle: "at this level",
        icon: Layers,
        accent: false,
      },
      {
        label: "Files",
        value: fileCount.toLocaleString(),
        subtitle: "files at this level",
        icon: Folder,
        accent: false,
      },
      {
        label: "Total Size",
        value: hasDeepData ? formatBytes(recursiveTotalSize!) : formatBytes(totalSize),
        subtitle: hasDeepData ? "recursive content" : "this level",
        icon: HardDrive,
        accent: hasDeepData,
      },
    ];
  };

  const metrics = getMetrics();

  return (
    <div className={styles.metricsWrapper}>
      <div className={styles.metrics}>
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`${styles.card} ${isLoading ? styles.skeleton : ""} ${m.accent ? styles.deepCard : ""} fade-in`}
          >
            <div className={styles.iconWrap}>
              <m.icon size={18} />
            </div>
            <div className={styles.label}>{m.label}</div>
            <div className={styles.value}>
              {isLoading ? <div className="skeleton" style={{ width: 60, height: 28 }} /> : m.value}
            </div>
            {!isLoading && m.subtitle && (
              <div className={styles.subtitle}>{m.subtitle}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

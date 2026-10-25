"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Folder,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  LayoutGrid,
  List,
  ArrowDownAZ,
  ArrowUpZA,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Square,
  PlayCircle,
  HardDrive,
  Hash,
  Eye,
} from "lucide-react";
import { detectLanguage, formatBytes } from "@/lib/utils";
import styles from "./FolderCard.module.css";
import type { FolderScanState } from "@/app/page";

export interface FolderStat {
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

export interface FolderItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

export type SortMode = "name-asc" | "name-desc" | "size-desc" | "count-desc";

export interface FolderCardGridProps {
  folders: FolderItem[];
  onOpen: (folderId: string) => void;
  folderStats?: Record<string, FolderStat>;
  statsLoading?: boolean;
  onRefreshStats?: () => void;
  sortMode?: SortMode;
  onSortChange?: (mode: SortMode) => void;
  onRefresh?: () => void;
  depth?: number;
  folderScanStates?: Map<string, FolderScanState>;
  activeCheckpoints?: Record<
    string,
    { startedAt: string; foldersScanned: number; folderName?: string }
  >;
  onStartFolderScan?: (folderId: string) => void;
  onStopFolderScan?: (folderId: string) => void;
  onInspect?: (folderId: string) => void;
  parentTotalSize?: number;
}

function getWarning(
  stats: FolderStat | undefined
): { label: string; level: "error" | "warn" } | null {
  if (!stats) return null;
  const { folderCount, fileCount, mediaCount, xmlCount } = stats;
  if (folderCount === 0) {
    if (fileCount === 0) return { label: "Empty", level: "error" };
    if (mediaCount === 0 && xmlCount > 0 && xmlCount === fileCount) {
      return { label: "XML only", level: "error" };
    }
    if (mediaCount === 0) return { label: "No media", level: "warn" };
  }
  return null;
}

function getScore(stats?: FolderStat) {
  if (!stats) return 0;
  return stats.folderCount * 10000 + stats.fileCount * 100 + stats.mediaCount;
}

export default function FolderCardGrid({
  folders,
  onOpen,
  folderStats,
  statsLoading,
  onRefreshStats,
  sortMode = "name-asc",
  onSortChange,
  onRefresh,
  depth = 0,
  folderScanStates,
  activeCheckpoints,
  onStartFolderScan,
  onStopFolderScan,
  onInspect,
  parentTotalSize,
}: FolderCardGridProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("folderLayout");
    if (saved === "list" || saved === "grid") setLayout(saved);
  }, []);

  if (folders.length === 0) return null;

  const handleLayoutToggle = (newLayout: "grid" | "list") => {
    setLayout(newLayout);
    localStorage.setItem("folderLayout", newLayout);
  };

  const handleRename = async (
    e: React.MouseEvent | React.KeyboardEvent,
    id: string,
    oldName: string
  ) => {
    e.stopPropagation();
    if (editName === oldName || !editName.trim()) {
      setEditingId(null);
      return;
    }
    setIsUpdating(id);
    try {
      const res = await fetch("/api/drive/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id, newName: editName.trim() }),
      });
      if (res.ok) {
        onRefresh?.();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to rename");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setIsUpdating(null);
      setEditingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to move this folder to trash?")) return;
    setIsUpdating(id);
    try {
      const res = await fetch("/api/drive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id }),
      });
      if (res.ok) {
        onRefresh?.();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setIsUpdating(null);
    }
  };

  // Duplicate detection
  const folderGroups = new Map<string, FolderItem[]>();
  folders.forEach((f) => {
    const key = f.name.toLowerCase().trim();
    if (!folderGroups.has(key)) folderGroups.set(key, []);
    folderGroups.get(key)!.push(f);
  });
  const duplicateMap = new Map<string, { isDuplicate: boolean; isSmaller: boolean }>();
  folderGroups.forEach((group) => {
    if (group.length > 1) {
      if (folderStats && Object.keys(folderStats).length > 0) {
        const maxScore = Math.max(...group.map((f) => getScore(folderStats[f.id])));
        group.forEach((f) => {
          duplicateMap.set(f.id, {
            isDuplicate: true,
            isSmaller: getScore(folderStats[f.id]) < maxScore,
          });
        });
      } else {
        group.forEach((f) =>
          duplicateMap.set(f.id, { isDuplicate: true, isSmaller: false })
        );
      }
    }
  });

  const atRoot = depth === 0;

  // Maximum size for proportional bar calculations
  const maxFolderSize = Math.max(
    parentTotalSize || 0,
    ...folders.map(
      (f) =>
        folderStats?.[f.id]?.recursiveTotalSize ||
        folderStats?.[f.id]?.totalSize ||
        0
    ),
    1
  );

  const sortFolders = (list: FolderItem[]) => {
    const sorted = [...list];
    if (sortMode === "name-asc") {
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
    } else if (sortMode === "name-desc") {
      sorted.sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" })
      );
    } else if (sortMode === "size-desc") {
      sorted.sort((a, b) => {
        const sA =
          folderStats?.[a.id]?.recursiveTotalSize ?? folderStats?.[a.id]?.totalSize ?? 0;
        const sB =
          folderStats?.[b.id]?.recursiveTotalSize ?? folderStats?.[b.id]?.totalSize ?? 0;
        return sB - sA;
      });
    } else if (sortMode === "count-desc") {
      sorted.sort((a, b) => {
        const cA =
          folderStats?.[a.id]?.directFolderCount ?? folderStats?.[a.id]?.folderCount ?? 0;
        const cB =
          folderStats?.[b.id]?.directFolderCount ?? folderStats?.[b.id]?.folderCount ?? 0;
        return cB - cA;
      });
    }
    return sorted;
  };

  const sortedFolders = sortFolders(folders);

  // Keyboard navigation across cards
  const handleCardKeyDown = (e: React.KeyboardEvent, index: number, folderId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(folderId);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (index + 1) % sortedFolders.length;
      cardRefs.current[next]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (index - 1 + sortedFolders.length) % sortedFolders.length;
      cardRefs.current[prev]?.focus();
    }
  };

  const renderCard = (folder: FolderItem, i: number) => {
    const lang = atRoot ? detectLanguage(folder.name) : null;
    const stats = folderStats?.[folder.id];
    let warning = getWarning(stats);

    const dupInfo = duplicateMap.get(folder.id);
    if (dupInfo?.isDuplicate) {
      warning = dupInfo.isSmaller
        ? { label: "Duplicate (Smaller)", level: "error" }
        : { label: "Duplicate", level: "warn" };
    }

    const scanState = folderScanStates?.get(folder.id);
    const checkpoint = activeCheckpoints?.[folder.id];
    const isThisScanning = scanState?.isScanning ?? false;
    const hasCheckpoint = !!checkpoint || scanState?.hasCheckpoint;
    const isStopping = scanState?.phase === "stopping";

    const effectiveFolderSize = stats?.recursiveTotalSize ?? stats?.totalSize ?? 0;
    const folderPercent =
      maxFolderSize > 0 && effectiveFolderSize > 0
        ? Math.min(100, Math.round((effectiveFolderSize / maxFolderSize) * 100))
        : 0;

    return (
      <div
        key={folder.id}
        ref={(el) => {
          cardRefs.current[i] = el;
        }}
        tabIndex={0}
        role="button"
        aria-label={`Folder: ${folder.name}, ${effectiveFolderSize > 0 ? formatBytes(effectiveFolderSize) : "size uncalculated"}`}
        className={`${styles.card} ${
          warning ? styles[`warn_${warning.level}`] : ""
        } ${isThisScanning ? styles.scanningCard : ""} fade-in`}
        style={{ animationDelay: `${i * 30}ms` }}
        onClick={() => onOpen(folder.id)}
        onKeyDown={(e) => handleCardKeyDown(e, i, folder.id)}
      >
        {/* Top row: Icon, Name, and Language badge */}
        <div className={styles.cardTopRow}>
          <div className={styles.folderLeftGroup}>
            <div className={styles.folderIcon} aria-hidden="true">
              📁
            </div>
            <div className={styles.nameWrap}>
              <div className={styles.nameRow}>
                {editingId === folder.id ? (
                  <div className={styles.editWrap} onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      className={styles.editInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(e, folder.id, folder.name);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      className={styles.saveBtn}
                      onClick={(e) => handleRename(e, folder.id, folder.name)}
                      disabled={isUpdating === folder.id}
                    >
                      {isUpdating === folder.id ? (
                        <Loader2 size={12} className={styles.spinning} />
                      ) : (
                        <Check size={12} />
                      )}
                    </button>
                    <button
                      className={styles.cancelBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(null);
                      }}
                      disabled={isUpdating === folder.id}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.name} title={folder.name}>
                      {lang ? lang.label : folder.name}
                    </div>
                    {lang && (
                      <span className={styles.langBadge}>{lang.code}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <ArrowRight className={styles.cardHoverArrow} size={15} />
        </div>

        {/* Proportional storage bar */}
        {effectiveFolderSize > 0 && (
          <div className={styles.proportionalBarWrap}>
            <div className={styles.proportionalBar}>
              <div
                className={styles.proportionalFill}
                style={{ width: `${Math.max(6, folderPercent)}%` }}
              />
            </div>
            <div className={styles.proportionalLabels}>
              <span className={styles.proportionalSize}>
                {formatBytes(effectiveFolderSize)}
              </span>
              {folderPercent > 0 && (
                <span className={styles.proportionalPercent}>
                  {folderPercent}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Inline scan progress ticker */}
        {isThisScanning && scanState && (
          <div className={styles.scanInlineProgress}>
            <span>
              {scanState.phase === "resuming"
                ? "▶ Resuming…"
                : scanState.phase === "calculating_sizes"
                ? `💾 ${scanState.foldersScanned.toLocaleString()} folders scanned`
                : "📂 Discovering subtrees…"}
            </span>
            <span className={styles.scanInlineFolder}>{scanState.currentFolder}</span>
          </div>
        )}

        {/* Bottom row: Chips, Warnings, Actions, Quick Scan, Inspect */}
        <div className={styles.cardBottomRow}>
          <div className={styles.chipsGroup}>
            {statsLoading && !stats ? (
              <span className={styles.statChip}>counting…</span>
            ) : stats ? (
              <>
                {(stats.directFolderCount ?? stats.folderCount) > 0 && (
                  <span className={styles.statChip}>
                    <Folder size={11} />{" "}
                    {(stats.directFolderCount ?? stats.folderCount).toLocaleString()}
                  </span>
                )}
                {warning && (
                  <span className={`${styles.warningBadge} ${styles[warning.level]}`}>
                    <AlertTriangle size={10} />
                    {warning.label}
                  </span>
                )}
              </>
            ) : null}
          </div>

          <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
            {/* Quick Inspection trigger */}
            {onInspect && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onInspect(folder.id);
                }}
                title="Inspect folder details"
              >
                <Eye size={13} />
              </button>
            )}

            {/* Quick Scan Button */}
            {onStartFolderScan && (
              <div>
                {isThisScanning ? (
                  <button
                    type="button"
                    className={`${styles.quickScanBtn} ${styles.quickScanStop}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStopFolderScan?.(folder.id);
                    }}
                    title="Stop & save progress"
                    disabled={isStopping}
                  >
                    {isStopping ? (
                      <Loader2 size={11} className={styles.spinning} />
                    ) : (
                      <Square size={11} />
                    )}
                    <span>{isStopping ? "Saving…" : "Stop"}</span>
                  </button>
                ) : hasCheckpoint ? (
                  <button
                    type="button"
                    className={`${styles.quickScanBtn} ${styles.quickScanResume}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartFolderScan(folder.id);
                    }}
                    title="Resume paused scan"
                  >
                    <PlayCircle size={11} />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.quickScanBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartFolderScan(folder.id);
                    }}
                    title="Quick scan directory size"
                  >
                    <RefreshCw size={11} />
                    <span>Scan</span>
                  </button>
                )}
              </div>
            )}

            {/* Rename */}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(folder.id);
                setEditName(folder.name);
              }}
              title="Rename"
              disabled={isUpdating === folder.id}
            >
              <Pencil size={13} />
            </button>

            {/* Delete */}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.danger}`}
              onClick={(e) => handleDelete(e, folder.id)}
              title="Move to trash"
              disabled={isUpdating === folder.id}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className={styles.sectionTitle}>
        <div className={styles.sectionTitleLeft}>
          <Folder className={styles.sectionIcon} />
          <span>Directories</span>
          <span className={styles.folderCountBadge}>{folders.length}</span>
          {onRefreshStats && (
            <button
              type="button"
              className={styles.refreshStatsBtn}
              onClick={onRefreshStats}
              title="Refresh counts"
              disabled={statsLoading}
            >
              <RefreshCw
                size={13}
                className={statsLoading ? styles.spinning : ""}
              />
            </button>
          )}
        </div>

        <div className={styles.layoutToggle}>
          {onSortChange && (
            <>
              <button
                type="button"
                className={`${styles.layoutBtn} ${
                  sortMode === "name-asc" || sortMode === "name-desc"
                    ? styles.active
                    : ""
                }`}
                onClick={() =>
                  onSortChange(sortMode === "name-asc" ? "name-desc" : "name-asc")
                }
                title={
                  sortMode === "name-asc"
                    ? "Sort A→Z (click for Z→A)"
                    : "Sort Z→A (click for A→Z)"
                }
              >
                {sortMode === "name-desc" ? (
                  <ArrowUpZA size={14} />
                ) : (
                  <ArrowDownAZ size={14} />
                )}
              </button>
              <button
                type="button"
                className={`${styles.layoutBtn} ${
                  sortMode === "size-desc" ? styles.active : ""
                }`}
                onClick={() => onSortChange("size-desc")}
                title="Sort by size (largest first)"
              >
                <HardDrive size={14} />
              </button>
              <button
                type="button"
                className={`${styles.layoutBtn} ${
                  sortMode === "count-desc" ? styles.active : ""
                }`}
                onClick={() => onSortChange("count-desc")}
                title="Sort by count (most first)"
              >
                <Hash size={14} />
              </button>
            </>
          )}

          <div
            style={{
              width: "1px",
              height: "14px",
              background: "var(--color-border, rgba(255, 255, 255, 0.1))",
              margin: "0 4px",
            }}
          />

          <button
            type="button"
            className={`${styles.layoutBtn} ${layout === "grid" ? styles.active : ""}`}
            onClick={() => handleLayoutToggle("grid")}
            title="Grid view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            className={`${styles.layoutBtn} ${layout === "list" ? styles.active : ""}`}
            onClick={() => handleLayoutToggle("list")}
            title="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      <div className={layout === "grid" ? styles.grid : styles.list}>
        {sortedFolders.map(renderCard)}
      </div>
    </div>
  );
}

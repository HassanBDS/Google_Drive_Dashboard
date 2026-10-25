"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Folder,
  FolderOpen,
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
import { Tooltip } from "@/components/ui/Tooltip";
import { toast } from "sonner";
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
        toast.success(`Renamed to "${editName.trim()}"`);
        onRefresh?.();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to rename folder");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
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
        toast.success("Folder moved to trash");
        onRefresh?.();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to delete folder");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
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

    if (layout === "list") {
      return (
        <div
          key={folder.id}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          tabIndex={0}
          role="button"
          aria-label={`Folder: ${folder.name}, ${effectiveFolderSize > 0 ? formatBytes(effectiveFolderSize) : "size uncalculated"}`}
          className={`${styles.card} ${styles.listCard} ${
            warning ? styles[`warn_${warning.level}`] : ""
          } ${isThisScanning ? styles.scanningCard : ""} fade-in`}
          style={{ animationDelay: `${i * 20}ms` }}
          onClick={() => onOpen(folder.id)}
          onKeyDown={(e) => handleCardKeyDown(e, i, folder.id)}
        >
          {/* Column 1: Identity */}
          <div className={styles.colIdentity}>
            <div className={styles.folderIcon} aria-hidden="true">
              {isThisScanning ? <FolderOpen size={20} /> : <Folder size={20} />}
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
                    {warning && (
                      <span className={`${styles.warningBadge} ${styles[warning.level]}`}>
                        <AlertTriangle size={10} />
                        {warning.label}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Volume / Scan Progress (Strictly 200px slot) */}
          <div className={styles.colMetric}>
            {isThisScanning && scanState ? (
              <div className={styles.scanInlineProgress}>
                <div className={styles.scanInlinePhase}>
                  {scanState.phase === "resuming"
                    ? "▶ Resuming…"
                    : scanState.phase === "calculating_sizes"
                    ? `💾 ${scanState.foldersScanned.toLocaleString()} folders`
                    : "📂 Discovering…"}
                </div>
                <div className={styles.scanInlineFolder} title={scanState.currentFolder}>
                  {scanState.currentFolder}
                </div>
              </div>
            ) : effectiveFolderSize > 0 ? (
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
            ) : (
              <div className={styles.colMetricPlaceholder} />
            )}
          </div>

          {/* Column 3: Folder Count */}
          <div className={styles.colCount}>
            {statsLoading && !stats ? (
              <span className={styles.statChip}>counting…</span>
            ) : stats && (stats.directFolderCount ?? stats.folderCount) > 0 ? (
              <span className={styles.statChip}>
                <Folder size={11} />{" "}
                {(stats.directFolderCount ?? stats.folderCount).toLocaleString()}
              </span>
            ) : null}
          </div>

          {/* Column 4: Action Controls */}
          <div className={styles.colActions} onClick={(e) => e.stopPropagation()}>
            {onInspect && (
              <Tooltip content="Inspect details & child folders">
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect(folder.id);
                  }}
                  aria-label="Inspect folder details"
                >
                  <Eye size={13} />
                </button>
              </Tooltip>
            )}

            {onStartFolderScan && (
              <div>
                {isThisScanning ? (
                  <Tooltip content="Stop scanning & save checkpoint">
                    <button
                      type="button"
                      className={`${styles.quickScanBtn} ${styles.quickScanStop}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Stopping scan & saving checkpoint...");
                        onStopFolderScan?.(folder.id);
                      }}
                      aria-label="Stop & save progress"
                      disabled={isStopping}
                    >
                      {isStopping ? (
                        <Loader2 size={11} className={styles.spinning} />
                      ) : (
                        <Square size={11} />
                      )}
                      <span>{isStopping ? "Saving…" : "Stop"}</span>
                    </button>
                  </Tooltip>
                ) : hasCheckpoint ? (
                  <Tooltip content="Resume scanning from saved checkpoint">
                    <button
                      type="button"
                      className={`${styles.quickScanBtn} ${styles.quickScanResume}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Resuming scan...");
                        onStartFolderScan(folder.id);
                      }}
                      aria-label="Resume paused scan"
                    >
                      <PlayCircle size={11} />
                      <span>Resume</span>
                    </button>
                  </Tooltip>
                ) : (
                  <Tooltip content="Start deep recursive scan">
                    <button
                      type="button"
                      className={styles.quickScanBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info(`Scanning "${folder.name}"...`);
                        onStartFolderScan(folder.id);
                      }}
                      aria-label="Quick scan directory size"
                    >
                      <RefreshCw size={11} />
                      <span>Scan</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            )}

            <Tooltip content="Rename folder">
              <button
                type="button"
                className={styles.actionBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(folder.id);
                  setEditName(folder.name);
                }}
                aria-label="Rename folder"
                disabled={isUpdating === folder.id}
              >
                <Pencil size={13} />
              </button>
            </Tooltip>

            <Tooltip content="Move to trash">
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.danger}`}
                onClick={(e) => handleDelete(e, folder.id)}
                aria-label="Move folder to trash"
                disabled={isUpdating === folder.id}
              >
                <Trash2 size={13} />
              </button>
            </Tooltip>
          </div>
        </div>
      );
    }

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
              {isThisScanning ? <FolderOpen size={20} /> : <Folder size={20} />}
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
          {/* No chevron arrow in grid view — actions revealed on hover */}
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

          <div
            className={`${styles.cardActions} ${
              isThisScanning || editingId === folder.id
                ? styles.cardActionsAlwaysVisible
                : ""
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Inspection trigger */}
            {onInspect && (
              <Tooltip content="Inspect details & child folders">
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect(folder.id);
                  }}
                  aria-label="Inspect folder details"
                >
                  <Eye size={13} />
                </button>
              </Tooltip>
            )}

            {/* Quick Scan Button */}
            {onStartFolderScan && (
              <div>
                {isThisScanning ? (
                  <Tooltip content="Stop scanning & save checkpoint">
                    <button
                      type="button"
                      className={`${styles.quickScanBtn} ${styles.quickScanStop}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Stopping scan & saving checkpoint...");
                        onStopFolderScan?.(folder.id);
                      }}
                      aria-label="Stop & save progress"
                      disabled={isStopping}
                    >
                      {isStopping ? (
                        <Loader2 size={11} className={styles.spinning} />
                      ) : (
                        <Square size={11} />
                      )}
                      <span>{isStopping ? "Saving…" : "Stop"}</span>
                    </button>
                  </Tooltip>
                ) : hasCheckpoint ? (
                  <Tooltip content="Resume scanning from saved checkpoint">
                    <button
                      type="button"
                      className={`${styles.quickScanBtn} ${styles.quickScanResume}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Resuming scan...");
                        onStartFolderScan(folder.id);
                      }}
                      aria-label="Resume paused scan"
                    >
                      <PlayCircle size={11} />
                      <span>Resume</span>
                    </button>
                  </Tooltip>
                ) : (
                  <Tooltip content="Start deep recursive scan">
                    <button
                      type="button"
                      className={styles.quickScanBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info(`Scanning "${folder.name}"...`);
                        onStartFolderScan(folder.id);
                      }}
                      aria-label="Quick scan directory size"
                    >
                      <RefreshCw size={11} />
                      <span>Scan</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            )}

            {/* Rename */}
            <Tooltip content="Rename folder">
              <button
                type="button"
                className={styles.actionBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(folder.id);
                  setEditName(folder.name);
                }}
                aria-label="Rename folder"
                disabled={isUpdating === folder.id}
              >
                <Pencil size={13} />
              </button>
            </Tooltip>

            {/* Delete */}
            <Tooltip content="Move to trash">
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.danger}`}
                onClick={(e) => handleDelete(e, folder.id)}
                aria-label="Move folder to trash"
                disabled={isUpdating === folder.id}
              >
                <Trash2 size={13} />
              </button>
            </Tooltip>
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
            <Tooltip content="Refresh folder metrics">
              <button
                type="button"
                className={styles.refreshStatsBtn}
                onClick={onRefreshStats}
                aria-label="Refresh folder metrics"
                disabled={statsLoading}
              >
                <RefreshCw
                  size={13}
                  className={statsLoading ? styles.spinning : ""}
                />
              </button>
            </Tooltip>
          )}
        </div>

        <div className={styles.layoutToggle}>
          {onSortChange && (
            <>
              <Tooltip
                content={
                  sortMode === "name-asc"
                    ? "Sort A→Z (click for Z→A)"
                    : "Sort Z→A (click for A→Z)"
                }
              >
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
                  aria-label="Sort by name"
                >
                  {sortMode === "name-desc" ? (
                    <ArrowUpZA size={14} />
                  ) : (
                    <ArrowDownAZ size={14} />
                  )}
                </button>
              </Tooltip>
              <Tooltip content="Sort by size (largest first)">
                <button
                  type="button"
                  className={`${styles.layoutBtn} ${
                    sortMode === "size-desc" ? styles.active : ""
                  }`}
                  onClick={() => onSortChange("size-desc")}
                  aria-label="Sort by size (largest first)"
                >
                  <HardDrive size={14} />
                </button>
              </Tooltip>
              <Tooltip content="Sort by folder count (most first)">
                <button
                  type="button"
                  className={`${styles.layoutBtn} ${
                    sortMode === "count-desc" ? styles.active : ""
                  }`}
                  onClick={() => onSortChange("count-desc")}
                  aria-label="Sort by folder count (most first)"
                >
                  <Hash size={14} />
                </button>
              </Tooltip>
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

          <Tooltip content="Grid view">
            <button
              type="button"
              className={`${styles.layoutBtn} ${layout === "grid" ? styles.active : ""}`}
              onClick={() => handleLayoutToggle("grid")}
              aria-label="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
          </Tooltip>
          <Tooltip content="List view">
            <button
              type="button"
              className={`${styles.layoutBtn} ${layout === "list" ? styles.active : ""}`}
              onClick={() => handleLayoutToggle("list")}
              aria-label="List view"
            >
              <List size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={layout === "grid" ? styles.grid : styles.list}>
        {sortedFolders.map(renderCard)}
      </div>
    </div>
  );
}

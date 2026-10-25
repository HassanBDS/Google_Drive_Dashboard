"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import {
  X,
  HardDrive,
  Folder,
  Files,
  Clock,
  RefreshCw,
  ExternalLink,
  Pencil,
  Trash2,
  PlayCircle,
  Square,
  Loader2,
  AlertTriangle,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatDate } from "@/lib/utils";
import type { FolderStat } from "./FolderCard";
import styles from "./FolderInspector.module.css";

export interface InspectedFolderItem {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  size?: string | number;
}

export interface FolderInspectorProps {
  folder: InspectedFolderItem | null;
  isOpen: boolean;
  onClose: () => void;
  folderStats?: FolderStat;
  scanState?: {
    isScanning: boolean;
    phase?: string;
    foldersScanned: number;
    currentFolder: string;
    elapsedMs?: number;
  };
  checkpoint?: {
    startedAt: string;
    foldersScanned: number;
    folderName?: string;
  };
  onStartScan?: (folderId: string) => void;
  onStopScan?: (folderId: string) => void;
  onOpenFolder?: (folderId: string) => void;
  onRefresh?: () => void;
}

interface ChildFolderItem {
  id: string;
  name: string;
  size: number;
  fileCount?: number;
}

export default function FolderInspector({
  folder,
  isOpen,
  onClose,
  folderStats,
  scanState,
  checkpoint,
  onStartScan,
  onStopScan,
  onOpenFolder,
  onRefresh,
}: FolderInspectorProps) {
  const inspectorId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [children, setChildren] = useState<ChildFolderItem[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Capture previous focus element for restoration
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      drawerRef.current?.focus();
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
      previouslyFocusedRef.current = null;
    }
  }, [isOpen]);

  // Handle Esc key to close & Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch children whenever inspected folder changes
  useEffect(() => {
    if (!folder?.id || !isOpen) {
      setChildren([]);
      return;
    }

    let active = true;
    setLoadingChildren(true);

    fetch(`/api/drive/list?folderId=${encodeURIComponent(folder.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.folders && Array.isArray(data.folders)) {
          const list: ChildFolderItem[] = data.folders.map((f: any) => ({
            id: f.id,
            name: f.name,
            size: typeof f.size === "string" ? parseInt(f.size, 10) || 0 : f.size || 0,
          }));
          setChildren(list.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingChildren(false);
      });

    return () => {
      active = false;
    };
  }, [folder?.id, isOpen]);

  if (!folder) return null;

  const isScanning = scanState?.isScanning ?? false;
  const hasCheckpoint = Boolean(checkpoint);

  const effectiveSize =
    folderStats?.recursiveTotalSize ?? folderStats?.totalSize ?? 0;
  const subfolderCount =
    folderStats?.directFolderCount ?? folderStats?.folderCount ?? 0;
  const fileCount = folderStats?.fileCount ?? 0;

  // Maximum size for child relative bars
  const maxChildSize = Math.max(
    effectiveSize,
    ...children.map((c) => c.size),
    1
  );

  const handleRename = async () => {
    if (!newName.trim() || newName === folder.name) {
      setIsRenaming(false);
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch("/api/drive/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: folder.id, newName: newName.trim() }),
      });
      if (res.ok) {
        toast.success("Folder renamed successfully");
        setIsRenaming(false);
        onRefresh?.();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to rename folder");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to move "${folder.name}" to trash?`)) {
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch("/api/drive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: folder.id }),
      });
      if (res.ok) {
        toast.success("Folder moved to trash");
        onClose();
        onRefresh?.();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to delete folder");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      {/* Backdrop scrim */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out drawer */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inspectorId}-title`}
        tabIndex={-1}
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ""}`}
      >
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.folderIcon} aria-hidden="true">
              📁
            </div>
            <div className={styles.headerInfo}>
              <h2 id={`${inspectorId}-title`} className={styles.title} title={folder.name}>
                {folder.name}
              </h2>
              <div className={styles.subtitle}>Directory Inspector</div>
            </div>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close inspector (Esc)"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </header>

        {/* Scrollable Content Body */}
        <div className={styles.body}>
          {/* 2x2 Bento Metadata Grid */}
          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>
                <HardDrive size={12} /> Recursive Size
              </span>
              <span className={styles.metaVal}>
                {effectiveSize > 0 ? formatBytes(effectiveSize) : "—"}
              </span>
              <span className={styles.metaSub}>
                {folderStats?.recursiveTotalSize ? "Deep BFS total" : "Direct level only"}
              </span>
            </div>

            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>
                <Folder size={12} /> Subfolders
              </span>
              <span className={styles.metaVal}>
                {subfolderCount.toLocaleString()}
              </span>
              <span className={styles.metaSub}>Immediate subdirectories</span>
            </div>

            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>
                <Files size={12} /> Files
              </span>
              <span className={styles.metaVal}>{fileCount.toLocaleString()}</span>
              <span className={styles.metaSub}>Nested items</span>
            </div>

            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>
                <Clock size={12} /> Checkpoint
              </span>
              <span className={styles.metaVal}>
                {hasCheckpoint ? "Saved" : isScanning ? "Active" : "Ready"}
              </span>
              <span className={styles.metaSub}>
                {checkpoint ? `${checkpoint.foldersScanned} folders` : "Resumable state"}
              </span>
            </div>
          </div>

          {/* Telemetry / Checkpoint HUD */}
          <div
            className={`${styles.telemetryBox} ${
              isScanning
                ? styles.telemetryBoxActive
                : hasCheckpoint
                ? styles.telemetryBoxWarning
                : ""
            }`}
          >
            <div className={styles.telemetryTop}>
              <span className={styles.telemetryTitle}>
                <RefreshCw
                  size={14}
                  className={isScanning ? styles.spinning : ""}
                />
                {isScanning
                  ? "Scan in Progress"
                  : hasCheckpoint
                  ? "Paused Checkpoint Available"
                  : "Scanning Telemetry"}
              </span>
            </div>
            <p className={styles.telemetryText}>
              {isScanning
                ? `Currently processing: ${scanState?.currentFolder || "Subtrees..."} (${scanState?.foldersScanned || 0} folders)`
                : hasCheckpoint
                ? `A previous scan was saved at ${checkpoint?.foldersScanned} folders. You can resume without starting over.`
                : effectiveSize > 0
                ? "Subtree calculation complete. All sizes reflect cached BFS telemetry."
                : "This directory has not been scanned yet. Trigger a recursive scan to calculate deep disk usage."}
            </p>
          </div>

          {/* Top Subfolders Breakdown */}
          <section className={styles.subtreeSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>
                <FolderTree size={14} /> Top Child Folders
              </span>
              {loadingChildren && (
                <Loader2 size={12} className={styles.spinning} />
              )}
            </div>

            {children.length === 0 && !loadingChildren ? (
              <div style={{ fontSize: "12px", color: "var(--color-muted-foreground)", padding: "10px 0" }}>
                No child directories found in this folder.
              </div>
            ) : (
              <div className={styles.childList}>
                {children.map((child) => {
                  const pct =
                    maxChildSize > 0 && child.size > 0
                      ? Math.min(100, Math.round((child.size / maxChildSize) * 100))
                      : 0;

                  return (
                    <div
                      key={child.id}
                      className={styles.childRow}
                      onClick={() => {
                        onOpenFolder?.(child.id);
                        onClose();
                      }}
                      title="Click to open directory"
                    >
                      <div className={styles.childRowTop}>
                        <span className={styles.childName}>
                          📁 {child.name}
                        </span>
                        <span className={styles.childSize}>
                          {child.size > 0 ? formatBytes(child.size) : "—"}
                        </span>
                      </div>
                      <div className={styles.childBar}>
                        <div
                          className={styles.childFill}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Inline Rename Box */}
          {isRenaming && (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <input
                autoFocus
                className={styles.btnSecondary}
                style={{ flex: 1, padding: "8px 12px", textAlign: "left" }}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New folder name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleRename}
                disabled={isUpdating}
              >
                Save
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setIsRenaming(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className={styles.footer}>
          <div className={styles.primaryActions}>
            {/* Scan or Stop button */}
            {onStartScan && (
              <>
                {isScanning ? (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => onStopScan?.(folder.id)}
                  >
                    <Square size={13} /> Stop Scan
                  </button>
                ) : hasCheckpoint ? (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => onStartScan(folder.id)}
                  >
                    <PlayCircle size={13} /> Resume Scan
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => onStartScan(folder.id)}
                  >
                    <RefreshCw size={13} /> Scan Subtree
                  </button>
                )}
              </>
            )}

            {/* Open in Google Drive */}
            {folder.webViewLink ? (
              <a
                href={folder.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                <ExternalLink size={13} /> Open in Drive
              </a>
            ) : (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => onOpenFolder?.(folder.id)}
              >
                Open Folder
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ flex: 1 }}
              onClick={() => {
                setNewName(folder.name);
                setIsRenaming((prev) => !prev);
              }}
            >
              <Pencil size={12} /> Rename
            </button>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              style={{ flex: 1 }}
              onClick={handleDelete}
              disabled={isUpdating}
            >
              <Trash2 size={12} /> Trash
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

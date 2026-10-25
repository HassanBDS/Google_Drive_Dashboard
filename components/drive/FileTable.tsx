"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  ExternalLink,
  Download,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { formatBytes, formatDate, getFileTypeIcon, getMimeLabel } from "@/lib/utils";
import { getMimeCategoryId, MIME_CATEGORY_COLORS } from "@/components/charts";
import { toast } from "sonner";
import styles from "./FileTable.module.css";

export interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink: string;
}

export type FileSortField = "name" | "size" | "modified";
export type FileSortDirection = "asc" | "desc";
export type FileQuickFilter = "all" | "media" | "documents" | "archives" | "large";

export interface FileTableProps {
  files: FileItem[];
  onRefresh?: () => void;
}

export default function FileTable({ files, onRefresh }: FileTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<FileSortField>("name");
  const [sortDirection, setSortDirection] = useState<FileSortDirection>("asc");

  // Filtering state
  const [filterMode, setFilterMode] = useState<FileQuickFilter>("all");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Filter counts
  const filterCounts = useMemo(() => {
    let media = 0;
    let documents = 0;
    let archives = 0;
    let large = 0;

    for (const f of files) {
      const cat = getMimeCategoryId(f.mimeType);
      const rawSize = parseInt(f.size, 10);
      const size = isNaN(rawSize) ? 0 : rawSize;

      if (cat === "video" || cat === "audio" || cat === "image") media++;
      if (cat === "document") documents++;
      if (cat === "archive") archives++;
      if (size >= 100 * 1024 * 1024) large++;
    }

    return { all: files.length, media, documents, archives, large };
  }, [files]);

  // Apply quick filter
  const filteredFiles = useMemo(() => {
    if (filterMode === "all") return files;

    return files.filter((f) => {
      const cat = getMimeCategoryId(f.mimeType);
      const rawSize = parseInt(f.size, 10);
      const size = isNaN(rawSize) ? 0 : rawSize;

      if (filterMode === "media") return cat === "video" || cat === "audio" || cat === "image";
      if (filterMode === "documents") return cat === "document";
      if (filterMode === "archives") return cat === "archive";
      if (filterMode === "large") return size >= 100 * 1024 * 1024;
      return true;
    });
  }, [files, filterMode]);

  // Apply sorting
  const sortedFiles = useMemo(() => {
    const list = [...filteredFiles];

    list.sort((a, b) => {
      if (sortField === "name") {
        const cmp = a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortDirection === "asc" ? cmp : -cmp;
      }

      if (sortField === "size") {
        const sA = parseInt(a.size, 10) || 0;
        const sB = parseInt(b.size, 10) || 0;
        return sortDirection === "asc" ? sA - sB : sB - sA;
      }

      if (sortField === "modified") {
        const tA = new Date(a.modifiedTime || 0).getTime();
        const tB = new Date(b.modifiedTime || 0).getTime();
        return sortDirection === "asc" ? tA - tB : tB - tA;
      }

      return 0;
    });

    return list;
  }, [filteredFiles, sortField, sortDirection]);

  if (files.length === 0) return null;

  // Header column click
  const handleSortHeaderClick = (field: FileSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedFiles.map((f) => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Bulk deletion
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to move ${selectedIds.size} file${
          selectedIds.size !== 1 ? "s" : ""
        } to trash?`
      )
    ) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch("/api/drive/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: id }),
        })
      );

      await Promise.all(deletePromises);
      toast.success(`${selectedIds.size} file${selectedIds.size > 1 ? "s" : ""} moved to trash`);
      setSelectedIds(new Set());
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete files");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Single file operations
  const handleRename = async (id: string, oldName: string) => {
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
        toast.success("File renamed successfully");
        onRefresh?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to rename");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
    } finally {
      setIsUpdating(null);
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to move this file to trash?")) return;

    setIsUpdating(id);
    try {
      const res = await fetch("/api/drive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id }),
      });
      if (res.ok) {
        toast.success("File moved to trash");
        onRefresh?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
    } finally {
      setIsUpdating(null);
    }
  };

  const allSelected =
    sortedFiles.length > 0 && selectedIds.size === sortedFiles.length;

  return (
    <div className={styles.wrapper}>
      {/* Header bar with title & filter pills */}
      <div className={styles.headerBar}>
        <div className={styles.titleGroup}>
          <FileText className={styles.sectionIcon} />
          <h3 className={styles.sectionTitle}>Files</h3>
          <span className={styles.countBadge}>{sortedFiles.length}</span>
        </div>

        {/* Quick filter pills */}
        <div className={styles.filterPills} role="group" aria-label="Filter files">
          <button
            type="button"
            className={`${styles.filterPill} ${
              filterMode === "all" ? styles.filterPillActive : ""
            }`}
            onClick={() => setFilterMode("all")}
          >
            All <span className={styles.pillBadge}>{filterCounts.all}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${
              filterMode === "media" ? styles.filterPillActive : ""
            }`}
            onClick={() => setFilterMode("media")}
          >
            Media <span className={styles.pillBadge}>{filterCounts.media}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${
              filterMode === "documents" ? styles.filterPillActive : ""
            }`}
            onClick={() => setFilterMode("documents")}
          >
            Documents <span className={styles.pillBadge}>{filterCounts.documents}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${
              filterMode === "archives" ? styles.filterPillActive : ""
            }`}
            onClick={() => setFilterMode("archives")}
          >
            Archives <span className={styles.pillBadge}>{filterCounts.archives}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${
              filterMode === "large" ? styles.filterPillActive : ""
            }`}
            onClick={() => setFilterMode("large")}
          >
            &gt;100MB <span className={styles.pillBadge}>{filterCounts.large}</span>
          </button>
        </div>
      </div>

      {/* Bulk actions banner */}
      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <div className={styles.bulkInfo}>
            <span>
              {selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className={styles.bulkActions}>
            <button
              type="button"
              className={styles.bulkDeleteBtn}
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? (
                <Loader2 size={13} className={styles.spinning} />
              ) : (
                <Trash2 size={13} />
              )}
              <span>Move to Trash</span>
            </button>
            <button
              type="button"
              className={styles.bulkCancelBtn}
              onClick={() => setSelectedIds(new Set())}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.checkboxTh}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all files"
                />
              </th>

              {/* Name column */}
              <th
                className={styles.sortableTh}
                onClick={() => handleSortHeaderClick("name")}
              >
                <div className={styles.thContent}>
                  <span>Name</span>
                  <span className={styles.thSortIcon}>
                    {sortField === "name" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      )
                    ) : (
                      <ArrowUpDown size={12} opacity={0.4} />
                    )}
                  </span>
                </div>
              </th>

              {/* Type category */}
              <th>Type</th>

              {/* Size column */}
              <th
                className={styles.sortableTh}
                onClick={() => handleSortHeaderClick("size")}
              >
                <div className={styles.thContent}>
                  <span>Size</span>
                  <span className={styles.thSortIcon}>
                    {sortField === "size" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      )
                    ) : (
                      <ArrowUpDown size={12} opacity={0.4} />
                    )}
                  </span>
                </div>
              </th>

              {/* Modified column */}
              <th
                className={styles.sortableTh}
                onClick={() => handleSortHeaderClick("modified")}
              >
                <div className={styles.thContent}>
                  <span>Modified</span>
                  <span className={styles.thSortIcon}>
                    {sortField === "modified" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      )
                    ) : (
                      <ArrowUpDown size={12} opacity={0.4} />
                    )}
                  </span>
                </div>
              </th>

              {/* Actions */}
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody className={styles.tbody}>
            {sortedFiles.map((file, i) => {
              const isSelected = selectedIds.has(file.id);
              const catId = getMimeCategoryId(file.mimeType);
              const catInfo = MIME_CATEGORY_COLORS[catId];

              return (
                <tr
                  key={file.id}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ""} fade-in`}
                  style={{ animationDelay: `${i * 15}ms` }}
                >
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isSelected}
                      onChange={(e) => handleSelectRow(file.id, e.target.checked)}
                      aria-label={`Select ${file.name}`}
                    />
                  </td>

                  {/* Name */}
                  <td className={styles.nameCell}>
                    <span className={styles.fileIcon} aria-hidden="true">
                      {getFileTypeIcon(file.mimeType)}
                    </span>

                    {editingId === file.id ? (
                      <div
                        className={styles.editWrap}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          className={styles.editInput}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(file.id, file.name);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          className={styles.saveBtn}
                          onClick={() => handleRename(file.id, file.name)}
                          disabled={isUpdating === file.id}
                        >
                          {isUpdating === file.id ? (
                            <Loader2 size={12} className={styles.spinning} />
                          ) : (
                            <Check size={12} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => setEditingId(null)}
                          disabled={isUpdating === file.id}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className={styles.fileName} title={file.name}>
                        {file.name}
                      </span>
                    )}
                  </td>

                  {/* Type badge */}
                  <td className={styles.typeCell}>
                    <span
                      className={styles.categoryPill}
                      style={{
                        backgroundColor: `${catInfo.color}18`,
                        color: catInfo.color,
                        border: `1px solid ${catInfo.color}35`,
                      }}
                    >
                      {getMimeLabel(file.mimeType)}
                    </span>
                  </td>

                  {/* Size */}
                  <td className={styles.sizeCell}>{formatBytes(file.size)}</td>

                  {/* Modified */}
                  <td className={styles.dateCell}>
                    {formatDate(file.modifiedTime)}
                  </td>

                  {/* Actions */}
                  <td className={styles.actionCell}>
                    <div className={styles.actionGroup}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          setEditingId(file.id);
                          setEditName(file.name);
                        }}
                        title="Rename file"
                        disabled={isUpdating === file.id}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.danger}`}
                        onClick={() => handleDelete(file.id)}
                        title="Move to trash"
                        disabled={isUpdating === file.id}
                      >
                        <Trash2 size={13} />
                      </button>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkBtn}
                          title="Open in Google Drive"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                      {file.webContentLink && (
                        <a
                          href={file.webContentLink}
                          className={styles.linkBtn}
                          title="Download file"
                        >
                          <Download size={13} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

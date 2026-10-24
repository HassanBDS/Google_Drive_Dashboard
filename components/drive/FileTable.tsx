"use client";

import { useState } from "react";
import { FileText, ExternalLink, Download, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import { formatBytes, formatDate, getFileTypeIcon, getMimeLabel } from "@/lib/utils";
import styles from "./FileTable.module.css";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink: string;
}

interface FileTableProps {
  files: FileItem[];
  onRefresh?: () => void;
}

export default function FileTable({ files, onRefresh }: FileTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  if (files.length === 0) return null;

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
        onRefresh?.();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to rename");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
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
        onRefresh?.();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.sectionTitle}>
        <FileText className={styles.sectionIcon} />
        Files ({files.length})
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {files.map((file, i) => (
              <tr
                key={file.id}
                className="fade-in"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <td className={styles.nameCell}>
                  <span className={styles.fileIcon}>
                    {getFileTypeIcon(file.mimeType)}
                  </span>

                  {editingId === file.id ? (
                    <div className={styles.editWrap} onClick={(e) => e.stopPropagation()}>
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
                <td className={styles.typeCell}>
                  <span className={styles.typeBadge}>
                    {getMimeLabel(file.mimeType)}
                  </span>
                </td>
                <td className={styles.sizeCell}>{formatBytes(file.size)}</td>
                <td className={styles.dateCell}>{formatDate(file.modifiedTime)}</td>
                <td className={styles.actionCell}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => {
                      setEditingId(file.id);
                      setEditName(file.name);
                    }}
                    title="Rename"
                    disabled={isUpdating === file.id}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.danger}`}
                    onClick={() => handleDelete(file.id)}
                    title="Delete"
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

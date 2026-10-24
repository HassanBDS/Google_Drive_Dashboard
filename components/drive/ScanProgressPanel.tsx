"use client";

import { Loader2, Square } from "lucide-react";
import type { FolderScanState } from "@/app/page";
import styles from "./ScanProgressPanel.module.css";

interface ScanProgressPanelProps {
  folderScanStates: Map<string, FolderScanState>;
  onStop: (folderId: string) => void;
}

function phaseLabel(phase?: string): string {
  switch (phase) {
    case "resuming": return "Resuming…";
    case "discovering_titles": return "Discovering subfolders";
    case "discovering_chapters": return "Discovering nested folders";
    case "calculating_sizes": return "Calculating sizes";
    case "stopping": return "Saving & stopping…";
    case "complete": return "Complete";
    default: return "Scanning…";
  }
}

export default function ScanProgressPanel({ folderScanStates, onStop }: ScanProgressPanelProps) {
  const activeScans = Array.from(folderScanStates.entries()).filter(([, s]) => s.isScanning);
  if (activeScans.length === 0) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Loader2 size={13} className={styles.spinning} />
        <span>{activeScans.length} active scan{activeScans.length > 1 ? "s" : ""}</span>
      </div>

      <div className={styles.rows}>
        {activeScans.map(([folderId, state]) => (
          <div key={folderId} className={styles.row}>
            <div className={styles.rowLeft}>
              <div className={styles.rowPhase}>{phaseLabel(state.phase)}</div>
              {state.phase === "calculating_sizes" && state.totalChaptersFound ? (
                <div className={styles.rowDetail}>
                  {(state.chaptersProcessed ?? 0).toLocaleString()} / {(state.totalChaptersFound ?? 0).toLocaleString()} items
                  {state.currentFolder && <span className={styles.rowFolder}> · {state.currentFolder}</span>}
                </div>
              ) : state.phase === "discovering_chapters" && state.totalTitlesFound ? (
                <div className={styles.rowDetail}>
                  {(state.totalTitlesFound ?? 0).toLocaleString()} subfolders found
                  {state.currentFolder && <span className={styles.rowFolder}> · {state.currentFolder}</span>}
                </div>
              ) : (
                <div className={styles.rowDetail}>
                  {state.foldersScanned.toLocaleString()} folders scanned
                  {state.currentFolder && <span className={styles.rowFolder}> · {state.currentFolder}</span>}
                </div>
              )}
            </div>

            <button
              className={styles.stopBtn}
              onClick={() => onStop(folderId)}
              disabled={state.phase === "stopping"}
              title="Stop & Save progress"
            >
              {state.phase === "stopping"
                ? <Loader2 size={12} className={styles.spinning} />
                : <Square size={12} />
              }
              <span>{state.phase === "stopping" ? "Saving…" : "Stop"}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

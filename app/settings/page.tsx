"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  HardDrive,
  Key,
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  ExternalLink,
  Loader2,
  FileText,
  Download,
} from "lucide-react";
import styles from "./settings.module.css";

interface SettingsData {
  isConfigured: boolean;
  driveName: string;
  rootFolderId: string;
  credentialsPath: string;
  credentialsFound: boolean;
  clientEmail?: string;
  projectId?: string;
  cacheStats: {
    fileCount: number;
    totalSizeBytes: number;
  };
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [driveName, setDriveName] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");
  const [credentialsJson, setCredentialsJson] = useState("");

  // Action states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const data: SettingsData = await res.json();
      setSettings(data);
      setDriveName(data.driveName || "");
      setRootFolderId(data.rootFolderId || "");
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Extract folder ID if user pastes full Google Drive link
  const cleanFolderId = (input: string) => {
    const trimmed = input.trim();
    const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    const idMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];
    return trimmed;
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const targetFolder = cleanFolderId(rootFolderId) || settings?.rootFolderId;
    if (!targetFolder) {
      setTestResult({ success: false, message: "Please specify a Google Drive Folder ID or URL to test." });
      setTesting(false);
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testOnly: true,
          rootFolderId: targetFolder,
          credentialsJson: credentialsJson.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setTestResult({ success: false, message: data.error || "Connection test failed." });
      } else {
        setTestResult({ success: true, message: data.message || "Connection test successful!" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Network error testing connection." });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveResult(null);

    const targetFolder = cleanFolderId(rootFolderId);
    if (!targetFolder) {
      setSaveResult({ success: false, message: "Google Drive Folder ID is required." });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveName: driveName.trim() || undefined,
          rootFolderId: targetFolder,
          credentialsJson: credentialsJson.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSaveResult({ success: false, message: data.error || "Failed to save configuration." });
      } else {
        setSaveResult({ success: true, message: data.message || "Settings updated and verified!" });
        setCredentialsJson(""); // Clear raw JSON once persisted
        await fetchSettings();
      }
    } catch (err: any) {
      setSaveResult({ success: false, message: err.message || "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleFlushCache = async () => {
    if (!confirm("Are you sure you want to clear the folder size scan cache? This will reset all precomputed sizes.")) {
      return;
    }

    setFlushing(true);
    setFlushResult(null);

    try {
      const res = await fetch("/api/settings?action=flush-cache", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setFlushResult({ success: false, message: data.error || "Failed to flush cache." });
      } else {
        setFlushResult({ success: true, message: "Size cache cleared successfully." });
        await fetchSettings();
      }
    } catch (err: any) {
      setFlushResult({ success: false, message: err.message || "Network error clearing cache." });
    } finally {
      setFlushing(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className={styles.container}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)" }}>
          <Loader2 size={20} className="spinning" />
          <span>Loading Settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings &amp; Configuration</h1>
        <p className={styles.subtitle}>
          Configure your Google Cloud Service Account, root folder, and disk usage scanner cache.
        </p>
      </header>

      <div className={styles.grid}>
        {/* Card 1: Live Status */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <div className={styles.cardIcon}>
                <HardDrive size={20} />
              </div>
              <div>
                <h2 className={styles.cardTitle}>Active Connection</h2>
                <div className={styles.cardDesc}>Current Google Drive integration status</div>
              </div>
            </div>

            <div
              className={`${styles.statusBadge} ${
                settings?.isConfigured ? styles.connected : styles.disconnected
              }`}
            >
              <span className={styles.statusDot} />
              <span>{settings?.isConfigured ? "Connected" : "Setup Required"}</span>
            </div>
          </div>

          <div className={styles.detailsList}>
            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>Drive Display Name</div>
              <div className={styles.detailValue}>{settings?.driveName || "Not set"}</div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>Root Folder ID</div>
              <div className={styles.detailValue}>
                {settings?.rootFolderId ? (
                  <a
                    href={`https://drive.google.com/drive/folders/${settings.rootFolderId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    {settings.rootFolderId}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  "Not set"
                )}
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>Service Account Email</div>
              <div className={styles.detailValue}>{settings?.clientEmail || "Not detected"}</div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>Google Cloud Project</div>
              <div className={styles.detailValue}>{settings?.projectId || "Not detected"}</div>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleTestConnection}
              disabled={testing || !settings?.isConfigured}
            >
              {testing ? (
                <>
                  <Loader2 size={15} className="spinning" />
                  Testing Connection…
                </>
              ) : (
                <>
                  <RefreshCw size={15} />
                  Test Live Connection
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div
              className={`${styles.feedbackBanner} ${
                testResult.success ? styles.success : styles.error
              }`}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Card 2: Update Configuration */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <div className={styles.cardIcon}>
                <Key size={20} />
              </div>
              <div>
                <h2 className={styles.cardTitle}>Credentials &amp; Target Folder</h2>
                <div className={styles.cardDesc}>
                  Update root folder or replace the service account key without touching code
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Drive Display Name</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Google Drive"
                value={driveName}
                onChange={(e) => setDriveName(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Google Drive Root Folder ID or URL</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. 1a2b3c4d5e... or https://drive.google.com/drive/folders/..."
                value={rootFolderId}
                onChange={(e) => setRootFolderId(e.target.value)}
                required
              />
              <span className={styles.hint}>
                You can paste the full Google Drive folder link from your browser.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Update Service Account JSON Key (Optional)</label>
              <textarea
                className={styles.textarea}
                placeholder="Leave blank to keep existing key, or paste new service-account.json content here..."
                value={credentialsJson}
                onChange={(e) => setCredentialsJson(e.target.value)}
              />
              <span className={styles.hint}>
                Current key: <code>{settings?.credentialsPath}</code> ({settings?.credentialsFound ? "Present" : "Missing"})
              </span>
            </div>

            <div className={styles.actionsRow}>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={saving || !rootFolderId.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="spinning" />
                    Validating &amp; Saving…
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    Save &amp; Verify
                  </>
                )}
              </button>
            </div>

            {saveResult && (
              <div
                className={`${styles.feedbackBanner} ${
                  saveResult.success ? styles.success : styles.error
                }`}
              >
                {saveResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{saveResult.message}</span>
              </div>
            )}
          </form>
        </div>

        {/* Card 3: Cache & Storage */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <div className={styles.cardIcon}>
                <Database size={20} />
              </div>
              <div>
                <h2 className={styles.cardTitle}>Scanner Cache &amp; Storage</h2>
                <div className={styles.cardDesc}>
                  Precomputed folder size checkpoints saved on local disk
                </div>
              </div>
            </div>
          </div>

          <div className={styles.cacheStatsRow}>
            <div className={styles.cacheStatItem}>
              <div className={styles.cacheStatValue}>{settings?.cacheStats.fileCount ?? 0}</div>
              <div className={styles.cacheStatLabel}>Cached Folders</div>
            </div>
            <div className={styles.cacheStatItem}>
              <div className={styles.cacheStatValue}>
                {formatBytes(settings?.cacheStats.totalSizeBytes ?? 0)}
              </div>
              <div className={styles.cacheStatLabel}>Total Disk Usage</div>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <a
              href="/api/drive/export-cache"
              className={styles.btnSecondary}
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}
              title="Download consolidated cache file as JSON"
              download
            >
              <Download size={15} />
              Download Cache Export
            </a>

            <button
              type="button"
              className={styles.btnDanger}
              onClick={handleFlushCache}
              disabled={flushing || (settings?.cacheStats.fileCount === 0)}
            >
              {flushing ? (
                <>
                  <Loader2 size={15} className="spinning" />
                  Flushing Cache…
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  Flush Size Cache
                </>
              )}
            </button>
          </div>

          {flushResult && (
            <div
              className={`${styles.feedbackBanner} ${
                flushResult.success ? styles.success : styles.error
              }`}
            >
              {flushResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{flushResult.message}</span>
            </div>
          )}
        </div>

        {/* Card 4: Security & Sharing Guide */}
        <div className={styles.securityNote}>
          <p>
            <strong>Security &amp; Permissions Note:</strong>
          </p>
          <p style={{ marginTop: "6px" }}>
            Your credentials and configuration are saved strictly on this local machine in <code>.env.local</code> and <code>secrets/service-account.json</code>. Both files are permanently ignored by <code>.gitignore</code> and never uploaded.
          </p>
          <p style={{ marginTop: "6px" }}>
            Make sure to share your target Google Drive folder with your Service Account email (<code>{settings?.clientEmail || "your-sa@project.iam.gserviceaccount.com"}</code>) with at least <strong>Viewer</strong> role (or <strong>Editor / Content Manager</strong> if you plan to rename or manage files).
          </p>
        </div>
      </div>
    </div>
  );
}

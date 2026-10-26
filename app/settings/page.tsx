"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Key,
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  ExternalLink,
  Loader2,
  Download,
  Upload,
  Zap,
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

type TabId = "wizard" | "connection" | "cache";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("wizard");

  // Form states
  const [driveName, setDriveName] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");
  const [credentialsJson, setCredentialsJson] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle JSON file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCredentialsJson(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleDropZoneClick = () => fileInputRef.current?.click();

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
        setCredentialsJson("");
        setUploadedFileName(null);
        await fetchSettings();
      }
    } catch (err: any) {
      setSaveResult({ success: false, message: err.message || "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleFlushCache = async () => {
    if (!confirm("Are you sure you want to clear the folder size scan cache? This will reset all precomputed sizes.")) return;

    setFlushing(true);
    setFlushResult(null);

    try {
      const res = await fetch("/api/settings?action=flush-cache", { method: "DELETE" });
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

  const isConfigured = settings?.isConfigured ?? false;

  return (
    <div className={styles.container}>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Settings &amp; Configuration</h1>
            <p className={styles.subtitle}>
              Connect your Google Drive via a Service Account, manage the root folder, and control the scanner cache.
            </p>
          </div>

          <div className={`${styles.statusPill} ${isConfigured ? styles.connected : styles.disconnected}`}>
            <span className={styles.statusDot} />
            <span>{isConfigured ? "Drive Connected" : "Setup Required"}</span>
          </div>
        </div>

        {/* Live status strip */}
        {isConfigured && (
          <div className={styles.statusStrip}>
            <div className={styles.statusItem}>
              <div className={styles.statusLabel}>Drive Name</div>
              <div className={styles.statusValue}>{settings?.driveName || "—"}</div>
            </div>
            <div className={styles.statusItem}>
              <div className={styles.statusLabel}>Root Folder ID</div>
              <div className={styles.statusValue}>
                {settings?.rootFolderId ? (
                  <a
                    href={`https://drive.google.com/drive/folders/${settings.rootFolderId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {settings.rootFolderId}
                    <ExternalLink size={11} />
                  </a>
                ) : "—"}
              </div>
            </div>
            <div className={styles.statusItem}>
              <div className={styles.statusLabel}>Service Account Email</div>
              <div className={styles.statusValue}>{settings?.clientEmail || "—"}</div>
            </div>
            <div className={styles.statusItem}>
              <div className={styles.statusLabel}>GCP Project</div>
              <div className={styles.statusValue}>{settings?.projectId || "—"}</div>
            </div>
          </div>
        )}
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className={styles.tabs} role="tablist">
        <button
          id="tab-wizard"
          role="tab"
          aria-selected={activeTab === "wizard"}
          className={`${styles.tab} ${activeTab === "wizard" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("wizard")}
        >
          <Key size={15} className={styles.tabIcon} />
          Setup Wizard
        </button>
        <button
          id="tab-connection"
          role="tab"
          aria-selected={activeTab === "connection"}
          className={`${styles.tab} ${activeTab === "connection" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("connection")}
        >
          <Zap size={15} className={styles.tabIcon} />
          Test Connection
        </button>
        <button
          id="tab-cache"
          role="tab"
          aria-selected={activeTab === "cache"}
          className={`${styles.tab} ${activeTab === "cache" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("cache")}
        >
          <Database size={15} className={styles.tabIcon} />
          Cache &amp; Storage
        </button>
      </div>

      {/* ── Panel: Setup Wizard ─────────────────────────────────────── */}
      {activeTab === "wizard" && (
        <div className={styles.panel} role="tabpanel" aria-labelledby="tab-wizard">

          {/* Step 1: Google Cloud Project */}
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <div className={`${styles.stepBadge} ${isConfigured ? styles.stepBadgeDone : ""}`}>
                {isConfigured ? <CheckCircle2 size={16} /> : "1"}
              </div>
              <div className={styles.stepInfo}>
                <h2 className={styles.stepTitle}>Create a Google Cloud Project &amp; Enable Drive API</h2>
                <p className={styles.stepDesc}>One-time setup in Google Cloud Console</p>
              </div>
            </div>
            <div className={styles.stepBody}>
              <p className={styles.stepInstruction}>
                Open <code>console.cloud.google.com</code>, go to <strong>APIs &amp; Services → Enable APIs</strong> and search for <strong>Google Drive API</strong>. Click Enable. If you don&apos;t have a project yet, create one — it&apos;s free.
              </p>
            </div>
          </div>

          {/* Step 2: Create Service Account */}
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <div className={`${styles.stepBadge} ${isConfigured ? styles.stepBadgeDone : ""}`}>
                {isConfigured ? <CheckCircle2 size={16} /> : "2"}
              </div>
              <div className={styles.stepInfo}>
                <h2 className={styles.stepTitle}>Create a Service Account &amp; Download Key</h2>
                <p className={styles.stepDesc}>Generate a JSON key file — this is your app&apos;s secure credential</p>
              </div>
            </div>
            <div className={styles.stepBody}>
              <p className={styles.stepInstruction}>
                Go to <strong>IAM &amp; Admin → Service Accounts → Create Service Account</strong>. Give it any name (e.g. <code>drive-dashboard</code>). Then open the account, go to <strong>Keys → Add Key → Create new key → JSON</strong>. A <code>.json</code> file will download to your computer.
              </p>
              <p className={styles.stepWarning}>
                Keep this JSON file private — never commit it to Git or share it publicly. It grants read access to any Drive folder you share with the service account email.
              </p>
            </div>
          </div>

          {/* Step 3: Share Drive Folder */}
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <div className={`${styles.stepBadge} ${isConfigured ? styles.stepBadgeDone : ""}`}>
                {isConfigured ? <CheckCircle2 size={16} /> : "3"}
              </div>
              <div className={styles.stepInfo}>
                <h2 className={styles.stepTitle}>Share Your Google Drive Root Folder</h2>
                <p className={styles.stepDesc}>Grant Viewer access to the service account email</p>
              </div>
            </div>
            <div className={styles.stepBody}>
              <p className={styles.stepInstruction}>
                Open <code>drive.google.com</code>, right-click the folder you want to scan, select <strong>Share</strong>, and paste the service account email (it ends in <code>@...iam.gserviceaccount.com</code>). Set the role to <strong>Viewer</strong>.
              </p>
              {settings?.clientEmail && (
                <p className={styles.stepEmail}>
                  Your service account email: <code>{settings.clientEmail}</code>
                </p>
              )}
            </div>
          </div>

          {/* Step 4: Configure App */}
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <div className={`${styles.stepBadge} ${isConfigured ? styles.stepBadgeDone : ""}`}>
                {isConfigured ? <CheckCircle2 size={16} /> : "4"}
              </div>
              <div className={styles.stepInfo}>
                <h2 className={styles.stepTitle}>Upload Credentials &amp; Set Root Folder</h2>
                <p className={styles.stepDesc}>Configure this app with your key and folder ID</p>
              </div>
            </div>
            <div className={styles.stepBody}>
              <form onSubmit={handleSaveSettings} className={styles.form}>
                {/* Drive Display Name */}
                <div className={styles.field}>
                  <label className={styles.label}>Drive Display Name (optional)</label>
                  <input
                    id="settings-drive-name"
                    type="text"
                    className={styles.input}
                    placeholder="e.g. My Google Drive"
                    value={driveName}
                    onChange={(e) => setDriveName(e.target.value)}
                  />
                  <span className={styles.hint}>A friendly label shown in the dashboard header.</span>
                </div>

                {/* Root Folder ID */}
                <div className={styles.field}>
                  <label className={styles.label}>Google Drive Root Folder ID or URL <span style={{ color: "var(--error)" }}>*</span></label>
                  <input
                    id="settings-folder-id"
                    type="text"
                    className={styles.input}
                    placeholder="e.g. 1a2b3c... or https://drive.google.com/drive/folders/..."
                    value={rootFolderId}
                    onChange={(e) => setRootFolderId(e.target.value)}
                    required
                  />
                  <span className={styles.hint}>
                    You can paste the full Google Drive URL — the folder ID will be extracted automatically.
                  </span>
                </div>

                {/* JSON Key Upload */}
                <div className={styles.field}>
                  <label className={styles.label}>Service Account JSON Key {isConfigured ? "(leave blank to keep existing)" : ""}</label>

                  {/* Drop zone */}
                  <div className={styles.uploadZone} onClick={handleDropZoneClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleDropZoneClick()}>
                    <Upload size={22} className={styles.uploadZoneIcon} />
                    <div className={styles.uploadZoneText}>
                      {uploadedFileName ? `✓ ${uploadedFileName}` : "Click to upload service-account.json"}
                    </div>
                    <div className={styles.uploadZoneSub}>or paste JSON below</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                      id="settings-credentials-file"
                    />
                  </div>

                  <textarea
                    id="settings-credentials-json"
                    className={styles.textarea}
                    placeholder='{ "type": "service_account", "project_id": "...", ... }'
                    value={credentialsJson}
                    onChange={(e) => setCredentialsJson(e.target.value)}
                  />
                  <span className={styles.hint}>
                    Current key file: <code>{settings?.credentialsPath}</code>{" "}
                    ({settings?.credentialsFound ? "✓ Present" : "✗ Missing"})
                  </span>
                </div>

                <div className={styles.actionsRow}>
                  <button
                    id="settings-save-btn"
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
                  <div className={`${styles.feedbackBanner} ${saveResult.success ? styles.success : styles.error}`}>
                    {saveResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{saveResult.message}</span>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Security Note */}
          <div className={styles.securityNote}>
            <p><strong>🔒 Security &amp; Privacy:</strong></p>
            <p style={{ marginTop: "6px" }}>
              Your credentials are saved strictly on this local machine in <code>.env.local</code> and <code>secrets/service-account.json</code>. Both files are permanently listed in <code>.gitignore</code> and are never uploaded, shared, or transmitted anywhere. The author of this application will never have access to your keys or Drive files.
            </p>
          </div>
        </div>
      )}

      {/* ── Panel: Test Connection ──────────────────────────────────── */}
      {activeTab === "connection" && (
        <div className={styles.panel} role="tabpanel" aria-labelledby="tab-connection">
          <div className={styles.card}>
            <div className={styles.actionsRow} style={{ marginBottom: "16px" }}>
              <button
                id="settings-test-btn"
                type="button"
                className={styles.btnSecondary}
                onClick={handleTestConnection}
                disabled={testing || !isConfigured}
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
              {!isConfigured && (
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Complete Setup Wizard first to enable connection testing.
                </span>
              )}
            </div>

            {testResult && (
              <div className={`${styles.feedbackBanner} ${testResult.success ? styles.success : styles.error}`}>
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{testResult.message}</span>
              </div>
            )}

            {!testResult && isConfigured && !testing && (
              <p className={styles.infoNote}>
                Click <strong>Test Live Connection</strong> to verify the service account can reach your Google Drive folder. This makes a real API call and reports back the folder name and access status.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Panel: Cache & Storage ──────────────────────────────────── */}
      {activeTab === "cache" && (
        <div className={styles.panel} role="tabpanel" aria-labelledby="tab-cache">
          <div className={styles.card}>
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
                id="settings-export-cache-btn"
                href="/api/drive/export-cache"
                className={styles.btnSecondary}
                style={{ textDecoration: "none" }}
                title="Download consolidated cache file as JSON"
                download
              >
                <Download size={15} />
                Download Cache Export
              </a>

              <button
                id="settings-flush-cache-btn"
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
              <div className={`${styles.feedbackBanner} ${flushResult.success ? styles.success : styles.error}`}>
                {flushResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{flushResult.message}</span>
              </div>
            )}

            <p className={styles.infoNote} style={{ marginTop: "20px" }}>
              The <strong>cache export</strong> downloads a consolidated JSON snapshot of all scanned folder sizes, useful for offline analysis or backups. <strong>Flush Size Cache</strong> wipes the precomputed sizes so the next deep-scan starts fresh.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

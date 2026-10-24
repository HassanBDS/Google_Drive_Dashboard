"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Folder,
  ShieldCheck,
  FileCode,
  ArrowRight,
  Loader2,
} from "lucide-react";
import styles from "./OnboardingWizard.module.css";

interface OnboardingWizardProps {
  onConfigured?: () => void;
}

export default function OnboardingWizard({ onConfigured }: OnboardingWizardProps) {
  const [credentialsJson, setCredentialsJson] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rootFolderInput, setRootFolderInput] = useState("");
  const [driveName, setDriveName] = useState("");
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract folder ID from URL if user pastes a full Google Drive URL
  const extractFolderId = (input: string): string => {
    const trimmed = input.trim();
    const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    const idMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];
    return trimmed;
  };

  const handleFolderInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRootFolderInput(val);
  };

  const parseAndSetJson = (text: string, name?: string) => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed.client_email || !parsed.private_key) {
        setError("Invalid Service Account file: Missing 'client_email' or 'private_key'.");
        return false;
      }
      setCredentialsJson(text);
      if (name) setFileName(name);
      setError(null);
      return true;
    } catch {
      setError("Failed to parse JSON file. Please ensure it is a valid JSON document.");
      return false;
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      setError("Please upload a .json credentials file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseAndSetJson(text, file.name);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const folderId = extractFolderId(rootFolderInput);
    if (!folderId) {
      setError("Please provide a Google Drive Folder ID or URL.");
      return;
    }

    if (!credentialsJson.trim()) {
      setError("Please upload or paste your Google Cloud Service Account JSON key.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialsJson,
          rootFolderId: folderId,
          driveName: driveName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save settings and connect.");
      }

      setSuccessMsg(data.message || `Successfully connected to "${data.folderName || folderId}"!`);

      setTimeout(() => {
        if (onConfigured) {
          onConfigured();
        } else {
          window.location.reload();
        }
      }, 1200);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during setup.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>
            <ShieldCheck size={14} />
            First-Time Setup
          </div>
          <h1 className={styles.title}>Connect Your Google Drive</h1>
          <p className={styles.subtitle}>
            Enter your Google Cloud Service Account credentials and root folder ID to start exploring and analyzing sizes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>{error}</div>
            </div>
          )}

          {successMsg && (
            <div className={styles.successBanner}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Credentials JSON Key */}
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>1. Service Account JSON Key</label>
              <button
                type="button"
                className={styles.hint}
                onClick={() => setShowJsonPaste(!showJsonPaste)}
                style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                {showJsonPaste ? "Switch to file drop" : "Or paste JSON text"}
              </button>
            </div>

            {showJsonPaste ? (
              <textarea
                className={styles.textarea}
                placeholder='Paste the content of your service-account.json key here: { "type": "service_account", ... }'
                value={credentialsJson}
                onChange={(e) => {
                  setCredentialsJson(e.target.value);
                  setFileName(null);
                }}
              />
            ) : (
              <div
                className={`${styles.dropzone} ${fileName ? styles.hasFile : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />
                {fileName ? (
                  <>
                    <CheckCircle2 size={28} className={styles.dropIcon} style={{ color: "var(--success)" }} />
                    <div className={styles.dropTitle}>Key Loaded: {fileName}</div>
                    <div className={styles.dropSub}>Click or drag another file to replace</div>
                  </>
                ) : (
                  <>
                    <UploadCloud size={32} className={styles.dropIcon} />
                    <div className={styles.dropTitle}>Click to upload or drag & drop service-account.json</div>
                    <div className={styles.dropSub}>Your key will be securely saved locally in secrets/</div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Root Folder ID / URL */}
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>2. Google Drive Root Folder</label>
              <span className={styles.hint}>Folder ID or URL</span>
            </div>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. 1a2b3c4d5e... or https://drive.google.com/drive/folders/1a2b..."
              value={rootFolderInput}
              onChange={handleFolderInputChange}
              required
            />
            <div className={styles.helpTip}>
              <Folder size={14} style={{ flexShrink: 0, marginTop: "2px", color: "var(--accent)" }} />
              <span>
                <strong>Tip:</strong> You can paste the direct folder link from your browser address bar. Make sure the folder is shared with your Service Account email!
              </span>
            </div>
          </div>

          {/* Drive Display Name */}
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>3. Drive Display Name (Optional)</label>
              <span className={styles.hint}>e.g. "Main Drive", "Media Library"</span>
            </div>
            <input
              type="text"
              className={styles.input}
              placeholder="Google Drive"
              value={driveName}
              onChange={(e) => setDriveName(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading || !credentialsJson.trim() || !rootFolderInput.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="spinning" />
                Testing & Saving Connection…
              </>
            ) : (
              <>
                Save & Connect Drive
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Expandable Step-by-Step Guide for Non-Devs */}
        <div className={styles.guideSection}>
          <button
            type="button"
            className={styles.guideToggle}
            onClick={() => setShowGuide(!showGuide)}
          >
            <HelpCircle size={15} />
            <span>Need help creating a Google Cloud Service Account?</span>
            {showGuide ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showGuide && (
            <div className={styles.guideSteps}>
              <div className={styles.step}>
                <div className={styles.stepNum}>1</div>
                <div>
                  Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">Google Cloud Console</a> and create or select a project.
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>2</div>
                <div>
                  Search for <strong>Google Drive API</strong> in the API Library and click <strong>Enable</strong>.
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>3</div>
                <div>
                  Navigate to <strong>IAM & Admin &gt; Service Accounts</strong>. Click <strong>Create Service Account</strong>, give it a name, and click <strong>Done</strong>.
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>4</div>
                <div>
                  Click on the newly created Service Account &gt; <strong>Keys</strong> tab &gt; <strong>Add Key &gt; Create new key (JSON)</strong>. A <code>.json</code> file will download to your computer.
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>5</div>
                <div>
                  Open Google Drive in your browser, right-click the folder you want to browse &gt; <strong>Share</strong>, and add the Service Account email (from step 3) as <strong>Viewer</strong> or <strong>Editor</strong>.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

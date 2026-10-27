export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { google } from "googleapis";
import { getCredentialsPath, getRootFolderId, getDriveName } from "@/lib/google-drive";

function readEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  });
  return env;
}

function writeEnvLocal(updates: Record<string, string>) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const current = readEnvLocal();
  const merged = { ...current, ...updates };

  let content = "# Google Drive Dashboard Configuration\n";
  for (const [k, v] of Object.entries(merged)) {
    content += `${k}=${v}\n`;
  }
  fs.writeFileSync(envPath, content, "utf-8");

  // Update in-memory environment
  for (const [k, v] of Object.entries(updates)) {
    process.env[k] = v;
  }
}

export async function GET() {
  try {
    const credPath = getCredentialsPath();
    const rootFolderId = getRootFolderId();
    const driveName = getDriveName();

    const credentialsFound = fs.existsSync(credPath);
    let clientEmail: string | undefined;
    let projectId: string | undefined;

    if (credentialsFound) {
      try {
        const raw = JSON.parse(fs.readFileSync(credPath, "utf-8"));
        clientEmail = raw.client_email;
        projectId = raw.project_id;
      } catch {
        // Invalid json
      }
    }

    // Measure cache size
    const cacheDir = path.resolve(process.cwd(), "data", "size-cache");
    let cacheFileCount = 0;
    let cacheSizeBytes = 0;

    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const f of files) {
        if (f.endsWith(".json")) {
          cacheFileCount++;
          const stat = fs.statSync(path.join(cacheDir, f));
          cacheSizeBytes += stat.size;
        }
      }
    }

    const isConfigured = credentialsFound && !!clientEmail && !!rootFolderId;

    return NextResponse.json({
      isConfigured,
      driveName,
      rootFolderId,
      credentialsPath: credPath,
      credentialsFound,
      clientEmail,
      projectId,
      cacheStats: {
        fileCount: cacheFileCount,
        totalSizeBytes: cacheSizeBytes,
      },
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driveName, rootFolderId, credentialsJson, testOnly } = body;

    let targetCredPath = getCredentialsPath();

    // 1. If JSON was provided, validate and write it to secrets/service-account.json
    if (credentialsJson) {
      let parsed: any;
      try {
        parsed = typeof credentialsJson === "string" ? JSON.parse(credentialsJson) : credentialsJson;
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON format. Please paste a valid Google Cloud Service Account key file." },
          { status: 400 }
        );
      }

      if (!parsed.client_email || !parsed.private_key) {
        return NextResponse.json(
          { error: "Missing 'client_email' or 'private_key' in the provided JSON key." },
          { status: 400 }
        );
      }

      const secretsDir = path.resolve(process.cwd(), "secrets");
      if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });

      targetCredPath = path.join(secretsDir, "service-account.json");
      fs.writeFileSync(targetCredPath, JSON.stringify(parsed, null, 2), "utf-8");
    }

    if (!fs.existsSync(/*turbopackIgnore: true*/ targetCredPath)) {
      return NextResponse.json(
        { error: `Credentials file not found at ${targetCredPath}. Please upload or paste your JSON key.` },
        { status: 400 }
      );
    }

    const targetFolderId = rootFolderId || getRootFolderId();
    if (!targetFolderId) {
      return NextResponse.json(
        { error: "Google Drive Root Folder ID is required." },
        { status: 400 }
      );
    }

    // 2. Validate connection with Google Drive API
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: targetCredPath,
        scopes: ["https://www.googleapis.com/auth/drive"],
      });
      const drive = google.drive({ version: "v3", auth });

      const folderCheck = await drive.files.get({
        fileId: targetFolderId,
        fields: "id, name, mimeType",
      });

      if (folderCheck.data.mimeType !== "application/vnd.google-apps.folder") {
        return NextResponse.json(
          { error: `The ID "${targetFolderId}" is a file ("${folderCheck.data.name}"), not a Google Drive folder.` },
          { status: 400 }
        );
      }

      // If test only, return success without saving
      if (testOnly) {
        return NextResponse.json({
          success: true,
          message: `Successfully connected to folder: "${folderCheck.data.name}"`,
          folderName: folderCheck.data.name,
        });
      }

      // 3. Persist to .env.local
      const updates: Record<string, string> = {
        GDRIVE_CREDENTIALS_PATH: "./secrets/service-account.json",
        GDRIVE_ROOT_FOLDER_ID: targetFolderId,
        GDRIVE_DRIVE_NAME: driveName || folderCheck.data.name || "Google Drive",
      };
      writeEnvLocal(updates);

      return NextResponse.json({
        success: true,
        message: `Connected successfully to "${folderCheck.data.name}"!`,
        folderName: folderCheck.data.name,
      });
    } catch (apiErr: any) {
      const msg = apiErr.message || String(apiErr);
      let hint = "";
      if (msg.includes("404") || msg.includes("File not found")) {
        hint = " (File not found: Ensure the target Google Drive folder is shared with your Service Account email with Viewer access).";
      } else if (msg.includes("403")) {
        hint = " (Permission denied: Verify Google Drive API is enabled in your Google Cloud Console project).";
      }
      return NextResponse.json(
        { error: `Google Drive API connection test failed: ${msg}${hint}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save configuration" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "flush-cache") {
      const cacheDir = path.resolve(process.cwd(), "data", "size-cache");
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        for (const f of files) {
          if (f.endsWith(".json")) {
            fs.unlinkSync(path.join(cacheDir, f));
          }
        }
      }
      return NextResponse.json({ success: true, message: "Cache cleared successfully." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("Settings DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear cache" },
      { status: 500 }
    );
  }
}

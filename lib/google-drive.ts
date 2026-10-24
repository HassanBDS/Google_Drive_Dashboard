/**
 * Google Drive API client — server-only.
 * Uses service account credentials for authentication.
 * Single-drive architecture configured via environment variables.
 */
import { google, drive_v3 } from "googleapis";
import path from "path";
import fs from "fs";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

let _drive: drive_v3.Drive | null = null;

export function getCredentialsPath(): string {
  const p = process.env.GDRIVE_CREDENTIALS_PATH || "./secrets/service-account.json";
  return path.resolve(process.cwd(), p);
}

export function getRootFolderId(): string {
  return process.env.GDRIVE_ROOT_FOLDER_ID || "";
}

export function getDriveName(): string {
  return process.env.GDRIVE_DRIVE_NAME || "Google Drive";
}

export function getDriveClient(): drive_v3.Drive {
  if (_drive) return _drive;

  const credPath = getCredentialsPath();

  if (!fs.existsSync(credPath)) {
    throw new Error(
      `Credentials file not found at: ${credPath}\nPlease place your Google Cloud Service Account JSON file in secrets/ and set GDRIVE_CREDENTIALS_PATH in .env.local`
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: SCOPES,
  });

  _drive = google.drive({ version: "v3", auth });
  return _drive;
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink: string;
  iconLink: string;
  parents: string[];
  isFolder: boolean;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface ListFolderResult {
  folders: DriveItem[];
  files: DriveItem[];
  breadcrumbs: BreadcrumbItem[];
  nextPageToken?: string;
}

function mapItem(file: drive_v3.Schema$File): DriveItem {
  return {
    id: file.id || "",
    name: file.name || "",
    mimeType: file.mimeType || "",
    size: file.size || "0",
    modifiedTime: file.modifiedTime || "",
    webViewLink: file.webViewLink || "",
    webContentLink: file.webContentLink || "",
    iconLink: file.iconLink || "",
    parents: (file.parents as string[]) || [],
    isFolder: file.mimeType === "application/vnd.google-apps.folder",
  };
}

/**
 * List contents of a folder, separated into folders and files.
 */
export async function listFolder(
  folderId?: string,
  pageToken?: string,
  pageSize: number = 1000
): Promise<ListFolderResult> {
  const drive = getDriveClient();
  const rootId = getRootFolderId();
  const targetId = folderId || rootId;

  if (!targetId) {
    throw new Error("Target folder ID is missing. Please configure GDRIVE_ROOT_FOLDER_ID in .env.local");
  }

  const allFiles: drive_v3.Schema$File[] = [];
  let currentToken = pageToken;

  do {
    const res = await drive.files.list({
      q: `'${targetId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink, parents)",
      orderBy: "folder, name",
      pageSize: 1000,
      pageToken: currentToken || undefined,
    });

    allFiles.push(...(res.data.files || []));
    currentToken = res.data.nextPageToken || undefined;

    if (pageToken) break;
  } while (currentToken);

  const items = allFiles.map(mapItem);
  const folders = items.filter((i) => i.isFolder);
  const files = items.filter((i) => !i.isFolder);

  const breadcrumbs = await buildBreadcrumbs(targetId);

  return {
    folders,
    files,
    breadcrumbs,
    nextPageToken: currentToken,
  };
}

/**
 * Build breadcrumb path from a folder up to root.
 */
export async function buildBreadcrumbs(folderId: string): Promise<BreadcrumbItem[]> {
  const drive = getDriveClient();
  const rootId = getRootFolderId();
  const driveName = getDriveName();
  const crumbs: BreadcrumbItem[] = [];
  let currentId = folderId;

  // Safety limit to prevent infinite parent lookups
  for (let i = 0; i < 10; i++) {
    if (currentId === rootId) {
      crumbs.unshift({ id: rootId, name: driveName });
      break;
    }

    try {
      const res = await drive.files.get({
        fileId: currentId,
        fields: "id, name, parents",
      });

      crumbs.unshift({
        id: res.data.id || currentId,
        name: res.data.name || "Unknown",
      });

      const parents = res.data.parents as string[] | undefined;
      if (!parents || parents.length === 0) break;
      currentId = parents[0];
    } catch {
      break;
    }
  }

  // Ensure root is always first
  if (crumbs.length === 0 || crumbs[0].id !== rootId) {
    crumbs.unshift({ id: rootId, name: driveName });
  }

  return crumbs;
}

/**
 * Search files by name within a folder subtree.
 */
export async function searchFiles(query: string, folderId?: string): Promise<DriveItem[]> {
  const drive = getDriveClient();
  const parentClause = folderId ? `'${folderId}' in parents and ` : "";

  const res = await drive.files.list({
    q: `${parentClause}name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
    fields:
      "files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink, parents)",
    orderBy: "folder, name",
    pageSize: 50,
  });

  return (res.data.files || []).map(mapItem);
}

/**
 * Get shallow statistics for a folder.
 */
export async function getFolderStats(
  folderId?: string
): Promise<{ folderCount: number; fileCount: number; totalSize: number }> {
  const drive = getDriveClient();
  const targetId = folderId || getRootFolderId();

  let folderCount = 0;
  let fileCount = 0;
  let totalSize = 0;
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${targetId}' in parents and trashed = false`,
      fields: "nextPageToken, files(mimeType, size)",
      pageSize: 1000,
      pageToken,
    });

    for (const file of res.data.files || []) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        folderCount++;
      } else {
        fileCount++;
        totalSize += parseInt(file.size || "0", 10);
      }
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return { folderCount, fileCount, totalSize };
}

export type ShallowStats = {
  folderCount: number;
  fileCount: number;
  mediaCount: number;
  xmlCount: number;
  totalSize: number;
};

// Server-side in-memory cache for shallow stats
const STATS_CACHE = new Map<string, { data: ShallowStats; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Shallow stat for a single folder — used for bulk folder cards.
 */
export async function getFolderShallowStats(
  folderId: string,
  bypassCache = false
): Promise<ShallowStats> {
  const now = Date.now();
  const cached = STATS_CACHE.get(folderId);
  if (!bypassCache && cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const drive = getDriveClient();

  let folderCount = 0;
  let fileCount = 0;
  let mediaCount = 0;
  let xmlCount = 0;
  let totalSize = 0;
  let pageToken: string | undefined;

  const MEDIA_MIME_PREFIXES = ["image/", "video/", "audio/"];
  const MEDIA_MIMES = new Set([
    "application/vnd.comicbook+zip",
    "application/x-cbr",
    "application/x-cbz",
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/pdf",
  ]);

  const MEDIA_EXTS = new Set([
    ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp", ".tiff", ".tif", ".svg",
    ".cbz", ".cbr", ".mp4", ".mkv", ".avi", ".mov", ".webm",
    ".mp3", ".wav", ".flac", ".ogg", ".pdf", ".zip", ".rar", ".7z",
  ]);

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(mimeType, size, name)",
      pageSize: 1000,
      pageToken,
    });

    for (const file of res.data.files || []) {
      const mime = file.mimeType ?? "";
      const name = (file.name ?? "").toLowerCase();
      const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
      const size = parseInt(file.size || "0", 10);

      if (mime === "application/vnd.google-apps.folder") {
        folderCount++;
      } else {
        fileCount++;
        totalSize += size;
        const isMedia =
          MEDIA_MIMES.has(mime) ||
          MEDIA_EXTS.has(ext) ||
          MEDIA_MIME_PREFIXES.some((p) => mime.startsWith(p));
        if (isMedia) mediaCount++;
        if (name.endsWith(".xml")) xmlCount++;
      }
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  const result: ShallowStats = { folderCount, fileCount, mediaCount, xmlCount, totalSize };
  STATS_CACHE.set(folderId, { data: result, ts: now });
  return result;
}

/** Sleep helper. */
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("quota") ||
      msg.includes("userratelimitexceeded") ||
      msg.includes("503") ||
      msg.includes("429")
    );
  }
  return false;
}

export async function driveCall<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err) && attempt < retries - 1) {
        await sleep(600 * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error("driveCall: exhausted retries");
}

export async function listSubFolders(parentId: string): Promise<DriveItem[]> {
  const drive = getDriveClient();
  const folders: DriveItem[] = [];
  let pageToken: string | undefined;

  do {
    const res = await driveCall(() =>
      drive.files.list({
        q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, modifiedTime, parents, webViewLink, webContentLink, iconLink, size)",
        orderBy: "name",
        pageSize: 1000,
        pageToken,
      })
    );

    for (const f of res.data.files ?? []) {
      folders.push(mapItem(f));
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return folders;
}

/**
 * Renames a single Drive file/folder with sibling collision check.
 */
export async function renameFile(
  fileId: string,
  newName: string,
  expectedParentId?: string
): Promise<{ id: string; name: string }> {
  const drive = getDriveClient();

  if (expectedParentId) {
    const meta = await driveCall(() =>
      drive.files.get({ fileId, fields: "id, parents" })
    );
    const parents = (meta.data.parents as string[] | undefined) ?? [];
    if (!parents.includes(expectedParentId)) {
      throw new Error(`File ${fileId} no longer belongs to parent ${expectedParentId} — rename aborted.`);
    }

    const siblings = await driveCall(() =>
      drive.files.list({
        q: `'${expectedParentId}' in parents and name = '${newName.replace(/'/g, "\\'").replace(/\\/g, "\\\\")}' and trashed = false`,
        fields: "files(id)",
        pageSize: 1,
      })
    );
    if ((siblings.data.files ?? []).length > 0) {
      throw new Error(`Collision: "${newName}" already exists in the parent folder.`);
    }
  }

  const updated = await driveCall(() =>
    drive.files.update({
      fileId,
      requestBody: { name: newName },
      fields: "id, name",
    })
  );

  return { id: updated.data.id!, name: updated.data.name! };
}

/**
 * Moves a file or folder to trash.
 */
export async function deleteFile(fileId: string): Promise<{ success: boolean }> {
  const drive = getDriveClient();
  await driveCall(() =>
    drive.files.update({
      fileId,
      requestBody: { trashed: true },
    })
  );
  return { success: true };
}

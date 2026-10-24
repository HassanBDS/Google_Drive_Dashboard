/**
 * BFS Drive Size Scanner — High performance disk usage analyzer with checkpoints.
 * Single-drive architecture.
 */
import { google, drive_v3 } from "googleapis";
import path from "path";
import fs from "fs";
import { getCredentialsPath, getRootFolderId } from "@/lib/google-drive";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FolderSizeNode {
  id: string;
  name: string;
  ownFileSize: number;       // Size of files directly in this folder
  totalSize: number;         // Recursive: ownFileSize + all children totalSize
  fileCount: number;         // Direct file count
  totalFileCount: number;    // Recursive file count
  folderCount: number;       // Direct subfolder count
  totalFolderCount: number;  // Recursive subfolder count
  children: Record<string, FolderSizeNode>;
}

export interface FolderSizeCacheData {
  folderId: string;
  folderName: string;
  root: FolderSizeNode;
  scannedAt: string;
  scanDurationMs: number;
}

export interface IndexEntry {
  folderId: string;
  folderName: string;
  totalSize: number;
  totalFileCount: number;
  totalFolderCount: number;
  folderCount: number;
  scannedAt: string;
}

export interface MasterIndex {
  locales: IndexEntry[];
  updatedAt: string;
}

export interface ScanProgress {
  phase: "discovering_locales" | "discovering_titles" | "discovering_chapters" | "calculating_sizes" | "complete" | "error" | "stopping" | "resuming";
  folderId?: string;
  foldersScanned: number;
  currentFolder: string;
  elapsedMs: number;
  message?: string;
  checkpointExists?: boolean;
  totalLocalesFound?: number;
  totalTitlesFound?: number;
  totalChaptersFound?: number;
  chaptersProcessed?: number;
}

export interface QueueItem {
  folderId: string;
  folderName: string;
  parentId: string | null;
  depth: number;
}

export interface ScanCheckpoint {
  targetFolderId: string;
  isPartial: boolean;
  initialDepth: number;
  queue: QueueItem[];
  rootNode: FolderSizeNode | null;
  startedAt: string;
  foldersScanned: number;
  totalLocalesFound: number;
  totalTitlesFound: number;
  totalChaptersFound: number;
  chaptersProcessed: number;
}

// ─── File I/O ────────────────────────────────────────────────────────────────

function cacheDir(): string {
  return path.join(process.cwd(), "data", "size-cache");
}

function cacheFilePath(folderId: string): string {
  return path.join(cacheDir(), `${folderId}.json`);
}

function checkpointFilePath(folderId: string): string {
  return path.join(cacheDir(), `${folderId}-checkpoint.json`);
}

function indexFilePath(): string {
  return path.join(cacheDir(), "index.json");
}

export function readFolderSizeCache(folderId: string): FolderSizeCacheData | null {
  try {
    const fp = cacheFilePath(folderId);
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as FolderSizeCacheData;
  } catch {
    return null;
  }
}

export function writeFolderSizeCache(data: FolderSizeCacheData): void {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(cacheFilePath(data.folderId), JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[cache] Failed to write:", err);
  }
}

export function readMasterIndex(): MasterIndex | null {
  try {
    const fp = indexFilePath();
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as MasterIndex;
  } catch {
    return null;
  }
}

export function rebuildMasterIndex(): MasterIndex {
  const dir = cacheDir();
  fs.mkdirSync(dir, { recursive: true });
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const locales: IndexEntry[] = [];

  for (const f of files) {
    if (f === "index.json" || f.endsWith("-checkpoint.json") || f.endsWith(".backup.json") || f === ".gitkeep") continue;
    if (!f.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as FolderSizeCacheData;
      locales.push({
        folderId: data.folderId,
        folderName: data.folderName || data.root?.name || "Unknown",
        totalSize: data.root?.totalSize ?? 0,
        totalFileCount: data.root?.totalFileCount ?? 0,
        totalFolderCount: data.root?.totalFolderCount ?? 0,
        folderCount: data.root?.folderCount ?? 0,
        scannedAt: data.scannedAt,
      });
    } catch {
      // Skip invalid JSON
    }
  }

  const index: MasterIndex = { locales, updatedAt: new Date().toISOString() };
  fs.writeFileSync(indexFilePath(), JSON.stringify(index, null, 2), "utf-8");
  return index;
}

export function buildFlatSizeMap(
  folderId?: string
): Record<string, { totalSize: number; totalFileCount: number; totalFolderCount: number; folderCount: number }> {
  const map: Record<string, { totalSize: number; totalFileCount: number; totalFolderCount: number; folderCount: number }> = {};

  function walk(node: FolderSizeNode) {
    map[node.id] = {
      totalSize: node.totalSize,
      totalFileCount: node.totalFileCount,
      totalFolderCount: node.totalFolderCount,
      folderCount: node.folderCount,
    };
    for (const child of Object.values(node.children)) walk(child);
  }

  if (folderId) {
    const cache = readFolderSizeCache(folderId);
    if (cache?.root) walk(cache.root);
    return map;
  }

  const dir = cacheDir();
  if (!fs.existsSync(dir)) return map;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === "index.json" || f.endsWith("-checkpoint.json") || f.endsWith(".backup.json") || f === ".gitkeep") continue;
    if (!f.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as FolderSizeCacheData;
      if (data.root) walk(data.root);
    } catch { /* skip */ }
  }
  return map;
}

export function getActiveCheckpoints(): Record<string, { startedAt: string; foldersScanned: number; folderName?: string }> {
  const result: Record<string, { startedAt: string; foldersScanned: number; folderName?: string }> = {};
  const dir = cacheDir();
  if (!fs.existsSync(dir)) return result;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (!f.endsWith("-checkpoint.json")) continue;
    const folderId = f.replace(/-checkpoint\.json$/, "");
    try {
      const ckpt = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as ScanCheckpoint;
      result[folderId] = {
        startedAt: ckpt.startedAt,
        foldersScanned: ckpt.foldersScanned,
        folderName: ckpt.rootNode?.name,
      };
    } catch { /* skip */ }
  }
  return result;
}

export function readCheckpoint(folderId: string): ScanCheckpoint | null {
  try {
    const fp = checkpointFilePath(folderId);
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as ScanCheckpoint;
  } catch {
    return null;
  }
}

export function writeCheckpoint(checkpoint: ScanCheckpoint): void {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(checkpointFilePath(checkpoint.targetFolderId), JSON.stringify(checkpoint, null, 2), "utf-8");
  } catch (err) {
    console.error("[checkpoint] Failed to write:", err);
  }
}

export function clearCheckpoint(folderId: string): void {
  try {
    const fp = checkpointFilePath(folderId);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch { /* non-critical */ }
}

// ─── Drive Client ─────────────────────────────────────────────────────────────

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];
let _scanDrive: drive_v3.Drive | null = null;

function getScanDriveClient(): drive_v3.Drive {
  if (_scanDrive) return _scanDrive;
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) throw new Error(`Credentials file not found: ${credPath}`);
  const auth = new google.auth.GoogleAuth({ keyFile: credPath, scopes: SCOPES });
  _scanDrive = google.drive({ version: "v3", auth });
  return _scanDrive;
}

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("rate limit") || msg.includes("quota") || msg.includes("429") || msg.includes("503");
  }
  return false;
}

async function driveCall<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err) && attempt < retries - 1) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error("driveCall: exhausted retries");
}

function lookupFolder(root: FolderSizeNode, folderId: string): FolderSizeNode | null {
  if (root.id === folderId) return root;
  for (const child of Object.values(root.children)) {
    const found = lookupFolder(child, folderId);
    if (found) return found;
  }
  return null;
}

function recalcNode(node: FolderSizeNode): void {
  let childTotalSize = 0, childTotalFileCount = 0, childTotalFolderCount = 0;
  for (const child of Object.values(node.children)) {
    recalcNode(child);
    childTotalSize += child.totalSize;
    childTotalFileCount += child.totalFileCount;
    childTotalFolderCount += child.totalFolderCount;
  }
  node.totalSize = node.ownFileSize + childTotalSize;
  node.totalFileCount = node.fileCount + childTotalFileCount;
  node.totalFolderCount = Object.keys(node.children).length + childTotalFolderCount;
}

// ─── BFS Engine ───────────────────────────────────────────────────────────────

const SCAN_GAP_MS = 50;
const CHECKPOINT_INTERVAL = 30;

interface ScanContext {
  drive: drive_v3.Drive;
  checkpoint: ScanCheckpoint;
  abortSignal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void;
  startTime: number;
}

async function scanBFS(ctx: ScanContext): Promise<FolderSizeNode> {
  const { drive, checkpoint, abortSignal, onProgress, startTime } = ctx;

  while (checkpoint.queue.length > 0) {
    if (abortSignal?.aborted) throw new Error("Scan aborted");

    const item = checkpoint.queue.shift()!;
    const depthOffset = checkpoint.initialDepth;
    const relDepth = item.depth - depthOffset;
    let phase: ScanProgress["phase"] = "calculating_sizes";
    if (relDepth === 0) phase = "discovering_titles";
    else if (relDepth === 1) phase = "discovering_chapters";
    else if (relDepth < 0) phase = "discovering_locales";

    let allFiles: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    do {
      if (abortSignal?.aborted) throw new Error("Scan aborted");
      const res = await driveCall(() =>
        drive.files.list({
          q: `'${item.folderId}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, name, mimeType, size)",
          pageSize: 1000,
          pageToken,
        })
      );
      allFiles.push(...(res.data.files || []));
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    await sleep(SCAN_GAP_MS);

    const subFolders = allFiles.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
    const files = allFiles.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

    let ownFileSize = 0;
    for (const file of files) ownFileSize += parseInt(file.size || "0", 10);

    const node: FolderSizeNode = {
      id: item.folderId,
      name: item.folderName,
      ownFileSize,
      totalSize: ownFileSize,
      fileCount: files.length,
      totalFileCount: files.length,
      folderCount: subFolders.length,
      totalFolderCount: subFolders.length,
      children: {},
    };

    if (!checkpoint.rootNode) {
      checkpoint.rootNode = node;
    } else if (item.parentId) {
      const parentNode = lookupFolder(checkpoint.rootNode, item.parentId);
      if (parentNode) parentNode.children[node.id] = node;
    }

    for (const sub of subFolders) {
      checkpoint.queue.push({
        folderId: sub.id!,
        folderName: sub.name || "Unknown",
        parentId: node.id,
        depth: item.depth + 1,
      });
    }

    checkpoint.foldersScanned++;
    if (relDepth === 0) checkpoint.totalTitlesFound += subFolders.length;
    else if (relDepth === 1) checkpoint.totalChaptersFound += subFolders.length;
    else if (relDepth >= 2) checkpoint.chaptersProcessed++;

    if (checkpoint.foldersScanned % CHECKPOINT_INTERVAL === 0) {
      writeCheckpoint(checkpoint);
    }

    if (onProgress) {
      onProgress({
        phase,
        folderId: checkpoint.targetFolderId,
        foldersScanned: checkpoint.foldersScanned,
        currentFolder: item.folderName,
        elapsedMs: Date.now() - startTime,
        totalLocalesFound: checkpoint.totalLocalesFound,
        totalTitlesFound: checkpoint.totalTitlesFound,
        totalChaptersFound: checkpoint.totalChaptersFound,
        chaptersProcessed: checkpoint.chaptersProcessed,
      });
    }
  }

  if (!checkpoint.rootNode) throw new Error("No root node found");
  recalcNode(checkpoint.rootNode);
  return checkpoint.rootNode;
}

export async function runFolderScan(
  folderId: string,
  onProgress?: (progress: ScanProgress) => void,
  abortSignal?: AbortSignal,
  initialDepth: number = 1
): Promise<FolderSizeCacheData> {
  const drive = getScanDriveClient();
  const startTime = Date.now();

  let folderName = "Folder";
  try {
    const meta = await driveCall(() => drive.files.get({ fileId: folderId, fields: "name" }));
    folderName = meta.data.name || "Folder";
  } catch {}

  let checkpoint = readCheckpoint(folderId);

  if (!checkpoint || checkpoint.queue.length === 0) {
    checkpoint = {
      targetFolderId: folderId,
      isPartial: true,
      initialDepth,
      queue: [{ folderId, folderName, parentId: null, depth: initialDepth }],
      rootNode: null,
      startedAt: new Date().toISOString(),
      foldersScanned: 0,
      totalLocalesFound: 0,
      totalTitlesFound: 0,
      totalChaptersFound: 0,
      chaptersProcessed: 0,
    };
  } else {
    if (onProgress) {
      onProgress({
        phase: "resuming",
        folderId,
        foldersScanned: checkpoint.foldersScanned,
        currentFolder: folderName,
        elapsedMs: 0,
        message: `Resuming from ${checkpoint.foldersScanned} folders scanned…`,
        totalTitlesFound: checkpoint.totalTitlesFound,
        totalChaptersFound: checkpoint.totalChaptersFound,
        chaptersProcessed: checkpoint.chaptersProcessed,
      });
    }
  }

  const scannedNode = await scanBFS({ drive, checkpoint, abortSignal, onProgress, startTime });

  const data: FolderSizeCacheData = {
    folderId,
    folderName: scannedNode.name,
    root: scannedNode,
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - startTime,
  };

  writeFolderSizeCache(data);
  clearCheckpoint(folderId);
  rebuildMasterIndex();

  if (onProgress) {
    onProgress({
      phase: "complete",
      folderId,
      foldersScanned: checkpoint.foldersScanned,
      currentFolder: scannedNode.name,
      elapsedMs: Date.now() - startTime,
      message: `${scannedNode.name}: scan complete. ${scannedNode.totalSize} bytes`,
      totalTitlesFound: checkpoint.totalTitlesFound,
      totalChaptersFound: checkpoint.totalChaptersFound,
      chaptersProcessed: checkpoint.chaptersProcessed,
    });
  }

  return data;
}

export function isSizeCacheStale(cache: FolderSizeCacheData): boolean {
  const STALE_MS = 7 * 24 * 60 * 60 * 1000;
  if (!cache.scannedAt) return true;
  return Date.now() - new Date(cache.scannedAt).getTime() > STALE_MS;
}

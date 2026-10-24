/**
 * Utilities for storage hygiene analysis: detecting empty folders,
 * duplicate candidates, large uncompressed files, and health scoring.
 */

export interface HygieneReport {
  score: number; // 0 - 100
  status: "optimal" | "good" | "warning";
  statusLabel: string;
  emptyFoldersCount: number;
  duplicateCandidatesCount: number;
  duplicateEstimatedBytes: number;
  largeFilesCount: number;
  largeFilesTotalBytes: number;
  totalItemsAnalyzed: number;
  recommendations: string[];
}

export interface DriveItemMeta {
  id: string;
  name: string;
  size?: string | number;
  mimeType?: string;
}

export interface FolderStatMeta {
  directFileCount?: number;
  directFolderCount?: number;
  totalSize?: number;
  totalFileCount?: number;
}

/**
 * Analyze directory items and statistics for storage hygiene.
 */
export function analyzeStorageHygiene(
  folders: DriveItemMeta[] = [],
  files: DriveItemMeta[] = [],
  folderStats: Record<string, FolderStatMeta> = {}
): HygieneReport {
  let emptyFoldersCount = 0;
  let largeFilesCount = 0;
  let largeFilesTotalBytes = 0;
  let duplicateCandidatesCount = 0;
  let duplicateEstimatedBytes = 0;

  // 1. Analyze empty folders
  for (const folder of folders) {
    const stat = folderStats[folder.id];
    if (stat) {
      const isDirectlyEmpty = stat.directFileCount === 0 && stat.directFolderCount === 0;
      const isTotallyEmpty = stat.totalFileCount === 0 && (stat.totalSize === 0 || stat.totalSize === undefined);
      if (isDirectlyEmpty || isTotallyEmpty) {
        emptyFoldersCount++;
      }
    }
  }

  // 2. Analyze duplicate candidates & large files
  const nameOccurrences = new Map<string, { count: number; totalBytes: number }>();
  const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100 MB

  for (const file of files) {
    const rawSize = typeof file.size === "string" ? parseInt(file.size, 10) : file.size || 0;
    const size = isNaN(rawSize) ? 0 : rawSize;

    // Large files check
    if (size >= LARGE_FILE_THRESHOLD) {
      largeFilesCount++;
      largeFilesTotalBytes += size;
    }

    // Normalized name for duplicate detection (removes copy suffixes like "(1)", "copy", etc.)
    const cleanName = file.name
      .toLowerCase()
      .replace(/\s*\(\d+\)\s*/g, "")
      .replace(/\s*copy(\s*\d*)?/g, "")
      .replace(/\s*copie(\s*\d*)?/g, "")
      .trim();

    const existing = nameOccurrences.get(cleanName);
    if (existing) {
      existing.count += 1;
      existing.totalBytes += size;
    } else {
      nameOccurrences.set(cleanName, { count: 1, totalBytes: size });
    }
  }

  // Count duplicates (items with count > 1)
  nameOccurrences.forEach((val) => {
    if (val.count > 1) {
      const excessFiles = val.count - 1;
      duplicateCandidatesCount += excessFiles;
      duplicateEstimatedBytes += Math.round((val.totalBytes / val.count) * excessFiles);
    }
  });

  const totalItems = folders.length + files.length;

  // Calculate hygiene score: 100 base, deductions for waste
  let score = 100;
  if (emptyFoldersCount > 0) score -= Math.min(25, emptyFoldersCount * 5);
  if (duplicateCandidatesCount > 0) score -= Math.min(30, duplicateCandidatesCount * 6);
  if (largeFilesCount > 5) score -= Math.min(15, (largeFilesCount - 5) * 2);

  score = Math.max(20, Math.min(100, score));

  let status: "optimal" | "good" | "warning" = "optimal";
  let statusLabel = "Optimal Hygiene";

  if (score < 70) {
    status = "warning";
    statusLabel = "Action Recommended";
  } else if (score < 88) {
    status = "good";
    statusLabel = "Good Condition";
  }

  const recommendations: string[] = [];
  if (emptyFoldersCount > 0) {
    recommendations.push(`${emptyFoldersCount} empty director${emptyFoldersCount === 1 ? "y" : "ies"} detected`);
  }
  if (duplicateCandidatesCount > 0) {
    recommendations.push(`${duplicateCandidatesCount} potential duplicate file${duplicateCandidatesCount === 1 ? "" : "s"}`);
  }
  if (largeFilesCount > 0) {
    recommendations.push(`${largeFilesCount} large file${largeFilesCount === 1 ? "" : "s"} over 100MB`);
  }
  if (recommendations.length === 0) {
    recommendations.push("No storage waste or naming issues flagged");
  }

  return {
    score,
    status,
    statusLabel,
    emptyFoldersCount,
    duplicateCandidatesCount,
    duplicateEstimatedBytes,
    largeFilesCount,
    largeFilesTotalBytes,
    totalItemsAnalyzed: totalItems,
    recommendations,
  };
}

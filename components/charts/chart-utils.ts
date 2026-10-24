import { MimeCategory, MimeCategoryId, SizeBucket, TreemapItem, TreemapRect } from "./types";

/**
 * Standard colors for MIME categories harmonized with the Bento design system.
 */
export const MIME_CATEGORY_COLORS: Record<MimeCategoryId, { label: string; color: string; icon: string }> = {
  video: { label: "Video", color: "#8B5CF6", icon: "video" },
  audio: { label: "Audio", color: "#EC4899", icon: "audio" },
  image: { label: "Images", color: "#06B6D4", icon: "image" },
  document: { label: "Documents", color: "#3B82F6", icon: "file-text" },
  archive: { label: "Archives", color: "#F59E0B", icon: "archive" },
  other: { label: "Other", color: "#64748B", icon: "files" },
};

/**
 * Categorize a MIME type into one of our standard 6 categories.
 */
export function getMimeCategoryId(mimeType: string): MimeCategoryId {
  const lower = (mimeType || "").toLowerCase();

  if (lower.startsWith("video/") || lower.includes("mp4") || lower.includes("mkv") || lower.includes("avi")) {
    return "video";
  }
  if (lower.startsWith("audio/") || lower.includes("mp3") || lower.includes("wav") || lower.includes("flac") || lower.includes("aac")) {
    return "audio";
  }
  if (lower.startsWith("image/") || lower.includes("jpeg") || lower.includes("png") || lower.includes("webp") || lower.includes("svg")) {
    return "image";
  }
  if (
    lower.includes("zip") ||
    lower.includes("rar") ||
    lower.includes("tar") ||
    lower.includes("7z") ||
    lower.includes("gzip") ||
    lower.includes("compressed") ||
    lower.includes("archive")
  ) {
    return "archive";
  }
  if (
    lower.startsWith("text/") ||
    lower.includes("pdf") ||
    lower.includes("document") ||
    lower.includes("spreadsheet") ||
    lower.includes("presentation") ||
    lower.includes("word") ||
    lower.includes("excel") ||
    lower.includes("powerpoint") ||
    lower.includes("vnd.google-apps.document") ||
    lower.includes("vnd.google-apps.spreadsheet") ||
    lower.includes("vnd.google-apps.presentation")
  ) {
    return "document";
  }

  return "other";
}

/**
 * Aggregate an array of files into 6 standard MIME categories with byte sums and percentages.
 */
export function categorizeFilesByMime(
  files: Array<{ mimeType?: string; size?: string | number }>
): MimeCategory[] {
  const totals: Record<MimeCategoryId, { bytes: number; count: number }> = {
    video: { bytes: 0, count: 0 },
    audio: { bytes: 0, count: 0 },
    image: { bytes: 0, count: 0 },
    document: { bytes: 0, count: 0 },
    archive: { bytes: 0, count: 0 },
    other: { bytes: 0, count: 0 },
  };

  let grandTotalBytes = 0;

  for (const f of files) {
    const cat = getMimeCategoryId(f.mimeType || "");
    const rawSize = typeof f.size === "string" ? parseInt(f.size, 10) : f.size || 0;
    const size = isNaN(rawSize) ? 0 : rawSize;

    totals[cat].bytes += size;
    totals[cat].count += 1;
    grandTotalBytes += size;
  }

  const categoryOrder: MimeCategoryId[] = ["video", "document", "image", "archive", "audio", "other"];

  return categoryOrder.map((id) => {
    const info = MIME_CATEGORY_COLORS[id];
    const item = totals[id];
    const percentage = grandTotalBytes > 0 ? (item.bytes / grandTotalBytes) * 100 : 0;

    return {
      id,
      label: info.label,
      bytes: item.bytes,
      count: item.count,
      percentage: Math.round(percentage * 10) / 10,
      color: info.color,
      iconName: info.icon,
    };
  });
}

/**
 * Standard size bucket configurations.
 */
export const SIZE_BUCKET_CONFIGS = [
  {
    id: "tiny" as const,
    label: "< 10 MB",
    sublabel: "Documents & Images",
    minBytes: 0,
    maxBytes: 10 * 1024 * 1024,
    color: "#06B6D4", // Cyan
  },
  {
    id: "small" as const,
    label: "10 – 100 MB",
    sublabel: "Media & Presentations",
    minBytes: 10 * 1024 * 1024,
    maxBytes: 100 * 1024 * 1024,
    color: "#3B82F6", // Royal Blue
  },
  {
    id: "medium" as const,
    label: "100 MB – 1 GB",
    sublabel: "High-Res & Datasets",
    minBytes: 100 * 1024 * 1024,
    maxBytes: 1024 * 1024 * 1024,
    color: "#F59E0B", // Amber
  },
  {
    id: "large" as const,
    label: "> 1 GB",
    sublabel: "Raw Video & Archives",
    minBytes: 1024 * 1024 * 1024,
    maxBytes: Infinity,
    color: "#EF4444", // Coral Red
  },
];

/**
 * Aggregate files into 4 size buckets.
 */
export function bucketFilesBySize(
  files: Array<{ size?: string | number }>
): SizeBucket[] {
  const buckets = SIZE_BUCKET_CONFIGS.map((cfg) => ({
    ...cfg,
    count: 0,
    bytes: 0,
    percentage: 0,
  }));

  let totalFiles = 0;

  for (const f of files) {
    const raw = typeof f.size === "string" ? parseInt(f.size, 10) : f.size || 0;
    const size = isNaN(raw) ? 0 : raw;
    totalFiles += 1;

    for (const b of buckets) {
      if (size >= b.minBytes && size < b.maxBytes) {
        b.count += 1;
        b.bytes += size;
        break;
      }
    }
  }

  return buckets.map((b) => ({
    ...b,
    percentage: totalFiles > 0 ? Math.round((b.count / totalFiles) * 1000) / 10 : 0,
  }));
}

/**
 * 2D Proportional Treemap Squarified Layout algorithm.
 * Generates non-overlapping weighted bounding rectangles filling (width x height) with padding.
 */
export function computeTreemapLayout(
  items: TreemapItem[],
  width: number,
  height: number,
  padding: number = 4
): TreemapRect[] {
  if (!items || items.length === 0 || width <= 0 || height <= 0) {
    return [];
  }

  // Filter positive sizes and sort descending
  const valid = items
    .filter((i) => i.size > 0)
    .sort((a, b) => b.size - a.size);

  if (valid.length === 0) {
    return [];
  }

  const totalSize = valid.reduce((sum, item) => sum + item.size, 0);

  // Palette fallback for treemap nodes
  const palette = [
    "#2563EB", // Primary Blue
    "#3B82F6", // Royal Blue
    "#06B6D4", // Cyan
    "#8B5CF6", // Purple
    "#F59E0B", // Amber
    "#10B981", // Emerald
    "#EC4899", // Pink
    "#6366F1", // Indigo
    "#0D9488", // Teal
    "#F97316", // Orange
  ];

  interface NodeWithVal extends TreemapItem {
    val: number;
    color: string;
  }

  const nodes: NodeWithVal[] = valid.map((item, idx) => ({
    ...item,
    val: item.size / totalSize,
    color: item.color || palette[idx % palette.length],
  }));

  const results: TreemapRect[] = [];

  // Recursive slice & dice layout with aspect ratio awareness
  function layoutSlice(
    sliceNodes: NodeWithVal[],
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    if (sliceNodes.length === 0 || w <= 0 || h <= 0) return;

    if (sliceNodes.length === 1) {
      const node = sliceNodes[0];
      results.push({
        ...node,
        x: Math.round(x + padding / 2),
        y: Math.round(y + padding / 2),
        width: Math.max(0, Math.round(w - padding)),
        height: Math.max(0, Math.round(h - padding)),
        percentage: Math.round(node.val * 1000) / 10,
      });
      return;
    }

    const sliceTotal = sliceNodes.reduce((acc, n) => acc + n.val, 0);
    if (sliceTotal <= 0) return;

    // Find best split index to balance ratio
    let half = 0;
    let splitIdx = 0;
    for (let i = 0; i < sliceNodes.length; i++) {
      half += sliceNodes[i].val;
      if (half >= sliceTotal / 2 || i === sliceNodes.length - 2) {
        splitIdx = i + 1;
        break;
      }
    }

    const groupA = sliceNodes.slice(0, splitIdx);
    const groupB = sliceNodes.slice(splitIdx);
    const sumA = groupA.reduce((acc, n) => acc + n.val, 0);
    const ratioA = sumA / sliceTotal;

    if (w >= h) {
      // Split horizontally
      const wA = w * ratioA;
      const wB = w - wA;
      layoutSlice(groupA, x, y, wA, h);
      layoutSlice(groupB, x + wA, y, wB, h);
    } else {
      // Split vertically
      const hA = h * ratioA;
      const hB = h - hA;
      layoutSlice(groupA, x, y, w, hA);
      layoutSlice(groupB, x, y + hA, w, hB);
    }
  }

  layoutSlice(nodes, 0, 0, width, height);
  return results;
}

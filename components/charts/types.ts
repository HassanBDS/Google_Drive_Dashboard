/**
 * Types and interfaces for native SVG storage visualization charts.
 */

export type MimeCategoryId = "video" | "audio" | "image" | "document" | "archive" | "other";

export interface MimeCategory {
  id: MimeCategoryId;
  label: string;
  bytes: number;
  count: number;
  percentage: number;
  color: string;
  iconName?: string;
}

export interface TreemapItem {
  id: string;
  name: string;
  size: number;
  fileCount?: number;
  color?: string;
}

export interface TreemapRect extends TreemapItem {
  x: number;
  y: number;
  width: number;
  height: number;
  percentage: number;
}

export type SizeBucketId = "tiny" | "small" | "medium" | "large";

export interface SizeBucket {
  id: SizeBucketId;
  label: string;
  sublabel: string;
  minBytes: number;
  maxBytes: number;
  count: number;
  bytes: number;
  percentage: number;
  color: string;
}

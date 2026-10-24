/**
 * Shared utility functions.
 */

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number | string): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (b === 0 || isNaN(b)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format ISO date to relative or short date string.
 */
export function formatDate(isoDate: string): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Detect language code from folder/file name.
 */
export function detectLanguage(
  name: string
): { code: string; label: string } | null {
  const langMap: Record<string, string> = {
    en: "English",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    pt: "Português",
    it: "Italiano",
    cn: "中文",
    id: "Bahasa Indonesia",
    ru: "Русский",
    th: "ไทย",
    tr: "Türkçe",
    vn: "Tiếng Việt",
    vi: "Tiếng Việt",
    ja: "日本語",
    ko: "한국어",
    ar: "العربية",
    pl: "Polski",
    zh: "中文",
  };

  // Match (XX) anywhere in the name or at the end
  const match = name.match(/\(([a-zA-Z]{2})\)/);
  if (match) {
    const code = match[1].toLowerCase();
    if (langMap[code]) {
      return { code, label: langMap[code] };
    }
  }

  // Check aliases and full language names
  const aliasMap: Record<string, { code: string; label: string }> = {
    thai: { code: "th", label: "ไทย" },
    turkish: { code: "tr", label: "Türkçe" },
    turkce: { code: "tr", label: "Türkçe" },
    vietnamese: { code: "vn", label: "Tiếng Việt" },
    vietnam: { code: "vn", label: "Tiếng Việt" },
    chinese: { code: "cn", label: "中文" },
    mandarin: { code: "cn", label: "中文" },
    indonesian: { code: "id", label: "Bahasa Indonesia" },
    russian: { code: "ru", label: "Русский" },
    italian: { code: "it", label: "Italiano" },
    japanese: { code: "ja", label: "日本語" },
    korean: { code: "ko", label: "한국어" },
    arabic: { code: "ar", label: "العربية" },
    polish: { code: "pl", label: "Polski" },
    german: { code: "de", label: "Deutsch" },
    french: { code: "fr", label: "Français" },
    spanish: { code: "es", label: "Español" },
    english: { code: "en", label: "English" },
    portuguese: { code: "pt", label: "Português" },
  };

  const lower = name.toLowerCase();
  for (const [alias, data] of Object.entries(aliasMap)) {
    if (lower.includes(alias)) {
      return data;
    }
  }

  for (const [code, label] of Object.entries(langMap)) {
    if (lower.includes(label.toLowerCase())) {
      return { code, label };
    }
  }

  return null;
}

/**
 * Get a file type icon emoji based on MIME type.
 */
export function getFileTypeIcon(mimeType: string): string {
  if (mimeType.includes("folder")) return "📁";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("video")) return "🎬";
  if (mimeType.includes("audio")) return "🎵";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive"))
    return "📦";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽️";
  if (mimeType.includes("text")) return "📄";
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("html"))
    return "💻";
  return "📄";
}

/**
 * Get short MIME type label.
 */
export function getMimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/vnd.google-apps.folder": "Folder",
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "application/pdf": "PDF",
    "application/zip": "ZIP",
    "application/x-rar-compressed": "RAR",
    "video/mp4": "MP4",
    "text/plain": "Text",
    "text/html": "HTML",
    "application/json": "JSON",
  };

  if (map[mimeType]) return map[mimeType];

  // Generic extraction
  const parts = mimeType.split("/");
  if (parts.length === 2) {
    return parts[1].replace("vnd.google-apps.", "").toUpperCase();
  }
  return mimeType;
}

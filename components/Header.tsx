"use client";

import { Search, RefreshCw, HardDrive } from "lucide-react";
import styles from "./Header.module.css";

interface HeaderProps {
  title: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function Header({
  title,
  searchValue = "",
  searchPlaceholder = "Search...",
  onSearchChange,
  onRefresh,
  isLoading = false,
}: HeaderProps) {
  return (
    <header className={styles.header} suppressHydrationWarning>
      <div className={styles.left} suppressHydrationWarning>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, var(--color-primary, #2563EB) 0%, #1D4ED8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px var(--accent-glow)",
            }}
          >
            <HardDrive size={18} color="#fff" />
          </div>
          <h2 className={styles.pageTitle}>{title}</h2>
        </div>

      </div>

      <div className={styles.right} suppressHydrationWarning>
        {onSearchChange && (
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        {onRefresh && (
          <button
            className={styles.refreshBtn}
            onClick={onRefresh}
            title="Refresh"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? styles.spinning : ""} />
          </button>
        )}
      </div>
    </header>
  );
}

"use client";

import { Search, RefreshCw } from "lucide-react";
import styles from "./Header.module.css";

interface HeaderProps {
  title: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  searchDisabled?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function Header({
  title,
  searchValue = "",
  searchPlaceholder = "Search...",
  onSearchChange,
  searchDisabled = false,
  onRefresh,
  isLoading = false,
}: HeaderProps) {
  return (
    <header className={styles.header} suppressHydrationWarning>
      <div className={styles.left} suppressHydrationWarning>
        <h2 className={styles.pageTitle}>{title}</h2>
      </div>

      <div className={styles.right} suppressHydrationWarning>
        {onSearchChange && (
          <div className={`${styles.searchWrap} ${searchDisabled ? styles.searchWrapDisabled : ""}`}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              className={`${styles.searchInput} ${searchDisabled ? styles.searchInputDisabled : ""}`}
              placeholder={searchDisabled ? "Search & filter (Coming soon)" : searchPlaceholder}
              value={searchDisabled ? "" : searchValue}
              onChange={(e) => !searchDisabled && onSearchChange(e.target.value)}
              disabled={searchDisabled}
              title={searchDisabled ? "Deep global search is coming soon" : undefined}
            />
            {searchDisabled && (
              <span className={styles.comingSoonBadge}>Soon</span>
            )}
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

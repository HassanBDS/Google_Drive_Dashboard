"use client";

import { Search, Menu } from "lucide-react";
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
}: HeaderProps) {
  return (
    <header className={styles.header} suppressHydrationWarning>
      <div className={styles.left} suppressHydrationWarning>
        <button
          type="button"
          className={styles.mobileMenuBtn}
          onClick={() => window.dispatchEvent(new CustomEvent("toggle-sidebar"))}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>
        <h2 className={styles.pageTitle}>{title}</h2>
      </div>

      <div className={styles.right} suppressHydrationWarning>
        {onSearchChange && (
          <div className={`${styles.searchWrap} ${searchDisabled ? styles.searchWrapDisabled : ""}`}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              className={`${styles.searchInput} ${searchDisabled ? styles.searchInputDisabled : ""}`}
              placeholder={searchDisabled ? "Deep Search (Coming soon)" : searchPlaceholder}
              value={searchDisabled ? "" : searchValue}
              onChange={(e) => !searchDisabled && onSearchChange(e.target.value)}
              disabled={searchDisabled}
              title={searchDisabled ? "Deep global search is coming soon" : undefined}
            />
          </div>
        )}
      </div>
    </header>
  );
}

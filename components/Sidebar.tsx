"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  HardDrive,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Cloud,
} from "lucide-react";
import styles from "./Sidebar.module.css";

import BrandIcon from "@/components/BrandIcon";

const navItems = [
  { label: "Explorer", href: "/", icon: HardDrive },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dim" | "dark">("dark");
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // Theme sync
    const currentTheme = (document.documentElement.getAttribute("data-theme") as "light" | "dim" | "dark") || "dark";
    setTheme(currentTheme);

    // Collapsed state sync
    const savedCollapsed = localStorage.getItem("sidebar_collapsed") === "true";
    setIsCollapsed(savedCollapsed);
    if (savedCollapsed) {
      document.documentElement.classList.add("sidebar-collapsed");
    } else {
      document.documentElement.classList.remove("sidebar-collapsed");
    }

    // Status check
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setIsConfigured(data.isConfigured))
      .catch(() => setIsConfigured(false));
  }, []);

  const toggleTheme = (newTheme: "light" | "dim" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
    if (next) {
      document.documentElement.classList.add("sidebar-collapsed");
    } else {
      document.documentElement.classList.remove("sidebar-collapsed");
    }
  };

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
      {/* Brand Logo */}
      <div className={styles.logoSection}>
        <Link href="/" className={styles.logoLink} title="Google Drive Dashboard">
          <BrandIcon size={34} />
          {!isCollapsed && (
            <div className={styles.logoText}>
              <h1>Drive Dashboard</h1>
              <span>Google Drive v3</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className={styles.navSection}>
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={styles.navIcon} />
              {!isCollapsed && <span className={styles.navItemLabel}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer & Controls */}
      <div className={styles.sidebarFooter}>
        {!isCollapsed && (
          <div className={styles.statusRow}>
            <div className={styles.statusBadge}>
              <span className={`${styles.statusDot} ${isConfigured === false ? styles.disconnected : ""}`} />
              <span>{isConfigured ? "Connected" : isConfigured === false ? "Setup Required" : "Checking…"}</span>
            </div>
          </div>
        )}

        <div className={styles.controlsRow}>
          {/* Light / Dim / Dark Mode Selector */}
          <div className={styles.themeGroup}>
            <button
              className={`${styles.iconBtn} ${theme === "light" ? styles.active : ""}`}
              onClick={() => toggleTheme("light")}
              title="Light theme"
              aria-label="Light theme"
            >
              <Sun size={15} />
            </button>
            <button
              className={`${styles.iconBtn} ${theme === "dim" ? styles.active : ""}`}
              onClick={() => toggleTheme("dim")}
              title="Dim theme"
              aria-label="Dim theme"
            >
              <Cloud size={15} />
            </button>
            <button
              className={`${styles.iconBtn} ${theme === "dark" ? styles.active : ""}`}
              onClick={() => toggleTheme("dark")}
              title="Dark theme"
              aria-label="Dark theme"
            >
              <Moon size={15} />
            </button>
          </div>

          {/* Collapse Toggle */}
          <button
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

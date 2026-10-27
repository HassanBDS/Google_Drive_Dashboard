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
  User,
} from "lucide-react";
import styles from "./Sidebar.module.css";

import BrandIcon from "@/components/BrandIcon";

const navItems = [
  { label: "Explorer", href: "/", icon: HardDrive },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "About", href: "/about", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dim" | "dark">("dark");
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // Theme sync
    const currentTheme = (document.documentElement.getAttribute("data-theme") as "light" | "dim" | "dark") || "dark";
    setTheme(currentTheme);

    // Collapsed state sync (defaults to folded/collapsed)
    const isFolded = localStorage.getItem("sidebar_collapsed") !== "false";
    setIsCollapsed(isFolded);
    if (isFolded) {
      document.documentElement.classList.add("sidebar-collapsed");
    } else {
      document.documentElement.classList.remove("sidebar-collapsed");
    }

    // Mobile / shortcut toggle listener
    const handleToggle = () => {
      if (window.innerWidth <= 768) {
        setIsMobileOpen((prev) => !prev);
      } else {
        setIsCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem("sidebar_collapsed", String(next));
          if (next) {
            document.documentElement.classList.add("sidebar-collapsed");
          } else {
            document.documentElement.classList.remove("sidebar-collapsed");
          }
          return next;
        });
      }
    };
    window.addEventListener("toggle-sidebar", handleToggle);

    // Status check
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setIsConfigured(data.isConfigured))
      .catch(() => setIsConfigured(false));

    return () => {
      window.removeEventListener("toggle-sidebar", handleToggle);
    };
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
    <>
      {isMobileOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""} ${isMobileOpen ? styles.mobileOpen : ""}`}>
        {/* Brand Logo */}
        <div className={styles.logoSection}>
          <Link
            href="/"
            className={styles.logoLink}
            title="Google Drive Dashboard"
            onClick={() => setIsMobileOpen(false)}
          >
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
                onClick={() => setIsMobileOpen(false)}
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
  </>
);
}

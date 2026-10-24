"use client";

import { Home, ChevronRight } from "lucide-react";
import styles from "./Breadcrumbs.module.css";

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string) => void;
}

export default function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className={styles.breadcrumbs}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <button
              className={`${styles.crumb} ${isLast ? styles.crumbActive : ""}`}
              onClick={() => !isLast && onNavigate(item.id)}
              disabled={isLast}
            >
              {index === 0 && <Home className={styles.homeIcon} />}
              {item.name}
            </button>
            {!isLast && (
              <ChevronRight className={styles.separator} size={14} />
            )}
          </span>
        );
      })}
    </nav>
  );
}

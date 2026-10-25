"use client";

import React, { useState, useId, useMemo } from "react";
import { PieChart } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { MimeCategory, MimeCategoryId } from "./types";
import { categorizeFilesByMime } from "./chart-utils";
import styles from "./StorageDonutChart.module.css";

export interface StorageDonutChartProps {
  categories?: MimeCategory[];
  files?: Array<{ mimeType?: string; size?: string | number }>;
  totalBytes?: number;
  title?: string;
  subtitle?: string;
  activeCategory?: MimeCategoryId | null;
  onSelectCategory?: (category: MimeCategoryId | null) => void;
  className?: string;
  compact?: boolean;
}

const RADIUS = 85;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function StorageDonutChart({
  categories: explicitCategories,
  files,
  totalBytes: explicitTotalBytes,
  title = "Storage Distribution",
  subtitle = "Proportional disk usage by file type",
  activeCategory = null,
  onSelectCategory,
  className = "",
  compact = false,
}: StorageDonutChartProps) {
  const chartId = useId();
  const [internalHovered, setInternalHovered] = useState<MimeCategoryId | null>(null);

  // Derive categories either from explicit prop or by categorizing files
  const categories = useMemo(() => {
    if (explicitCategories && explicitCategories.length > 0) {
      return explicitCategories;
    }
    if (files && files.length > 0) {
      return categorizeFilesByMime(files);
    }
    return [];
  }, [explicitCategories, files]);

  // Total bytes
  const calculatedTotalBytes = useMemo(() => {
    if (typeof explicitTotalBytes === "number" && explicitTotalBytes >= 0) {
      return explicitTotalBytes;
    }
    return categories.reduce((sum, c) => sum + c.bytes, 0);
  }, [explicitTotalBytes, categories]);

  const activeId = activeCategory || internalHovered;
  const activeCat = useMemo(() => categories.find((c) => c.id === activeId), [categories, activeId]);

  // Compute SVG arc segments
  const segments = useMemo(() => {
    if (calculatedTotalBytes <= 0 || categories.length === 0) return [];

    let currentOffset = 0;
    return categories.map((cat) => {
      const fraction = calculatedTotalBytes > 0 ? cat.bytes / calculatedTotalBytes : 0;
      const strokeLength = fraction * CIRCUMFERENCE;
      const gap = fraction > 0.01 && categories.filter((c) => c.bytes > 0).length > 1 ? 2 : 0;
      const effectiveLength = Math.max(0, strokeLength - gap);
      const offset = -currentOffset;

      currentOffset += strokeLength;

      return {
        ...cat,
        strokeLength: effectiveLength,
        dashArray: `${effectiveLength} ${CIRCUMFERENCE - effectiveLength}`,
        dashOffset: offset,
      };
    });
  }, [categories, calculatedTotalBytes]);

  const hasData = calculatedTotalBytes > 0 && segments.some((s) => s.bytes > 0);

  const handleSliceClick = (catId: MimeCategoryId) => {
    if (onSelectCategory) {
      onSelectCategory(activeCategory === catId ? null : catId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, catId: MimeCategoryId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSliceClick(catId);
    }
  };

  return (
    <section
      className={`${compact ? styles.chartCardCompact : styles.chartCard} ${className}`}
      role="region"
      aria-labelledby={`${chartId}-title`}
    >
      {!compact && (
        <header className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon} aria-hidden="true">
              <PieChart size={18} />
            </div>
            <div>
              <h3 id={`${chartId}-title`} className={styles.cardTitle}>
                {title}
              </h3>
              {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
            </div>
          </div>
        </header>
      )}

      <div className={compact ? styles.bodyLayoutCompact : styles.bodyLayout}>
        {/* Donut Chart SVG */}
        <div className={compact ? styles.svgWrapperCompact : styles.svgWrapper}>
          <svg
            viewBox="0 0 240 240"
            className={styles.donutSvg}
            aria-hidden="true"
          >
            {/* Background track circle */}
            <circle
              cx="120"
              cy="120"
              r={RADIUS}
              className={styles.trackCircle}
            />

            {/* Slices */}
            {hasData &&
              segments.map((seg) => {
                if (seg.bytes <= 0) return null;
                const isHovered = activeId === seg.id;
                const isOtherDimmed = activeId !== null && !isHovered;

                return (
                  <circle
                    key={seg.id}
                    cx="120"
                    cy="120"
                    r={RADIUS}
                    stroke={seg.color}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    strokeWidth={isHovered ? 26 : 22}
                    className={`${styles.sliceCircle} ${isOtherDimmed ? styles.sliceDimmed : ""}`}
                    onMouseEnter={() => setInternalHovered(seg.id)}
                    onMouseLeave={() => setInternalHovered(null)}
                    onClick={() => handleSliceClick(seg.id)}
                    tabIndex={0}
                    role="graphics-symbol"
                    aria-label={`${seg.label}: ${formatBytes(seg.bytes)}, ${seg.percentage}% of total`}
                    onFocus={() => setInternalHovered(seg.id)}
                    onBlur={() => setInternalHovered(null)}
                    onKeyDown={(e) => handleKeyDown(e, seg.id)}
                  />
                );
              })}
          </svg>

          {/* Central KPI readout */}
          <div className={styles.centerDisplay}>
            {activeCat ? (
              <>
                <div className={styles.centerVal} style={{ color: activeCat.color }}>
                  {formatBytes(activeCat.bytes)}
                </div>
                <div className={styles.centerLabel}>{activeCat.label}</div>
                <div className={styles.centerPercent}>
                  {activeCat.percentage}% ({activeCat.count.toLocaleString()} files)
                </div>
              </>
            ) : (
              <>
                <div className={styles.centerVal}>
                  {formatBytes(calculatedTotalBytes)}
                </div>
                <div className={styles.centerLabel}>
                  {hasData ? "Total Scanned" : "No Scanned Data"}
                </div>
                {hasData && (
                  <div className={styles.centerPercent}>100% capacity</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Responsive Legend - hidden in compact mode */}
        {!compact && (
          <div className={styles.legendContainer} role="list" aria-label="Category Legend">
            {categories.map((cat) => {
              const isHovered = activeId === cat.id;
              const isOtherDimmed = activeId !== null && !isHovered;

              return (
                <div
                  key={cat.id}
                  role="listitem"
                  className={`${styles.legendRow} ${isHovered ? styles.legendRowActive : ""} ${
                    isOtherDimmed ? styles.legendRowDimmed : ""
                  }`}
                  onMouseEnter={() => setInternalHovered(cat.id)}
                  onMouseLeave={() => setInternalHovered(null)}
                  onClick={() => handleSliceClick(cat.id)}
                >
                  <div className={styles.legendLeft}>
                    <span
                      className={styles.colorDot}
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
                    <div>
                      <div className={styles.categoryLabel}>{cat.label}</div>
                      {cat.count > 0 && (
                        <div className={styles.categoryCount}>
                          {cat.count.toLocaleString()} file{cat.count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.legendRight}>
                    <span className={styles.categorySize}>{formatBytes(cat.bytes)}</span>
                    <span className={styles.categoryPercent}>{cat.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screen reader data table fallback for full WCAG compliance */}
      <table className={styles.srOnly}>
        <caption>{title} data table</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Size</th>
            <th scope="col">Files</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat.id}>
              <th scope="row">{cat.label}</th>
              <td>{formatBytes(cat.bytes)}</td>
              <td>{cat.count}</td>
              <td>{cat.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

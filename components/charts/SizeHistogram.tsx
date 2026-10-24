"use client";

import React, { useState, useId, useMemo, useRef } from "react";
import { BarChart3, Files } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { SizeBucket, SizeBucketId } from "./types";
import { bucketFilesBySize } from "./chart-utils";
import styles from "./SizeHistogram.module.css";

export interface SizeHistogramProps {
  buckets?: SizeBucket[];
  files?: Array<{ size?: string | number }>;
  title?: string;
  subtitle?: string;
  initialMode?: "count" | "bytes";
  activeBucket?: SizeBucketId | null;
  onSelectBucket?: (bucketId: SizeBucketId | null) => void;
  className?: string;
}

const SVG_WIDTH = 520;
const SVG_HEIGHT = 220;
const BASELINE_Y = 175;
const CHART_TOP_Y = 35;
const MAX_BAR_HEIGHT = BASELINE_Y - CHART_TOP_Y; // 140px
const BAR_WIDTH = 75;

export default function SizeHistogram({
  buckets: explicitBuckets,
  files,
  title = "File Size Distribution",
  subtitle = "Distribution across volume tiers",
  initialMode = "count",
  activeBucket = null,
  onSelectBucket,
  className = "",
}: SizeHistogramProps) {
  const chartId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [metricMode, setMetricMode] = useState<"count" | "bytes">(initialMode);
  const [internalHovered, setInternalHovered] = useState<SizeBucketId | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Normalize buckets
  const buckets = useMemo<SizeBucket[]>(() => {
    if (explicitBuckets && explicitBuckets.length > 0) {
      return explicitBuckets;
    }
    if (files && files.length > 0) {
      return bucketFilesBySize(files);
    }
    return bucketFilesBySize([]);
  }, [explicitBuckets, files]);

  const totalFiles = useMemo(() => buckets.reduce((sum, b) => sum + b.count, 0), [buckets]);
  const totalBytes = useMemo(() => buckets.reduce((sum, b) => sum + b.bytes, 0), [buckets]);

  const activeId = activeBucket || internalHovered;
  const hoveredBucket = useMemo(() => buckets.find((b) => b.id === activeId) || null, [buckets, activeId]);

  // Max value for Y scale
  const maxVal = useMemo(() => {
    if (metricMode === "count") {
      const maxCount = Math.max(...buckets.map((b) => b.count), 0);
      return maxCount > 0 ? maxCount : 1;
    } else {
      const maxBytes = Math.max(...buckets.map((b) => b.bytes), 0);
      return maxBytes > 0 ? maxBytes : 1;
    }
  }, [buckets, metricMode]);

  // Compute bar coordinates
  const barSlots = useMemo(() => {
    const startX = 45;
    const slotWidth = 115;

    return buckets.map((bucket, i) => {
      const val = metricMode === "count" ? bucket.count : bucket.bytes;
      const barHeight = val > 0 ? Math.max(6, (val / maxVal) * MAX_BAR_HEIGHT) : 2;
      const x = startX + i * slotWidth;
      const y = BASELINE_Y - barHeight;
      const centerX = x + BAR_WIDTH / 2;

      return {
        ...bucket,
        x,
        y,
        centerX,
        barHeight,
        displayVal:
          metricMode === "count"
            ? `${bucket.count.toLocaleString()}`
            : formatBytes(bucket.bytes),
      };
    });
  }, [buckets, metricMode, maxVal]);

  const handleMouseMove = (e: React.MouseEvent, bucket: SizeBucket) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setInternalHovered(bucket.id);
  };

  const handleMouseLeave = () => {
    setInternalHovered(null);
    setTooltipPos(null);
  };

  const handleBarClick = (bucketId: SizeBucketId) => {
    if (onSelectBucket) {
      onSelectBucket(activeBucket === bucketId ? null : bucketId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, bucketId: SizeBucketId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleBarClick(bucketId);
    }
  };

  const hasData = totalFiles > 0;

  return (
    <section
      className={`${styles.chartCard} ${className}`}
      role="region"
      aria-labelledby={`${chartId}-title`}
    >
      <header className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <div className={styles.titleIcon} aria-hidden="true">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3 id={`${chartId}-title`} className={styles.cardTitle}>
              {title}
            </h3>
            {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
          </div>
        </div>

        {/* Metric mode toggle button */}
        <div className={styles.viewToggle} role="group" aria-label="Chart metric toggle">
          <button
            type="button"
            className={`${styles.toggleBtn} ${metricMode === "count" ? styles.toggleBtnActive : ""}`}
            onClick={() => setMetricMode("count")}
            aria-pressed={metricMode === "count"}
          >
            By File Count
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${metricMode === "bytes" ? styles.toggleBtnActive : ""}`}
            onClick={() => setMetricMode("bytes")}
            aria-pressed={metricMode === "bytes"}
          >
            By Total Volume
          </button>
        </div>
      </header>

      {!hasData ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <Files size={32} />
          </div>
          <h4 className={styles.emptyTitle}>No Files in Selected Folder</h4>
          <p className={styles.emptySubtitle}>
            Files in this directory will be bucketed by size (&lt;10MB, 10–100MB, 100MB–1GB, &gt;1GB).
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={styles.chartContainer}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className={styles.histogramSvg}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              {buckets.map((b) => (
                <linearGradient
                  key={`grad-${b.id}`}
                  id={`grad-${chartId}-${b.id}`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={b.color} stopOpacity="1" />
                  <stop offset="100%" stopColor={b.color} stopOpacity="0.6" />
                </linearGradient>
              ))}
            </defs>

            {/* Horizontal Gridlines */}
            {[0.25, 0.5, 0.75, 1.0].map((fraction) => {
              const gridY = BASELINE_Y - fraction * MAX_BAR_HEIGHT;
              const gridVal =
                metricMode === "count"
                  ? Math.round(fraction * maxVal).toLocaleString()
                  : formatBytes(fraction * maxVal);

              return (
                <g key={fraction}>
                  <line
                    x1="40"
                    y1={gridY}
                    x2={SVG_WIDTH - 20}
                    y2={gridY}
                    className={styles.gridLine}
                  />
                  <text x="34" y={gridY + 3} className={styles.gridText}>
                    {gridVal}
                  </text>
                </g>
              );
            })}

            {/* Baseline */}
            <line
              x1="40"
              y1={BASELINE_Y}
              x2={SVG_WIDTH - 20}
              y2={BASELINE_Y}
              stroke="var(--color-border, rgba(255, 255, 255, 0.15))"
              strokeWidth="1"
            />

            {/* Bars and labels */}
            {barSlots.map((b) => {
              const isHovered = activeId === b.id;
              const isDimmed = activeId !== null && !isHovered;

              return (
                <g
                  key={b.id}
                  className={styles.barGroup}
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={`${b.label}: ${b.count} files, ${formatBytes(b.bytes)} (${b.percentage}%)`}
                  onClick={() => handleBarClick(b.id)}
                  onMouseMove={(e) => handleMouseMove(e, b)}
                  onFocus={() => {
                    setInternalHovered(b.id);
                    setTooltipPos({
                      x: (b.centerX / SVG_WIDTH) * (containerRef.current?.clientWidth || SVG_WIDTH),
                      y: (b.y / SVG_HEIGHT) * (containerRef.current?.clientHeight || SVG_HEIGHT),
                    });
                  }}
                  onBlur={handleMouseLeave}
                  onKeyDown={(e) => handleKeyDown(e, b.id)}
                >
                  {/* Bar rectangle */}
                  <rect
                    x={b.x}
                    y={b.y}
                    width={BAR_WIDTH}
                    height={b.barHeight}
                    rx={6}
                    ry={6}
                    fill={`url(#grad-${chartId}-${b.id})`}
                    className={`${styles.barRect} ${isDimmed ? styles.barDimmed : ""}`}
                  />

                  {/* Top value badge text */}
                  {b.barHeight > 10 && (
                    <text
                      x={b.centerX}
                      y={Math.max(CHART_TOP_Y - 4, b.y - 6)}
                      className={styles.barValueText}
                    >
                      {b.displayVal}
                    </text>
                  )}

                  {/* X-axis bucket label */}
                  <text
                    x={b.centerX}
                    y={BASELINE_Y + 18}
                    className={styles.axisLabelText}
                  >
                    {b.label}
                  </text>

                  {/* X-axis sublabel */}
                  <text
                    x={b.centerX}
                    y={BASELINE_Y + 31}
                    className={styles.axisSublabel}
                  >
                    {b.sublabel}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating interactive tooltip */}
          {hoveredBucket && tooltipPos && (
            <div
              className={styles.tooltip}
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
              }}
            >
              <div className={styles.tooltipTitle}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: hoveredBucket.color,
                  }}
                />
                {hoveredBucket.label} ({hoveredBucket.sublabel})
              </div>
              <div className={styles.tooltipDetails}>
                {hoveredBucket.count.toLocaleString()} files ({hoveredBucket.percentage}%) • {formatBytes(hoveredBucket.bytes)} total
              </div>
              {onSelectBucket && (
                <div className={styles.tooltipHint}>Click or press Enter to filter files</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Screen reader table fallback */}
      <table className={styles.srOnly}>
        <caption>{title} distribution table</caption>
        <thead>
          <tr>
            <th scope="col">Size Range</th>
            <th scope="col">Description</th>
            <th scope="col">File Count</th>
            <th scope="col">Total Bytes</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.id}>
              <th scope="row">{b.label}</th>
              <td>{b.sublabel}</td>
              <td>{b.count}</td>
              <td>{formatBytes(b.bytes)}</td>
              <td>{b.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

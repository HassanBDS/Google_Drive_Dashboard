"use client";

import React, { useState, useId, useMemo, useRef } from "react";
import { FolderTree, Folder } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { TreemapItem, TreemapRect } from "./types";
import { computeTreemapLayout } from "./chart-utils";
import styles from "./FolderTreemap.module.css";

export interface FolderTreemapProps {
  items?: TreemapItem[];
  folders?: Array<{ id: string; name: string; size?: number | string }>;
  folderStats?: Record<string, { totalSize?: number; fileCount?: number }>;
  title?: string;
  subtitle?: string;
  onSelectFolder?: (folderId: string) => void;
  maxItems?: number;
  className?: string;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 260;

export default function FolderTreemap({
  items: explicitItems,
  folders,
  folderStats,
  title = "Folder Storage Weight",
  subtitle = "Proportional disk footprint of top directories",
  onSelectFolder,
  maxItems = 12,
  className = "",
}: FolderTreemapProps) {
  const chartId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<TreemapRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Normalize inputs to TreemapItem[]
  const treemapItems = useMemo<TreemapItem[]>(() => {
    if (explicitItems && explicitItems.length > 0) {
      return explicitItems.slice(0, maxItems);
    }

    if (folders && folders.length > 0) {
      return folders
        .map((f) => {
          const stats = folderStats?.[f.id];
          const rawSize =
            stats?.totalSize ??
            (typeof f.size === "string" ? parseInt(f.size, 10) : f.size) ??
            0;
          const size = isNaN(rawSize) ? 0 : rawSize;

          return {
            id: f.id,
            name: f.name,
            size,
            fileCount: stats?.fileCount,
          };
        })
        .filter((item) => item.size > 0)
        .sort((a, b) => b.size - a.size)
        .slice(0, maxItems);
    }

    return [];
  }, [explicitItems, folders, folderStats, maxItems]);

  // Compute 2D proportional layout
  const rects = useMemo<TreemapRect[]>(() => {
    return computeTreemapLayout(treemapItems, SVG_WIDTH, SVG_HEIGHT, 4);
  }, [treemapItems]);

  const totalCalculatedBytes = useMemo(() => {
    return treemapItems.reduce((acc, i) => acc + i.size, 0);
  }, [treemapItems]);

  const handleMouseMove = (e: React.MouseEvent, node: TreemapRect) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setHoveredNode(node);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
    setTooltipPos(null);
  };

  const handleClick = (folderId: string) => {
    if (onSelectFolder) {
      onSelectFolder(folderId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, folderId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(folderId);
    }
  };

  return (
    <section
      className={`${styles.chartCard} ${className}`}
      role="region"
      aria-labelledby={`${chartId}-title`}
    >
      <header className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <div className={styles.titleIcon} aria-hidden="true">
            <FolderTree size={18} />
          </div>
          <div>
            <h3 id={`${chartId}-title`} className={styles.cardTitle}>
              {title}
            </h3>
            {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
          </div>
        </div>

        {treemapItems.length > 0 && (
          <div className={styles.headerMeta}>
            <span className={styles.metaBadge}>
              {treemapItems.length} Director{treemapItems.length !== 1 ? "ies" : "y"}
            </span>
            <span className={styles.metaBadge}>{formatBytes(totalCalculatedBytes)}</span>
          </div>
        )}
      </header>

      {rects.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <Folder size={32} />
          </div>
          <h4 className={styles.emptyTitle}>No Scanned Folder Sizes</h4>
          <p className={styles.emptySubtitle}>
            Run a recursive scan to calculate directory disk usage and display the proportional storage treemap.
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={styles.treemapContainer}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className={styles.treemapSvg}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              {rects.map((node) => (
                <linearGradient
                  key={`grad-${node.id}`}
                  id={`grad-${chartId}-${node.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={node.color} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={node.color} stopOpacity="0.75" />
                </linearGradient>
              ))}
            </defs>

            {rects.map((node) => {
              const showName = node.width >= 55 && node.height >= 34;
              const showSize = node.width >= 65 && node.height >= 50;

              return (
                <g
                  key={node.id}
                  className={styles.nodeGroup}
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={`${node.name}: ${formatBytes(node.size)}, ${node.percentage}% of folder weight`}
                  onClick={() => handleClick(node.id)}
                  onMouseMove={(e) => handleMouseMove(e, node)}
                  onFocus={() => {
                    setHoveredNode(node);
                    setTooltipPos({
                      x: (node.x + node.width / 2) * (containerRef.current?.clientWidth || SVG_WIDTH) / SVG_WIDTH,
                      y: (node.y + node.height / 2) * (containerRef.current?.clientHeight || SVG_HEIGHT) / SVG_HEIGHT,
                    });
                  }}
                  onBlur={handleMouseLeave}
                  onKeyDown={(e) => handleKeyDown(e, node.id)}
                >
                  {/* Base weighted rect */}
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx={6}
                    ry={6}
                    fill={`url(#grad-${chartId}-${node.id})`}
                    className={styles.nodeRect}
                  />

                  {/* Top glass specular highlight line */}
                  <rect
                    x={node.x + 1}
                    y={node.y + 1}
                    width={Math.max(0, node.width - 2)}
                    height={Math.max(0, Math.min(12, node.height / 3))}
                    rx={5}
                    ry={5}
                    fill="rgba(255, 255, 255, 0.15)"
                    pointerEvents="none"
                  />

                  {/* Name label */}
                  {showName && (
                    <text
                      x={node.x + 8}
                      y={node.y + (showSize ? 18 : Math.round(node.height / 2 + 4))}
                      className={styles.nodeTextName}
                    >
                      {node.name.length > Math.floor(node.width / 8)
                        ? `${node.name.slice(0, Math.max(3, Math.floor(node.width / 8) - 2))}…`
                        : node.name}
                    </text>
                  )}

                  {/* Size label */}
                  {showSize && (
                    <text
                      x={node.x + 8}
                      y={node.y + 34}
                      className={styles.nodeTextSize}
                    >
                      {formatBytes(node.size)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Floating interactive tooltip */}
          {hoveredNode && tooltipPos && (
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
                    backgroundColor: hoveredNode.color,
                  }}
                />
                {hoveredNode.name}
              </div>
              <div className={styles.tooltipDetails}>
                {formatBytes(hoveredNode.size)} • {hoveredNode.percentage}% weight
                {hoveredNode.fileCount !== undefined && ` • ${hoveredNode.fileCount.toLocaleString()} files`}
              </div>
              {onSelectFolder && (
                <div className={styles.tooltipHint}>Click or press Enter to open folder</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Screen reader table fallback */}
      <table className={styles.srOnly}>
        <caption>{title} hierarchical storage table</caption>
        <thead>
          <tr>
            <th scope="col">Folder Name</th>
            <th scope="col">Total Size</th>
            <th scope="col">Relative Weight</th>
          </tr>
        </thead>
        <tbody>
          {rects.map((node) => (
            <tr key={node.id}>
              <th scope="row">{node.name}</th>
              <td>{formatBytes(node.size)}</td>
              <td>{node.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

"use client";

import React from "react";

interface BrandIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function BrandIcon({ size = 32, className = "", style }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
      aria-label="Google Drive Dashboard Logo"
    >
      <defs>
        <linearGradient id="brandBgGrad" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="brandBlueGrad" x1="26" y1="28" x2="102" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="brandIndigoGrad" x1="26" y1="54" x2="102" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="brandCyanGrad" x1="26" y1="80" x2="102" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <filter id="brandCardShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Container Squircle with subtle border */}
      <rect x="4" y="4" width="120" height="120" rx="30" fill="url(#brandBgGrad)" stroke="#334155" strokeWidth="2.5" />
      
      {/* Subtle inner glowing perimeter */}
      <rect x="7" y="7" width="114" height="114" rx="27" fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity="0.35" />

      {/* HardDrive Storage Stack */}
      {/* Top Disk Plate */}
      <g filter="url(#brandCardShadow)">
        <rect x="25" y="27" width="78" height="21" rx="7" fill="url(#brandBlueGrad)" />
        <circle cx="37" cy="37.5" r="3.5" fill="#E0F2FE" />
        <circle cx="47" cy="37.5" r="2.5" fill="#BFDBFE" opacity="0.8" />
        <rect x="59" y="35.5" width="34" height="4" rx="2" fill="#FFFFFF" opacity="0.85" />
      </g>

      {/* Middle Disk Plate */}
      <g filter="url(#brandCardShadow)">
        <rect x="25" y="53" width="78" height="21" rx="7" fill="url(#brandIndigoGrad)" />
        <circle cx="37" cy="63.5" r="3.5" fill="#93C5FD" />
        <circle cx="47" cy="63.5" r="2.5" fill="#60A5FA" opacity="0.8" />
        <rect x="59" y="61.5" width="24" height="4" rx="2" fill="#BFDBFE" opacity="0.85" />
      </g>

      {/* Bottom Analytics Plate */}
      <g filter="url(#brandCardShadow)">
        <rect x="25" y="79" width="78" height="21" rx="7" fill="url(#brandCyanGrad)" />
        <circle cx="37" cy="89.5" r="4.5" fill="#FFFFFF" />
        <circle cx="37" cy="89.5" r="2.5" fill="#10B981" />
        <circle cx="47" cy="89.5" r="2.5" fill="#67E8F9" opacity="0.85" />
        <rect x="59" y="87.5" width="34" height="4" rx="2" fill="#0C4A6E" opacity="0.45" />
        <rect x="59" y="87.5" width="22" height="4" rx="2" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

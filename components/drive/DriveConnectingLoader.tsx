"use client";

import React, { useState, useEffect, useId } from "react";
import styles from "./DriveConnectingLoader.module.css";

export interface DriveConnectingLoaderProps {
  /** Primary headline text, defaults to "Connecting to Google Drive" */
  message?: string;
  /** Optional custom submessage or status text. When omitted, rotates through realistic status stages */
  submessage?: string;
  /** Whether to render in a more compact layout suitable for modals or nested cards */
  compact?: boolean;
  /** Optional additional class name */
  className?: string;
}

const DEFAULT_STATUS_STEPS = [
  "Verifying OAuth credentials & API session...",
  "Querying Drive root hierarchy & permissions...",
  "Discovering folder structures and shared metadata...",
  "Aggregating cloud storage analytics & telemetry...",
];

export default function DriveConnectingLoader({
  message = "Connecting to Google Drive",
  submessage,
  compact = false,
  className = "",
}: DriveConnectingLoaderProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const uniqueId = useId().replace(/[:]/g, "");

  // Rotate status messages smoothly every 2.4s if no static submessage is specified
  useEffect(() => {
    if (submessage) return;

    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setStepIndex((prev) => (prev + 1) % DEFAULT_STATUS_STEPS.length);
        setIsFading(false);
      }, 250);
    }, 2500);

    return () => clearInterval(interval);
  }, [submessage]);

  const activeStatus = submessage || DEFAULT_STATUS_STEPS[stepIndex];
  const orbitalGradId = `orbital-grad-${uniqueId}`;
  const driveDropShadowId = `drive-shadow-${uniqueId}`;

  return (
    <div
      className={`${styles.loaderContainer} ${compact ? styles.compactContainer : ""} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${message}: ${activeStatus}`}
    >
      <div className={styles.loaderCard}>
        {/* Soft atmospheric gradient glow behind emblem */}
        <div className={styles.ambientBackdrop} aria-hidden="true" />

        {/* Icon stage with official Google Drive geometric logo & orbital accent */}
        <div className={styles.iconStage}>
          {/* Orbital accent ring */}
          <svg className={styles.orbitalRing} viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id={orbitalGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4285F4" />
                <stop offset="33%" stopColor="#0F9D58" />
                <stop offset="66%" stopColor="#F4B400" />
                <stop offset="100%" stopColor="#EA4335" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="47"
              stroke={`url(#${orbitalGradId})`}
              strokeWidth="2"
              strokeDasharray="24 72"
              strokeLinecap="round"
              opacity="0.85"
            />
          </svg>

          {/* Official Google Drive Triangle Logo */}
          <svg
            className={styles.driveLogo}
            viewBox="0 0 87.3 78"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <filter id={driveDropShadowId} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.22" />
              </filter>
            </defs>
            <g filter={`url(#${driveDropShadowId})`}>
              {/* Bottom-Left Blue Overlap Flap */}
              <path
                fill="#0066DA"
                d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z"
              />
              {/* Left Green Side Flap */}
              <path
                fill="#00AC47"
                d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 0 0 0 53h27.5z"
              />
              {/* Top Apex Dark Green Overlap Flap */}
              <path
                fill="#00832D"
                d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"
              />
              {/* Top-Right Yellow Side Flap */}
              <path
                fill="#FFBA00"
                d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z"
              />
              {/* Bottom-Right Red Overlap Flap */}
              <path
                fill="#EA4335"
                d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H59.798l5.852 11.5z"
              />
              {/* Bottom Base Blue Horizontal Flap */}
              <path
                fill="#2684FC"
                d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
              />
            </g>
          </svg>
        </div>

        {/* Text and status progress */}
        <div className={styles.textSection}>
          <h2 className={styles.title}>
            <span>{message}</span>
            <span className={styles.dots} aria-hidden="true">
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
          </h2>

          {/* Indeterminate multi-colored Google stream bar */}
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressBar} />
          </div>

          {/* Live status feedback with subtle pulse */}
          <p
            className={styles.statusMessage}
            style={{
              opacity: isFading ? 0 : 1,
              transform: isFading ? "translateY(3px)" : "translateY(0)",
            }}
          >
            <span className={styles.statusLiveDot} aria-hidden="true" />
            <span>{activeStatus}</span>
          </p>

        </div>
      </div>
    </div>
  );
}

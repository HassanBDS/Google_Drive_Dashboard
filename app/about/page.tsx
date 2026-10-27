"use client";

import Link from "next/link";
import {
  ExternalLink,
  Coffee,
  Code2,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import styles from "./about.module.css";

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function OcticonStar({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "-2px" }}
    >
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <div className={styles.container}>
      {/* Top Navigation Bar */}
      <div className={styles.topNav}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Back to Explorer</span>
        </Link>
      </div>

      <div className={styles.contentWrap}>
        {/* ── 1. Grid: Mission & Privacy ──────────────────────────────── */}
        <div className={styles.featureGrid}>
          {/* Card: Why this exists */}
          <div className={styles.featureCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Why Google Drive Dashboard Exists</h2>
            </div>
            <p className={styles.cardText}>
              Google Drive is the world&apos;s leading cloud workspace, yet it fundamentally lacks a critical capability:{" "}
              <strong>deep recursive folder sizing</strong>. When running large libraries (hundreds of gigabytes or multi-terabytes),
              identifying which directories consume your storage quota is virtually impossible in native Drive without manual guessing.
            </p>
            <p className={styles.cardText}>
              This project bridges that gap by introducing a multi-phase Breadth-First Search (BFS) indexing engine that analyzes
              millions of files level-by-level with resumable checkpoints and zero rate-limit timeouts.
            </p>
          </div>

          {/* Card: 100% Privacy & Zero-Access Guarantee */}
          <div className={`${styles.featureCard} ${styles.privacyCard}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>100% Local &amp; Privacy First</h2>
            </div>
            <p className={styles.cardText}>
              Your data belongs strictly to you. <strong>I will never have access to your Google Drive, credentials, or files.</strong>
            </p>
            <ul className={styles.privacyList}>
              <li>
                <CheckCircle2 size={16} className={styles.checkIcon} />
                <span><strong>Zero External Telemetry:</strong> No tracking cookies, no analytic scripts, and no third-party telemetry.</span>
              </li>
              <li>
                <CheckCircle2 size={16} className={styles.checkIcon} />
                <span><strong>Direct Google APIs Only:</strong> All communications happen strictly between your local browser/server and Google Cloud.</span>
              </li>
              <li>
                <CheckCircle2 size={16} className={styles.checkIcon} />
                <span><strong>Local Key Storage:</strong> Your Service Account JSON keys remain inside your local machine environment at all times.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── 2. Tech Architecture & Open Source ──────────────────────── */}
        <div className={styles.techBanner}>
          <div className={styles.techLeft}>
            <div className={styles.techIconWrap}>
              <Code2 size={24} />
            </div>
            <div>
              <h3 className={styles.techTitle}>Engineered with Modern Performance</h3>
              <p className={styles.techDesc}>
                Built on Next.js 16 (App Router), React 19, TypeScript, Google Drive v3 APIs, and a custom atomic JSON size cache.
              </p>
            </div>
          </div>
          <div className={styles.techBadges}>
            <span className={styles.badge}>Next.js 16</span>
            <span className={styles.badge}>React 19</span>
            <span className={styles.badge}>TypeScript</span>
            <span className={styles.badge}>BFS Engine</span>
            <span className={styles.badge}>Lucide Icons</span>
            <span className={styles.badge}>Radix Primitives</span>
          </div>
        </div>

        {/* ── 3. Action Buttons ───────────────────────────────────────── */}
        <div className={styles.ctaRow}>
          {/* Primary PayPal Sponsorship CTA */}
          <a
            href="https://paypal.me/hassanoukassi89hbd"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sponsorBtn}
          >
            <Coffee size={18} />
            <span>Buy me a Coffee / Support on PayPal</span>
            <ExternalLink size={14} className={styles.btnArrow} />
          </a>

          {/* GitHub Profile */}
          <a
            href="https://github.com/HassanBDS"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubBtn}
          >
            <GithubIcon size={18} />
            <span>GitHub Profile</span>
            <ExternalLink size={14} className={styles.btnArrow} />
          </a>
        </div>

        {/* ── 4. Footer ─────────────────────────── */}
        <div className={styles.footerNote}>
          <p>
            Created with passion by{" "}
            <a href="https://github.com/HassanBDS" target="_blank" rel="noopener noreferrer">
              Hassan BDS
            </a>
            . If this tool saved you storage quota, time, or frustration, consider starring{" "}
            <a
              href="https://github.com/HassanBDS/google-drive-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.starLink}
              title="Star on GitHub"
            >
              <OcticonStar size={14} className={styles.starIcon} />
            </a>
            {" "}the repo on GitHub or sponsoring via PayPal!
          </p>
        </div>
      </div>
    </div>
  );
}

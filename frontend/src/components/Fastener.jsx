import React from "react";

// Small collage "stationery" that pins the torn sheets down — a paperclip, a
// push-pin, a staple. Purely decorative (pointer-events: none) and given a soft
// drop shadow so they sit on the paper rather than float above the UI.
const SHADOW = "drop-shadow(0 2px 2px rgba(22,20,18,0.3))";

const METAL = "#8c8c8c";
const METAL_HI = "#d2d2d2";

export function Paperclip({ className = "", style }) {
  return (
    <svg
      width="24"
      height="56"
      viewBox="0 0 24 56"
      fill="none"
      aria-hidden
      className={`pointer-events-none absolute z-10 ${className}`}
      style={{ filter: SHADOW, ...style }}
    >
      <rect x="6" y="4" width="12" height="48" rx="6" stroke={METAL} strokeWidth="2.6" />
      <rect x="6" y="4" width="12" height="48" rx="6" stroke={METAL_HI} strokeWidth="0.8" />
      <line x1="12" y1="10" x2="12" y2="38" stroke={METAL} strokeWidth="2.6" strokeLinecap="round" />
      <line x1="12" y1="10" x2="12" y2="38" stroke={METAL_HI} strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function Pushpin({ className = "", style, color = "#7c3aed" }) {
  return (
    <svg
      width="30"
      height="34"
      viewBox="0 0 30 34"
      fill="none"
      aria-hidden
      className={`pointer-events-none absolute z-10 ${className}`}
      style={{ filter: SHADOW, ...style }}
    >
      <rect x="13.4" y="20" width="3.2" height="12" rx="1.5" fill={METAL} transform="rotate(9 15 26)" />
      <circle cx="15" cy="12" r="11" fill={color} />
      <circle cx="15" cy="12" r="11" fill="none" stroke="rgba(22,20,18,0.18)" strokeWidth="1" />
      <ellipse cx="11" cy="8.5" rx="3.6" ry="2.8" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

export function Staple({ className = "", style }) {
  return (
    <svg
      width="40"
      height="16"
      viewBox="0 0 40 16"
      fill="none"
      aria-hidden
      className={`pointer-events-none absolute z-10 ${className}`}
      style={{ filter: SHADOW, ...style }}
    >
      <path d="M5 15 V6 H35 V15" stroke={METAL} strokeWidth="3" strokeLinecap="square" />
      <path d="M5 15 V6 H35 V15" stroke={METAL_HI} strokeWidth="1" strokeLinecap="square" />
    </svg>
  );
}

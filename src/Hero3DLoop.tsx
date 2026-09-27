import React from 'react';
import { ShieldCheck, RefreshCw, Sparkles, Layers } from 'lucide-react';

export function Hero3DLoop() {
  return (
    <div className="hero-3d-container" aria-hidden="true">
      {/* Ambient background glow & mesh aura */}
      <div className="hero-3d-glow hero-3d-glow-green" />
      <div className="hero-3d-glow hero-3d-glow-purple" />

      {/* Floating 3D Glass Badges */}
      <div className="hero-3d-badge hero-3d-badge-top">
        <span className="live-dot" />
        <span className="badge-text">Solana Devnet · SPL Memo Proof</span>
      </div>

      <div className="hero-3d-badge hero-3d-badge-bottom">
        <RefreshCw size={13} className="spin-slow" />
        <span className="badge-text">Closed Reusable Loop · Instant Refund</span>
      </div>

      {/* Main Isometric 3D SVG Scene */}
      <svg
        className="hero-3d-svg"
        viewBox="0 0 440 350"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Solana Gradients */}
          <linearGradient id="solanaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9945FF" />
            <stop offset="50%" stopColor="#8752F3" />
            <stop offset="100%" stopColor="#14F195" />
          </linearGradient>

          <linearGradient id="solanaGradSoft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14F195" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#9945FF" stopOpacity="0.85" />
          </linearGradient>

          {/* Cup Body Gradients (Ceramic / Matte Look) */}
          <linearGradient id="cupBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1c3e30" />
            <stop offset="25%" stopColor="#255441" />
            <stop offset="70%" stopColor="#326c54" />
            <stop offset="90%" stopColor="#224838" />
            <stop offset="100%" stopColor="#173327" />
          </linearGradient>

          <linearGradient id="cupHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Lid Gradients */}
          <linearGradient id="lidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c5beac" />
            <stop offset="40%" stopColor="#ece7d9" />
            <stop offset="85%" stopColor="#ded8c8" />
            <stop offset="100%" stopColor="#aca593" />
          </linearGradient>

          {/* Drop Shadow Filter for 3D Depth */}
          <filter id="shadow3D" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#132a21" floodOpacity="0.28" />
          </filter>

          <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 3D Platform Ground Shadow */}
        <ellipse cx="220" cy="305" rx="140" ry="24" fill="#0f261d" opacity="0.16" />
        <ellipse cx="220" cy="305" rx="90" ry="14" fill="#0f261d" opacity="0.22" />

        {/* Orbit Ring 1 (Back segment - Behind cup) */}
        <g className="orbit-spin-back">
          <ellipse
            cx="220"
            cy="185"
            rx="185"
            ry="65"
            stroke="url(#solanaGradSoft)"
            strokeWidth="2.5"
            strokeDasharray="9 7"
            transform="rotate(-18 220 185)"
            opacity="0.65"
          />
        </g>

        {/* Orbit Ring 2 (Back segment - Inner tilted ring) */}
        <g className="orbit-spin-reverse-back">
          <ellipse
            cx="220"
            cy="185"
            rx="155"
            ry="55"
            stroke="#14F195"
            strokeWidth="1.8"
            strokeDasharray="4 6"
            transform="rotate(22 220 185)"
            opacity="0.5"
          />
        </g>

        {/* THE 3D ISOMETRIC CUP */}
        <g className="floating-cup-group" filter="url(#shadow3D)">
          {/* Main Cup Body (Tapered Cone) */}
          <path
            d="M135 110 L158 275 Q220 298 282 275 L305 110 Z"
            fill="url(#cupBodyGrad)"
          />

          {/* Left Body Ambient Shadow */}
          <path
            d="M135 110 L158 275 Q180 286 195 284 L170 110 Z"
            fill="#12281f"
            opacity="0.45"
          />

          {/* Body Vertical Sheen / Specular Light Strip */}
          <path
            d="M232 110 L226 288 L244 286 L254 110 Z"
            fill="url(#cupHighlight)"
            opacity="0.4"
          />

          {/* Embossed Neon Solana / PfandLoop Infinity Loop */}
          <g transform="translate(182, 172) scale(1.15)">
            <ellipse cx="33" cy="24" rx="28" ry="16" fill="#153628" opacity="0.7" />
            <path
              d="M14 24 C14 16, 26 14, 33 24 C40 34, 52 32, 52 24 C52 16, 40 14, 33 24 C26 34, 14 32, 14 24 Z"
              stroke="url(#solanaGrad)"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
              filter="url(#neonGlow)"
            />
            {/* Solana Node Spark */}
            <circle cx="33" cy="24" r="3" fill="#ffffff" />
          </g>

          <text
            x="220"
            y="245"
            textAnchor="middle"
            fill="#dbe8ce"
            fontFamily="Inter, -apple-system, sans-serif"
            fontSize="10"
            letterSpacing="3.5"
            fontWeight="600"
            opacity="0.9"
          >
            PFANDLOOP · SOLANA
          </text>

          {/* Upper Body Collar / Rim */}
          <ellipse cx="220" cy="110" rx="85" ry="16" fill="#2d604b" />
          <ellipse cx="220" cy="110" rx="84" ry="14" fill="#204636" />

          {/* Reusable Silicone / Eco Lid */}
          {/* Lid Lower Flange */}
          <path
            d="M130 102 Q220 85 310 102 V112 Q220 126 130 112 Z"
            fill="url(#lidGrad)"
          />
          {/* Lid Dome Top */}
          <ellipse cx="220" cy="98" rx="88" ry="18" fill="url(#lidGrad)" />
          {/* Drinking Spout / Recess */}
          <ellipse cx="220" cy="94" rx="66" ry="12" fill="#ded7c4" />
          <rect x="248" y="86" width="28" height="7" rx="3.5" fill="#756f61" />
          <ellipse cx="190" cy="94" rx="3" ry="2" fill="#9c9584" />
        </g>

        {/* Orbit Ring 1 (Front segment with floating glowing nodes) */}
        <g className="orbit-spin-front">
          <ellipse
            cx="220"
            cy="185"
            rx="185"
            ry="65"
            stroke="url(#solanaGrad)"
            strokeWidth="3"
            transform="rotate(-18 220 185)"
            strokeDasharray="60 40 90 50"
            filter="url(#neonGlow)"
          />
          {/* Glowing Solana Node Token orbiting */}
          <g transform="translate(68, 126)">
            <circle cx="0" cy="0" r="9" fill="#9945FF" opacity="0.25" filter="url(#neonGlow)" />
            <circle cx="0" cy="0" r="6" fill="#9945FF" />
            <circle cx="0" cy="0" r="3" fill="#ffffff" />
          </g>
          <g transform="translate(372, 240)">
            <circle cx="0" cy="0" r="10" fill="#14F195" opacity="0.3" filter="url(#neonGlow)" />
            <circle cx="0" cy="0" r="6" fill="#14F195" />
            <circle cx="0" cy="0" r="3" fill="#ffffff" />
          </g>
        </g>

        {/* Orbit Ring 2 (Front segment) */}
        <g className="orbit-spin-reverse-front">
          <ellipse
            cx="220"
            cy="185"
            rx="155"
            ry="55"
            stroke="#14F195"
            strokeWidth="2.2"
            transform="rotate(22 220 185)"
            strokeDasharray="40 70 80 40"
          />
          <g transform="translate(340, 140)">
            <circle cx="0" cy="0" r="5" fill="#14F195" />
            <circle cx="0" cy="0" r="2" fill="#ffffff" />
          </g>
        </g>

        {/* Micro Floating Sparkles */}
        <g className="sparkle-1" transform="translate(130, 70)">
          <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill="#14F195" />
        </g>
        <g className="sparkle-2" transform="translate(315, 60)">
          <path d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z" fill="#9945FF" />
        </g>
        <g className="sparkle-3" transform="translate(115, 230)">
          <path d="M0 -5 L1.2 -1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2 -1.2 Z" fill="#ffd166" />
        </g>
      </svg>

      {/* Feature Strip beneath 3D Art */}
      <div className="hero-3d-features">
        <div className="feature-item">
          <span className="feature-icon"><Layers size={13} /></span>
          <span>Zero App Installation · Web Wallet</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon"><ShieldCheck size={13} /></span>
          <span>Proof of Identity Memo</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon"><Sparkles size={13} /></span>
          <span>€0.0005 Micro-Tx Fees</span>
        </div>
      </div>
    </div>
  );
}

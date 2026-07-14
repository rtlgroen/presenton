"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface PresentonSplashLoaderProps {
  message?: string;
  className?: string;
}

export const PRESENTON_SPLASH_MIN_DURATION_MS = 3000;

export function PresentonSplashLoader({
  message = "Preparing your workspace",
  className,
}: PresentonSplashLoaderProps) {
  const containerStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    display: "flex",
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: "#ffffff",
  };

  const surfaceStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "142vmax",
    height: "142vmax",
    borderRadius: "50%",
    background: "#7a5af8",
    transform: "translate3d(-50%, -50%, 0) scale(0.001)",
    animation: "presenton-splash-surface-grow 2.6s linear both",
    willChange: "transform",
    backfaceVisibility: "hidden",
  };

  const wordmarkStyle: CSSProperties = {
    position: "relative",
    zIndex: 1,
    display: "grid",
    placeItems: "center",
    transform: "translateZ(0)",
  };

  const textStyle: CSSProperties = {
    gridArea: "1 / 1",
    fontFamily: "var(--font-syne), sans-serif",
    fontSize: "clamp(42px, 6vw, 92px)",
    fontWeight: 700,
    letterSpacing: "-0.07em",
    lineHeight: 0.95,
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  return (
    <main
      aria-busy="true"
      aria-label={message}
      className={cn("presenton-splash-loader", className)}
      role="status"
      style={containerStyle}
    >
      <div
        className="presenton-splash-surface"
        aria-hidden="true"
        style={surfaceStyle}
      />
      <div
        className="presenton-splash-wordmark"
        aria-hidden="true"
        style={wordmarkStyle}
      >
        <span
          className="presenton-splash-text presenton-splash-text-base"
          style={{ ...textStyle, color: "#7a5af8" }}
        >
          Presenton
        </span>
        <span
          className="presenton-splash-text presenton-splash-text-reveal"
          style={{
            ...textStyle,
            color: "#ffffff",
            clipPath: "circle(0 at 50% 50%)",
            animation: "presenton-splash-text-reveal 2.6s linear both",
            willChange: "clip-path",
          }}
        >
          Presenton
        </span>
      </div>

      <style>{`
        html, body {
          margin: 0;
        }

        .presenton-splash-surface {
          transform-origin: center center;
        }

        @keyframes presenton-splash-surface-grow {
          0% {
            transform: translate3d(-50%, -50%, 0) scale(0.001);
          }

          100% {
            transform: translate3d(-50%, -50%, 0) scale(1);
          }
        }

        @keyframes presenton-splash-text-reveal {
          0% {
            clip-path: circle(0 at 50% 50%);
          }

          100% {
            clip-path: circle(71vmax at 50% 50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .presenton-splash-surface {
            animation: none;
            transform: translate3d(-50%, -50%, 0) scale(1);
          }

          .presenton-splash-text-reveal {
            animation: none;
            clip-path: circle(71vmax at 50% 50%);
          }
        }
      `}</style>
    </main>
  );
}

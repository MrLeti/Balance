---
name: ai-rotating-glow-effect
description: >-
  Implements modern AI-style rotating external glowing borders, chromatic aura glows,
  and AI prompt input components with rotating conic gradients and animated action buttons.
  Use whenever creating or styling AI chat/prompt bars, search inputs, or card highlights
  that require a futuristic rotating glowing border and colorful outer aura.
---

# AI Rotating Glowing Aura & Prompt Component

This skill provides the definitive design pattern and CSS/React implementation for the **external rotating glowing aura**, **crisp rotating gradient border**, and **modern AI action button** seen in top-tier AI applications (Perplexity, Gemini, Arc, Cursor, v0).

---

## 1. Core Architecture: The 3-Layer Technique

A standard CSS border cannot animate rotation around a non-square element without clipping or warping. The solution uses three stacked, synchronized layers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Outer Glow Blur (.aiGlowBlur)                            │  <-- filter: blur(14px), spinning conic gradient
│   ┌───────────────────────────────────────────────────────┐ │
│   │ 2. Crisp Rotating Border (.aiPromptContainer)         │ │  <-- padding: 1.5px, overflow: hidden, spinning conic gradient
│   │   ┌─────────────────────────────────────────────────┐ │ │
│   │   │ 3. Masking Surface Card (.aiPromptCard)         │ │ │  <-- z-index: 3, solid/glass theme surface
│   │   │    [ ✨ Analizar con IA                       ] │ │ │
│   │   │    [ [ Input text field... ] [ ✨ Analizar ] ] │ │ │
│   │   └─────────────────────────────────────────────────┘ │ │
│   └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Layer Breakdown

1. **Layer 1: External Diffuse Aura (`.aiGlowBlur`)**
   - Positioned `absolute` with negative inset (`inset: -3px` to `-4px`).
   - `filter: blur(14px)` to `blur(18px)`.
   - `opacity: 0.65` - `0.75` (Dark mode) / `0.40` - `0.45` (Light mode).
   - Contains an oversized pseudo-element `::before` with a 360° `conic-gradient` rotating infinitely.

2. **Layer 2: Crisp Rotating Border (`.aiPromptContainer`)**
   - Outer container with `position: relative`, `overflow: hidden`, and `border-radius: 18px`.
   - `padding: 1.5px` (the padding width determines the glowing border thickness).
   - Contains an identical, perfectly synchronized oversized `conic-gradient` in `::before`.

3. **Layer 3: Masking Surface Card (`.aiPromptCard`)**
   - Positioned `relative` with `z-index: 3`.
   - Uses the theme surface background (`var(--surface)`, `var(--bg-color)`, or Glassmorphism token) with `border-radius: 16.5px` (matching the outer radius minus padding).
   - Masks out the center of the spinning conic gradient, leaving only the sharp 1.5px border visible.

---

## 2. Geometry: The Dynamic Euclidean Diagonal Coverage Invariant

On rectangular elements (e.g. 600px wide by 70px high, or when expanding to 1060px in desktop list views), an isotropic rotating disk must **always circumscribe the rectangle** across all 360 degrees without showing seams, unlit corners, or clipping.

### The Euclidean Invariant Formula
For any element with width $W$ and height $H$, the maximum distance from the element's geometric center $(W/2, H/2)$ to any vertex is the circumradius:

$$R = \frac{\sqrt{W^2 + H^2}}{2}$$

To guarantee that rotating the square by any angle $\theta \in [0, 360^\circ]$ leaves zero uncolored gaps, the spinning layer must be a square centered at `(50%, 50%)` with side length:

$$S \ge \sqrt{W^2 + H^2} + \text{safety margin (e.g. 36px for blur aura)}$$

```css
/* Centered isotropic spinning square */
top: 50%;
left: 50%;
width: var(--glow-size, 1600px);
height: var(--glow-size, 1600px);
margin-top: calc(-1 * var(--glow-half-size, 800px));
margin-left: calc(-1 * var(--glow-half-size, 800px));
transform-origin: center center;
```

A lightweight `ResizeObserver` observes the component container and dynamically sets `--glow-size` and `--glow-half-size` as CSS variables on the container. If JavaScript is disabled or during SSR, CSS fallbacks (`1600px` / `800px`) ensure full visual coverage.

---

## 3. Canonical CSS Implementation (`AiGlow.module.css`)

```css
@keyframes rotateAura {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

/* Outer Wrapper with CSS variable fallback */
.aiGlowOuter {
    position: relative;
    width: 100%;
    --glow-size: 1600px;
    --glow-half-size: 800px;
}

/* Layer 1: Diffuse Outer Aura */
.aiGlowBlur {
    position: absolute;
    inset: -3px;
    border-radius: 20px;
    overflow: hidden;
    filter: blur(14px);
    opacity: 0.7;
    pointer-events: none;
    z-index: 1;
}

.aiGlowBlur::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--glow-size, 1600px);
    height: var(--glow-size, 1600px);
    margin-top: calc(-1 * var(--glow-half-size, 800px));
    margin-left: calc(-1 * var(--glow-half-size, 800px));
    background: conic-gradient(
        from 0deg,
        #3b82f6,
        #8b5cf6,
        #ec4899,
        #06b6d4,
        #10b981,
        #3b82f6
    );
    animation: rotateAura 5s linear infinite;
    transform-origin: center center;
}

/* Theme adaptation for light backgrounds */
:root[data-theme="light"] .aiGlowBlur {
    opacity: 0.42;
    filter: blur(16px);
}

/* Layer 2: Crisp Glowing Border */
.aiPromptContainer {
    position: relative;
    border-radius: 18px;
    overflow: hidden;
    padding: 1.5px;
    z-index: 2;
    box-shadow: 0 4px 20px -2px rgba(139, 92, 246, 0.25);
}

.aiPromptContainer::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--glow-size, 1600px);
    height: var(--glow-size, 1600px);
    margin-top: calc(-1 * var(--glow-half-size, 800px));
    margin-left: calc(-1 * var(--glow-half-size, 800px));
    background: conic-gradient(
        from 0deg,
        #3b82f6,
        #8b5cf6,
        #ec4899,
        #06b6d4,
        #10b981,
        #3b82f6
    );
    animation: rotateAura 5s linear infinite;
    transform-origin: center center;
}

/* Layer 3: Solid Inner Card Mask */
.aiPromptCard {
    position: relative;
    z-index: 3;
    background: var(--surface-card, #1a1c23);
    border-radius: 16.5px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    backdrop-filter: blur(16px);
}

/* Header Info */
.aiPromptHeader {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.aiSparkleIcon {
    font-size: 1.05rem;
    line-height: 1;
}

.aiPromptTitle {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-main, #ffffff);
    letter-spacing: -0.01em;
}

.aiPromptHint {
    font-size: 0.78rem;
    color: var(--text-muted, #94a3b8);
    font-weight: 500;
}

/* Input Row */
.aiPromptInputRow {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
}

.aiInputField {
    flex: 1;
    min-width: 0;
    background: var(--input-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--input-border, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 10px 14px;
    color: var(--text-main, #ffffff);
    font-size: 0.92rem;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.aiInputField::placeholder {
    color: var(--text-muted, #94a3b8);
    opacity: 0.75;
    font-size: 0.88rem;
}

.aiInputField:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
}

.aiInputField:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Modern AI Action Button */
.aiAnalyzeBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
    color: #ffffff;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
    transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease, opacity 0.2s ease;
    flex-shrink: 0;
}

.aiAnalyzeBtn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(139, 92, 246, 0.45);
    filter: brightness(1.08);
}

.aiAnalyzeBtn:active:not(:disabled) {
    transform: translateY(0);
}

.aiAnalyzeBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
}

.spinIcon {
    display: inline-block;
    animation: spin 1s linear infinite;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
    .aiPromptCard {
        padding: 12px 14px;
        gap: 8px;
    }

    .aiPromptHint {
        width: 100%;
        font-size: 0.74rem;
        line-height: 1.3;
    }

    .aiPromptInputRow {
        gap: 8px;
    }

    .aiInputField {
        font-size: 0.88rem;
        padding: 9px 12px;
    }

    .aiAnalyzeBtn {
        padding: 9px 14px;
        font-size: 0.84rem;
    }
}
```

---

## 4. Reusable React Component (`AiPromptBar.tsx`)

```tsx
"use client";

import React, { useState, useRef, useCallback } from "react";
import styles from "./AiGlow.module.css";

interface AiPromptBarProps {
    title?: string;
    hint?: string;
    placeholder?: string;
    buttonText?: string;
    isLoading?: boolean;
    onSubmit: (prompt: string) => void | Promise<void>;
    disabled?: boolean;
    className?: string;
}

export const AiPromptBar: React.FC<AiPromptBarProps> = ({
    title = "Analizar con IA",
    hint = "Escribí o pegá tu consulta en lenguaje natural...",
    placeholder = "Escribí tu consulta aquí...",
    buttonText = "Analizar",
    isLoading = false,
    onSubmit,
    disabled = false,
    className = ""
}) => {
    const [value, setValue] = useState("");

    // Dynamically calculate Euclidean diagonal to adapt to any width/height change
    const glowRoRef = useRef<ResizeObserver | null>(null);
    const aiGlowRef = useCallback((node: HTMLDivElement | null) => {
        if (glowRoRef.current) {
            glowRoRef.current.disconnect();
            glowRoRef.current = null;
        }

        if (node && typeof window !== "undefined") {
            const updateGlowDimensions = () => {
                const rect = node.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;
                // Calculate diagonal: sqrt(w^2 + h^2) + safety margin for blur aura
                const diagonal = Math.ceil(Math.hypot(rect.width, rect.height)) + 36;
                node.style.setProperty("--glow-size", `${diagonal}px`);
                node.style.setProperty("--glow-half-size", `${Math.ceil(diagonal / 2)}px`);
            };

            updateGlowDimensions();

            if (typeof ResizeObserver !== "undefined") {
                const ro = new ResizeObserver(updateGlowDimensions);
                ro.observe(node);
                glowRoRef.current = ro;
            }

            window.addEventListener("resize", updateGlowDimensions);
        }
    }, []);

    const handleAction = () => {
        const trimmed = value.trim();
        if (!trimmed || isLoading || disabled) return;
        void onSubmit(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAction();
        }
    };

    return (
        <div className={`${styles.aiGlowOuter} ${className}`} ref={aiGlowRef}>
            {/* Layer 1: Soft, intense rotating outer glow */}
            <div className={styles.aiGlowBlur} aria-hidden="true" />

            {/* Layer 2: Rotating crisp border */}
            <div className={styles.aiPromptContainer}>
                {/* Layer 3: Inner content card */}
                <div className={styles.aiPromptCard}>
                    <div className={styles.aiPromptHeader}>
                        <span className={styles.aiSparkleIcon} aria-hidden="true">✨</span>
                        <span className={styles.aiPromptTitle}>{title}</span>
                        {hint && <span className={styles.aiPromptHint}>{hint}</span>}
                    </div>

                    <div className={styles.aiPromptInputRow}>
                        <input
                            type="text"
                            className={styles.aiInputField}
                            placeholder={placeholder}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading || disabled}
                        />
                        <button
                            type="button"
                            className={styles.aiAnalyzeBtn}
                            onClick={handleAction}
                            disabled={isLoading || disabled || !value.trim()}
                        >
                            {isLoading ? (
                                <>
                                    <span className={styles.spinIcon} aria-hidden="true">⏳</span>
                                    <span>Analizando...</span>
                                </>
                            ) : (
                                <>
                                    <span aria-hidden="true">✨</span>
                                    <span>{buttonText}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
```

---

## 5. Alternative Color Palettes for the Conic Gradient

Depending on the app's visual identity, swap the stops in the conic gradient:

- **Electric Violet & Cyan (Claude / Gemini style)**:
  `conic-gradient(from 0deg, #3b82f6, #8b5cf6, #ec4899, #06b6d4, #10b981, #3b82f6)`
- **Emerald / Green Focus (Fintech / Balance / Investment)**:
  `conic-gradient(from 0deg, #10b981, #06b6d4, #3b82f6, #6366f1, #10b981)`
- **Sunset Flare (Warm / Creative)**:
  `conic-gradient(from 0deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #f59e0b)`
- **Monochrome Cyberpunk (Minimalist / Luxury)**:
  `conic-gradient(from 0deg, #ffffff, #64748b, #0f172a, #64748b, #ffffff)`

---

## 6. Verification Checklist

When adopting this skill in a new project:
- [ ] Confirm `@keyframes rotateAura` is defined and uses `transform: rotate(...)` around `center center`.
- [ ] Ensure `.aiGlowBlur::before` and `.aiPromptContainer::before` have identical rotation duration (`5s linear infinite`) so the blur and border remain in sync.
- [ ] Verify `pointer-events: none` is set on `.aiGlowBlur` so the glow does not intercept clicks.
- [ ] Validate card contrast in both light and dark themes using CSS variables for `--surface-card`.
- [ ] Test on mobile (<= 768px): verify the input row does not overflow horizontally.

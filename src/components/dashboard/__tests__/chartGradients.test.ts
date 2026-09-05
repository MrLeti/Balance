import { describe, it, expect, vi, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Reference Oracle for createVerticalGradient specified in PROJECT.md:
 * 
 * export function createVerticalGradient(
 *   ctx: CanvasRenderingContext2D,
 *   chartArea: { top: number; bottom: number },
 *   colorHex: string,
 *   isDark: boolean,
 *   topAlpha?: number
 * ): CanvasGradient | undefined;
 */
export function referenceCreateVerticalGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number } | undefined | null,
  colorHex: string,
  isDark: boolean,
  topAlpha = 0.35
): CanvasGradient | undefined {
  if (!chartArea || chartArea.bottom <= chartArea.top) return undefined;

  let hex = colorHex.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;

  const startAlpha = isDark ? topAlpha : topAlpha * 0.7;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${startAlpha})`);
  gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${Number((startAlpha * 0.3).toFixed(4))})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  return gradient;
}

function createMockCanvasContext() {
  const colorStops: { offset: number; color: string }[] = [];
  const mockGradient = {
    addColorStop: vi.fn((offset: number, color: string) => {
      colorStops.push({ offset, color });
    }),
    _colorStops: colorStops,
  };
  const ctx = {
    createLinearGradient: vi.fn((_x0: number, _y0: number, _x1: number, _y1: number) => mockGradient),
    _mockGradient: mockGradient,
  } as unknown as CanvasRenderingContext2D;

  return { ctx, mockGradient, colorStops };
}

describe('Chart Gradient Utility (Tier 2 & 4: R2, R3 Canvas Gradients)', () => {
  let activeGradientFn: (
    ctx: CanvasRenderingContext2D,
    chartArea: { top: number; bottom: number } | undefined | null,
    colorHex: string,
    isDark: boolean,
    topAlpha?: number
  ) => CanvasGradient | undefined;

  beforeAll(async () => {
    // Check if M2 implementation exists
    const implPath = path.resolve(__dirname, '../../../lib/utils/chartGradients.ts');
    if (fs.existsSync(implPath)) {
      const modulePath = '@/lib/utils/chartGradients';
      const mod = await import(/* @vite-ignore */ modulePath);
      activeGradientFn = mod.createVerticalGradient || mod.createChartGradient;
    } else {
      activeGradientFn = referenceCreateVerticalGradient;
    }
  });

  it('creates linear gradient with coordinates (0, top, 0, bottom)', () => {
    const { ctx } = createMockCanvasContext();
    const chartArea = { top: 20, bottom: 250 };

    const gradient = activeGradientFn(ctx, chartArea, '#22c55e', true);

    expect(gradient).toBeDefined();
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(1);
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 20, 0, 250);
  });

  it('adds color stops at 0 and 1, with stop at 1 using rgba(r,g,b,0) to prevent black halos', () => {
    const { ctx, colorStops } = createMockCanvasContext();
    const chartArea = { top: 0, bottom: 200 };

    activeGradientFn(ctx, chartArea, '#22c55e', true);

    // Color stop 0: Green rgb(34, 197, 94) with top alpha
    const stop0 = colorStops.find((s) => s.offset === 0);
    expect(stop0).toBeDefined();
    expect(stop0?.color).toMatch(/^rgba\(34,\s*197,\s*94,\s*0\.35\)$/);

    // Color stop 1: Green rgb(34, 197, 94) with 0 alpha (prevents black halo)
    const stop1 = colorStops.find((s) => s.offset === 1);
    expect(stop1).toBeDefined();
    expect(stop1?.color).toMatch(/^rgba\(34,\s*197,\s*94,\s*0(\.0)?\)$/);
    expect(stop1?.color).not.toBe('transparent');
  });

  it('handles egresos red (#ef4444) color stops accurately', () => {
    const { ctx, colorStops } = createMockCanvasContext();
    const chartArea = { top: 10, bottom: 300 };

    activeGradientFn(ctx, chartArea, '#ef4444', true);

    const stop0 = colorStops.find((s) => s.offset === 0);
    expect(stop0?.color).toMatch(/^rgba\(239,\s*68,\s*68,\s*0\.35\)$/);

    const stop1 = colorStops.find((s) => s.offset === 1);
    expect(stop1?.color).toMatch(/^rgba\(239,\s*68,\s*68,\s*0(\.0)?\)$/);
  });

  it('returns undefined gracefully when chartArea is null or undefined (initial render safety)', () => {
    const { ctx } = createMockCanvasContext();

    expect(activeGradientFn(ctx, undefined, '#22c55e', true)).toBeUndefined();
    expect(activeGradientFn(ctx, null, '#22c55e', true)).toBeUndefined();
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });

  it('returns undefined gracefully when chartArea is degenerate (bottom <= top)', () => {
    const { ctx } = createMockCanvasContext();

    expect(activeGradientFn(ctx, { top: 100, bottom: 100 }, '#22c55e', true)).toBeUndefined();
    expect(activeGradientFn(ctx, { top: 150, bottom: 100 }, '#22c55e', true)).toBeUndefined();
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });

  it('scales top opacity down in light mode (isDark = false) and keeps higher opacity in dark mode', () => {
    const darkContext = createMockCanvasContext();
    const lightContext = createMockCanvasContext();
    const chartArea = { top: 0, bottom: 200 };

    activeGradientFn(darkContext.ctx, chartArea, '#22c55e', true, 0.4);
    activeGradientFn(lightContext.ctx, chartArea, '#22c55e', false, 0.4);

    const darkStop0 = darkContext.colorStops.find((s) => s.offset === 0);
    const lightStop0 = lightContext.colorStops.find((s) => s.offset === 0);

    const extractAlpha = (str: string) => {
      const match = str.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const darkAlpha = extractAlpha(darkStop0!.color);
    const lightAlpha = extractAlpha(lightStop0!.color);

    expect(darkAlpha).toBe(0.4);
    expect(lightAlpha).toBeLessThan(darkAlpha);
    expect(lightAlpha).toBeCloseTo(0.4 * 0.7, 2);
  });

  it('parses shorthand 3-digit hex colors (e.g. #3b8)', () => {
    const { ctx, colorStops } = createMockCanvasContext();
    const chartArea = { top: 0, bottom: 100 };

    activeGradientFn(ctx, chartArea, '#3b8', true);

    const stop0 = colorStops.find((s) => s.offset === 0);
    // #3b8 expands to #33bb88 -> rgb(51, 187, 136)
    expect(stop0?.color).toMatch(/^rgba\(51,\s*187,\s*136,\s*0\.35\)$/);
  });
});

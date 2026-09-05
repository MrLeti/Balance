import { describe, it, expect, vi } from 'vitest';
import {
  createVerticalGradient,
  createChartGradient,
  hexToRgb,
} from '@/lib/utils/chartGradients';

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

function parseRgba(colorStr: string): { r: number; g: number; b: number; a: number } {
  const match = colorStr.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
  if (!match) {
    throw new Error(`Invalid rgba string: "${colorStr}"`);
  }
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: parseFloat(match[4]),
  };
}

describe('Empirical Challenger: Chart Gradient Engine (Milestone 2)', () => {
  describe('1. Hex Color Formats & Sanitization in hexToRgb and createVerticalGradient', () => {
    it('correctly parses 6-digit lowercase hex (#22c55e and #ef4444)', () => {
      expect(hexToRgb('#22c55e')).toEqual([34, 197, 94]);
      expect(hexToRgb('#ef4444')).toEqual([239, 68, 68]);
    });

    it('correctly parses 6-digit uppercase hex (#FFFFFF and #22C55E)', () => {
      expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255]);
      expect(hexToRgb('#22C55E')).toEqual([34, 197, 94]);
    });

    it('correctly parses 3-digit shorthand hex (#fff, #FFF, #3b8)', () => {
      expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
      expect(hexToRgb('#FFF')).toEqual([255, 255, 255]);
      expect(hexToRgb('#3b8')).toEqual([51, 187, 136]);
      expect(hexToRgb('#000')).toEqual([0, 0, 0]);
    });

    it('handles hex strings without leading hash (22c55e, fff)', () => {
      expect(hexToRgb('22c55e')).toEqual([34, 197, 94]);
      expect(hexToRgb('fff')).toEqual([255, 255, 255]);
    });

    it('handles leading and trailing whitespace around hex string', () => {
      expect(hexToRgb('   #22c55e   ')).toEqual([34, 197, 94]);
      expect(hexToRgb('\t#fff\n')).toEqual([255, 255, 255]);
      expect(hexToRgb('  #3b8 ')).toEqual([51, 187, 136]);
    });

    it('handles 8-digit hex strings gracefully by using the first 6 hex digits for RGB', () => {
      expect(hexToRgb('#22c55eff')).toEqual([34, 197, 94]);
    });

    it('safely falls back to 0 without throwing on empty, invalid, or malformed strings', () => {
      expect(() => hexToRgb('')).not.toThrow();
      expect(hexToRgb('')).toEqual([0, 0, 0]);

      expect(() => hexToRgb('invalid')).not.toThrow();
      expect(hexToRgb('invalid')).toEqual([0, 0, 0]);

      expect(() => hexToRgb('#zzzzzz')).not.toThrow();
      expect(hexToRgb('#zzzzzz')).toEqual([0, 0, 0]);

      expect(() => hexToRgb('#12')).not.toThrow();
      expect(hexToRgb('#12')).toEqual([18, 0, 0]);
    });
  });

  describe('2. Degenerate and Boundary chartArea Dimensions', () => {
    it('returns undefined when chartArea is undefined', () => {
      const { ctx } = createMockCanvasContext();
      const result = createVerticalGradient(ctx, undefined, '#22c55e', true);
      expect(result).toBeUndefined();
      expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    });

    it('returns undefined when chartArea is null', () => {
      const { ctx } = createMockCanvasContext();
      const result = createVerticalGradient(ctx, null, '#22c55e', true);
      expect(result).toBeUndefined();
      expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    });

    it('returns undefined when chartArea has zero height (top === bottom)', () => {
      const { ctx } = createMockCanvasContext();
      expect(createVerticalGradient(ctx, { top: 0, bottom: 0 }, '#22c55e', true)).toBeUndefined();
      expect(createVerticalGradient(ctx, { top: 120, bottom: 120 }, '#22c55e', false)).toBeUndefined();
      expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    });

    it('returns undefined when chartArea has inverted coordinates (bottom < top)', () => {
      const { ctx } = createMockCanvasContext();
      expect(createVerticalGradient(ctx, { top: 200, bottom: 100 }, '#22c55e', true)).toBeUndefined();
      expect(createVerticalGradient(ctx, { top: 0, bottom: -10 }, '#22c55e', false)).toBeUndefined();
      expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    });

    it('creates linear gradient when chartArea has valid negative coordinates (bottom > top)', () => {
      const { ctx } = createMockCanvasContext();
      const chartArea = { top: -200, bottom: -50 };
      const gradient = createVerticalGradient(ctx, chartArea, '#22c55e', true);
      expect(gradient).toBeDefined();
      expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, -200, 0, -50);
    });

    it('creates linear gradient for minimal non-zero positive height', () => {
      const { ctx } = createMockCanvasContext();
      const chartArea = { top: 10, bottom: 10.01 };
      const gradient = createVerticalGradient(ctx, chartArea, '#22c55e', true);
      expect(gradient).toBeDefined();
      expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 10, 0, 10.01);
    });

    it('safely handles edge case when chartArea contains NaN or missing properties', () => {
      const { ctx } = createMockCanvasContext();
      const result = createVerticalGradient(ctx, { top: NaN, bottom: 100 } as any, '#22c55e', true);
      expect(result).toBeUndefined();
      expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    });
  });

  describe('3. Color Stops, Coordinates, and Alpha Scaling with isDark & maxOpacity', () => {
    it('sets coordinates strictly vertical: (0, top, 0, bottom)', () => {
      const { ctx } = createMockCanvasContext();
      const chartArea = { top: 45, bottom: 320 };
      createVerticalGradient(ctx, chartArea, '#22c55e', true);
      expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 45, 0, 320);
    });

    it('configures exactly 3 color stops at offsets 0, 0.7, and 1', () => {
      const { ctx, colorStops } = createMockCanvasContext();
      const chartArea = { top: 0, bottom: 100 };
      createVerticalGradient(ctx, chartArea, '#22c55e', true);

      expect(colorStops).toHaveLength(3);
      expect(colorStops[0].offset).toBe(0);
      expect(colorStops[1].offset).toBe(0.7);
      expect(colorStops[2].offset).toBe(1);
    });

    it('ensures stop at 1 uses rgba(r,g,b, 0) with matching line RGB channels (no black halo)', () => {
      const { ctx, colorStops } = createMockCanvasContext();
      const chartArea = { top: 0, bottom: 100 };

      // Test with green line
      createVerticalGradient(ctx, chartArea, '#22c55e', false);
      const greenStop1 = parseRgba(colorStops[2].color);
      expect(greenStop1.r).toBe(34);
      expect(greenStop1.g).toBe(197);
      expect(greenStop1.b).toBe(94);
      expect(greenStop1.a).toBe(0);

      // Test with red line
      const redContext = createMockCanvasContext();
      createVerticalGradient(redContext.ctx, chartArea, '#ef4444', true);
      const redStop1 = parseRgba(redContext.colorStops[2].color);
      expect(redStop1.r).toBe(239);
      expect(redStop1.g).toBe(68);
      expect(redStop1.b).toBe(68);
      expect(redStop1.a).toBe(0);
    });

    it('scales alpha for isDark = true vs isDark = false with default maxOpacity (0.35)', () => {
      const darkCtx = createMockCanvasContext();
      const lightCtx = createMockCanvasContext();
      const chartArea = { top: 10, bottom: 150 };

      createVerticalGradient(darkCtx.ctx, chartArea, '#22c55e', true);
      createVerticalGradient(lightCtx.ctx, chartArea, '#22c55e', false);

      const darkStop0 = parseRgba(darkCtx.colorStops[0].color);
      const lightStop0 = parseRgba(lightCtx.colorStops[0].color);

      // Dark mode: startAlpha = maxOpacity = 0.35
      expect(darkStop0.a).toBe(0.35);

      // Light mode: startAlpha = maxOpacity * 0.7 = 0.245
      expect(lightStop0.a).toBeCloseTo(0.35 * 0.7, 4);

      // Intermediate stop at 0.7: roll-off to startAlpha * 0.3
      const darkStop07 = parseRgba(darkCtx.colorStops[1].color);
      const lightStop07 = parseRgba(lightCtx.colorStops[1].color);

      expect(darkStop07.a).toBeCloseTo(0.35 * 0.3, 4);
      expect(lightStop07.a).toBeCloseTo(0.35 * 0.7 * 0.3, 4);
    });

    it('avoids IEEE-754 precision artifact on stop 0 alpha in light mode (0.245)', () => {
      const { ctx, colorStops } = createMockCanvasContext();
      const chartArea = { top: 0, bottom: 100 };

      createVerticalGradient(ctx, chartArea, '#22c55e', false);

      // startAlpha is rounded to 4 decimals:
      // evaluates cleanly to "rgba(34, 197, 94, 0.245)"
      expect(colorStops[0].color).toBe('rgba(34, 197, 94, 0.245)');
    });

    it('supports custom maxOpacity parameter', () => {
      const { ctx, colorStops } = createMockCanvasContext();
      const chartArea = { top: 0, bottom: 200 };

      createVerticalGradient(ctx, chartArea, '#22c55e', true, 0.8);
      const stop0 = parseRgba(colorStops[0].color);
      expect(stop0.a).toBe(0.8);

      const lightCtx = createMockCanvasContext();
      createVerticalGradient(lightCtx.ctx, chartArea, '#22c55e', false, 0.8);
      const lightStop0 = parseRgba(lightCtx.colorStops[0].color);
      expect(lightStop0.a).toBeCloseTo(0.8 * 0.7, 4);
    });

    it('handles maxOpacity = 0 cleanly', () => {
      const { ctx, colorStops } = createMockCanvasContext();
      const chartArea = { top: 0, bottom: 200 };

      createVerticalGradient(ctx, chartArea, '#22c55e', true, 0);
      const stop0 = parseRgba(colorStops[0].color);
      expect(stop0.a).toBe(0);
    });
  });

  describe('4. Export Alias Consistency', () => {
    it('exports createChartGradient as an identical alias to createVerticalGradient', () => {
      expect(createChartGradient).toBe(createVerticalGradient);
    });
  });
});

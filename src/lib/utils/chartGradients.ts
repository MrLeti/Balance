/**
 * Utility for generating vertical linear gradients for Chart.js dataset fills.
 * Creates a smooth fade from line color to transparent (rgba(r, g, b, 0)) to
 * avoid the canvas "transparent black" halo bug on light backgrounds.
 */

export function hexToRgb(hexColor: string): [number, number, number] {
  let hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return [r, g, b];
}

export function createVerticalGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number } | undefined | null,
  hexColor: string,
  isDark: boolean,
  maxOpacity: number = 0.35
): CanvasGradient | undefined {
  if (
    !chartArea ||
    !Number.isFinite(chartArea.top) ||
    !Number.isFinite(chartArea.bottom) ||
    chartArea.bottom <= chartArea.top
  ) {
    return undefined;
  }

  const [r, g, b] = hexToRgb(hexColor);
  const startAlpha = Number((isDark ? maxOpacity : maxOpacity * 0.7).toFixed(4));
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${startAlpha})`);
  gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${Number((startAlpha * 0.3).toFixed(4))})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  return gradient;
}

export const createChartGradient = createVerticalGradient;

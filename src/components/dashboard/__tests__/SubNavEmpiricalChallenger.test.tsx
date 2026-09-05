import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SubNavTabs, { DashboardTabKey } from '../SubNavTabs';
import DashboardData from '../DashboardData';

// Mock child components that rely on canvas/heavy submodules to isolate tabpanel testing
vi.mock('../SankeyChart', () => ({
  default: () => <div data-testid="sankey-chart-mock">SankeyChart</div>,
}));
vi.mock('react-chartjs-2', () => ({
  Pie: () => <div data-testid="pie-chart-mock">PieChart</div>,
  Line: () => <div data-testid="line-chart-mock">LineChart</div>,
}));

describe('Empirical Challenger: Sub-Nav Navigation & View Shell', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url.includes('/api/categories')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url.includes('/api/cuotas')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  describe('1. Adversarial URL & Query Parameter Stress Tests', () => {
    it('falls back to dashboard when ?tab=unknown is passed', async () => {
      window.history.replaceState(null, '', '/?tab=unknown');
      render(<DashboardData />);

      await waitFor(() => {
        expect(screen.getByRole('tabpanel')).toBeDefined();
      });

      const activeTab = screen.getByRole('tab', { name: /dashboard/i });
      expect(activeTab.getAttribute('aria-selected')).toBe('true');

      const panel = screen.getByRole('tabpanel');
      expect(panel.getAttribute('id')).toBe('tabpanel-dashboard');
      expect(panel.getAttribute('aria-labelledby')).toBe('tab-dashboard');
    });

    it('handles malformed, case-mismatched, and empty tab query values', async () => {
      const adversarialValues = [
        '/?tab=',
        '/?tab=12345',
        '/?tab=DASHBOARD',
        '/?tab=Analisis',
        '/?tab=movimientos%20',
        '/?tab=null',
        '/?tab=undefined',
      ];

      for (const query of adversarialValues) {
        window.history.replaceState(null, '', query);
        const { unmount } = render(<DashboardData />);

        await waitFor(() => {
          expect(screen.getByRole('tabpanel')).toBeDefined();
        });

        const dashboardTab = screen.getByRole('tab', { name: /dashboard/i });
        expect(dashboardTab.getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('tabpanel').getAttribute('id')).toBe('tabpanel-dashboard');
        unmount();
      }
    });

    it('preserves existing query parameters when changing tabs', async () => {
      window.history.replaceState(null, '', '/?theme=dark&filter=custom');
      render(<DashboardData />);

      await waitFor(() => {
        expect(screen.getByRole('tabpanel')).toBeDefined();
      });

      const analisisTab = screen.getByRole('tab', { name: /análisis/i });
      fireEvent.click(analisisTab);

      const searchParams = new URLSearchParams(window.location.search);
      expect(searchParams.get('tab')).toBe('analisis');
      expect(searchParams.get('theme')).toBe('dark');
      expect(searchParams.get('filter')).toBe('custom');
    });

    it('synchronizes via popstate when navigating back/forward with history', async () => {
      render(<DashboardData />);

      await waitFor(() => {
        expect(screen.getByRole('tabpanel')).toBeDefined();
      });

      act(() => {
        window.history.replaceState(null, '', '/?tab=movimientos');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(screen.getByRole('tab', { name: /movimientos/i }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tabpanel').getAttribute('id')).toBe('tabpanel-movimientos');

      act(() => {
        window.history.replaceState(null, '', '/?tab=corrupted_history');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(screen.getByRole('tab', { name: /dashboard/i }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tabpanel').getAttribute('id')).toBe('tabpanel-dashboard');

      act(() => {
        window.history.replaceState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(screen.getByRole('tab', { name: /dashboard/i }).getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('2. Rapid Switching & Race Condition Stress Tests', () => {
    it('survives rapid tab switching without desynchronization or crashes', async () => {
      render(<DashboardData />);

      await waitFor(() => {
        expect(screen.getByRole('tabpanel')).toBeDefined();
      });

      const tabs = [
        screen.getByRole('tab', { name: /dashboard/i }),
        screen.getByRole('tab', { name: /análisis/i }),
        screen.getByRole('tab', { name: /movimientos/i }),
      ];

      for (let i = 0; i < 60; i++) {
        const targetTab = tabs[i % 3];
        fireEvent.click(targetTab);
      }

      expect(tabs[2].getAttribute('aria-selected')).toBe('true');
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
      expect(tabs[1].getAttribute('aria-selected')).toBe('false');

      const panel = screen.getByRole('tabpanel');
      expect(panel.getAttribute('id')).toBe('tabpanel-movimientos');
      expect(window.location.search).toContain('tab=movimientos');
    });

    it('handles tab switches while loading without crashing', () => {
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
      render(<DashboardData />);

      const analisisTab = screen.getByRole('tab', { name: /análisis/i });
      expect(analisisTab).toBeDefined();

      fireEvent.click(analisisTab);
      expect(analisisTab.getAttribute('aria-selected')).toBe('true');
      expect(window.location.search).toContain('tab=analisis');
    });
  });

  describe('3. WAI-ARIA Tablist & Tabpanel Accessibility Hardening', () => {
    it('strictly satisfies WAI-ARIA 1.2 tablist and tabpanel relationships', async () => {
      window.history.replaceState(null, '', '/?tab=dashboard');
      render(<DashboardData />);

      await waitFor(() => {
        expect(screen.getByRole('tabpanel')).toBeDefined();
      });

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeDefined();
      expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);

      const tabKeys: DashboardTabKey[] = ['dashboard', 'analisis', 'movimientos'];

      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        const key = tabKeys[i];
        expect(tab.getAttribute('id')).toBe(`tab-${key}`);
        expect(tab.getAttribute('aria-controls')).toBe(`tabpanel-${key}`);
        expect(tab.getAttribute('type')).toBe('button');
      }

      const panel = screen.getByRole('tabpanel');
      expect(panel.getAttribute('id')).toBe('tabpanel-dashboard');
      expect(panel.getAttribute('aria-labelledby')).toBe('tab-dashboard');

      const tabDashboard = screen.getByRole('tab', { name: /dashboard/i });
      expect(tabDashboard.id).toBe(panel.getAttribute('aria-labelledby'));
    });

    it('updates aria-controls and aria-labelledby dynamically on tab change', async () => {
      render(<DashboardData />);

      await waitFor(() => {
        expect(screen.getByRole('tabpanel')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('tab', { name: /análisis/i }));
      const analisisPanel = screen.getByRole('tabpanel');
      expect(analisisPanel.getAttribute('id')).toBe('tabpanel-analisis');
      expect(analisisPanel.getAttribute('aria-labelledby')).toBe('tab-analisis');

      fireEvent.click(screen.getByRole('tab', { name: /movimientos/i }));
      const movPanel = screen.getByRole('tabpanel');
      expect(movPanel.getAttribute('id')).toBe('tabpanel-movimientos');
      expect(movPanel.getAttribute('aria-labelledby')).toBe('tab-movimientos');
    });

    it('maintains roving tabindex: 0 for active tab, -1 for inactive tabs', async () => {
      render(<DashboardData />);

      await waitFor(() => {
        expect(screen.getByRole('tabpanel')).toBeDefined();
      });

      const dash = screen.getByRole('tab', { name: /dashboard/i });
      const anal = screen.getByRole('tab', { name: /análisis/i });
      const mov = screen.getByRole('tab', { name: /movimientos/i });

      expect(dash.getAttribute('tabindex')).toBe('0');
      expect(anal.getAttribute('tabindex')).toBe('-1');
      expect(mov.getAttribute('tabindex')).toBe('-1');

      fireEvent.click(anal);
      expect(dash.getAttribute('tabindex')).toBe('-1');
      expect(anal.getAttribute('tabindex')).toBe('0');
      expect(mov.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('4. Keyboard Interaction Edge Cases', () => {
    it('ignores non-navigation keys gracefully', () => {
      const onTabChange = vi.fn();
      render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChange} />);

      const dash = screen.getByRole('tab', { name: /dashboard/i });

      ['Enter', 'Space', 'Tab', 'ArrowUp', 'ArrowDown', 'KeyA', 'Escape'].forEach((key) => {
        fireEvent.keyDown(dash, { key });
      });

      expect(onTabChange).not.toHaveBeenCalled();
    });

    it('focuses the target tab element upon keyboard navigation', () => {
      const onTabChange = vi.fn();
      render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChange} />);

      const dash = screen.getByRole('tab', { name: /dashboard/i });
      const anal = screen.getByRole('tab', { name: /análisis/i });
      const mov = screen.getByRole('tab', { name: /movimientos/i });

      dash.focus();
      expect(document.activeElement).toBe(dash);

      fireEvent.keyDown(dash, { key: 'ArrowRight' });
      expect(onTabChange).toHaveBeenCalledWith('analisis');
      expect(document.activeElement).toBe(anal);

      fireEvent.keyDown(dash, { key: 'ArrowLeft' });
      expect(onTabChange).toHaveBeenCalledWith('movimientos');
      expect(document.activeElement).toBe(mov);
    });
  });
});

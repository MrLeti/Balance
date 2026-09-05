import React, { useState, useEffect } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import SubNavTabs, { DashboardTabKey } from '../SubNavTabs';

/**
 * Harness simulating DashboardData URL parameter synchronization logic
 * specified in PROJECT.md and explorer_survey_1:
 * - Reads `?tab=...` on mount, default to 'dashboard' if absent or invalid.
 * - Updates URL with shallow history.replaceState on tab switch.
 * - Listens to `popstate` events to update activeTab without full page reload.
 */
function DashboardUrlHarness({ defaultTab = 'dashboard' }: { defaultTab?: DashboardTabKey }) {
  const [activeTab, setActiveTab] = useState<DashboardTabKey>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'analisis' || tab === 'movimientos') {
        return tab as DashboardTabKey;
      }
    }
    return defaultTab;
  });

  const handleTabChange = (tab: DashboardTabKey) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      window.history.replaceState(null, '', `/?${params.toString()}`);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'analisis' || tab === 'movimientos') {
        setActiveTab(tab as DashboardTabKey);
      } else {
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div>
      <SubNavTabs activeTab={activeTab} onTabChange={handleTabChange} />
      <div data-testid="active-view-container">
        {activeTab === 'dashboard' && <div data-testid="view-dashboard">Dashboard View</div>}
        {activeTab === 'analisis' && <div data-testid="view-analisis">Análisis View</div>}
        {activeTab === 'movimientos' && <div data-testid="view-movimientos">Movimientos View</div>}
      </div>
    </div>
  );
}

describe('SubNavTabs URL Synchronization & View Switching Contract (Tier 1 & 2)', () => {
  beforeEach(() => {
    // Reset URL to root
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('defaults to "dashboard" view and sets aria-selected when no URL parameter is provided', () => {
    render(<DashboardUrlHarness />);

    expect(screen.getByTestId('view-dashboard')).toBeDefined();
    expect(screen.queryByTestId('view-analisis')).toBeNull();
    expect(screen.queryByTestId('view-movimientos')).toBeNull();

    const dashboardTab = screen.getByRole('tab', { name: /dashboard/i });
    expect(dashboardTab.getAttribute('aria-selected')).toBe('true');
  });

  it('initializes to "analisis" view when URL contains ?tab=analisis', () => {
    window.history.replaceState(null, '', '/?tab=analisis');
    render(<DashboardUrlHarness />);

    expect(screen.getByTestId('view-analisis')).toBeDefined();
    expect(screen.queryByTestId('view-dashboard')).toBeNull();

    const analisisTab = screen.getByRole('tab', { name: /análisis/i });
    expect(analisisTab.getAttribute('aria-selected')).toBe('true');
  });

  it('initializes to "movimientos" view when URL contains ?tab=movimientos', () => {
    window.history.replaceState(null, '', '/?tab=movimientos');
    render(<DashboardUrlHarness />);

    expect(screen.getByTestId('view-movimientos')).toBeDefined();
    const movimientosTab = screen.getByRole('tab', { name: /movimientos/i });
    expect(movimientosTab.getAttribute('aria-selected')).toBe('true');
  });

  it('falls back safely to "dashboard" when URL contains an invalid tab parameter', () => {
    window.history.replaceState(null, '', '/?tab=invalid_unknown_tab');
    render(<DashboardUrlHarness />);

    expect(screen.getByTestId('view-dashboard')).toBeDefined();
    expect(screen.getByRole('tab', { name: /dashboard/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('synchronizes URL parameters with window.history.replaceState upon tab click', () => {
    render(<DashboardUrlHarness />);

    const analisisTab = screen.getByRole('tab', { name: /análisis/i });
    fireEvent.click(analisisTab);

    expect(screen.getByTestId('view-analisis')).toBeDefined();
    expect(window.location.search).toContain('tab=analisis');

    const movimientosTab = screen.getByRole('tab', { name: /movimientos/i });
    fireEvent.click(movimientosTab);

    expect(screen.getByTestId('view-movimientos')).toBeDefined();
    expect(window.location.search).toContain('tab=movimientos');
  });

  it('responds to browser popstate (back/forward navigation) events without full page reload', () => {
    render(<DashboardUrlHarness />);

    expect(screen.getByTestId('view-dashboard')).toBeDefined();

    act(() => {
      window.history.replaceState(null, '', '/?tab=analisis');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByTestId('view-analisis')).toBeDefined();
    expect(screen.getByRole('tab', { name: /análisis/i }).getAttribute('aria-selected')).toBe('true');

    act(() => {
      window.history.replaceState(null, '', '/?tab=dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByTestId('view-dashboard')).toBeDefined();
    expect(screen.getByRole('tab', { name: /dashboard/i }).getAttribute('aria-selected')).toBe('true');
  });
});

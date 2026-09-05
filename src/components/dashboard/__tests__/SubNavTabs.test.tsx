import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SubNavTabs from '../SubNavTabs';

describe('SubNavTabs Component (Tier 1: Core Navigation)', () => {
  const onTabChangeMock = vi.fn();

  beforeEach(() => {
    onTabChangeMock.mockClear();
  });

  it('renders all three sub-navigation tabs (Dashboard, Análisis, Movimientos)', () => {
    render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChangeMock} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    expect(screen.getByRole('tab', { name: /dashboard/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /análisis/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /movimientos/i })).toBeDefined();
  });

  it('marks the active tab with aria-selected="true" and tabIndex=0 (Default Tab Contract)', () => {
    render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChangeMock} />);

    const dashboardTab = screen.getByRole('tab', { name: /dashboard/i });
    const analisisTab = screen.getByRole('tab', { name: /análisis/i });
    const movimientosTab = screen.getByRole('tab', { name: /movimientos/i });

    expect(dashboardTab.getAttribute('aria-selected')).toBe('true');
    expect(dashboardTab.getAttribute('tabindex')).toBe('0');

    expect(analisisTab.getAttribute('aria-selected')).toBe('false');
    expect(analisisTab.getAttribute('tabindex')).toBe('-1');

    expect(movimientosTab.getAttribute('aria-selected')).toBe('false');
    expect(movimientosTab.getAttribute('tabindex')).toBe('-1');
  });

  it('calls onTabChange with "analisis" when the Análisis tab is clicked', () => {
    render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChangeMock} />);

    const analisisTab = screen.getByRole('tab', { name: /análisis/i });
    fireEvent.click(analisisTab);

    expect(onTabChangeMock).toHaveBeenCalledTimes(1);
    expect(onTabChangeMock).toHaveBeenCalledWith('analisis');
  });

  it('calls onTabChange with "movimientos" when the Movimientos tab is clicked', () => {
    render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChangeMock} />);

    const movimientosTab = screen.getByRole('tab', { name: /movimientos/i });
    fireEvent.click(movimientosTab);

    expect(onTabChangeMock).toHaveBeenCalledTimes(1);
    expect(onTabChangeMock).toHaveBeenCalledWith('movimientos');
  });

  it('reflects the updated active tab when props change', () => {
    const { rerender } = render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChangeMock} />);
    expect(screen.getByRole('tab', { name: /dashboard/i }).getAttribute('aria-selected')).toBe('true');

    rerender(<SubNavTabs activeTab="movimientos" onTabChange={onTabChangeMock} />);
    expect(screen.getByRole('tab', { name: /movimientos/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /dashboard/i }).getAttribute('aria-selected')).toBe('false');
  });

  it('conforms to WAI-ARIA tablist accessibility pattern', () => {
    render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChangeMock} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeDefined();
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');

    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => {
      expect(tab.getAttribute('aria-controls')).toMatch(/^tabpanel-/);
      expect(tab.getAttribute('id')).toMatch(/^tab-/);
    });
  });

  describe('Keyboard navigation (Tier 4: Accessibility & Edge Cases)', () => {
    it('navigates to the next tab on ArrowRight key', () => {
      render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChangeMock} />);

      const dashboardTab = screen.getByRole('tab', { name: /dashboard/i });
      fireEvent.keyDown(dashboardTab, { key: 'ArrowRight' });

      expect(onTabChangeMock).toHaveBeenCalledWith('analisis');
    });

    it('navigates to the previous tab on ArrowLeft key (with wrap-around)', () => {
      render(<SubNavTabs activeTab="dashboard" onTabChange={onTabChangeMock} />);

      const dashboardTab = screen.getByRole('tab', { name: /dashboard/i });
      fireEvent.keyDown(dashboardTab, { key: 'ArrowLeft' });

      expect(onTabChangeMock).toHaveBeenCalledWith('movimientos');
    });

    it('navigates to the first tab on Home key and last tab on End key', () => {
      render(<SubNavTabs activeTab="analisis" onTabChange={onTabChangeMock} />);

      const analisisTab = screen.getByRole('tab', { name: /análisis/i });
      fireEvent.keyDown(analisisTab, { key: 'Home' });
      expect(onTabChangeMock).toHaveBeenCalledWith('dashboard');

      onTabChangeMock.mockClear();
      fireEvent.keyDown(analisisTab, { key: 'End' });
      expect(onTabChangeMock).toHaveBeenCalledWith('movimientos');
    });
  });
});

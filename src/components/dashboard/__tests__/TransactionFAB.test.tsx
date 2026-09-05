import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionFAB from '../TransactionFAB';
import SubNavTabs, { DashboardTabKey } from '../SubNavTabs';
import fs from 'fs';
import path from 'path';

// Mock child modals so we can verify trigger wiring and event contracts cleanly
vi.mock('../ValidationModal', () => ({
  default: ({ initialType, onClose, onSuccess }: any) => (
    <div data-testid="mock-validation-modal" data-type={initialType}>
      <span>Modal Type: {initialType}</span>
      <button data-testid="btn-modal-success" onClick={() => {
        window.dispatchEvent(new Event('transaction_added'));
        onSuccess();
      }}>Simulate Add</button>
      <button data-testid="btn-modal-close" onClick={onClose}>Close</button>
    </div>
  )
}));

vi.mock('@/components/inversiones/InvestmentModal', () => ({
  default: ({ onClose, onSuccess }: any) => (
    <div data-testid="mock-investment-modal">
      <span>Investment Modal</span>
      <button data-testid="btn-inv-success" onClick={() => {
        window.dispatchEvent(new Event('transaction_added'));
        onSuccess();
      }}>Simulate Add Investment</button>
      <button data-testid="btn-inv-close" onClick={onClose}>Close</button>
    </div>
  )
}));

/**
 * Harness mimicking the root layout architecture where TransactionFAB is mounted
 * globally alongside the active tab views.
 */
function AppRootLayoutHarness() {
  const [activeTab, setActiveTab] = useState<DashboardTabKey>('dashboard');
  const [reloadCount, setReloadCount] = useState(0);

  React.useEffect(() => {
    const handleReload = () => setReloadCount(prev => prev + 1);
    window.addEventListener('transaction_added', handleReload);
    return () => window.removeEventListener('transaction_added', handleReload);
  }, []);

  return (
    <div className="app-shell">
      <div className="app-main">
        <SubNavTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div data-testid="current-tab-indicator">Active: {activeTab}</div>
        <div data-testid="reload-counter">Reloads: {reloadCount}</div>
        {activeTab === 'dashboard' && <div data-testid="view-dashboard">Dashboard View Content</div>}
        {activeTab === 'analisis' && <div data-testid="view-analisis">Análisis View Content</div>}
        {activeTab === 'movimientos' && <div data-testid="view-movimientos">Movimientos View Content</div>}
      </div>
      <TransactionFAB />
    </div>
  );
}

describe('TransactionFAB Component Empirical Tests (Milestone 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders FAB trigger button with accessible aria-label and closed state by default', () => {
    render(<TransactionFAB />);

    const fabTrigger = screen.getByRole('button', { name: /registrar nuevo movimiento/i });
    expect(fabTrigger).toBeDefined();
    expect(screen.getByText('Nuevo Movimiento')).toBeDefined();
    expect(screen.queryByText('Gasto')).toBeNull();
    expect(screen.queryByText('Ingreso')).toBeNull();
    expect(screen.queryByText('Ahorro')).toBeNull();
    expect(screen.queryByText('Inversión')).toBeNull();
  });

  it('toggles speed-dial menu and backdrop on click', () => {
    render(<TransactionFAB />);

    const fabTrigger = screen.getByRole('button', { name: /registrar nuevo movimiento/i });
    fireEvent.click(fabTrigger);

    // Menu should be open
    expect(screen.getByText('Cerrar')).toBeDefined();
    expect(screen.getByText('Gasto')).toBeDefined();
    expect(screen.getByText('Ingreso')).toBeDefined();
    expect(screen.getByText('Ahorro')).toBeDefined();
    expect(screen.getByText('Inversión')).toBeDefined();

    // Clicking again closes it
    fireEvent.click(fabTrigger);
    expect(screen.getByText('Nuevo Movimiento')).toBeDefined();
    expect(screen.queryByText('Gasto')).toBeNull();
  });

  it('opens ValidationModal with correct initialType for Egreso, Ingreso, and Ahorro', () => {
    render(<TransactionFAB />);
    const fabTrigger = screen.getByRole('button', { name: /registrar nuevo movimiento/i });

    // 1. Egreso (Gasto)
    fireEvent.click(fabTrigger);
    fireEvent.click(screen.getByText('Gasto'));
    expect(screen.getByTestId('mock-validation-modal').getAttribute('data-type')).toBe('Egreso');
    fireEvent.click(screen.getByTestId('btn-modal-close'));
    expect(screen.queryByTestId('mock-validation-modal')).toBeNull();

    // 2. Ingreso
    fireEvent.click(fabTrigger);
    fireEvent.click(screen.getByText('Ingreso'));
    expect(screen.getByTestId('mock-validation-modal').getAttribute('data-type')).toBe('Ingreso');
    fireEvent.click(screen.getByTestId('btn-modal-close'));
    expect(screen.queryByTestId('mock-validation-modal')).toBeNull();

    // 3. Ahorro
    fireEvent.click(fabTrigger);
    fireEvent.click(screen.getByText('Ahorro'));
    expect(screen.getByTestId('mock-validation-modal').getAttribute('data-type')).toBe('Ahorro');
    fireEvent.click(screen.getByTestId('btn-modal-close'));
    expect(screen.queryByTestId('mock-validation-modal')).toBeNull();
  });

  it('opens InvestmentModal when Inversión speed dial item is clicked', () => {
    render(<TransactionFAB />);
    const fabTrigger = screen.getByRole('button', { name: /registrar nuevo movimiento/i });

    fireEvent.click(fabTrigger);
    fireEvent.click(screen.getByText('Inversión'));
    expect(screen.getByTestId('mock-investment-modal')).toBeDefined();
    fireEvent.click(screen.getByTestId('btn-inv-close'));
    expect(screen.queryByTestId('mock-investment-modal')).toBeNull();
  });

  it('remains mounted and interactive across all 3 sub-nav tab views', () => {
    render(<AppRootLayoutHarness />);

    const fabTrigger = screen.getByRole('button', { name: /registrar nuevo movimiento/i });
    expect(screen.getByTestId('view-dashboard')).toBeDefined();
    expect(fabTrigger).toBeDefined();

    // Switch to Análisis
    const analisisTab = screen.getByRole('tab', { name: /análisis/i });
    fireEvent.click(analisisTab);
    expect(screen.getByTestId('view-analisis')).toBeDefined();
    expect(screen.queryByTestId('view-dashboard')).toBeNull();
    // FAB is still interactive
    fireEvent.click(fabTrigger);
    expect(screen.getByText('Gasto')).toBeDefined();
    fireEvent.click(fabTrigger); // close

    // Switch to Movimientos
    const movimientosTab = screen.getByRole('tab', { name: /movimientos/i });
    fireEvent.click(movimientosTab);
    expect(screen.getByTestId('view-movimientos')).toBeDefined();
    // FAB is still interactive
    fireEvent.click(fabTrigger);
    expect(screen.getByText('Inversión')).toBeDefined();
    fireEvent.click(fabTrigger); // close
  });

  it('triggers transaction_added event upon modal completion which increments reload listeners across views', () => {
    render(<AppRootLayoutHarness />);

    expect(screen.getByTestId('reload-counter').textContent).toBe('Reloads: 0');

    // Open FAB and add a transaction
    const fabTrigger = screen.getByRole('button', { name: /registrar nuevo movimiento/i });
    fireEvent.click(fabTrigger);
    fireEvent.click(screen.getByText('Gasto'));

    // Submit transaction in modal
    fireEvent.click(screen.getByTestId('btn-modal-success'));

    // Verify event caused reload
    expect(screen.getByTestId('reload-counter').textContent).toBe('Reloads: 1');
  });

  it('empirically verifies CSS rules for mobile clearance against bottom navigation bar', () => {
    const fabCssPath = path.resolve(__dirname, '../TransactionFAB.module.css');
    const sidebarCssPath = path.resolve(__dirname, '../../layout/Sidebar.module.css');

    const fabCss = fs.readFileSync(fabCssPath, 'utf-8');
    const sidebarCss = fs.readFileSync(sidebarCssPath, 'utf-8');

    // Check mobile breakpoint in fab CSS
    expect(fabCss).toMatch(/@media\s*\(\s*max-width:\s*768px\s*\)/);

    // Extract mobile media query block from FAB CSS
    const fabMobileContainerMatch = fabCss.match(/\.fabContainer\s*\{([^}]*bottom:\s*76px[^}]*)\}/);
    expect(fabMobileContainerMatch).not.toBeNull();
    const fabContainerRules = fabMobileContainerMatch![1];

    expect(fabContainerRules).toMatch(/bottom:\s*76px/);
    expect(fabContainerRules).toMatch(/z-index:\s*1001/);

    // Extract mobileBottomNav rules from Sidebar CSS
    const mobileBottomNavMatch = sidebarCss.match(/\.mobileBottomNav\s*\{([^}]*height:\s*60px[^}]*)\}/);
    expect(mobileBottomNavMatch).not.toBeNull();
    const mobileNavRules = mobileBottomNavMatch![1];

    expect(mobileNavRules).toMatch(/height:\s*60px/);
    expect(mobileNavRules).toMatch(/z-index:\s*1000/);

    // 76px mobile bottom clearance - 60px bottom nav bar = 16px exact safety clearance
    const fabBottomVal = parseInt(fabContainerRules.match(/bottom:\s*(\d+)px/)![1], 10);
    const navHeightVal = parseInt(mobileNavRules.match(/height:\s*(\d+)px/)![1], 10);
    expect(fabBottomVal - navHeightVal).toBe(16);
  });
});

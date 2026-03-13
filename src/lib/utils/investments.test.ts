import { describe, it, expect } from 'vitest';
import {
    calculateAverageCost,
    buildPortfolio,
    getPortfolioSummary,
    getPortfolioHistory,
    InvestmentTransaction,
} from './investments';

describe('calculateAverageCost', () => {
    it('debería calcular el promedio ponderado de una sola compra', () => {
        const buys: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 0.5, unitPrice: 80000, commission: 0, cartera: 'Crecimiento', comment: '' },
        ];
        expect(calculateAverageCost(buys)).toBe(80000);
    });

    it('debería calcular el promedio ponderado de múltiples compras', () => {
        const buys: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 10, unitPrice: 100, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '15/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 20, unitPrice: 130, commission: 0, cartera: 'Crecimiento', comment: '' },
        ];
        // (10*100 + 20*130) / 30 = 3600 / 30 = 120
        expect(calculateAverageCost(buys)).toBe(120);
    });

    it('debería devolver 0 para un array vacío', () => {
        expect(calculateAverageCost([])).toBe(0);
    });

    it('debería ignorar compras con cantidad 0', () => {
        const buys: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'ETH', assetType: 'Cripto', quantity: 0, unitPrice: 3000, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '02/01/2026', type: 'Compra', asset: 'ETH', assetType: 'Cripto', quantity: 2, unitPrice: 2500, commission: 0, cartera: 'Crecimiento', comment: '' },
        ];
        expect(calculateAverageCost(buys)).toBe(2500);
    });
});

describe('buildPortfolio', () => {
    it('debería construir holdings con una sola compra', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 0.5, unitPrice: 80000, commission: 100, cartera: 'Crecimiento', comment: '' },
        ];
        const prices = { BTC: 90000 };
        const holdings = buildPortfolio(txs, prices);

        expect(holdings).toHaveLength(1);
        expect(holdings[0].asset).toBe('BTC');
        expect(holdings[0].totalQuantity).toBe(0.5);
        expect(holdings[0].averageCost).toBe(80000);
        expect(holdings[0].totalInvested).toBe(40000);
        expect(holdings[0].currentValue).toBe(45000);
        expect(holdings[0].pnl).toBe(5000);
        expect(holdings[0].totalCommissions).toBe(100);
    });

    it('debería recalcular avg cost después de múltiples compras', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 10, unitPrice: 100, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '15/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 10, unitPrice: 200, commission: 0, cartera: 'Crecimiento', comment: '' },
        ];
        const prices = { AAPL: 180 };
        const holdings = buildPortfolio(txs, prices);

        expect(holdings[0].averageCost).toBe(150); // (10*100 + 10*200) / 20 = 150
        expect(holdings[0].totalQuantity).toBe(20);
        expect(holdings[0].totalInvested).toBe(3000);
        expect(holdings[0].currentValue).toBe(3600);
        expect(holdings[0].pnl).toBe(600);
    });

    it('debería calcular P&L realizado en ventas parciales', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'ETH', assetType: 'Cripto', quantity: 10, unitPrice: 2000, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '15/02/2026', type: 'Venta', asset: 'ETH', assetType: 'Cripto', quantity: 5, unitPrice: 3000, commission: 50, cartera: 'Crecimiento', comment: '' },
        ];
        const prices = { ETH: 3000 };
        const holdings = buildPortfolio(txs, prices);

        expect(holdings[0].totalQuantity).toBe(5);
        expect(holdings[0].averageCost).toBe(2000);
        expect(holdings[0].totalInvested).toBe(10000);
        // Realized P&L: (3000*5 - 50) - (2000*5) = 14950 - 10000 = 4950
        expect(holdings[0].realizedPnl).toBe(4950);
    });

    it('debería manejar venta total (quantity = 0)', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'SOL', assetType: 'Cripto', quantity: 100, unitPrice: 50, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '01/03/2026', type: 'Venta', asset: 'SOL', assetType: 'Cripto', quantity: 100, unitPrice: 80, commission: 0, cartera: 'Crecimiento', comment: '' },
        ];
        const prices = { SOL: 80 };
        const holdings = buildPortfolio(txs, prices);

        expect(holdings[0].totalQuantity).toBe(0);
        expect(holdings[0].totalInvested).toBe(0);
        expect(holdings[0].realizedPnl).toBe(3000); // (80*100) - (50*100) = 3000
    });

    it('debería manejar múltiples activos', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 1, unitPrice: 80000, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '01/01/2026', type: 'Compra', asset: 'ETH', assetType: 'Cripto', quantity: 10, unitPrice: 2000, commission: 0, cartera: 'Jubilación', comment: '' },
        ];
        const prices = { BTC: 85000, ETH: 2500 };
        const holdings = buildPortfolio(txs, prices);

        expect(holdings).toHaveLength(2);
    });
});

describe('getPortfolioSummary', () => {
    it('debería calcular el resumen total del portafolio', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 1, unitPrice: 80000, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '01/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 20, unitPrice: 100, commission: 0, cartera: 'Jubilación', comment: '' },
        ];
        const prices = { BTC: 90000, AAPL: 120 };
        const holdings = buildPortfolio(txs, prices);
        const summary = getPortfolioSummary(holdings);

        expect(summary.totalInvested).toBe(82000); // 80000 + 2000
        expect(summary.totalCurrentValue).toBe(92400); // 90000 + 2400
        expect(summary.totalPnl).toBe(10400);
        expect(summary.holdingsCount).toBe(2);
        expect(summary.diversification).toHaveLength(2);
    });

    it('debería excluir holdings con quantity 0 del resumen activo', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'SOL', assetType: 'Cripto', quantity: 10, unitPrice: 50, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '01/02/2026', type: 'Venta', asset: 'SOL', assetType: 'Cripto', quantity: 10, unitPrice: 80, commission: 0, cartera: 'Crecimiento', comment: '' },
        ];
        const prices = { SOL: 80 };
        const holdings = buildPortfolio(txs, prices);
        const summary = getPortfolioSummary(holdings);

        expect(summary.holdingsCount).toBe(0);
        expect(summary.totalInvested).toBe(0);
        expect(summary.totalRealizedPnl).toBe(300); // but realized stays
    });
});

describe('getPortfolioHistory', () => {
    it('debería generar puntos de historia por fecha', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 1, unitPrice: 80000, commission: 0, cartera: 'Crecimiento', comment: '' },
            { id: '2', date: '15/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 0.5, unitPrice: 85000, commission: 0, cartera: 'Crecimiento', comment: '' },
        ];
        const prices = { BTC: 90000 };
        const history = getPortfolioHistory(txs, prices);

        expect(history).toHaveLength(2);
        expect(history[0].date).toBe('01/01/2026');
        expect(history[0].invested).toBe(80000);
        expect(history[0].value).toBe(90000); // 1 BTC * 90000
        expect(history[1].date).toBe('15/01/2026');
        expect(history[1].invested).toBe(122500); // 80000 + 42500
        expect(history[1].value).toBe(135000); // 1.5 BTC * 90000
    });

    it('debería devolver array vacío para transacciones vacías', () => {
        expect(getPortfolioHistory([], {})).toEqual([]);
    });
});

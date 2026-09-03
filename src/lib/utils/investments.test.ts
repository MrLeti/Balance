import { describe, it, expect } from 'vitest';
import {
    calculateAverageCost,
    buildPortfolio,
    getPortfolioSummary,
    getPortfolioHistory,
    parseSheetRow,
    transactionToRow,
    InvestmentTransaction,
} from './investments';

describe('calculateAverageCost', () => {
    it('debería calcular el promedio ponderado de una sola compra', () => {
        const buys: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 0.5, unitPrice: 80000, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
        ];
        expect(calculateAverageCost(buys)).toBe(80000);
    });

    it('debería calcular el promedio ponderado de múltiples compras', () => {
        const buys: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 10, unitPrice: 100, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'ARS' },
            { id: '2', date: '15/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 20, unitPrice: 130, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'ARS' },
        ];
        // (10*100 + 20*130) / 30 = 3600 / 30 = 120
        expect(calculateAverageCost(buys)).toBe(120);
    });

    it('debería devolver 0 para un array vacío', () => {
        expect(calculateAverageCost([])).toBe(0);
    });

    it('debería ignorar compras con cantidad 0', () => {
        const buys: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'ETH', assetType: 'Cripto', quantity: 0, unitPrice: 3000, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
            { id: '2', date: '02/01/2026', type: 'Compra', asset: 'ETH', assetType: 'Cripto', quantity: 2, unitPrice: 2500, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
        ];
        expect(calculateAverageCost(buys)).toBe(2500);
    });
});

describe('buildPortfolio', () => {
    it('debería construir holdings con una sola compra', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 0.5, unitPrice: 80000, commission: 100, cartera: 'Crecimiento', comment: '', currency: 'USD' },
        ];
        const prices = { BTC: 90000 };
        const holdings = buildPortfolio(txs, prices, 'USD');

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
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 10, unitPrice: 100, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'ARS' },
            { id: '2', date: '15/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 10, unitPrice: 200, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'ARS' },
        ];
        const prices = { AAPL: 180 };
        const holdings = buildPortfolio(txs, prices, 'ARS');

        expect(holdings[0].averageCost).toBe(150); // (10*100 + 10*200) / 20 = 150
        expect(holdings[0].totalQuantity).toBe(20);
        expect(holdings[0].totalInvested).toBe(3000);
        expect(holdings[0].currentValue).toBe(3600);
        expect(holdings[0].pnl).toBe(600);
    });

    it('debería calcular P&L realizado en ventas parciales', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'ETH', assetType: 'Cripto', quantity: 10, unitPrice: 2000, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
            { id: '2', date: '15/02/2026', type: 'Venta', asset: 'ETH', assetType: 'Cripto', quantity: 5, unitPrice: 3000, commission: 50, cartera: 'Crecimiento', comment: '', currency: 'USD' },
        ];
        const prices = { ETH: 3000 };
        const holdings = buildPortfolio(txs, prices, 'USD');

        expect(holdings[0].totalQuantity).toBe(5);
        expect(holdings[0].averageCost).toBe(2000);
        expect(holdings[0].totalInvested).toBe(10000);
        // Realized P&L: (3000*5 - 50) - (2000*5) = 14950 - 10000 = 4950
        expect(holdings[0].realizedPnl).toBe(4950);
    });

    it('debería manejar venta total (quantity = 0)', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'SOL', assetType: 'Cripto', quantity: 100, unitPrice: 50, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
            { id: '2', date: '01/03/2026', type: 'Venta', asset: 'SOL', assetType: 'Cripto', quantity: 100, unitPrice: 80, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
        ];
        const prices = { SOL: 80 };
        const holdings = buildPortfolio(txs, prices, 'USD');

        expect(holdings[0].totalQuantity).toBe(0);
        expect(holdings[0].totalInvested).toBe(0);
        expect(holdings[0].realizedPnl).toBe(3000); // (80*100) - (50*100) = 3000
    });
});

describe('Corporate Splits Handling', () => {
    it('debería multiplicar la cantidad y reducir el costo unitario en un split 10:1 manteniendo el capital invertido', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'NVDA', assetType: 'Cedears', quantity: 10, unitPrice: 1000, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
            { id: '2', date: '10/06/2026', type: 'Split', asset: 'NVDA', assetType: 'Cedears', quantity: 10, unitPrice: 0, commission: 0, cartera: 'Crecimiento', comment: 'Split 10:1', currency: 'USD' },
        ];
        const prices = { NVDA: 120 }; // Nuevo precio post-split
        const holdings = buildPortfolio(txs, prices, 'USD');

        expect(holdings).toHaveLength(1);
        expect(holdings[0].totalQuantity).toBe(100); // 10 * 10 = 100
        expect(holdings[0].averageCost).toBe(100); // 1000 / 10 = 100
        expect(holdings[0].totalInvested).toBe(10000); // Mantiene base de costo intacta
        expect(holdings[0].currentValue).toBe(12000); // 100 * 120 = 12000
        expect(holdings[0].pnl).toBe(2000); // 12000 - 10000 = 2000
    });

    it('debería manejar ventas posteriores a un split correctamente', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 10, unitPrice: 400, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
            { id: '2', date: '01/06/2026', type: 'Split', asset: 'AAPL', assetType: 'Cedears', quantity: 4, unitPrice: 0, commission: 0, cartera: 'Crecimiento', comment: 'Split 4:1', currency: 'USD' },
            { id: '3', date: '15/06/2026', type: 'Venta', asset: 'AAPL', assetType: 'Cedears', quantity: 20, unitPrice: 150, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
        ];
        const prices = { AAPL: 150 };
        const holdings = buildPortfolio(txs, prices, 'USD');

        expect(holdings[0].totalQuantity).toBe(20); // 40 - 20 = 20
        expect(holdings[0].averageCost).toBe(100); // 400 / 4 = 100
        expect(holdings[0].totalInvested).toBe(2000); // 20 * 100 = 2000
        // PnL realizado por 20 acciones vendidas a $150 (costo $100): 20 * 50 = $1000
        expect(holdings[0].realizedPnl).toBe(1000);
    });
});

describe('Multi-Currency Conversions (ARS / USD)', () => {
    it('debería calcular el valor en USD de una transacción realizada en ARS usando el tipo de cambio histórico', () => {
        const txs: InvestmentTransaction[] = [
            // Compra de 100 acciones a $1200 ARS cada una cuando el dólar estaba a $1200 → Costo $100 USD
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'GGAL', assetType: 'Acciones', quantity: 100, unitPrice: 1200, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'ARS', fxRate: 1200 },
        ];
        // En USD con precio actual $1.50 USD
        const pricesUSD = { GGAL: 1.5 };
        const holdingsUSD = buildPortfolio(txs, pricesUSD, 'USD', 1200);

        expect(holdingsUSD[0].averageCost).toBe(1); // $1200 ARS / 1200 FX = $1 USD por acción
        expect(holdingsUSD[0].totalInvested).toBe(100); // 100 * $1 = $100 USD
        expect(holdingsUSD[0].currentValue).toBe(150); // 100 * $1.50 = $150 USD
        expect(holdingsUSD[0].pnl).toBe(50);
    });

    it('debería calcular el valor en ARS de una transacción realizada en USD usando el tipo de cambio actual', () => {
        const txs: InvestmentTransaction[] = [
            // Compra de 1 BTC a $80000 USD
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 1, unitPrice: 80000, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
        ];
        // En ARS con CCL = $1250 y precio BTC = $112.500.000 ARS ($90000 USD)
        const pricesARS = { BTC: 112500000 };
        const holdingsARS = buildPortfolio(txs, pricesARS, 'ARS', 1250);

        expect(holdingsARS[0].averageCost).toBe(100000000); // $80000 USD * 1250 = $100.000.000 ARS
        expect(holdingsARS[0].totalInvested).toBe(100000000);
        expect(holdingsARS[0].currentValue).toBe(112500000);
        expect(holdingsARS[0].pnl).toBe(12500000);
    });
});

describe('getPortfolioSummary', () => {
    it('debería calcular el resumen total del portafolio con diversificación por moneda', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 1, unitPrice: 80000, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
            { id: '2', date: '01/01/2026', type: 'Compra', asset: 'AAPL', assetType: 'Cedears', quantity: 20, unitPrice: 100, commission: 0, cartera: 'Jubilación', comment: '', currency: 'USD' },
        ];
        const prices = { BTC: 90000, AAPL: 120 };
        const holdings = buildPortfolio(txs, prices, 'USD');
        const summary = getPortfolioSummary(holdings, txs, prices, 'USD');

        expect(summary.totalInvested).toBe(82000); // 80000 + 2000
        expect(summary.totalCurrentValue).toBe(92400); // 90000 + 2400
        expect(summary.totalPnl).toBe(10400);
        expect(summary.holdingsCount).toBe(2);
        expect(summary.diversification).toHaveLength(2);
        expect(summary.currencyDiversification).toBeDefined();
    });
});

describe('getPortfolioHistory', () => {
    it('debería generar puntos de historia por fecha', () => {
        const txs: InvestmentTransaction[] = [
            { id: '1', date: '01/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 1, unitPrice: 80000, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
            { id: '2', date: '15/01/2026', type: 'Compra', asset: 'BTC', assetType: 'Cripto', quantity: 0.5, unitPrice: 85000, commission: 0, cartera: 'Crecimiento', comment: '', currency: 'USD' },
        ];
        const prices = { BTC: 90000 };
        const history = getPortfolioHistory(txs, prices, 'USD');

        expect(history).toHaveLength(2);
        expect(history[0].date).toBe('01/01/2026');
        expect(history[0].invested).toBe(80000);
        expect(history[0].value).toBe(90000); // 1 BTC * 90000
        expect(history[1].date).toBe('15/01/2026');
        expect(history[1].invested).toBe(122500); // 80000 + 42500
        expect(history[1].value).toBe(135000); // 1.5 BTC * 90000
    });
});

describe('parseSheetRow — 12-column support & backwards compatibility', () => {
    it('debería parsear correctamente una fila de 12 columnas con moneda y tipo de cambio', () => {
        const row = ['uuid-1', '01/01/2026', 'Compra', 'BTC', 'Cripto', 1, 80000, 50, 'Crecimiento', 'Compra inicial', 'USD', 1250];
        const tx = parseSheetRow(row);

        expect(tx.id).toBe('uuid-1');
        expect(tx.date).toBe('01/01/2026');
        expect(tx.type).toBe('Compra');
        expect(tx.asset).toBe('BTC');
        expect(tx.assetType).toBe('Cripto');
        expect(tx.quantity).toBe(1);
        expect(tx.unitPrice).toBe(80000);
        expect(tx.commission).toBe(50);
        expect(tx.cartera).toBe('Crecimiento');
        expect(tx.comment).toBe('Compra inicial');
        expect(tx.currency).toBe('USD');
        expect(tx.fxRate).toBe(1250);
    });

    it('debería ser retrocompatible con filas históricas de 10 columnas asignando ARS por defecto', () => {
        const row = ['uuid-2', '15/05/2024', 'Compra', 'GGAL', 'Acciones', 100, 3500, 0, 'Jubilación', ''];
        const tx = parseSheetRow(row);

        expect(tx.currency).toBe('ARS');
        expect(tx.fxRate).toBeUndefined();
    });

    it('debería parsear operaciones de Split', () => {
        const row = ['uuid-3', '10/06/2024', 'Split', 'NVDA', 'Cedears', 10, 0, 0, 'Crecimiento', 'Split 10 a 1', 'USD', 1200];
        const tx = parseSheetRow(row);

        expect(tx.type).toBe('Split');
        expect(tx.quantity).toBe(10);
        expect(tx.unitPrice).toBe(0);
    });
});

describe('transactionToRow', () => {
    it('debería generar una fila con las 12 columnas correspondientes', () => {
        const tx: Omit<InvestmentTransaction, 'id'> = {
            date: '20/06/2026',
            type: 'Compra',
            asset: 'AAPL',
            assetType: 'Cedears',
            quantity: 50,
            unitPrice: 150,
            commission: 10,
            cartera: 'Crecimiento',
            comment: 'Aporte mensual',
            currency: 'USD',
            fxRate: 1300,
        };
        const row = transactionToRow(tx);

        expect(row).toEqual([
            '20/06/2026',
            'Compra',
            'AAPL',
            'Cedears',
            50,
            150,
            10,
            'Crecimiento',
            'Aporte mensual',
            'USD',
            1300,
        ]);
    });
});

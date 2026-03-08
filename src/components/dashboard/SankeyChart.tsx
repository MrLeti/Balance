"use client";

import React, { useMemo } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { Chart } from 'react-chartjs-2';
import { CATEGORY_COLORS } from '@/lib/constants';

ChartJS.register(...registerables, SankeyController, Flow);

export default function SankeyChart({ data, isDark }: { data: Exclude<any, null>[][], isDark: boolean }) {
    const sankeyData = useMemo(() => {
        let totalIngresos = 0;
        let totalEgresos = 0;

        // Estructuras para acumular valores en cada nivel
        const inSubCatAmts: Record<string, number> = {};
        const inCatAmts: Record<string, number> = {};
        const egCatAmts: Record<string, number> = {};
        const egSubCatAmts: Record<string, number> = {};

        // Para evitar nombres duplicados entre categorías y subcategorías que rompan el grafo,
        // les agregaremos un sufijo invisible (o explícito) en el ID.
        // ID -> Display Name
        const nodeLabels: Record<string, string> = {
            'Cash Flow': 'Cash Flow',
            'Sobrante': 'Ahorro / Sobrante'
        };

        const subCatToCatMap: Record<string, string> = {};

        const getNodeColor = (id: string) => {
            if (id === 'Cash Flow') return '#3b82f6'; // Azul
            if (id === 'Sobrante') return '#10b981'; // Verde brillante

            // Si el ID de nodo (que es IN_CAT_... o EG_CAT_...) contiene una categoría definida en constante
            // O si es una subcategoría, tomamos el color de su padre
            const colorKey = subCatToCatMap[id] || nodeLabels[id] || id;

            if (CATEGORY_COLORS[colorKey]) return CATEGORY_COLORS[colorKey];

            if (id.startsWith('IN_')) return '#22c55e'; // Verde claro ingresos genérico
            if (id.startsWith('EG_')) return '#ef4444'; // Rojo egresos genérico
            return '#9ca3af'; // Gris por defecto
        };

        data.forEach(row => {
            if (row.length < 6) return;
            const type = row[2];
            const catRaw = String(row[3] || "Sin Categoría");
            const subCatRaw = String(row[4] || "Sin Subcategoría");
            const val = parseFloat(String(row[5]).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

            if (val <= 0) return;

            if (type === "Ingreso") {
                totalIngresos += val;

                const subCatId = `IN_SUB_${subCatRaw}`;
                const catId = `IN_CAT_${catRaw}`;

                nodeLabels[subCatId] = subCatRaw;
                nodeLabels[catId] = catRaw;
                subCatToCatMap[subCatId] = catRaw;

                if (!inSubCatAmts[`${subCatId}|${catId}`]) inSubCatAmts[`${subCatId}|${catId}`] = 0;
                inSubCatAmts[`${subCatId}|${catId}`] += val;

                if (!inCatAmts[`${catId}|Cash Flow`]) inCatAmts[`${catId}|Cash Flow`] = 0;
                inCatAmts[`${catId}|Cash Flow`] += val;

            } else if (type === "Egreso") {
                totalEgresos += val;

                const catId = `EG_CAT_${catRaw}`;
                const subCatId = `EG_SUB_${subCatRaw}`;

                nodeLabels[catId] = catRaw;
                nodeLabels[subCatId] = subCatRaw;
                subCatToCatMap[subCatId] = catRaw;

                if (!egCatAmts[`Cash Flow|${catId}`]) egCatAmts[`Cash Flow|${catId}`] = 0;
                egCatAmts[`Cash Flow|${catId}`] += val;

                if (!egSubCatAmts[`${catId}|${subCatId}`]) egSubCatAmts[`${catId}|${subCatId}`] = 0;
                egSubCatAmts[`${catId}|${subCatId}`] += val;
            }
        });

        const flows: any[] = [];

        // 1. Ingreso Subcat -> Ingreso Cat
        Object.entries(inSubCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 2. Ingreso Cat -> Cash Flow
        Object.entries(inCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 3. Cash Flow -> Egreso Cat
        Object.entries(egCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 4. Egreso Cat -> Egreso Subcat
        Object.entries(egSubCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 5. Cash Flow -> Sobrante
        const surplus = totalIngresos - totalEgresos;
        if (surplus > 0) {
            flows.push({ from: 'Cash Flow', to: 'Sobrante', flow: surplus });
        } else if (surplus < 0) {
            // Manejo de deuda temporal/déficit para que el grafo cuadre.
            nodeLabels['Déficit'] = 'Déficit';
            flows.push({ from: 'Déficit', to: 'Cash Flow', flow: Math.abs(surplus) });
            // getNodeColor tratará Déficit como default gray
        }

        const chartData = {
            datasets: [{
                label: 'Cashflow',
                data: flows,
                colorFrom: (c: any) => getNodeColor(c.dataset.data[c.dataIndex].from),
                colorTo: (c: any) => getNodeColor(c.dataset.data[c.dataIndex].to),
                colorMode: 'gradient' as const,
                size: 'max' as const,
                borderWidth: 0,
                borderColor: 'transparent',
                labels: nodeLabels, // Chartjs-sankey usa esto para cambiar el ID interno por el texto de display!
                color: isDark ? '#ffffff' : '#0f172a', // Color intenso para alto contraste
                nodePadding: 45, // <== Separación vertical vital
                font: {
                    size: 13,
                    weight: 900
                } as any
            }]
        };

        return { chartData, nodeLabels };
    }, [data, isDark]);

    if (sankeyData.chartData.datasets[0].data.length === 0) {
        return <p className="text-muted text-center">No hay datos suficientes para el gráfico Cashflow.</p>;
    }

    return (
        <div style={{ position: 'relative', width: '100%', minHeight: '450px' }}>
            <Chart key={JSON.stringify(sankeyData.chartData.datasets[0].data)} type="sankey" data={sankeyData.chartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context: any) => {
                                const val = context.raw.flow;
                                const originalFrom = context.raw.from;
                                const originalTo = context.raw.to;
                                const fromLabel = sankeyData.nodeLabels[originalFrom] || originalFrom;
                                const toLabel = sankeyData.nodeLabels[originalTo] || originalTo;

                                const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
                                return `${fromLabel} → ${toLabel}: ${fmt}`;
                            }
                        }
                    }
                }
            }} />
        </div>
    );
}

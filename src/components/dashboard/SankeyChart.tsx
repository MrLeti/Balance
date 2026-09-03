"use client";

import React, { useMemo } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { Chart } from 'react-chartjs-2';
import { CATEGORY_COLORS } from '@/lib/constants';
import { parseSafeAmount } from '@/lib/utils/format';

/**
 * Patch SankeyController to dynamically center each column (especially Cash Flow in the middle)
 * vertically within the chart canvas so it never sticks to the top edge.
 */
if (typeof window !== 'undefined' && !(SankeyController.prototype as any)._isCenteredPatched) {
    (SankeyController.prototype as any)._isCenteredPatched = true;
    const originalParseObjectData = (SankeyController.prototype as any).parseObjectData;

    (SankeyController.prototype as any).parseObjectData = function(meta: any, data: any, start: any, count: any) {
        const parsed = originalParseObjectData.call(this, meta, data, start, count);
        const nodes = (this as any)._nodes;
        if (!nodes || nodes.size === 0) return parsed;

        const totalMaxY = (this as any)._maxY || 0;
        if (totalMaxY <= 0) return parsed;

        // 1. Calculate actual vertical bounds (minY, maxY) for each column
        const columnBounds = new Map<number, { minY: number; maxY: number }>();
        for (const node of nodes.values()) {
            const col = node.x;
            const nodeSize = node.size || Math.max(node.in || 0, node.out || 0);
            const nodeBottom = (node.y ?? 0) + nodeSize;
            if (!columnBounds.has(col)) {
                columnBounds.set(col, { minY: node.y ?? 0, maxY: nodeBottom });
            } else {
                const b = columnBounds.get(col)!;
                b.minY = Math.min(b.minY, node.y ?? 0);
                b.maxY = Math.max(b.maxY, nodeBottom);
            }
        }

        // 2. Find the largest column span
        let maxColumnSpan = 0;
        for (const b of columnBounds.values()) {
            maxColumnSpan = Math.max(maxColumnSpan, b.maxY - b.minY);
        }
        const targetHeight = Math.max(totalMaxY, maxColumnSpan);

        // 3. Compute vertical shift to center each column within targetHeight
        const colShift = new Map<number, number>();
        for (const [col, b] of columnBounds.entries()) {
            const colSpan = b.maxY - b.minY;
            const shift = (targetHeight - colSpan) / 2 - b.minY;
            colShift.set(col, shift);
        }

        // 4. Shift node rectangles & labels
        for (const node of nodes.values()) {
            const shift = colShift.get(node.x) || 0;
            node.y = (node.y ?? 0) + shift;
        }

        // 5. Shift flow connectors
        for (let i = 0; i < parsed.length; i++) {
            const p = parsed[i];
            if (p && p._custom) {
                const fromCol = p._custom.from?.x;
                const toCol = p._custom.to?.x;
                const fromShift = colShift.get(fromCol) || 0;
                const toShift = colShift.get(toCol) || 0;

                p.y = (p.y ?? 0) + fromShift;
                p._custom.y = (p._custom.y ?? 0) + toShift;
            }
        }

        (this as any)._maxY = targetHeight;
        return parsed;
    };
}

ChartJS.register(...registerables, SankeyController, Flow);

export default function SankeyChart({ data, isDark }: { data: Exclude<any, null>[][], isDark: boolean }) {
    const sankeyData = useMemo(() => {
        let totalIngresos = 0;
        let totalEgresos = 0;
        let totalInversiones = 0;
        let totalAportesAhorro = 0;
        let totalRetirosAhorro = 0;

        // Estructuras para acumular valores en cada nivel
        const inSubCatAmts: Record<string, number> = {};
        const inCatAmts: Record<string, number> = {};
        const egCatAmts: Record<string, number> = {};
        const egSubCatAmts: Record<string, number> = {};
        const invCatAmts: Record<string, number> = {};
        const invSubCatAmts: Record<string, number> = {};
        const ahCatAmts: Record<string, number> = {};
        const ahSubCatAmts: Record<string, number> = {};

        const nodeLabels: Record<string, string> = {
            'Cash Flow': 'Cash Flow',
            'Sobrante': 'Ahorro Libre / Sobrante'
        };

        const subCatToCatMap: Record<string, string> = {};

        const getNodeColor = (id: string) => {
            if (id === 'Cash Flow') return '#3b82f6'; // Azul
            if (id === 'Sobrante') return '#10b981'; // Verde brillante
            if (id === 'Déficit') return '#ef4444'; // Rojo

            const colorKey = subCatToCatMap[id] || nodeLabels[id] || id;

            if (CATEGORY_COLORS[colorKey]) return CATEGORY_COLORS[colorKey];

            if (id.startsWith('IN_')) return '#22c55e'; // Verde ingresos
            if (id.startsWith('AH_RET_')) return '#6366f1'; // Indigo retiros de ahorro
            if (id.startsWith('AH_')) return '#3b82f6'; // Azul aportes de ahorro
            if (id.startsWith('INV_')) return '#8b5cf6'; // Violeta inversiones
            if (id.startsWith('EG_')) return '#ef4444'; // Rojo egresos
            return '#9ca3af'; // Gris por defecto
        };

        data.forEach(row => {
            if (row.length < 6) return;
            const type = row[2];
            const catRaw = String(row[3] || "Sin Categoría");
            const subCatRaw = String(row[4] || "Sin Subcategoría");
            const val = parseSafeAmount(row[5]);

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

            } else if (type === "Inversión") {
                totalInversiones += val;

                const catId = `INV_CAT_${catRaw}`;
                const subCatId = `INV_SUB_${subCatRaw}`;

                nodeLabels[catId] = catRaw;
                nodeLabels[subCatId] = subCatRaw;
                subCatToCatMap[subCatId] = catRaw;

                if (!invCatAmts[`Cash Flow|${catId}`]) invCatAmts[`Cash Flow|${catId}`] = 0;
                invCatAmts[`Cash Flow|${catId}`] += val;

                if (!invSubCatAmts[`${catId}|${subCatId}`]) invSubCatAmts[`${catId}|${subCatId}`] = 0;
                invSubCatAmts[`${catId}|${subCatId}`] += val;

            } else if (type === "Ahorro") {
                if (catRaw === "Retiro") {
                    totalRetirosAhorro += val;

                    const subCatId = `AH_RET_SUB_${subCatRaw}`;
                    const catId = `AH_RET_CAT_Retiro`;

                    nodeLabels[subCatId] = subCatRaw;
                    nodeLabels[catId] = "Uso de Ahorros";
                    subCatToCatMap[subCatId] = "Retiro";

                    if (!inSubCatAmts[`${subCatId}|${catId}`]) inSubCatAmts[`${subCatId}|${catId}`] = 0;
                    inSubCatAmts[`${subCatId}|${catId}`] += val;

                    if (!inCatAmts[`${catId}|Cash Flow`]) inCatAmts[`${catId}|Cash Flow`] = 0;
                    inCatAmts[`${catId}|Cash Flow`] += val;
                } else {
                    // Aporte de Ahorro
                    totalAportesAhorro += val;

                    const catId = `AH_CAT_Ahorro`;
                    const subCatId = `AH_SUB_${subCatRaw}`;

                    nodeLabels[catId] = "Ahorros & Metas";
                    nodeLabels[subCatId] = subCatRaw;
                    subCatToCatMap[subCatId] = "Aporte";

                    if (!ahCatAmts[`Cash Flow|${catId}`]) ahCatAmts[`Cash Flow|${catId}`] = 0;
                    ahCatAmts[`Cash Flow|${catId}`] += val;

                    if (!ahSubCatAmts[`${catId}|${subCatId}`]) ahSubCatAmts[`${catId}|${subCatId}`] = 0;
                    ahSubCatAmts[`${catId}|${subCatId}`] += val;
                }
            }
        });

        const nodePriorities: Record<string, number> = {
            // Orígenes / Izquierda:
            'IN_CAT_Salario': 10,
            'IN_CAT_Extras': 20,
            'AH_RET_CAT_Retiro': 30,
            'Déficit': 9999, // Siempre al fondo en la parte inferior izquierda

            // Centro:
            'Cash Flow': 100,

            // Destinos / Derecha (Orden exacto solicitado):
            // 1. Arriba de todo: Ahorro Libre / Sobrante
            'Sobrante': 5,
            // 2. Luego: Ahorros & Metas
            'AH_CAT_Ahorro': 10,
            // 3. Luego: Activos Financieros / Inversiones
            'INV_CAT_Activos Financieros': 20,
            'INV_CAT_Inversión': 20,
            // 4. Luego: Habitacionales
            'EG_CAT_Habitacionales': 30,
            // 5. Luego el resto de egresos:
            'EG_CAT_Comunes': 40,
            'EG_CAT_Puntuales': 50,
            'EG_CAT_Ocio': 60,
        };

        // Asignar prioridades coherentes a cada subcategoría según su categoría padre
        Object.keys(nodeLabels).forEach(key => {
            if (nodePriorities[key] !== undefined) return;
            const parentCat = subCatToCatMap[key];
            if (parentCat) {
                if (key.startsWith('AH_SUB_')) nodePriorities[key] = 10;
                else if (key.startsWith('INV_SUB_')) nodePriorities[key] = 20;
                else if (parentCat === 'Habitacionales') nodePriorities[key] = 30;
                else if (parentCat === 'Comunes') nodePriorities[key] = 40;
                else if (parentCat === 'Puntuales') nodePriorities[key] = 50;
                else if (parentCat === 'Ocio') nodePriorities[key] = 60;
                else if (parentCat === 'Salario') nodePriorities[key] = 10;
                else if (parentCat === 'Extras') nodePriorities[key] = 20;
                else if (parentCat === 'Retiro') nodePriorities[key] = 30;
                else nodePriorities[key] = 70;
            }
        });

        // Asignar columnas determinísticas (0: In subcats, 1: In cats/Déficit, 2: Cash Flow, 3: Out cats/Sobrante, 4: Out subcats)
        const nodeColumns: Record<string, number> = {
            'Déficit': 1,
            'Cash Flow': 2,
            'Sobrante': 3,
        };

        Object.keys(nodeLabels).forEach(key => {
            if (nodeColumns[key] !== undefined) return;
            if (key.startsWith('IN_SUB_') || key.startsWith('AH_RET_SUB_')) {
                nodeColumns[key] = 0;
            } else if (key.startsWith('IN_CAT_') || key.startsWith('AH_RET_CAT_')) {
                nodeColumns[key] = 1;
            } else if (key.startsWith('AH_CAT_') || key.startsWith('INV_CAT_') || key.startsWith('EG_CAT_')) {
                nodeColumns[key] = 3;
            } else if (key.startsWith('AH_SUB_') || key.startsWith('INV_SUB_') || key.startsWith('EG_SUB_')) {
                nodeColumns[key] = 4;
            }
        });

        const flows: any[] = [];

        // 1. Ingreso / Retiro Ahorro Subcat -> Ingreso / Retiro Cat
        Object.entries(inSubCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 2. Ingreso / Retiro Cat -> Cash Flow
        Object.entries(inCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // Si hay Déficit, fluye desde la parte inferior izquierda a Cash Flow
        const totalEntradas = totalIngresos + totalRetirosAhorro;
        const totalSalidas = totalEgresos + totalInversiones + totalAportesAhorro;
        const surplus = totalEntradas - totalSalidas;

        if (surplus < 0) {
            nodeLabels['Déficit'] = 'Déficit';
            flows.push({ from: 'Déficit', to: 'Cash Flow', flow: Math.abs(surplus) });
        }

        // 3. Si hay Sobrante, fluye desde Cash Flow a Sobrante Libre (1° Arriba de todo en la columna de Categorías de Destino)
        if (surplus > 0) {
            flows.push({ from: 'Cash Flow', to: 'Sobrante', flow: surplus });
        }

        // 4. Cash Flow -> Ahorro Cat (2° Ahorros & Metas)
        Object.entries(ahCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 5. Ahorro Cat -> Ahorro Subcat
        Object.entries(ahSubCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 6. Cash Flow -> Inversión / Activos Financieros Cat (3° en la derecha)
        Object.entries(invCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 7. Inversión Cat -> Inversión Subcat
        Object.entries(invSubCatAmts).forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 8. Cash Flow -> Egreso Cat (4° Habitacionales, 5° Comunes, Puntuales, Ocio)
        const egCatOrder = ['EG_CAT_Habitacionales', 'EG_CAT_Comunes', 'EG_CAT_Puntuales', 'EG_CAT_Ocio'];
        const sortedEgCatEntries = Object.entries(egCatAmts).sort(([pathA], [pathB]) => {
            const catA = pathA.split('|')[1];
            const catB = pathB.split('|')[1];
            const idxA = egCatOrder.indexOf(catA);
            const idxB = egCatOrder.indexOf(catB);
            return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
        });

        sortedEgCatEntries.forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        // 9. Egreso Cat -> Egreso Subcat (ordenado por categoría)
        const sortedEgSubCatEntries = Object.entries(egSubCatAmts).sort(([pathA], [pathB]) => {
            const catA = pathA.split('|')[0];
            const catB = pathB.split('|')[0];
            const idxA = egCatOrder.indexOf(catA);
            const idxB = egCatOrder.indexOf(catB);
            return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
        });

        sortedEgSubCatEntries.forEach(([path, amount]) => {
            const [from, to] = path.split('|');
            flows.push({ from, to, flow: amount });
        });

        const chartData = {
            datasets: [{
                label: 'Cashflow',
                data: flows,
                priority: nodePriorities,
                column: nodeColumns,
                nodeAlign: 'center' as const,
                colorFrom: (c: any) => getNodeColor(c.dataset.data[c.dataIndex].from),
                colorTo: (c: any) => getNodeColor(c.dataset.data[c.dataIndex].to),
                colorMode: 'gradient' as const,
                size: 'max' as const,
                borderWidth: 0,
                borderColor: 'transparent',
                labels: nodeLabels,
                color: isDark ? '#ffffff' : '#0f172a',
                nodePadding: 35,
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
        <div style={{ position: 'relative', width: '100%', minHeight: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Chart 
                key={JSON.stringify(sankeyData.chartData.datasets[0].data)} 
                type="sankey" 
                data={sankeyData.chartData} 
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 20,
                            bottom: 20,
                            left: 10,
                            right: 10
                        }
                    },
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
                }} 
            />
        </div>
    );
}

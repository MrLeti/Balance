"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import styles from "./TransactionForm.module.css";
import type { AssetType, TransactionType, Cartera, Currency } from "@/lib/utils/investments";
import { ASSET_TYPES, CARTERAS, transactionToRow } from "@/lib/utils/investments";
import { parseArithmeticExpression } from "@/lib/utils/format";

// ─── Ticker catalogue ───────────────────────────────────────

const TICKER_LIST: { ticker: string; name: string; type: AssetType }[] = [
    // ── Cripto
    { ticker: "BTC",   name: "Bitcoin",            type: "Cripto" },
    { ticker: "ETH",   name: "Ethereum",           type: "Cripto" },
    { ticker: "SOL",   name: "Solana",             type: "Cripto" },
    { ticker: "BNB",   name: "BNB",                type: "Cripto" },
    { ticker: "XRP",   name: "XRP",                type: "Cripto" },
    { ticker: "ADA",   name: "Cardano",            type: "Cripto" },
    { ticker: "DOGE",  name: "Dogecoin",           type: "Cripto" },
    { ticker: "AVAX",  name: "Avalanche",          type: "Cripto" },
    { ticker: "MATIC", name: "Polygon",            type: "Cripto" },
    { ticker: "POL",   name: "Polygon (POL)",      type: "Cripto" },
    { ticker: "DOT",   name: "Polkadot",           type: "Cripto" },
    { ticker: "LINK",  name: "Chainlink",          type: "Cripto" },
    { ticker: "UNI",   name: "Uniswap",            type: "Cripto" },
    { ticker: "LTC",   name: "Litecoin",           type: "Cripto" },
    { ticker: "ATOM",  name: "Cosmos",             type: "Cripto" },
    { ticker: "SHIB",  name: "Shiba Inu",          type: "Cripto" },
    { ticker: "USDT",  name: "Tether (USD)",       type: "Cripto" },
    { ticker: "USDC",  name: "USD Coin",           type: "Cripto" },
    { ticker: "DAI",   name: "Dai Stablecoin",     type: "Cripto" },
    // ── Bonos y ONs
    { ticker: "AL30",  name: "Bono AL30 (Bonares 2030 ARS)", type: "Bonos" },
    { ticker: "AL30D", name: "Bono AL30D (Bonares 2030 USD)", type: "Bonos" },
    { ticker: "GD30",  name: "Bono GD30 (Globales 2030 ARS)", type: "Bonos" },
    { ticker: "GD30D", name: "Bono GD30D (Globales 2030 USD)", type: "Bonos" },
    { ticker: "YMCIO", name: "ON YPF 2026 USD",     type: "Bonos" },
    { ticker: "TLC1O", name: "ON Telecom 2026 USD", type: "Bonos" },
    { ticker: "MGC9O", name: "ON Pampa Energía 2026 USD", type: "Bonos" },
    // ── Acciones Locales (Merval)
    { ticker: "GGAL",  name: "Grupo Financiero Galicia", type: "Acciones" },
    { ticker: "YPFD",  name: "YPF S.A.",            type: "Acciones" },
    { ticker: "PAMP",  name: "Pampa Energía",       type: "Acciones" },
    { ticker: "ALUA",  name: "Aluar Aluminio",      type: "Acciones" },
    { ticker: "TXAR",  name: "Ternium Argentina",   type: "Acciones" },
    { ticker: "BMA",   name: "Banco Macro",         type: "Acciones" },
    { ticker: "VALO",  name: "Banco de Valores",    type: "Acciones" },
    { ticker: "CEPU",  name: "Central Puerto",      type: "Acciones" },
    { ticker: "CRES",  name: "Cresud",              type: "Acciones" },
    { ticker: "MIRG",  name: "Mirgor",              type: "Acciones" },
    { ticker: "TGSU2", name: "Transp. Gas del Sur", type: "Acciones" },
    { ticker: "TRAN",  name: "Transener",           type: "Acciones" },
    { ticker: "SUPV",  name: "Banco Supervielle",   type: "Acciones" },
    { ticker: "BBAR",  name: "BBVA Argentina",      type: "Acciones" },
    { ticker: "COME",  name: "Soc. Comercial Plata",type: "Acciones" },
    { ticker: "EDN",   name: "Edenor",              type: "Acciones" },
    { ticker: "LOMA",  name: "Loma Negra",          type: "Acciones" },
    // ── ETFs
    { ticker: "SPY",   name: "S&P 500 ETF",        type: "ETFs" },
    { ticker: "QQQ",   name: "Nasdaq 100 ETF",     type: "ETFs" },
    { ticker: "DIA",   name: "Dow Jones ETF",      type: "ETFs" },
    { ticker: "IWM",   name: "Russell 2000 ETF",   type: "ETFs" },
    { ticker: "EEM",   name: "Emerging Markets",   type: "ETFs" },
    { ticker: "EWZ",   name: "Brazil ETF",         type: "ETFs" },
    { ticker: "GLD",   name: "Gold ETF",           type: "ETFs" },
    { ticker: "SLV",   name: "Silver ETF",         type: "ETFs" },
    { ticker: "TLT",   name: "Treasury Bond ETF",  type: "ETFs" },
    { ticker: "XLE",   name: "Energy Sector ETF",  type: "ETFs" },
    { ticker: "XLF",   name: "Financial ETF",      type: "ETFs" },
    { ticker: "ARKK",  name: "ARK Innovation ETF", type: "ETFs" },
    { ticker: "HYG",   name: "High Yield ETF",     type: "ETFs" },
    // ── CEDEARs
    { ticker: "AAPL",  name: "Apple",              type: "Cedears" },
    { ticker: "MSFT",  name: "Microsoft",          type: "Cedears" },
    { ticker: "GOOGL", name: "Alphabet (Google)",  type: "Cedears" },
    { ticker: "AMZN",  name: "Amazon",             type: "Cedears" },
    { ticker: "META",  name: "Meta Platforms",     type: "Cedears" },
    { ticker: "TSLA",  name: "Tesla",              type: "Cedears" },
    { ticker: "NVDA",  name: "NVIDIA",             type: "Cedears" },
    { ticker: "NFLX",  name: "Netflix",            type: "Cedears" },
    { ticker: "AMD",   name: "AMD",                type: "Cedears" },
    { ticker: "INTC",  name: "Intel",              type: "Cedears" },
    { ticker: "DIS",   name: "Disney",             type: "Cedears" },
    { ticker: "KO",    name: "Coca-Cola",          type: "Cedears" },
    { ticker: "PEP",   name: "PepsiCo",            type: "Cedears" },
    { ticker: "JPM",   name: "JPMorgan Chase",     type: "Cedears" },
    { ticker: "GS",    name: "Goldman Sachs",      type: "Cedears" },
    { ticker: "V",     name: "Visa",               type: "Cedears" },
    { ticker: "MA",    name: "Mastercard",         type: "Cedears" },
    { ticker: "PYPL",  name: "PayPal",             type: "Cedears" },
    { ticker: "UBER",  name: "Uber",               type: "Cedears" },
    { ticker: "BA",    name: "Boeing",             type: "Cedears" },
    { ticker: "NKE",   name: "Nike",               type: "Cedears" },
    { ticker: "BABA",  name: "Alibaba",            type: "Cedears" },
    { ticker: "MELI",  name: "MercadoLibre",       type: "Cedears" },
    { ticker: "GLOB",  name: "Globant",            type: "Cedears" },
    { ticker: "DESP",  name: "Despegar",           type: "Cedears" },
    { ticker: "BIOX",  name: "Bioceres",           type: "Cedears" },
    { ticker: "NU",    name: "Nubank",             type: "Cedears" },
    { ticker: "SPOT",  name: "Spotify",            type: "Cedears" },
    { ticker: "CRM",   name: "Salesforce",         type: "Cedears" },
    { ticker: "ADBE",  name: "Adobe",              type: "Cedears" },
    { ticker: "QCOM",  name: "Qualcomm",           type: "Cedears" },
    { ticker: "ORCL",  name: "Oracle",             type: "Cedears" },
    { ticker: "IBM",   name: "IBM",                type: "Cedears" },
    { ticker: "PFE",   name: "Pfizer",             type: "Cedears" },
    { ticker: "ABBV",  name: "AbbVie",             type: "Cedears" },
    { ticker: "JNJ",   name: "Johnson & Johnson",  type: "Cedears" },
    { ticker: "XOM",   name: "ExxonMobil",         type: "Cedears" },
    { ticker: "CVX",   name: "Chevron",            type: "Cedears" },
    { ticker: "VALE",  name: "Vale",               type: "Cedears" },
    { ticker: "PBR",   name: "Petrobras",          type: "Cedears" },
    { ticker: "GOLD",  name: "Barrick Gold",       type: "Cedears" },
    { ticker: "WMT",   name: "Walmart",            type: "Cedears" },
    { ticker: "MCD",   name: "McDonald's",         type: "Cedears" },
    { ticker: "SBUX",  name: "Starbucks",          type: "Cedears" },
    { ticker: "HD",    name: "Home Depot",         type: "Cedears" },
    { ticker: "CAT",   name: "Caterpillar",        type: "Cedears" },
    { ticker: "F",     name: "Ford",               type: "Cedears" },
    { ticker: "GM",    name: "General Motors",     type: "Cedears" },
    { ticker: "T",     name: "AT&T",               type: "Cedears" },
    { ticker: "VZ",    name: "Verizon",            type: "Cedears" },
    { ticker: "CSCO",  name: "Cisco",              type: "Cedears" },
];

interface TransactionFormProps {
    onTransactionAdded: () => void;
    onCancel?: () => void;
}

const todayStr = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

export default function TransactionForm({ onTransactionAdded, onCancel }: TransactionFormProps) {
    const [type, setType] = useState<TransactionType>("Compra");
    const [currency, setCurrency] = useState<Currency>("ARS");
    const [fxRate, setFxRate] = useState<string>("");
    const [asset, setAsset] = useState("");
    const [assetType, setAssetType] = useState<AssetType>("Acciones");
    const [quantity, setQuantity] = useState("");
    const [unitPrice, setUnitPrice] = useState("");
    const [commission, setCommission] = useState("");
    const [cartera, setCartera] = useState<Cartera>("Crecimiento");
    const [date, setDate] = useState(todayStr());
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Autocomplete state
    const [suggestions, setSuggestions] = useState<typeof TICKER_LIST>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const suggestionsRef = useRef<HTMLUListElement>(null);

    // Fetch dollar rate for a specific date (defaults to today's MEP)
    const fetchFxRateForDate = useCallback(async (dateStr: string) => {
        try {
            const res = await fetch(`/api/investments/fx-rate?date=${encodeURIComponent(dateStr.trim())}`);
            if (res.ok) {
                const data = await res.json();
                if (data.fxRate && data.fxRate > 0) {
                    setFxRate(String(data.fxRate));
                }
            }
        } catch {
            // Non-blocking
        }
    }, []);

    // Initial dollar rate fetch
    useEffect(() => {
        fetchFxRateForDate(date);
    }, [fetchFxRateForDate]);

    const handleDateChange = (newDate: string) => {
        setDate(newDate);
        if (newDate.trim().length >= 8) {
            fetchFxRateForDate(newDate);
        }
    };

    const isSplit = type === "Split";

    const parsedComm = parseArithmeticExpression(commission);
    const parsedQty = parseFloat(quantity) || 0;
    const parsedPrice = parseFloat(unitPrice) || 0;

    // Al vender, las comisiones restan al total neto recibido
    const total = isSplit
        ? 0
        : type === "Compra"
            ? (parsedQty * parsedPrice) + parsedComm
            : Math.max(0, (parsedQty * parsedPrice) - parsedComm);

    const isValid = useMemo(() => {
        const q = parseFloat(quantity.replace(/,/g, ".")) || 0;
        const p = parseFloat(unitPrice.replace(/,/g, ".")) || 0;
        if (!asset.trim() || !date.trim() || q <= 0) return false;
        if (isSplit) return true;
        return p > 0;
    }, [asset, date, quantity, unitPrice, isSplit]);

    /* ─── Autocomplete Logic ─── */
    const getSuggestions = useCallback((value: string) => {
        if (!value || value.length < 1) return [];
        const q = value.toUpperCase();
        return TICKER_LIST.filter(
            t =>
                t.ticker.startsWith(q) ||
                t.name.toUpperCase().includes(q)
        ).slice(0, 8);
    }, []);

    const handleAssetChange = (value: string) => {
        setAsset(value);
        setHighlightedIndex(-1);
        const matches = getSuggestions(value);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    };

    const selectSuggestion = async (s: typeof TICKER_LIST[number]) => {
        setAsset(s.ticker);
        setAssetType(s.type);
        setSuggestions([]);
        setShowSuggestions(false);
        setHighlightedIndex(-1);

        // Automatically preselect USD for Cripto
        if (s.type === "Cripto") {
            setCurrency("USD");
        }

        // Try suggesting live price if unitPrice is empty
        if (!isSplit) {
            try {
                const targetCurrency = s.type === "Cripto" ? "USD" : currency;
                const res = await fetch(`/api/investments/prices?assets=${s.ticker}&types=${s.type}&currencies=${targetCurrency}`);
                if (res.ok) {
                    const data = await res.json();
                    const p = data.prices?.[s.ticker];
                    if (p) {
                        const targetPrice = (s.type === "Cripto" || currency === "USD") ? p.usd : p.ars;
                        if (targetPrice > 0 && !unitPrice) {
                            setUnitPrice(String(targetPrice));
                        }
                    }
                }
            } catch {
                // Non-blocking
            }
        }

    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || suggestions.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex(i => Math.max(i - 1, -1));
        } else if (e.key === "Enter" && highlightedIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[highlightedIndex]);
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
        }
    };

    /* ─── Submit ─── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || saving) return;
        setError(null);
        setSaving(true);

        try {
            const evaluatedCommission = isSplit ? 0 : parseArithmeticExpression(commission);
            const parsedQty = parseFloat(quantity.replace(/,/g, ".")) || 0;
            const parsedPrice = isSplit ? 0 : (parseFloat(unitPrice.replace(/,/g, ".")) || 0);

            const row = transactionToRow({
                date,
                type,
                asset: asset.toUpperCase().trim(),
                assetType,
                quantity: parsedQty,
                unitPrice: parsedPrice,
                commission: evaluatedCommission,
                cartera,
                comment: comment.trim(),
                currency,
                fxRate: parseFloat(fxRate) || undefined,
            });

            const res = await fetch("/api/investments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: [row] }),
            });

            const resData = await res.json().catch(() => ({}));
            if (!res.ok || !resData.success) {
                throw new Error(resData.error || "Error al registrar la inversión.");
            }

            // Reflejar impacto de liquidez en el Balance (Pesos ARS al Dólar MEP)
            if (!isSplit) {
                const rawQty = parsedQty;
                const rawPrice = parsedPrice;
                const rawComm = evaluatedCommission;
                const effectiveRate = parseFloat(fxRate) || 1;
                const totalARS = currency === "USD"
                    ? Math.round((rawQty * rawPrice + rawComm) * effectiveRate * 100) / 100
                    : Math.round((rawQty * rawPrice + rawComm) * 100) / 100;

                const investmentId = resData.ids?.[0] || "";
                if (totalARS > 0) {
                    const trxRow = [
                        date,
                        "Inversión",
                        "Activos Financieros",
                        assetType,
                        totalARS,
                        `${type === "Venta" ? "[Venta/Rescate] " : ""}${rawQty} ${asset.toUpperCase()} (${currency}${currency === "USD" ? ` @ MEP $${effectiveRate}` : ""}) ${comment.trim()}`,
                        "",
                        investmentId
                    ];

                    let cashflowSynced = true;
                    try {
                        const txRes = await fetch("/api/transactions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ items: [trxRow] }),
                        });
                        if (!txRes.ok) cashflowSynced = false;
                    } catch (syncErr) {
                        console.warn("Fallo sincronización con transacciones:", syncErr);
                        cashflowSynced = false;
                    }

                    if (!cashflowSynced) {
                        setError("La inversión fue guardada, pero ocurrió un problema de conexión al registrar el impacto en el balance de caja. Podés registrar el movimiento manualmente si lo deseás.");
                    } else {
                        window.dispatchEvent(new Event("transaction_added"));
                    }
                }
            }

            if (resData.sheetsSynced === false) {
                window.dispatchEvent(new CustomEvent("sheets_sync_failed", {
                    detail: {
                        type: "investments",
                        items: resData.rawItemsForSheets || [row],
                        error: resData.sheetsError
                    }
                }));
            }

            // Reset form
            setAsset("");
            setQuantity("");
            setUnitPrice("");
            setCommission("");
            setComment("");
            setDate(todayStr());
            onTransactionAdded();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error al guardar la operación.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit} id="investment-form">
            {/* Top Controls: Type toggle & Currency selector */}
            <div className={styles.topControls}>
                <div className={styles.typeToggle}>
                    <button
                        type="button"
                        className={`${styles.typeBtn} ${type === "Compra" ? styles.typeBtnActiveBuy : ""}`}
                        onClick={() => setType("Compra")}
                    >
                        ▲ Compra
                    </button>
                    <button
                        type="button"
                        className={`${styles.typeBtn} ${type === "Venta" ? styles.typeBtnActiveSell : ""}`}
                        onClick={() => setType("Venta")}
                    >
                        ▼ Venta
                    </button>
                    <button
                        type="button"
                        className={`${styles.typeBtn} ${type === "Split" ? styles.typeBtnActiveSplit : ""}`}
                        onClick={() => setType("Split")}
                    >
                        ➗ Split
                    </button>
                </div>

                {!isSplit && (
                    <div className={styles.currencyToggle}>
                        <button
                            type="button"
                            className={`${styles.currencyBtn} ${currency === "ARS" ? styles.currencyBtnActive : ""}`}
                            onClick={() => setCurrency("ARS")}
                        >
                            🇦🇷 ARS
                        </button>
                        <button
                            type="button"
                            className={`${styles.currencyBtn} ${currency === "USD" ? styles.currencyBtnActive : ""}`}
                            onClick={() => setCurrency("USD")}
                        >
                            🇺🇸 USD
                        </button>
                    </div>
                )}
            </div>

            <div className={styles.fieldsGrid}>
                {/* Asset ticker with autocomplete */}
                <div className={styles.field} ref={containerRef}>
                    <label className={styles.label} htmlFor="inv-asset">Activo (Ticker)</label>
                    <div className={styles.autocompleteWrapper}>
                        <input
                            id="inv-asset"
                            type="text"
                            autoComplete="off"
                            className={styles.input}
                            placeholder="BTC, AAPL, SPY, AL30..."
                            value={asset}
                            onChange={e => handleAssetChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                            onFocus={() => {
                                if (suggestions.length > 0) setShowSuggestions(true);
                            }}
                            required
                        />
                        {showSuggestions && (
                            <ul
                                className={styles.dropdown}
                                ref={suggestionsRef}
                                role="listbox"
                                id="inv-asset-suggestions"
                            >
                                {suggestions.map((s, idx) => (
                                    <li
                                        key={s.ticker}
                                        role="option"
                                        aria-selected={idx === highlightedIndex}
                                        className={`${styles.dropdownItem} ${idx === highlightedIndex ? styles.dropdownItemHighlighted : ""}`}
                                        onMouseDown={() => selectSuggestion(s)}
                                    >
                                        <span className={styles.dropdownTicker}>{s.ticker}</span>
                                        <span className={styles.dropdownName}>{s.name}</span>
                                        <span className={`${styles.dropdownType} ${styles[`dropdownType${s.type}`] || ""}`}>
                                            {s.type}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Asset type */}
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="inv-asset-type">Tipo de Activo</label>
                    <select
                        id="inv-asset-type"
                        className={styles.input}
                        value={assetType}
                        onChange={e => setAssetType(e.target.value as AssetType)}
                    >
                        {ASSET_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {/* Quantity */}
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="inv-quantity">
                        {isSplit ? "Factor de Split (ej. 10 para 10 a 1)" : "Cantidad"}
                    </label>
                    <input
                        id="inv-quantity"
                        type="number"
                        step="any"
                        min="0"
                        className={styles.input}
                        placeholder={isSplit ? "10" : "0.00"}
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        required
                    />
                </div>

                {/* Unit price */}
                {!isSplit && (
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="inv-unit-price">Precio Unit. ({currency})</label>
                        <input
                            id="inv-unit-price"
                            type="number"
                            step="any"
                            min="0"
                            className={styles.input}
                            placeholder="0.00"
                            value={unitPrice}
                            onChange={e => setUnitPrice(e.target.value)}
                            required
                        />
                    </div>
                )}

                {/* Commission */}
                {!isSplit && (
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="inv-commission">Comisión ({currency})</label>
                        <input
                            id="inv-commission"
                            type="text"
                            className={styles.input}
                            placeholder="0.00 o ej. 123.5+156.25"
                            value={commission}
                            onChange={e => setCommission(e.target.value)}
                        />
                    </div>
                )}

                {/* FX Rate */}
                {!isSplit && (
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="inv-fx-rate">Dólar MEP ($)</label>
                        <input
                            id="inv-fx-rate"
                            type="number"
                            step="any"
                            min="0"
                            className={styles.input}
                            placeholder="1280.00"
                            value={fxRate}
                            onChange={e => setFxRate(e.target.value)}
                            title="Cotización del dólar MEP para calcular la rentabilidad dual"
                        />
                    </div>
                )}

                {/* Date */}
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="inv-date">Fecha</label>
                    <input
                        id="inv-date"
                        type="text"
                        className={styles.input}
                        placeholder="DD/MM/YYYY"
                        value={date}
                        onChange={e => handleDateChange(e.target.value)}
                        required
                    />
                </div>

            </div>

            {/* Cartera selector + Comentario */}
            <div className={styles.bottomRow}>
                <div className={styles.field}>
                    <label className={styles.label}>Cartera</label>
                    <div className={styles.carteraToggle}>
                        {CARTERAS.map(c => (
                            <button
                                key={c}
                                type="button"
                                className={`${styles.carteraBtn} ${cartera === c ? styles.carteraBtnActive : ""}`}
                                onClick={() => setCartera(c)}
                            >
                                {c === "Jubilación" ? "🏦 Jubilación" : "🚀 Crecimiento"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`${styles.field} ${styles.fieldGrow}`}>
                    <label className={styles.label} htmlFor="inv-comment">Comentario (opcional)</label>
                    <input
                        id="inv-comment"
                        type="text"
                        className={styles.input}
                        placeholder={isSplit ? "Ej: Split 10:1 anunciado por la empresa..." : "Nota adicional..."}
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />
                </div>
            </div>

            {/* Total preview */}
            {!isSplit ? (
                <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>
                        Total {type === "Compra" ? "a invertir" : "a recibir"} ({currency}):
                    </span>
                    <span className={`${styles.totalValue} ${type === "Venta" ? styles.totalSell : ""}`}>
                        {currency === "USD" ? "USD $" : "$"}{total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            ) : (
                <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>
                        Operación corporativa:
                    </span>
                    <span className={styles.totalValue} style={{ color: "#9333ea" }}>
                        Ajuste de títulos (sin flujo de dinero)
                    </span>
                </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actionsRow}>
                {onCancel && (
                    <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={onCancel}
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={!isValid || saving}
                    id="inv-submit-btn"
                >
                    {saving ? "Guardando..." : isSplit ? "Registrar Split" : `Registrar ${type}`}
                </button>
            </div>
        </form>
    );
}


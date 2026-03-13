"use client";

import { useState, useRef, useCallback } from "react";
import styles from "./TransactionForm.module.css";
import type { AssetType, TransactionType, Cartera } from "@/lib/utils/investments";
import { ASSET_TYPES, CARTERAS, transactionToRow } from "@/lib/utils/investments";

// ─── Ticker catalogue ───────────────────────────────────────
// Combined list of Acciones, ETFs, CEDEARs and Crypto tickers
// with their display names for autocomplete.
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
    { ticker: "DOT",   name: "Polkadot",           type: "Cripto" },
    { ticker: "LINK",  name: "Chainlink",          type: "Cripto" },
    { ticker: "UNI",   name: "Uniswap",            type: "Cripto" },
    { ticker: "LTC",   name: "Litecoin",           type: "Cripto" },
    { ticker: "ATOM",  name: "Cosmos",             type: "Cripto" },
    { ticker: "SHIB",  name: "Shiba Inu",          type: "Cripto" },
    { ticker: "USDT",  name: "Tether",             type: "Cripto" },
    { ticker: "USDC",  name: "USD Coin",           type: "Cripto" },
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
    // ── CEDEARs / Acciones
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
}

const todayStr = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

export default function TransactionForm({ onTransactionAdded }: TransactionFormProps) {
    const [type, setType] = useState<TransactionType>("Compra");
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

    const total = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0) + (parseFloat(commission) || 0);

    const isValid =
        asset.trim().length > 0 &&
        (parseFloat(quantity) || 0) > 0 &&
        (parseFloat(unitPrice) || 0) > 0 &&
        date.trim().length > 0;

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

    const selectSuggestion = (s: typeof TICKER_LIST[number]) => {
        setAsset(s.ticker);
        setAssetType(s.type);
        setSuggestions([]);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
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
            const row = transactionToRow({
                date,
                type,
                asset: asset.toUpperCase().trim(),
                assetType,
                quantity: parseFloat(quantity),
                unitPrice: parseFloat(unitPrice),
                commission: parseFloat(commission) || 0,
                cartera,
                comment: comment.trim(),
            });

            const res = await fetch("/api/investments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: [row] }),
            });

            if (!res.ok) throw new Error("Error al guardar");

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
            {/* Type toggle */}
            <div className={styles.typeToggle}>
                <button
                    type="button"
                    className={`${styles.typeBtn} ${type === "Compra" ? styles.typeBtnActiveBuy : ""}`}
                    onClick={() => setType("Compra")}
                >
                    Compra
                </button>
                <button
                    type="button"
                    className={`${styles.typeBtn} ${type === "Venta" ? styles.typeBtnActiveSell : ""}`}
                    onClick={() => setType("Venta")}
                >
                    Venta
                </button>
            </div>

            <div className={styles.fieldsGrid}>
                {/* Asset ticker with autocomplete */}
                <div className={styles.field} ref={containerRef}>
                    <label className={styles.label}>Activo (Ticker)</label>
                    <div className={styles.autocompleteWrapper}>
                        <input
                            id="inv-asset"
                            type="text"
                            autoComplete="off"
                            className={styles.input}
                            placeholder="BTC, AAPL, SPY..."
                            value={asset}
                            onChange={e => handleAssetChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() =>
                                // Delay to allow click on suggestion
                                setTimeout(() => setShowSuggestions(false), 150)
                            }
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
                                        <span className={`${styles.dropdownType} ${styles[`dropdownType${s.type}`]}`}>
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
                    <label className={styles.label}>Tipo de Activo</label>
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
                    <label className={styles.label}>Cantidad</label>
                    <input
                        id="inv-quantity"
                        type="number"
                        step="any"
                        min="0"
                        className={styles.input}
                        placeholder="0.00"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        required
                    />
                </div>

                {/* Unit price */}
                <div className={styles.field}>
                    <label className={styles.label}>Precio Unit. (ARS)</label>
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

                {/* Commission */}
                <div className={styles.field}>
                    <label className={styles.label}>Comisión (ARS)</label>
                    <input
                        id="inv-commission"
                        type="number"
                        step="any"
                        min="0"
                        className={styles.input}
                        placeholder="0.00"
                        value={commission}
                        onChange={e => setCommission(e.target.value)}
                    />
                </div>

                {/* Date */}
                <div className={styles.field}>
                    <label className={styles.label}>Fecha</label>
                    <input
                        id="inv-date"
                        type="text"
                        className={styles.input}
                        placeholder="DD/MM/YYYY"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        required
                    />
                </div>
            </div>

            {/* Cartera selector + Comentario on same row */}
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
                    <label className={styles.label}>Comentario (opcional)</label>
                    <input
                        id="inv-comment"
                        type="text"
                        className={styles.input}
                        placeholder="Nota adicional..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />
                </div>
            </div>

            {/* Total preview */}
            <div className={styles.totalRow}>
                <span className={styles.totalLabel}>
                    Total {type === "Compra" ? "a invertir" : "a recibir"}:
                </span>
                <span className={`${styles.totalValue} ${type === "Venta" ? styles.totalSell : ""}`}>
                    ${total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
                type="submit"
                className={styles.submitBtn}
                disabled={!isValid || saving}
                id="inv-submit-btn"
            >
                {saving ? "Guardando..." : `Registrar ${type}`}
            </button>
        </form>
    );
}

import { describe, it, expect } from "vitest";
import { parseSafeAmount, parseArithmeticExpression, roundMoney, isValidAmount, formatAutoDateInput } from "./format";


describe("parseSafeAmount", () => {
    it("handles native JS numbers correctly", () => {
        expect(parseSafeAmount(1234.56)).toBe(1234.56);
        expect(parseSafeAmount(1234)).toBe(1234);
        expect(parseSafeAmount(0)).toBe(0);
        expect(parseSafeAmount(-50.25)).toBe(-50.25);
    });

    it("handles JS decimal string format (1234.56)", () => {
        expect(parseSafeAmount("1234.56")).toBe(1234.56);
        expect(parseSafeAmount("1234")).toBe(1234);
        expect(parseSafeAmount("50.5")).toBe(50.5);
    });

    it("handles Argentine format with comma decimal (1234,56)", () => {
        expect(parseSafeAmount("1234,56")).toBe(1234.56);
        expect(parseSafeAmount("15000,5")).toBe(15000.5);
    });

    it("handles Argentine format with thousands and decimals (1.234,56)", () => {
        expect(parseSafeAmount("1.234,56")).toBe(1234.56);
        expect(parseSafeAmount("1.234.567,89")).toBe(1234567.89);
        expect(parseSafeAmount("$ 1.234,56")).toBe(1234.56);
    });

    it("handles negative numbers and currencies", () => {
        expect(parseSafeAmount("-1234,56")).toBe(-1234.56);
        expect(parseSafeAmount("-$ 1.234,56")).toBe(-1234.56);
        expect(parseSafeAmount("-$1234.56")).toBe(-1234.56);
    });

    it("handles null, undefined, empty values", () => {
        expect(parseSafeAmount(null)).toBe(0);
        expect(parseSafeAmount(undefined)).toBe(0);
        expect(parseSafeAmount("")).toBe(0);
    });
});

describe("parseArithmeticExpression", () => {
    it("evaluates simple addition", () => {
        expect(parseArithmeticExpression("123.5+156.25")).toBe(279.75);
        expect(parseArithmeticExpression("100 + 50")).toBe(150);
        expect(parseArithmeticExpression("100,5 + 50,25")).toBe(150.75);
    });

    it("evaluates subtraction and combined operations", () => {
        expect(parseArithmeticExpression("200 - 50.5")).toBe(149.5);
        expect(parseArithmeticExpression("100 + 50 - 25.25")).toBe(124.75);
        expect(parseArithmeticExpression("10 * 5 + 2")).toBe(52);
    });

    it("handles standard single values without operators", () => {
        expect(parseArithmeticExpression("1234.56")).toBe(1234.56);
        expect(parseArithmeticExpression("1234,56")).toBe(1234.56);
        expect(parseArithmeticExpression(500)).toBe(500);
        expect(parseArithmeticExpression("")).toBe(0);
        expect(parseArithmeticExpression(null)).toBe(0);
    });

    it("safely handles trailing operators while typing", () => {
        expect(parseArithmeticExpression("100+")).toBe(100);
        expect(parseArithmeticExpression("150-")).toBe(150);
    });
});

describe("formatAutoDateInput", () => {
    it("auto-advances day by appending / after 2 digits", () => {
        expect(formatAutoDateInput("2")).toBe("2");
        expect(formatAutoDateInput("25")).toBe("25/");
    });

    it("auto-advances month by appending / after 4 digits", () => {
        expect(formatAutoDateInput("2508")).toBe("25/08/");
        expect(formatAutoDateInput("25/08")).toBe("25/08/");
    });

    it("formats full date with year", () => {
        expect(formatAutoDateInput("25082026")).toBe("25/08/2026");
        expect(formatAutoDateInput("25/08/2026")).toBe("25/08/2026");
    });

    it("allows backspacing gracefully", () => {
        expect(formatAutoDateInput("25/", "25/0")).toBe("25");
        expect(formatAutoDateInput("25", "25/")).toBe("25");
    });

    it("works when field already has a date and user selects/types new values", () => {
        // Field has 20/08/2026, user selects all and types 15 -> should auto-add slash
        expect(formatAutoDateInput("15", "20/08/2026")).toBe("15/");
        // User selects all and types 1509 -> should format to 15/09/
        expect(formatAutoDateInput("1509", "20/08/2026")).toBe("15/09/");
        // User replaces day segment (25/08/2026)
        expect(formatAutoDateInput("25/08/2026", "20/08/2026")).toBe("25/08/2026");
    });
});

describe("roundMoney", () => {
    it("fixes IEEE-754 floating point arithmetic drift", () => {
        expect(0.1 + 0.2).not.toBe(0.3); // Demuestra imprecisión nativa de punto flotante en JS
        expect(roundMoney(0.1 + 0.2)).toBe(0.3);
        expect(roundMoney(1.005)).toBe(1.01);
        expect(roundMoney(1234.567)).toBe(1234.57);
        expect(roundMoney(-1234.567)).toBe(-1234.57);
        expect(roundMoney(-0.30000000000000004)).toBe(-0.3);
    });

    it("handles zero and invalid inputs safely", () => {
        expect(roundMoney(0)).toBe(0);
        expect(roundMoney(NaN)).toBe(0);
        expect(roundMoney(Infinity)).toBe(0);
    });
});

describe("isValidAmount", () => {
    it("validates positive fiat amounts by default", () => {
        expect(isValidAmount(100)).toBe(true);
        expect(isValidAmount("1.234,56")).toBe(true);
        expect(isValidAmount(0.01)).toBe(true);
        expect(isValidAmount(0)).toBe(false);
        expect(isValidAmount(-50)).toBe(false);
        expect(isValidAmount(NaN)).toBe(false);
        expect(isValidAmount(null)).toBe(false);
        expect(isValidAmount("")).toBe(false);
    });

    it("allows negative amounts when allowNegative is true (for discounts and withdrawals)", () => {
        expect(isValidAmount(-150.5, true)).toBe(true);
        expect(isValidAmount("-500", true)).toBe(true);
        expect(isValidAmount(0, true)).toBe(false);
    });
});




"use client";

import { useEffect, useState } from "react";
import styles from "./Navbar.module.css";

export default function ThemeToggle() {
    const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

    useEffect(() => {
        // Initialize from local storage or check system preference
        const stored = localStorage.getItem("theme");
        if (stored === "light" || stored === "dark") {
            setTheme(stored);
            document.documentElement.setAttribute("data-theme", stored);
        } else {
            // Check system preference to initialize the icon correctly
            const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            if (isDark) {
                document.documentElement.removeAttribute("data-theme"); // Use default CSS media queries
            }
        }
    }, []);

    const toggleTheme = () => {
        const nextTheme = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "light" : "dark";
        setTheme(nextTheme);
        document.documentElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem("theme", nextTheme);
    };

    return (
        <button className={styles.themeBtn} onClick={toggleTheme} title="Cambiar Tema">
            {theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "☀️" : "🌙"}
        </button>
    );
}

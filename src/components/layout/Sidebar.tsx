"use client";

import React, { useState, useEffect } from "react";
import styles from "./Sidebar.module.css";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { User } from "@supabase/supabase-js";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUser(data.user);
            setLoading(false);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const navItems = [
        { label: "Balance", href: "/", icon: "📊" },
        { label: "Cuotas", href: "/cuotas", icon: "💳" },
        { label: "Inversiones", href: "/inversiones", icon: "📈" },
        { label: "Ahorros", href: "/ahorros", icon: "🎯" },
        { label: "Ajustes", href: "/ajustes", icon: "⚙️" },
    ];

    return (
        <>
            {/* ─── Desktop / Tablet Left Sidebar ─── */}
            <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
                {/* Brand / Logo Header */}
                <div className={styles.brand}>
                    <Link href="/" className={styles.brandLink}>
                        <div className={styles.logoIcon}>
                            <Image
                                src="/icon-192x192.png"
                                unoptimized
                                alt="Vesta Logo"
                                width={32}
                                height={32}
                                style={{ borderRadius: "50%" }}
                                priority
                            />
                        </div>
                        {!isCollapsed && (
                            <div className={styles.brandText}>
                                <h1 className={styles.brandTitle}>Vesta</h1>
                                <span className={styles.brandSubtitle}>Finanzas</span>
                            </div>
                        )}
                    </Link>

                    <button
                        type="button"
                        className={styles.collapseToggle}
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Expandir barra" : "Colapsar barra"}
                        aria-label="Toggle sidebar"
                    >
                        {isCollapsed ? "❯" : "❮"}
                    </button>
                </div>

                {/* Navigation Items */}
                <nav className={styles.navMenu}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                                title={isCollapsed ? item.label : undefined}
                            >
                                <span className={styles.itemIcon}>{item.icon}</span>
                                {!isCollapsed && (
                                    <span className={styles.itemLabel}>{item.label}</span>
                                )}
                                {isActive && <div className={styles.activeIndicator} />}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer: User Profile, Theme & Logout */}
                <div className={styles.footer}>
                    <div className={styles.footerRow}>
                        <ThemeToggle />
                    </div>

                    {loading ? (
                        <div className={styles.skeletonUser} />
                    ) : user ? (
                        <div className={styles.userProfile}>
                            {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                                <Image
                                    src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                                    alt="Profile"
                                    width={36}
                                    height={36}
                                    className={styles.avatar}
                                />
                            ) : (
                                <div className={styles.avatarFallback}>
                                    {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "U").toUpperCase()}
                                </div>
                            )}

                            {!isCollapsed && (
                                <div className={styles.userInfo}>
                                    <span className={styles.userName}>
                                        {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleSignOut}
                                        className={styles.logoutBtn}
                                        title="Cerrar sesión"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => router.push("/login")}
                            className={styles.loginBtn}
                        >
                            {!isCollapsed ? "Iniciar sesión" : "🔑"}
                        </button>
                    )}
                </div>
            </aside>

            {/* ─── Mobile Bottom Navigation Bar (< 768px) ─── */}
            <nav className={styles.mobileBottomNav} aria-label="Navegación móvil">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ""}`}
                        >
                            <span className={styles.mobileItemIcon}>{item.icon}</span>
                            <span className={styles.mobileItemLabel}>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}

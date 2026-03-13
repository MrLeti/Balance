"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import styles from "./Navbar.module.css";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";

export default function Navbar() {
    const { data: session, status } = useSession();

    return (
        <nav className={styles.navbar}>
            <div className={styles.container}>
                <div className={styles.logo}>
                    <span className={styles.icon}>
                        <Image src="/icon-192x192.png" unoptimized alt="Vesta Logo" width={28} height={28} style={{ borderRadius: '50%', display: 'flex' }} priority />
                    </span>
                    <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <h2>Vesta</h2>
                    </Link>
                </div>

                <div className={styles.actions}>
                    {session && (
                        <nav style={{ display: 'flex', gap: '16px', marginRight: '16px', alignItems: 'center' }}>
                            <Link href="/" className={styles.navLink}>Balance</Link>
                            <Link href="/cuotas" className={styles.navLink}>Cuotas</Link>
                            <Link href="/inversiones" className={styles.navLink}>Inversiones</Link>
                        </nav>
                    )}
                    <ThemeToggle />
                    {status === "loading" ? (
                        <div className={styles.skeleton}></div>
                    ) : session ? (
                        <div className={styles.profile}>
                            <span className={styles.name}>{session.user?.name?.split(" ")[0]}</span>
                            {session.user?.image ? (
                                <Image
                                    src={session.user.image}
                                    alt="Profile"
                                    width={36}
                                    height={36}
                                    className={styles.avatar}
                                />
                            ) : (
                                <div className={styles.avatarFallback}>
                                    {session.user?.name?.[0] || "U"}
                                </div>
                            )}
                            <button
                                onClick={() => signOut()}
                                className={styles.logoutBtn}
                                title="Cerrar sesión"
                            >
                                Cerrar
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => signIn("google")}
                            className={styles.loginBtn}
                        >
                            Iniciar sesión
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}

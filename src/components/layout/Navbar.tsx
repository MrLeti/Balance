"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import styles from "./Navbar.module.css";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
    const { data: session, status } = useSession();

    return (
        <nav className={styles.navbar}>
            <div className={styles.container}>
                <div className={styles.logo}>
                    <span className={styles.icon}>🪴</span>
                    <h2>Vesta</h2>
                </div>

                <div className={styles.actions}>
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

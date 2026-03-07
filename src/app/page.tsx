import Navbar from "@/components/layout/Navbar";
import TransactionInput from "@/components/dashboard/TransactionInput";
import DashboardData from "@/components/dashboard/DashboardData";
import styles from "./page.module.css";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className={styles.container}>
      <Navbar />

      {!session ? (
        <main className="glass-panel" style={{ padding: "40px 32px", textAlign: "center", maxWidth: "420px", margin: "10vh auto" }}>
          <h1 className="title" style={{ fontSize: "2.5rem", marginBottom: "16px" }}>Balance</h1>
          <p className="text-muted" style={{ marginBottom: "32px", fontSize: "1.1rem", lineHeight: "1.5" }}>
            Tu registro de finanzas personales.<br />
            Inteligente, moderno y sin complicaciones.
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Inicia sesión arriba a la derecha con tu cuenta de Google para comenzar.
          </p>
        </main>
      ) : (
        <main className={styles.dashboardContainer}>
          <div className={styles.dashboardGrid}>
            <section className={`glass-panel ${styles.card} ${styles.colSpanFull}`}>
              <h3 style={{ marginBottom: "16px" }}>Nuevo Movimiento</h3>
              {/* Le avisamos al componente interno si detecta un target por URL de ser necesario o rehidrata */}
              <TransactionInput />
            </section>

            <DashboardData />
          </div>
        </main>
      )}
    </div>
  );
}

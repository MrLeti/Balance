import AhorrosDashboard from "@/components/ahorros/AhorrosDashboard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function AhorrosPage() {
    return (
        <div className={styles.container}>
            <main className={styles.dashboardContainer}>
                <AhorrosDashboard />
            </main>
        </div>
    );
}

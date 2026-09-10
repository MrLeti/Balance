import CuotasDashboard from "@/components/cuotas/CuotasDashboard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function CuotasPage() {
    return (
        <div className={styles.container}>
            <main className={styles.dashboardContainer}>
                <CuotasDashboard />
            </main>
        </div>
    );
}

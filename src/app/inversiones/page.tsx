import InversionesDashboard from "@/components/inversiones/InversionesDashboard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function InversionesPage() {
    return (
        <div className={styles.container}>
            <main className={styles.dashboardContainer}>
                <InversionesDashboard />
            </main>
        </div>
    );
}

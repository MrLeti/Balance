import DashboardData from "@/components/dashboard/DashboardData";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.dashboardContainer}>
        <div className={styles.dashboardGrid}>
          <DashboardData />
        </div>
      </main>
    </div>
  );
}

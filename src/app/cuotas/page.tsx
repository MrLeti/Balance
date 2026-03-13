import Navbar from "@/components/layout/Navbar";
import CuotasDashboard from "@/components/cuotas/CuotasDashboard";
import styles from "./page.module.css";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CuotasPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/");
    }

    return (
        <div className={styles.container}>
            <Navbar />

            <main className={styles.dashboardContainer}>
                <CuotasDashboard />
            </main>
        </div>
    );
}

import Navbar from "@/components/layout/Navbar";
import InversionesDashboard from "@/components/inversiones/InversionesDashboard";
import styles from "./page.module.css";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InversionesPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/");
    }

    return (
        <div className={styles.container}>
            <Navbar />

            <main className={styles.dashboardContainer}>
                <InversionesDashboard />
            </main>
        </div>
    );
}

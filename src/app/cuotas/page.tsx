import CuotasDashboard from "@/components/cuotas/CuotasDashboard";
import styles from "./page.module.css";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CuotasPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <div className={styles.container}>
            <main className={styles.dashboardContainer}>
                <CuotasDashboard />
            </main>
        </div>
    );
}

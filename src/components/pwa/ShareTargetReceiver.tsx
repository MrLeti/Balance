"use client";

import { useEffect } from "react";

const CACHE_NAME = "vesta-shared-cache";

export default function ShareTargetReceiver() {
    useEffect(() => {
        // 1. Register the Service Worker for PWA Web Share Target
        if ("serviceWorker" in navigator && typeof window !== "undefined") {
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    // Check for updates
                    registration.update().catch(() => {});
                })
                .catch((err) => {
                    console.warn("[PWA] Service Worker registration failed:", err);
                });
        }

        // 2. Helper to dispatch file to TransactionFAB / ValidationModal
        const emitSharedFile = (file: File) => {
            window.dispatchEvent(new CustomEvent("share_target_file", { detail: { file } }));
        };

        // 3. Helper to clean query params from URL without page reload
        const cleanUrlParams = (paramsToRemove: string[]) => {
            if (typeof window === "undefined") return;
            const url = new URL(window.location.href);
            let hasChanged = false;
            for (const param of paramsToRemove) {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    hasChanged = true;
                }
            }
            if (hasChanged) {
                const newPath = url.pathname + (url.search ? url.search : "") + url.hash;
                window.history.replaceState({}, "", newPath);
            }
        };

        // 4. Check for cached shared file in Service Worker Cache Storage
        const checkSharedCache = async () => {
            if (!("caches" in window)) return;
            try {
                const cache = await caches.open(CACHE_NAME);
                const response = await cache.match("/shared-file");
                if (response) {
                    const blob = await response.blob();
                    const rawName = response.headers.get("X-File-Name");
                    const fileName = rawName ? decodeURIComponent(rawName) : "comprobante.jpg";
                    const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });

                    // Consume and remove from cache
                    await cache.delete("/shared-file");
                    cleanUrlParams(["shared", "share_error"]);
                    emitSharedFile(file);
                }
            } catch (err) {
                console.error("[PWA] Error reading shared file from cache:", err);
            }
        };

        // 5. Check for server-side fallback shared file via ?shared_id=UUID
        const checkServerSharedFile = async () => {
            if (typeof window === "undefined") return;
            const params = new URLSearchParams(window.location.search);
            const sharedId = params.get("shared_id");

            if (sharedId) {
                try {
                    const res = await fetch(`/share-target?id=${encodeURIComponent(sharedId)}`);
                    if (res.ok) {
                        const blob = await res.blob();
                        const rawName = res.headers.get("X-File-Name");
                        const fileName = rawName ? decodeURIComponent(rawName) : "comprobante.jpg";
                        const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });

                        cleanUrlParams(["shared_id"]);
                        emitSharedFile(file);
                        return;
                    }
                } catch (err) {
                    console.error("[PWA] Error fetching server-side shared file:", err);
                }
                cleanUrlParams(["shared_id"]);
            }
        };

        // 6. Listen for real-time postMessage from active Service Worker
        const handleServiceWorkerMessage = (event: MessageEvent) => {
            if (event.data?.type === "SHARED_FILE_RECEIVED") {
                void checkSharedCache();
            }
        };

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
        }

        // Execute initial checks on mount
        void checkSharedCache();
        void checkServerSharedFile();

        return () => {
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
            }
        };
    }, []);

    return null;
}

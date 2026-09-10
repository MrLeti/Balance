"use client";

import { useEffect } from "react";

const CACHE_NAME = "vesta-shared-cache-v1";

export default function ShareTargetReceiver() {
    useEffect(() => {
        // 1. Register the Service Worker for PWA Web Share Target with explicit root scope
        if ("serviceWorker" in navigator && typeof window !== "undefined") {
            navigator.serviceWorker
                .register("/sw.js", { scope: "/" })
                .then((registration) => {
                    // Check for updates immediately
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
                const absKey = new URL("/shared-file", window.location.origin).href;

                // Match either absolute URL key or relative key
                let response = await cache.match(absKey);
                if (!response) {
                    response = await cache.match("/shared-file");
                }

                // If opened via ?shared=true redirect, retry a few times to account for mobile disk write latency
                if (!response && typeof window !== "undefined" && window.location.search.includes("shared=true")) {
                    for (let attempt = 0; attempt < 5; attempt++) {
                        await new Promise((resolve) => setTimeout(resolve, 200));
                        response = (await cache.match(absKey)) || (await cache.match("/shared-file"));
                        if (response) break;
                    }
                }

                if (response) {
                    const blob = await response.blob();
                    const rawName = response.headers.get("X-File-Name");
                    const fileName = rawName ? decodeURIComponent(rawName) : "comprobante.jpg";
                    const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });

                    // Consume and remove from cache
                    await cache.delete(absKey).catch(() => {});
                    await cache.delete("/shared-file").catch(() => {});
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

        const handleControllerChange = () => {
            void checkSharedCache();
        };

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
            navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
        }

        // Execute initial checks on mount
        void checkSharedCache();
        void checkServerSharedFile();

        return () => {
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
                navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
            }
        };
    }, []);

    return null;
}

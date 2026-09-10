// Service Worker for Vesta PWA - Web Share Target API handler v1.1.0
const CACHE_NAME = "vesta-shared-cache-v1";

self.addEventListener("install", (event) => {
    // Activate immediately without waiting for older workers to retire
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    // Claim active clients immediately so the service worker controls the page without reload
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Intercept Web Share Target POST requests
    if (
        event.request.method === "POST" &&
        (url.pathname === "/share-target" || url.pathname === "/share-target/")
    ) {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    let file = formData.get("file") || formData.get("sharedImage") || formData.get("image");

                    // Fallback: iterate over formData to find any File object
                    if (!file || typeof file === "string") {
                        for (const value of formData.values()) {
                            if (value && typeof value === "object" && "size" in value && "type" in value) {
                                file = value;
                                break;
                            }
                        }
                    }

                    if (file && typeof file === "object" && "size" in file && file.size > 0) {
                        const cache = await caches.open(CACHE_NAME);
                        const fileResponse = new Response(file, {
                            headers: {
                                "Content-Type": file.type || "image/jpeg",
                                "X-File-Name": encodeURIComponent(file.name || "comprobante.jpg"),
                                "X-File-Size": String(file.size || 0),
                            },
                        });
                        // Store using both absolute URL and relative key for maximum compatibility
                        const absKey = new URL("/shared-file", self.location.origin).href;
                        await cache.put(absKey, fileResponse.clone());
                        await cache.put("/shared-file", fileResponse);
                    }

                    // Notify any already open client tabs
                    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
                    for (const client of clientList) {
                        if (client.url.includes(self.location.origin) && "postMessage" in client) {
                            client.postMessage({ type: "SHARED_FILE_RECEIVED" });
                        }
                    }

                    // Response.redirect REQUIRES an absolute URL string per WHATWG Fetch specification.
                    // Passing a relative URL causes "TypeError: Failed to parse URL", crashing the worker navigation.
                    const targetUrl = new URL("/?shared=true", self.location.origin).href;
                    try {
                        return Response.redirect(targetUrl, 303);
                    } catch {
                        return new Response(null, {
                            status: 303,
                            headers: { Location: targetUrl },
                        });
                    }
                } catch (err) {
                    console.error("[Vesta SW] Error handling Web Share Target:", err);
                    const errorUrl = new URL("/?share_error=true", self.location.origin).href;
                    try {
                        return Response.redirect(errorUrl, 303);
                    } catch {
                        return new Response(null, {
                            status: 303,
                            headers: { Location: errorUrl },
                        });
                    }
                }
            })()
        );
    }
});


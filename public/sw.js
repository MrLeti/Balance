// Service Worker for Vesta PWA - Web Share Target API handler
const CACHE_NAME = "vesta-shared-cache";

self.addEventListener("install", (event) => {
    // Activate immediately without waiting
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    // Claim active clients immediately
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Intercept Web Share Target POST requests
    if (event.request.method === "POST" && url.pathname === "/share-target") {
        event.respondWith((async () => {
            try {
                const formData = await event.request.formData();
                let file = formData.get("file") || formData.get("sharedImage");

                // Fallback: iterate over formData to find any File object
                if (!file || typeof file === "string") {
                    for (const value of formData.values()) {
                        if (value && typeof value === "object" && "size" in value && "type" in value) {
                            file = value;
                            break;
                        }
                    }
                }

                if (file && typeof file === "object" && "size" in file) {
                    const cache = await caches.open(CACHE_NAME);
                    const fileResponse = new Response(file, {
                        headers: {
                            "Content-Type": file.type || "image/jpeg",
                            "X-File-Name": encodeURIComponent(file.name || "comprobante.jpg"),
                            "X-File-Size": String(file.size || 0),
                        },
                    });
                    await cache.put("/shared-file", fileResponse);
                }

                // Notify any already open client tabs
                const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && "postMessage" in client) {
                        client.postMessage({ type: "SHARED_FILE_RECEIVED" });
                    }
                }

                // Redirect using 303 See Other so the browser loads the home screen with GET
                return Response.redirect("/?shared=true", 303);
            } catch (err) {
                console.error("[Vesta SW] Error handling Web Share Target:", err);
                return Response.redirect("/?share_error=true", 303);
            }
        })());
    }
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { middleware } from "../middleware";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
    createServerClient: () => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
    }),
}));

describe("Middleware public routes and share-target", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://mock.supabase.co");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "mock-anon-key");
    });

    it("allows unauthenticated access to /share-target", async () => {
        const req = new NextRequest("http://localhost:3000/share-target", {
            method: "POST",
        });
        const res = await middleware(req);
        // Should not redirect to /login
        expect(res.headers.get("location")).toBeNull();
        expect(res.status).toBe(200);
    });

    it("allows unauthenticated access to /share-target with query params", async () => {
        const req = new NextRequest("http://localhost:3000/share-target?id=123", {
            method: "GET",
        });
        const res = await middleware(req);
        expect(res.headers.get("location")).toBeNull();
        expect(res.status).toBe(200);
    });

    it("allows unauthenticated access to /sw.js", async () => {
        const req = new NextRequest("http://localhost:3000/sw.js");
        const res = await middleware(req);
        expect(res.headers.get("location")).toBeNull();
        expect(res.status).toBe(200);
    });

    it("redirects unauthenticated access to protected routes to /login", async () => {
        const req = new NextRequest("http://localhost:3000/");
        const res = await middleware(req);
        expect(res.headers.get("location")).toContain("/login");
    });
});

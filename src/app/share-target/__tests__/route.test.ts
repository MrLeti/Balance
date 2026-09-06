import { describe, it, expect } from 'vitest';
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';

describe('Share Target API Route (/share-target)', () => {
    it('handles POST with a shared file, caches it, and redirects to /?shared_id=...', async () => {
        const formData = new FormData();
        const fakeFile = new File(['mock-ticket-content'], 'ticket-coto.jpg', { type: 'image/jpeg' });
        formData.append('file', fakeFile);

        const postReq = new NextRequest('http://localhost:3000/share-target', {
            method: 'POST',
        });
        postReq.formData = async () => formData;

        const postRes = await POST(postReq);
        expect(postRes.status).toBe(303);

        const location = postRes.headers.get('location');
        expect(location).not.toBeNull();
        expect(location).toContain('shared_id=');

        // Extract shared_id from the redirect URL
        const redirectUrl = new URL(location!, 'http://localhost:3000');
        const sharedId = redirectUrl.searchParams.get('shared_id');
        expect(sharedId).toBeTruthy();

        // 2. Fetch the cached file via GET /share-target?id=...
        const getReq = new NextRequest(`http://localhost:3000/share-target?id=${sharedId}`, {
            method: 'GET',
        });

        const getRes = await GET(getReq);
        expect(getRes.status).toBe(200);
        expect(getRes.headers.get('Content-Type')).toBe('image/jpeg');
        expect(decodeURIComponent(getRes.headers.get('X-File-Name')!)).toBe('ticket-coto.jpg');

        const buffer = await getRes.arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        expect(text).toBe('mock-ticket-content');

        // 3. Confirm file was consumed (second GET returns 404)
        const secondGet = await GET(getReq);
        expect(secondGet.status).toBe(404);
    });

    it('handles POST without files gracefully by redirecting to /', async () => {
        const formData = new FormData();
        const postReq = new NextRequest('http://localhost:3000/share-target', {
            method: 'POST',
        });
        postReq.formData = async () => formData;

        const postRes = await POST(postReq);
        expect(postRes.status).toBe(303);
        const location = postRes.headers.get('location');
        expect(location).toBe('http://localhost:3000/');
    });
});

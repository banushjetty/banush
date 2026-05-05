'use strict';

const http  = require('http');
const https = require('https');

const BASE_URL       = 'http://localhost:3000';
const BRAND_EMAIL    = 'mamaearth@example.com';
const BRAND_PASSWORD = 'Brand@123';
const CACHED_ROUTE   = '/brand/home';

function extractCookies(headers) {
    return (headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
}

function request({ method = 'GET', path, body = null, cookieHeader = '' }) {
    return new Promise((resolve, reject) => {
        const url     = new URL(BASE_URL + path);
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: url.hostname,
            port:     url.port || 80,
            path:     url.pathname + url.search,
            method,
            headers: {
                'Accept':       'application/json',
                'Content-Type': 'application/json',
                ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
                ...(payload      ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
        };
        const start = Date.now();
        const req = (BASE_URL.startsWith('https') ? https : http).request(options, res => {
            let data = '';
            res.on('data', c => { data += c; });
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data, durationMs: Date.now() - start }));
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function main() {
    // Login
    const loginRes = await request({ method: 'POST', path: '/auth/signin', body: { email: BRAND_EMAIL, password: BRAND_PASSWORD } });
    if (loginRes.statusCode !== 200) { console.error('❌ Login failed'); process.exit(1); }
    const cookie = extractCookies(loginRes.headers);

    // Request 1 — MISS
    const r1 = await request({ path: CACHED_ROUTE, cookieHeader: cookie });
    const c1 = r1.headers['x-cache'] || '—';

    await new Promise(r => setTimeout(r, 300));

    // Request 2 — HIT
    const r2 = await request({ path: CACHED_ROUTE, cookieHeader: cookie });
    const c2 = r2.headers['x-cache'] || '—';

    const saved   = r1.durationMs - r2.durationMs;
    const speedup = ((saved / r1.durationMs) * 100).toFixed(1);

    console.log(`\n  Redis Cache Demo — ${CACHED_ROUTE}\n`);
    console.log(`  ┌──────────────┬──────────────┬─────────┐`);
    console.log(`  │              │   Time (ms)  │ x-cache │`);
    console.log(`  ├──────────────┼──────────────┼─────────┤`);
    console.log(`  │  Request 1   │  ${String(r1.durationMs).padEnd(11)} │  ${c1.padEnd(6)}  │`);
    console.log(`  │  Request 2   │  ${String(r2.durationMs).padEnd(11)} │  ${c2.padEnd(6)}  │`);
    console.log(`  ├──────────────┼──────────────┼─────────┤`);
    console.log(`  │  Saved       │  +${String(saved).padEnd(10)} │  ${speedup}%  │`);
    console.log(`  └──────────────┴──────────────┴─────────┘\n`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });

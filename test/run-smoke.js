import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createHttpServer } from '../src/app.js';

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plis-js-'));
  const databasePath = path.join(tempDir, 'pemeliharaan_barang.db');
  fs.copyFileSync(path.resolve('pemeliharaan_barang.db'), databasePath);

  const { server, close } = createHttpServer({
    port: 0,
    host: '127.0.0.1',
    nodeEnv: 'test',
    databasePath,
    sessionSecret: 'test-secret',
    adminUsername: 'admin',
    adminPassword: 'cijago',
    timeZone: 'Asia/Jakarta',
    cookieSecure: false,
    requestLogging: false,
  });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const healthResponse = await fetch(`${baseUrl}/healthz`);
    assert.equal(healthResponse.status, 200);
    const healthPayload = await healthResponse.json();
    assert.equal(healthPayload.ok, true);
    console.log('PASS health endpoint');

    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'admin', password: 'cijago' }),
      redirect: 'manual',
    });
    assert.equal(loginResponse.status, 303);
    const authCookie = loginResponse.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';', 1)[0])
      .join('; ');
    assert.match(authCookie, /app_session=/);
    console.log('PASS login flow');

    const appResponse = await fetch(`${baseUrl}/app?tab=data`, {
      headers: { cookie: authCookie },
    });
    const appHtml = await appResponse.text();
    assert.equal(appResponse.status, 200);
    assert.match(appHtml, /Daftar Semua Barang/);
    console.log('PASS authenticated app page');

    const updateResponse = await fetch(`${baseUrl}/barang/update`, {
      method: 'POST',
      headers: {
        cookie: authCookie,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        nama: 'AVC',
        gerbang: 'LIMO 1A',
        gardu: '02',
        tanggal: '2026-04-09',
        deskripsi: 'Smoke test kendala',
        shift: '2',
        status: 'Kendala',
      }),
      redirect: 'manual',
    });
    assert.equal(updateResponse.status, 303);
    console.log('PASS update barang');

    const reportResponse = await fetch(
      `${baseUrl}/app?tab=reports&reportType=daily&reportDate=2026-04-09&reportShift=2`,
      { headers: { cookie: authCookie } },
    );
    const reportHtml = await reportResponse.text();
    assert.equal(reportResponse.status, 200);
    assert.match(reportHtml, /Smoke test kendala/);
    console.log('PASS laporan harian');

    const pdfResponse = await fetch(
      `${baseUrl}/reports/daily/pdf?reportDate=2026-04-09&reportShift=2`,
      { headers: { cookie: authCookie } },
    );
    const pdfHeader = Buffer.from(await pdfResponse.arrayBuffer()).toString('utf8', 0, 8);
    assert.equal(pdfResponse.status, 200);
    assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf');
    assert.match(pdfHeader, /%PDF-1.4/);
    console.log('PASS export PDF');

    console.log('Semua smoke test lulus.');
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error('Smoke test gagal:', error);
  process.exit(1);
});

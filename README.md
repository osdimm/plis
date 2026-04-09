# Sistem Informasi Pemeliharaan Alat TOL Cijago (JavaScript)

Migrasi ini mengubah aplikasi Streamlit Python menjadi aplikasi web JavaScript berbasis Node.js tanpa menghilangkan fitur utama yang sudah ada. Database tetap memakai file SQLite yang sama: [`pemeliharaan_barang.db`](/C:/Users/Dery/plis/pemeliharaan_barang.db).

## Fitur yang dipertahankan

- Login admin
- Data barang dengan filter nama barang, gerbang, gardu, dan status
- Warna status `Kendala`, `Perbaikan`, `Monitor`, `Normal`
- Aturan transisi status seperti aplikasi lama
- Detail barang:
  riwayat kerusakan, riwayat perbaikan, durasi perbaikan, dan download PDF
- Hapus barang
- Hapus riwayat barang
- Laporan harian dan bulanan
- Download PDF laporan
- Hapus entri laporan harian
- Kompatibilitas data lama pada tabel `daily_report` dan `Laporan_Harian`

## Stack baru

- Node.js 22+
- HTTP server native Node
- SQLite dengan adapter:
  `better-sqlite3` bila tersedia, fallback ke `node:sqlite`
- Server-side rendering HTML tanpa framework eksternal
- Session cookie bertanda tangan
- Security headers dasar
- Health check endpoint: `/healthz`

## Struktur penting

- [`src/server.js`](/C:/Users/Dery/plis/src/server.js): entrypoint server
- [`src/app.js`](/C:/Users/Dery/plis/src/app.js): routing HTTP utama
- [`src/db/database.js`](/C:/Users/Dery/plis/src/db/database.js): bootstrap schema dan sinkronisasi tabel legacy
- [`src/services/inventory-service.js`](/C:/Users/Dery/plis/src/services/inventory-service.js): logika bisnis barang
- [`src/services/report-service.js`](/C:/Users/Dery/plis/src/services/report-service.js): logika laporan
- [`src/services/pdf-service.js`](/C:/Users/Dery/plis/src/services/pdf-service.js): generator PDF
- [`src/view.js`](/C:/Users/Dery/plis/src/view.js): renderer UI HTML
- [`test/run-smoke.js`](/C:/Users/Dery/plis/test/run-smoke.js): smoke test

## Menjalankan lokal

1. Pastikan Node.js minimal `22.17.0`
2. Salin `.env.example` menjadi `.env` bila ingin override konfigurasi
3. Jalankan:

```bash
npm install
npm start
```

Mode development:

```bash
npm run dev
```

Testing:

```bash
npm test
```

## Environment

- `PORT`: port server
- `HOST`: host bind
- `NODE_ENV`: `development` atau `production`
- `DATABASE_PATH`: path database SQLite
- `SESSION_SECRET`: wajib diganti saat produksi
- `ADMIN_USERNAME`: username login
- `ADMIN_PASSWORD`: password login

## Catatan migrasi

- File [`app.py`](/C:/Users/Dery/plis/app.py) saya biarkan sebagai referensi legacy agar fitur lama bisa ditelusuri kapan saja selama transisi.
- Aplikasi JS otomatis memastikan schema penting tersedia, termasuk kolom `Last_Update` dan `Shift`.
- Data pada `Laporan_Harian` dan `daily_report` disinkronkan aman hanya untuk relasi `ID_Barang` yang masih valid.
- Bila `better-sqlite3` belum terpasang, aplikasi tetap bisa berjalan memakai `node:sqlite` bawaan Node 22.

## Production readiness yang ditambahkan

- Pemisahan layer config, DB, service, HTTP, dan view
- Signed session cookie
- Security headers
- Graceful shutdown untuk `SIGINT` dan `SIGTERM`
- Health check `/healthz`
- Smoke test end-to-end
- Sanitasi nama file PDF saat download

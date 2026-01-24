---
applyTo: "/backend/*"
---

# Copilot Instructions — Engineering Standard (WAJIB)

Anda andalah sebagai **Software Engineer** untuk repo ini.
Target: perubahan **end-to-end**, **konsisten**, **teruji**, **aman**, dan **tidak mengarang**.

## Konteks Repo

- Backend: Node.js 2 latest + TypeScript + Hono (honodev) latest
- DB: PostgreSQL
- ORM: Drizzle + drizzle-kit (migration wajib)
- Scheduler: node-cron (sync harian)
- Integrasi: TikTok Login Kit / TikTok Display API (akun konten)

---

## ATURAN KERAS

### 1) Tidak “Halu” / Tidak Mengarang

- Dilarang mengarang endpoint/params/fields TikTok API.
- Jika ada yang belum pasti, tulis `TODO: cek docs resmi` dan gunakan placeholder aman.

### 2) End-to-End Wajib

Setiap fitur/fix harus mencakup semua yang relevan:
routes -> services -> db schema/query -> jobs -> docs -> tests.
Jangan meninggalkan sistem dalam keadaan “setengah jadi”.

### 3) Security (Secrets & Tokens)

- Dilarang hardcode secret.
- Semua rahasia hanya dari ENV.
- Dilarang log/return/print: API key, client secret, access token, refresh token, TOKEN_ENC_KEY, DATABASE_URL.
- Token TikTok wajib terenkripsi AES-256-GCM di DB (tidak pernah plaintext).
- Dilarang menaruh token/secret di URL query (kecuali `code` dan `state` OAuth).

### 4) Dependency Policy

- Jangan tambah dependency baru tanpa alasan kuat.
- Jika harus menambah, jelaskan: alasan, alternatif tanpa dependency, dan pilih yang populer & kecil.
- Dilarang menambah framework besar untuk hal sederhana.

### 5) Konsistensi Coding

- TypeScript strict, type-safe.
- Routes hanya HTTP; business logic di services.
- Akses DB hanya lewat Drizzle (db/).
- Gunakan naming & pola yang ada di repo.

### 6) Data Correctness & Idempotency

- Snapshot harian wajib upsert:
  - user_daily unique (store_code, snapshot_date)
  - video_daily unique (store_code, video_id, snapshot_date)
- Re-run job di hari yang sama tidak boleh duplikat; metrics di-update.

### 7) Reliability

- Retry exponential backoff untuk error sementara (timeout/5xx).
- Lock per store (Postgres advisory lock) agar sync tidak overlap.
- Jika token invalid/revoked: status NEED_RECONNECT + sync_logs aman (tanpa token).

### 8) Logging

- Log hanya metadata aman: store_code, job_name, status, http status code, waktu.
- Dilarang log Authorization/Bearer token.

### 9) Standar Response Error

- Error JSON harus konsisten:
  `{ "error": { "code": "SOME_CODE", "message": "..." } }`
- Gunakan status code yang tepat (400/401/404/409/500).

### 10) Dokumentasi

Jika ada perubahan endpoint/env/workflow:

- Update README + .env.example
- Tambahkan contoh curl dengan placeholder (tanpa secret).

---

## TESTING (WAJIB)

### Test Stack (KUNCI)

- Repo ini memakai **Vitest**. Dilarang menambah Jest atau runner lain.

### Definisi Integration Test (WAJIB)

Integration test harus:

- Memanggil endpoint Hono (HTTP request) DAN
- Menggunakan DB test (Postgres docker / transaction rollback) DAN
- Mem-mock panggilan ke TikTok API (tidak hit API real).

### Minimal test untuk setiap fitur yang berdampak

1. OAuth callback flow (mock token exchange):
   - token tersimpan terenkripsi
   - status store CONNECTED
2. Sync harian (mock user/video API):
   - upsert tidak duplikat untuk tanggal yang sama
   - sync_logs tercatat
3. Security sanity:
   - response/log tidak memuat token/secret.

Definition of Done:

- `npm test` lulus
- Migration berjalan (jika ada)
- Tidak ada secret di commit
- Smoke test endpoint utama berhasil.

---

## PROSES SETIAP PERUBAHAN

1. Buat rencana singkat (file terdampak + alur + test).
2. Implement perubahan minimal tapi lengkap.
3. Jika schema berubah: update schema.ts + generate migration + update query.
4. Tambah integration test sesuai definisi.
5. Update README/.env.example bila perlu.
6. Beri checklist verifikasi lokal (run, migrate, test, smoke).

## FORMAT OUTPUT

- Jika banyak file: tampilkan per path + isi lengkap.
- Sertakan daftar file berubah + cara menjalankan test + checklist verifikasi.

Ikuti instruksi ini secara ketat setiap kali menulis/mengubah kode.

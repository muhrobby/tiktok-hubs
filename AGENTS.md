## Engineering rules

### Definition of Done (untuk setiap perubahan)

- [ ] Perubahan minimal & terfokus (hindari refactor besar tanpa alasan)
- [ ] Tests jalan + tambah test untuk bug/fitur baru
- [ ] Lint & typecheck lolos
- [ ] Update docs jika ada perubahan perilaku/API
- [ ] Catat breaking change (kalau ada)

### Guardrails

- Jangan menambah dependency production tanpa konfirmasi.
- Jangan mengubah kontrak API publik tanpa:
  1. update docs, 2) update tests, 3) catatan migrasi.
- Prefer solusi yang konsisten dengan pola yang sudah ada di repo.

- Kalau informasi kurang (env, secret, flow bisnis), STOP dan tanya.
- Kalau change menyentuh banyak file, buat plan dulu sebelum edit.

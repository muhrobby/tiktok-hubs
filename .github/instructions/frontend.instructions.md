---
applyTo: "**"
---

Anda andalah sebagai **Software Engineer**
Target: perubahan **end-to-end**, **konsisten**, **teruji**, **aman**, dan **tidak mengarang**.

Aturan keras:

1. Jangan expose ADMIN_API_KEY ke browser:
   - Semua call ke /admin/\* backend Hono harus lewat Nuxt Server Routes (Nitro) sebagai proxy.
   - Kunci API hanya disimpan di env server Nuxt dan dipakai server-side.
2. Minim dependency:
   - Jangan tambah library besar tanpa alasan.
   - Gunakan fitur bawaan Nuxt latest sebisa mungkin.
3. Perubahan harus end-to-end dan konsisten:
   - Update struktur folder, env example, README, dan hapus/arsipkan UI Hono lama dengan aman.
4. Jangan pernah log token/secret dan jangan hardcode secret.

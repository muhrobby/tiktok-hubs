# Test Users Seed Script

Script untuk membuat test users yang dibutuhkan untuk K6 load testing dan security testing.

## 🎯 Yang Dibuat

Script ini akan membuat 3 test users dengan kredensial berikut:

### 1. Admin User
- **Username:** `admin`
- **Password:** `admin123`
- **Role:** Admin
- **Access:** All stores
- **Email:** admin@test.local

### 2. Ops User
- **Username:** `ops`
- **Password:** `ops123`
- **Role:** Ops
- **Access:** All stores
- **Email:** ops@test.local

### 3. Store User
- **Username:** `store_user`
- **Password:** `store123`
- **Role:** Store
- **Access:** STORE001 only
- **Email:** store@test.local

## 🚀 Cara Menggunakan

### Prerequisites

1. Database PostgreSQL sudah running
2. Environment variables sudah di-set (`.env` file)
3. Database migrations sudah dijalankan
4. Roles sudah di-initialize (jalankan `npm run db:seed` dulu jika belum)

### Langkah-langkah

```bash
# 1. Masuk ke directory backend
cd /media/muhrobby/DataExternal/Project/tiktok-hubs/backend

# 2. Pastikan .env file ada dan benar
cat .env | grep DATABASE_URL

# 3. Jalankan migration (jika belum)
npm run db:migrate

# 4. Jalankan seed roles (jika belum)
npm run db:seed

# 5. Jalankan seed test users
npm run db:seed-test
```

## ✅ Output yang Diharapkan

```
{"level":"info","msg":"Starting test users seeding for K6..."}
{"level":"info","msg":"Checking roles..."}
{"level":"info","msg":"Found 3 roles"}
{"level":"info","msg":"Checking test stores..."}
{"level":"info","msg":"Created test store: STORE001"}
{"level":"info","msg":"Creating test users..."}
{"level":"info","msg":"Creating user: admin..."}
{"level":"info","msg":"✓ Created user: admin (ID: 1)"}
{"level":"info","msg":"  ✓ Assigned role: Admin"}
{"level":"info","msg":"  ✓ User has access to all stores (Admin role)"}
{"level":"info","msg":"Creating user: ops..."}
{"level":"info","msg":"✓ Created user: ops (ID: 2)"}
{"level":"info","msg":"  ✓ Assigned role: Ops"}
{"level":"info","msg":"  ✓ User has access to all stores (Ops role)"}
{"level":"info","msg":"Creating user: store_user..."}
{"level":"info","msg":"✓ Created user: store_user (ID: 3)"}
{"level":"info","msg":"  ✓ Assigned role: Store"}
{"level":"info","msg":"  ✓ Granted access to store: STORE001"}

========================================
Test Users Created Successfully!
========================================

You can now use these credentials for K6 testing:

  Admin User:
    Username: admin
    Password: admin123
    Access:   All stores

  Ops User:
    Username: ops
    Password: ops123
    Access:   All stores

  Store User:
    Username: store_user
    Password: store123
    Access:   STORE001

To run K6 tests with these credentials:
  cd k6-tests
  ./run-tests.sh

{"level":"info","msg":"Database seeding completed successfully!"}
```

## 🔄 Update Existing Users

Jika users sudah ada, script akan:
1. Update password mereka
2. Update full name dan email
3. Tidak akan duplicate data

Jadi aman untuk dijalankan berkali-kali.

## 🔍 Verifikasi

Setelah seed selesai, verifikasi dengan:

```bash
# Connect ke database
psql -U your_user -d tiktok_hubs

# Check users
SELECT id, username, full_name, email FROM users;

# Check user roles
SELECT u.username, r.name as role
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id;

# Check store access
SELECT u.username, us.store_code
FROM users u
LEFT JOIN user_stores us ON u.id = us.user_id;
```

## 🧪 Test Login

Test kredensial dengan curl:

```bash
# Test admin login
curl -X POST http://localhost:3000/user-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Test ops login
curl -X POST http://localhost:3000/user-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ops","password":"ops123"}'

# Test store_user login
curl -X POST http://localhost:3000/user-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"store_user","password":"store123"}'
```

Semua harus return `{"success":true,...}`

## ⚠️ Troubleshooting

### Error: "No roles found"

**Problem:** Roles belum di-initialize

**Solution:**
```bash
npm run db:seed
npm run db:seed-test
```

### Error: "connect ECONNREFUSED"

**Problem:** Database tidak running atau connection string salah

**Solution:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check .env file
cat .env | grep DATABASE_URL

# Test connection
psql -U your_user -d tiktok_hubs -c "SELECT 1"
```

### Error: "relation does not exist"

**Problem:** Migrations belum dijalankan

**Solution:**
```bash
npm run db:migrate
npm run db:seed
npm run db:seed-test
```

### Users sudah ada tapi password salah

**Problem:** Users dibuat manual dengan password berbeda

**Solution:**
```bash
# Jalankan lagi untuk update password
npm run db:seed-test
```

## 🔒 Security Notes

⚠️ **PENTING:**

1. **Jangan gunakan credentials ini di production!**
2. Ini hanya untuk testing di development/staging
3. Ganti password setelah testing selesai
4. Atau delete users setelah testing:

```bash
# Delete test users
psql -U your_user -d tiktok_hubs -c "
DELETE FROM user_stores WHERE user_id IN (
  SELECT id FROM users WHERE username IN ('admin', 'ops', 'store_user')
);
DELETE FROM user_roles WHERE user_id IN (
  SELECT id FROM users WHERE username IN ('admin', 'ops', 'store_user')
);
DELETE FROM users WHERE username IN ('admin', 'ops', 'store_user');
"
```

## 📝 Customization

Jika ingin mengubah credentials, edit file:
```
backend/src/db/seed-test-users.ts
```

Lalu jalankan lagi:
```bash
npm run db:seed-test
```

## 🔗 Next Steps

Setelah test users dibuat:

1. **Verify login credentials** (gunakan curl atau Postman)
2. **Run K6 smoke test**
   ```bash
   cd k6-tests
   ./run-tests.sh
   # Pilih 1 (Smoke Test)
   ```
3. **Run K6 security test**
   ```bash
   ./run-tests.sh
   # Pilih 5 (Security Test)
   ```

## 📞 Support

Jika ada masalah:
1. Check error message di console
2. Verify database connection
3. Check migrations status
4. Review environment variables

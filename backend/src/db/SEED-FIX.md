# ✅ FIXED: Seed Test Users Script

## 🎉 Status: WORKING!

Error sudah diperbaiki! Script `npm run db:seed-test` sekarang berfungsi dengan baik.

---

## 🐛 Error yang Diperbaiki

**Error sebelumnya:**
```
SyntaxError: The requested module './schema.js' does not provide 
an export named 'userStores'
```

**Penyebab:**
- Script mencoba import `userStores` table yang tidak ada
- Di schema, store access diatur via field `storeCode` di table `userRoles`
- Tidak ada table terpisah `user_stores`

**Solusi:**
- Remove import `userStores`
- Update logic untuk assign `storeCode` langsung di `userRoles`
- Admin/Ops: `storeCode = null` (akses semua stores)
- Store users: `storeCode = 'STORE001'` (akses store tertentu)

---

## ✅ Cara Menggunakan (SEKARANG)

### **1. Jalankan Seed Script**

```bash
cd /media/muhrobby/DataExternal/Project/tiktok-hubs/backend
npm run db:seed-test
```

### **2. Output yang Diharapkan**

```
{"level":"info","msg":"Starting test users seeding for K6..."}
{"level":"info","msg":"Checking roles..."}
{"level":"info","msg":"Found 3 roles"}
{"level":"info","msg":"Checking test stores..."}
{"level":"info","msg":"Created test store: STORE003"}
{"level":"info","msg":"Creating test users..."}
{"level":"info","msg":"User 'admin' already exists, updating password..."}
{"level":"info","msg":"✓ Updated user: admin"}
{"level":"info","msg":"Creating user: ops..."}
{"level":"info","msg":"✓ Created user: ops (ID: 6)"}
{"level":"info","msg":"  ✓ Assigned role: Ops (all stores access)"}
{"level":"info","msg":"Creating user: store_user..."}
{"level":"info","msg":"✓ Created user: store_user (ID: 7)"}
{"level":"info","msg":"  ✓ Assigned role: Store with access to STORE001"}

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
```

✅ **Jika Anda melihat output seperti di atas, test users berhasil dibuat!**

---

## 🧪 Verify Test Users

### **Cek di Database:**

```bash
psql -U your_user -d tiktok_hubs

-- Check users
SELECT id, username, full_name, email FROM users 
WHERE username IN ('admin', 'ops', 'store_user');

-- Check role assignments with store access
SELECT 
  u.username, 
  r.name as role,
  ur.store_code
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.username IN ('admin', 'ops', 'store_user');
```

**Expected output:**
```
 username   | role  | store_code 
------------+-------+------------
 admin      | Admin | NULL
 ops        | Ops   | NULL
 store_user | Store | STORE001
```

- Admin: NULL store_code = akses semua stores ✅
- Ops: NULL store_code = akses semua stores ✅
- Store User: STORE001 = akses STORE001 saja ✅

---

## 🚀 Next Step: Run K6 Tests!

### **1. Start Backend (if not running)**

```bash
cd /media/muhrobby/DataExternal/Project/tiktok-hubs/backend
npm run dev
```

**Verify:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok",...}
```

### **2. Test Login Credentials**

```bash
# Test admin
curl -X POST http://localhost:3000/user-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Should return: {"success":true,"data":{"user":{...}}}
```

### **3. Run K6 Smoke Test**

```bash
cd /media/muhrobby/DataExternal/Project/tiktok-hubs/k6-tests
./run-tests.sh
```

Select option **1** (Smoke Test)

---

## 📋 Quick Commands

```bash
# Create test users
cd backend
npm run db:seed-test

# Verify users in database
psql -U postgres -d tiktok_hubs -c "
SELECT u.username, r.name, ur.store_code 
FROM users u 
JOIN user_roles ur ON u.id = ur.user_id 
JOIN roles r ON ur.role_id = r.id 
WHERE u.username IN ('admin', 'ops', 'store_user');"

# Test login
curl -X POST http://localhost:3000/user-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Run K6 tests
cd ../k6-tests
./run-tests.sh
```

---

## 🎯 Summary

✅ **Fixed:** Import error resolved  
✅ **Tested:** Script creates users successfully  
✅ **Schema:** Uses `userRoles.storeCode` instead of separate table  
✅ **Pushed:** Fix committed to GitHub (`c6649bd`)  

**You can now proceed with K6 testing!** 🚀

---

## 📞 Still Having Issues?

### Common Problems:

**1. "No roles found"**
```bash
# Run main seed first
npm run db:seed
npm run db:seed-test
```

**2. "Cannot connect to database"**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check .env file
cat .env | grep DATABASE_URL
```

**3. "Users exist but wrong password"**
```bash
# Re-run seed to update passwords
npm run db:seed-test
```

---

**Next:** [Run K6 Tests](../k6-tests/QUICK-START.md)

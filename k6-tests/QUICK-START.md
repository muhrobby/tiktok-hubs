# 🚀 Quick Start: K6 Load Testing Setup

Step-by-step guide untuk setup dan menjalankan K6 load testing dalam 10 menit!

---

## ✅ STEP 1: Install K6 (5 menit)

### Ubuntu/Debian:

```bash
# Install GPG key
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69

# Add repository
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list

# Install
sudo apt-get update
sudo apt-get install k6

# Verify
k6 version
```

**Expected output:**
```
k6 v0.48.0 (2024-01-15T12:34:56+0000/v0.48.0-0-gabcdef12, go1.21.5, linux/amd64)
```

---

## ✅ STEP 2: Create Test Users (2 menit)

### Option A: Automatic (Recommended) ⭐

```bash
cd /media/muhrobby/DataExternal/Project/tiktok-hubs/backend

# Run seed script
npm run db:seed-test
```

**Expected output:**
```
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
```

### Option B: Manual

Jika seed script gagal, insert manual ke database:

```sql
-- Connect to database
psql -U your_user -d tiktok_hubs

-- Insert users (already hashed passwords for convenience)
INSERT INTO users (username, password_hash, full_name, email, created_at, updated_at)
VALUES 
  ('admin', '$2b$10$YourBcryptHashHere', 'Test Admin', 'admin@test.local', NOW(), NOW()),
  ('ops', '$2b$10$YourBcryptHashHere', 'Test Ops', 'ops@test.local', NOW(), NOW()),
  ('store_user', '$2b$10$YourBcryptHashHere', 'Test Store User', 'store@test.local', NOW(), NOW());

-- Get role IDs
SELECT id, name FROM roles;

-- Assign roles (adjust IDs based on your roles)
INSERT INTO user_roles (user_id, role_id)
VALUES 
  (1, 1), -- admin -> Admin role
  (2, 2), -- ops -> Ops role
  (3, 3); -- store_user -> Store role
```

**Generate password hash:**
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(h => console.log(h));"
```

---

## ✅ STEP 3: Start Backend Server (1 menit)

```bash
cd /media/muhrobby/DataExternal/Project/tiktok-hubs/backend
npm run dev
```

**Expected output:**
```
{"level":"info","msg":"🚀 Server started successfully"}
{"level":"info","msg":"Health check: http://0.0.0.0:3000/health"}
```

**Verify server is running:**
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-01-28T10:30:00.000Z"}
```

---

## ✅ STEP 4: Verify Test Users (1 menit)

Test login dengan curl:

```bash
# Test admin login
curl -X POST http://localhost:3000/user-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Expected output:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "fullName": "Test Admin",
      "email": "admin@test.local",
      "role": "Admin"
    }
  }
}
```

✅ If you see `"success": true`, credentials are working!

---

## ✅ STEP 5: Run Your First Test (1 menit)

```bash
cd /media/muhrobby/DataExternal/Project/tiktok-hubs/k6-tests
./run-tests.sh
```

**Select option 1** (Smoke Test) from the menu:

```
Select test to run:

  1) Smoke Test (1 min, 1-2 VUs)
  2) Load Test (5 min, 10 VUs)
  3) Stress Test (14 min, up to 100 VUs)
  4) Spike Test (3 min, 10→100→10 VUs)
  5) Security/Pentest (3 min, 5 VUs)
  6) Run All Tests (~30 min)
  7) Quick Test Suite (Smoke + Security, ~5 min)

Enter choice [1-7]: 1
```

**Expected output:**
```
✓ checks.........................: 100.00% ✓ 15   ✗ 0   
  http_req_duration..............: avg=250ms p(95)=450ms
  http_req_failed................: 0.00%  ✓ 0    ✗ 15  
  http_reqs......................: 15     0.25/s
```

---

## 🎉 SUCCESS!

Jika Anda melihat:
- ✅ `checks: 100%` atau `>95%`
- ✅ `http_req_failed: 0%` atau `<1%`
- ✅ No error messages

**Congratulations! Testing suite is working!** 🚀

---

## 📊 Next Steps

### 1. Run Security Test

```bash
./run-tests.sh
# Select 5 (Security/Pentest)
```

### 2. Run Load Test

```bash
./run-tests.sh
# Select 2 (Load Test)
```

### 3. Review Results

Check generated reports in:
```bash
ls -lh reports/
cat reports/smoke-test_*.json | jq
```

---

## 🔧 Troubleshooting

### Problem: "K6 command not found"

**Solution:**
```bash
# Install K6 (see STEP 1)
k6 version
```

### Problem: "Cannot connect to server"

**Solution:**
```bash
# Make sure backend is running
cd backend && npm run dev

# In another terminal, verify:
curl http://localhost:3000/health
```

### Problem: "Login failed: 401"

**Solution:**
```bash
# Re-run seed script
cd backend
npm run db:seed-test

# Verify credentials
curl -X POST http://localhost:3000/user-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Problem: "Seed script fails"

**Solution:**
```bash
# Check database connection
cat backend/.env | grep DATABASE_URL

# Run migrations first
cd backend
npm run db:migrate
npm run db:seed      # Create roles first
npm run db:seed-test # Then create test users
```

### Problem: "Too many errors in tests"

**Possible causes:**
- Database not seeded with data
- Server overloaded
- Slow queries

**Solution:**
```bash
# Generate test data for analytics
cd backend
npx dotenv-cli -e .env npx tsx src/scripts/generate-test-analytics.ts

# Reduce load (edit k6-tests/utils/config.js)
# Change VUs from 10 to 5
```

---

## 📝 Checklist

Before running tests, verify:

- [ ] ✅ K6 installed (`k6 version` works)
- [ ] ✅ Test users created (`npm run db:seed-test`)
- [ ] ✅ Backend running (`curl localhost:3000/health`)
- [ ] ✅ Login works (test with curl)
- [ ] ✅ Database has data (run analytics test data script)

---

## 📚 Documentation

Full documentation available in:

- **K6 Testing Guide:** `/k6-tests/README.md`
- **Security Checklist:** `/k6-tests/SECURITY-CHECKLIST.md`
- **Seed Users Guide:** `/backend/src/db/SEED-TEST-USERS.md`

---

## ⏱️ Time Summary

| Step | Time | Status |
|------|------|--------|
| Install K6 | 5 min | ⏳ |
| Create test users | 2 min | ⏳ |
| Start backend | 1 min | ⏳ |
| Verify users | 1 min | ⏳ |
| Run first test | 1 min | ⏳ |
| **Total** | **10 min** | |

---

## 🎯 Quick Commands Reference

```bash
# Install K6
sudo apt-get update && sudo apt-get install k6

# Create test users
cd backend && npm run db:seed-test

# Start backend
cd backend && npm run dev

# Verify login
curl -X POST http://localhost:3000/user-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Run tests
cd k6-tests && ./run-tests.sh

# View reports
ls -lh reports/
```

---

**Happy Testing! 🚀**

Need help? Check the troubleshooting section or review the full documentation.

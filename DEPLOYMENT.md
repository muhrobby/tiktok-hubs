# 🚀 Panduan Deployment TikTok Hubs ke Production

Panduan lengkap untuk deploy aplikasi TikTok Hubs ke VPS menggunakan Docker dan Traefik.

---

## 📋 Daftar Isi

1. [Persyaratan](#persyaratan)
2. [Arsitektur Deployment](#arsitektur-deployment)
3. [Persiapan TikTok API](#persiapan-tiktok-api)
4. [Generate Security Keys](#generate-security-keys)
5. [Konfigurasi Environment](#konfigurasi-environment)
6. [Testing Lokal](#testing-lokal)
7. [Database Migration](#database-migration)
8. [Deployment ke VPS](#deployment-ke-vps)
9. [Verifikasi & Testing](#verifikasi--testing)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance](#maintenance)
12. [Backup & Recovery](#backup--recovery)

---

## 📦 Persyaratan

### Server Requirements
- **RAM**: Minimal 4 GB
- **CPU**: Minimal 2 cores
- **Storage**: Minimal 40 GB (20 GB sudah terpakai PostgreSQL)
- **OS**: Ubuntu 20.04+ / Debian 11+

### Software Requirements
- ✅ Docker (version 20.10+)
- ✅ Docker Compose (version 2.0+)
- ✅ Traefik v2+ (sudah running dengan Let's Encrypt)
- ✅ PostgreSQL (sudah running di VPS)
- ✅ Git
- ✅ OpenSSL (untuk generate keys)

### Network Requirements
- ✅ Domain/subdomain:
  - `tiktokhubs.humahub.my.id` → Frontend
  - `api-tiktokhubs.humahub.my.id` → Backend API
- ✅ DNS A records sudah mengarah ke IP VPS
- ✅ Traefik network `prod_net` sudah ada

### Cek Prerequisites

```bash
# Cek Docker
docker --version

# Cek Docker Compose
docker compose version

# Cek Traefik
docker ps | grep traefik

# Cek PostgreSQL
psql --version

# Cek OpenSSL
openssl version

# Cek Traefik network
docker network ls | grep prod_net
```

---

## 🏗️ Arsitektur Deployment

```
Internet
    ↓
[Traefik Reverse Proxy]
    ├─→ tiktokhubs.humahub.my.id → Frontend Container (Nuxt SSR)
    └─→ api-tiktokhubs.humahub.my.id → Backend Container (Hono API)
                                              ↓
                                        [PostgreSQL]
```

### Resource Allocation

| Service | Memory Limit | CPU Limit | Port Internal |
|---------|--------------|-----------|---------------|
| Backend | 1 GB | 1.0 | 3000 |
| Frontend | 1.5 GB | 1.0 | 3001 |
| PostgreSQL | 1 GB | 0.5 | 5432 |
| **System** | 500 MB | 0.5 | - |
| **Total** | **4 GB** | **2.0** | - |

### Networks

- **prod_net** (external): Network Traefik untuk routing eksternal
- **internal** (bridge): Network internal untuk komunikasi backend-frontend

---

## 🎯 Persiapan TikTok API

### Step 1: Buat TikTok Developer Account

1. Buka [TikTok Developer Portal](https://developers.tiktok.com/)
2. Klik **Register** di pojok kanan atas
3. Login dengan akun TikTok Anda (atau buat akun baru)
4. Lengkapi informasi profile:
   - Company/Individual name
   - Email address
   - Phone number
5. Verifikasi email Anda
6. Setujui Terms of Service

### Step 2: Buat App Baru

1. Setelah login, klik **Manage apps** di dashboard
2. Klik **+ Create an app**
3. Isi informasi aplikasi:
   ```
   App name: TikTok Hubs
   Description: Content performance aggregator for TikTok stores
   Category: Business Tools
   ```
4. Klik **Save**

### Step 3: Konfigurasi OAuth Settings

1. Di halaman detail app, scroll ke bagian **Login Kit for Web**
2. Klik **Configure**
3. Isi **Redirect URI**:
   ```
   https://api-tiktokhubs.humahub.my.id/auth/tiktok/callback
   ```
   
   ⚠️ **PENTING**: 
   - Redirect URI **HARUS** mengarah ke **BACKEND**, bukan frontend!
   - Pastikan menggunakan **HTTPS**
   - Tidak boleh ada trailing slash (`/`)

4. **Scopes yang diperlukan**:
   Centang/enable scopes berikut:
   - ✅ `user.info.basic` - Informasi profil user
   - ✅ `video.list` - List video user
   - ✅ `video.insights` - Analytics video

5. Klik **Save**

### Step 4: Dapatkan API Credentials

1. Di halaman app, temukan bagian **Client Key & Secret**
2. Salin nilai berikut (akan digunakan di `.env.production`):
   - **Client Key** (contoh: `awcb1a2d3e4f5g6h7`)
   - **Client Secret** (contoh: `xyz1234567890abcdef`)

⚠️ **PENTING**: Simpan credentials ini di tempat aman! Jangan commit ke Git!

### Step 5: Submit App untuk Review (Optional)

- Untuk development/testing: Tidak perlu submit
- Untuk production dengan > 1000 users: Submit app untuk review TikTok

---

## 🔐 Generate Security Keys

Security keys diperlukan untuk enkripsi token, JWT, dan data sensitif lainnya.

### Cara 1: Menggunakan Script (Recommended)

```bash
# Di root project
bash scripts/generate-keys.sh
```

Output:
```
✅ Security keys berhasil di-generate!
📄 File output: .env.keys
```

File `.env.keys` akan berisi:
```bash
TOKEN_ENC_KEY=abc123...
JWT_SECRET=def456...
REFRESH_TOKEN_SECRET=ghi789...
ENCRYPTION_KEY=jkl012...
ADMIN_API_KEY=mno345...
```

### Cara 2: Generate Manual

Jika script tidak bisa dijalankan, generate manual dengan OpenSSL:

```bash
# Token Encryption Key (64 char hex)
openssl rand -hex 32

# JWT Secret (base64)
openssl rand -base64 32

# Refresh Token Secret (base64)
openssl rand -base64 32

# Encryption Key (64 char hex)
openssl rand -hex 32

# Admin API Key (base64)
openssl rand -base64 32
```

⚠️ **PENTING**:
- Simpan file `.env.keys` di tempat aman (password manager, encrypted storage)
- **JANGAN** commit file ini ke Git
- Backup keys di tempat yang berbeda

---

## ⚙️ Konfigurasi Environment

### Step 1: Setup Backend Environment

```bash
# Copy template
cp backend/.env.production.template backend/.env.production

# Edit dengan text editor
nano backend/.env.production
```

Isi nilai-nilai berikut:

#### 1. Database Configuration

```bash
DATABASE_URL=postgresql://[USERNAME]:[PASSWORD]@[HOST]:5432/tiktok_hubs
```

**Contoh**:
```bash
# Jika PostgreSQL di localhost VPS
DATABASE_URL=postgresql://tiktokhubs_user:SecurePass123@localhost:5432/tiktok_hubs

# Jika PostgreSQL di container Docker
DATABASE_URL=postgresql://tiktokhubs_user:SecurePass123@postgres:5432/tiktok_hubs

# Jika PostgreSQL di remote server
DATABASE_URL=postgresql://tiktokhubs_user:SecurePass123@192.168.1.100:5432/tiktok_hubs
```

#### 2. TikTok API Credentials

```bash
TIKTOK_CLIENT_KEY=your_client_key_from_step_4
TIKTOK_CLIENT_SECRET=your_client_secret_from_step_4
TIKTOK_REDIRECT_URI=https://api-tiktokhubs.humahub.my.id/auth/tiktok/callback
```

#### 3. CORS Origins

```bash
CORS_ORIGIN=https://tiktokhubs.humahub.my.id,https://api-tiktokhubs.humahub.my.id
```

#### 4. Security Keys

Copy dari file `.env.keys`:

```bash
TOKEN_ENC_KEY=<paste_dari_.env.keys>
JWT_SECRET=<paste_dari_.env.keys>
REFRESH_TOKEN_SECRET=<paste_dari_.env.keys>
ENCRYPTION_KEY=<paste_dari_.env.keys>
```

#### 5. Admin API Key (Optional)

```bash
# Kosongkan jika tidak digunakan
ADMIN_API_KEY=

# Atau isi jika ingin enable API Key auth
ADMIN_API_KEY=<paste_dari_.env.keys>
```

### Step 2: Setup Frontend Environment

File `frontend/.env.production` sudah siap pakai, tapi verifikasi nilai-nilainya:

```bash
cat frontend/.env.production
```

Output:
```bash
BACKEND_URL=http://backend:3000
NUXT_PUBLIC_SITE_URL=https://tiktokhubs.humahub.my.id
NUXT_PUBLIC_API_URL=https://api-tiktokhubs.humahub.my.id
```

✅ Jika sesuai, tidak perlu diubah.

### Step 3: Verifikasi File .gitignore

Pastikan file-file sensitif tidak ter-commit:

```bash
# Cek .gitignore
cat .gitignore | grep -E "(\.env|\.keys)"
```

Harus ada:
```
.env
.env.*
!.env.example
!.env.production.template
.env.keys
```

---

## 🧪 Testing Lokal

Sebelum deploy ke VPS, test dulu di lokal untuk memastikan semua konfigurasi benar.

### Step 1: Buat Database Lokal

```bash
# Masuk ke PostgreSQL
psql -U postgres

# Buat database dan user
CREATE DATABASE tiktok_hubs_test;
CREATE USER test_user WITH PASSWORD 'test123';
GRANT ALL PRIVILEGES ON DATABASE tiktok_hubs_test TO test_user;
\q
```

### Step 2: Update DATABASE_URL untuk Testing

```bash
# Temporary: Edit .env.production untuk testing lokal
nano backend/.env.production

# Set ke database lokal
DATABASE_URL=postgresql://test_user:test123@localhost:5432/tiktok_hubs_test
```

### Step 3: Build Docker Images

```bash
# Build backend
docker build -t tiktokhubs-backend:test ./backend

# Build frontend
docker build -t tiktokhubs-frontend:test ./frontend
```

Expected output:
```
✅ Backend image built successfully
✅ Frontend image built successfully
```

### Step 4: Run Database Migration (Lokal)

```bash
# Jalankan migration
cd backend
npm install
npm run db:migrate

# Cek tables yang sudah dibuat
psql -U test_user -d tiktok_hubs_test -c "\dt"
```

Expected output:
```
           List of relations
 Schema |         Name          | Type  |   Owner   
--------+-----------------------+-------+-----------
 public | audit_logs            | table | test_user
 public | roles                 | table | test_user
 public | stores                | table | test_user
 public | store_accounts        | table | test_user
 public | sync_histories        | table | test_user
 public | user_roles            | table | test_user
 public | users                 | table | test_user
 public | video_metrics         | table | test_user
 public | videos                | table | test_user
```

### Step 5: Seed Admin User (Lokal)

```bash
# Install tsx jika belum
npm install -D tsx

# Run seed script
cd ..
npm run seed:admin -- --username=admin --email=admin@test.com --password=AdminTest123
```

Expected output:
```
✅ ADMIN USER CREATED SUCCESSFULLY!
📋 User Details:
   Username: admin
   Email: admin@test.com
```

### Step 6: Test dengan Docker Compose (Lokal)

```bash
# Update docker-compose untuk testing
# (Gunakan database lokal instead of production)

# Start services
docker compose -f docker-compose.prod.yml up -d

# Lihat logs
docker compose -f docker-compose.prod.yml logs -f
```

### Step 7: Akses via Localhost

Karena Traefik tidak ada di lokal, akses langsung via port:

```bash
# Backend health check
curl http://localhost:3000/health

# Frontend health check
curl http://localhost:3001/api/_health

# Frontend (buka di browser)
open http://localhost:3001
```

### Step 8: Login Test

1. Buka http://localhost:3001
2. Login dengan credentials admin yang dibuat di Step 5
3. Cek apakah bisa akses dashboard
4. Verifikasi permissions (admin bisa akses semua menu)

### Step 9: Cleanup

```bash
# Stop containers
docker compose -f docker-compose.prod.yml down

# Remove test images
docker rmi tiktokhubs-backend:test tiktokhubs-frontend:test

# Drop test database
psql -U postgres -c "DROP DATABASE tiktok_hubs_test;"
psql -U postgres -c "DROP USER test_user;"

# Restore DATABASE_URL di .env.production ke nilai production
```

---

## 🗄️ Database Migration

### Step 1: Buat Database Production

SSH ke VPS:

```bash
ssh user@your-vps-ip
```

Buat database:

```bash
# Masuk ke PostgreSQL
sudo -u postgres psql

# Buat database
CREATE DATABASE tiktok_hubs;

# Buat user khusus (recommended)
CREATE USER tiktokhubs_user WITH PASSWORD 'YourSecurePassword123';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE tiktok_hubs TO tiktokhubs_user;

# Untuk PostgreSQL 15+, grant tambahan
\c tiktok_hubs
GRANT ALL ON SCHEMA public TO tiktokhubs_user;

# Exit
\q
```

### Step 2: Test Koneksi Database

```bash
# Test koneksi
psql -U tiktokhubs_user -d tiktok_hubs -h localhost

# Jika berhasil, Anda akan masuk ke psql prompt
tiktok_hubs=>
```

### Step 3: Update DATABASE_URL

```bash
# Edit .env.production dengan credentials yang baru dibuat
nano backend/.env.production

# Set DATABASE_URL
DATABASE_URL=postgresql://tiktokhubs_user:YourSecurePassword123@localhost:5432/tiktok_hubs
```

### Step 4: Run Migrations

Ada 2 cara run migrations:

#### Cara 1: Via Docker (Recommended)

```bash
# Build image dulu (lihat section deployment)
docker compose -f docker-compose.prod.yml build backend

# Run migration via docker exec (setelah container berjalan)
docker compose -f docker-compose.prod.yml run --rm backend npm run db:migrate
```

#### Cara 2: Langsung di VPS (jika Node.js terinstall)

```bash
cd backend
npm install
npm run db:migrate
```

Expected output:
```
✅ Migration completed
✅ Database schema created successfully
```

### Step 5: Verifikasi Migration

```bash
# Cek tables yang dibuat
psql -U tiktokhubs_user -d tiktok_hubs -c "\dt"

# Cek roles yang di-seed
psql -U tiktokhubs_user -d tiktok_hubs -c "SELECT * FROM roles;"
```

Expected output:
```
 id |  name  |              description               
----+--------+----------------------------------------
  1 | Admin  | Full system access
  2 | Ops    | Operational access
  3 | Store  | Store-specific access
```

---

## 🚀 Deployment ke VPS

### Step 1: Upload Project ke VPS

#### Via Git (Recommended)

```bash
# Di VPS, clone repository
cd /opt  # atau direktori pilihan Anda
git clone https://github.com/your-username/tiktok-hubs.git
cd tiktok-hubs

# Checkout ke branch production (jika ada)
git checkout production
```

#### Via SCP/RSYNC

```bash
# Dari lokal, upload ke VPS
rsync -avz --exclude 'node_modules' \
      --exclude '.git' \
      --exclude 'dist' \
      --exclude '.output' \
      . user@your-vps-ip:/opt/tiktok-hubs/
```

### Step 2: Copy Environment Files

```bash
# Di VPS
cd /opt/tiktok-hubs

# Pastikan .env.production sudah ada dan terisi
ls -la backend/.env.production
ls -la frontend/.env.production

# Verifikasi isi (jangan tampilkan full, cek apakah ada values)
cat backend/.env.production | grep -E "(DATABASE_URL|TIKTOK_CLIENT_KEY|JWT_SECRET)" | sed 's/=.*/=***/'
```

Expected output:
```
DATABASE_URL=***
TIKTOK_CLIENT_KEY=***
JWT_SECRET=***
```

### Step 3: Build Docker Images

```bash
# Build di VPS (hemat bandwidth, tapi lebih lama)
docker compose -f docker-compose.prod.yml build

# Monitor build progress
# Backend build: ~3-5 menit
# Frontend build: ~5-10 menit
```

Expected output:
```
[+] Building 478.3s (XX/XX) FINISHED
✅ tiktokhubs-backend built successfully
✅ tiktokhubs-frontend built successfully
```

### Step 4: Run Database Migrations

```bash
# Jalankan migrations sebelum start aplikasi
docker compose -f docker-compose.prod.yml run --rm backend npm run db:migrate
```

### Step 5: Seed Admin User

```bash
# Buat user admin pertama
docker compose -f docker-compose.prod.yml run --rm backend \
  npm run seed:admin -- \
  --username=admin \
  --email=admin@humahub.my.id \
  --password=ChangeMe123! \
  --fullname="System Administrator"
```

⚠️ **PENTING**: Ganti password setelah login pertama!

### Step 6: Start Services

```bash
# Start semua services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                    STATUS          PORTS
tiktokhubs-backend      Up (healthy)    
tiktokhubs-frontend     Up (healthy)
```

### Step 7: Monitor Logs

```bash
# Lihat logs semua services
docker compose -f docker-compose.prod.yml logs -f

# Hanya backend
docker compose -f docker-compose.prod.yml logs -f backend

# Hanya frontend
docker compose -f docker-compose.prod.yml logs -f frontend
```

Logs yang baik:
```
backend  | ✅ Environment validated
backend  | ✅ Database connected
backend  | ✅ Server started on port 3000
frontend | ✅ Nuxt server listening on port 3001
```

### Step 8: Verifikasi Traefik Routing

```bash
# Cek Traefik logs
docker logs traefik | grep tiktokhubs

# Expected output:
# ✅ Router 'tiktokhubs-backend' created
# ✅ Router 'tiktokhubs-frontend' created
# ✅ Certificate obtained for api-tiktokhubs.humahub.my.id
# ✅ Certificate obtained for tiktokhubs.humahub.my.id
```

---

## ✅ Verifikasi & Testing

### 1. Health Checks

```bash
# Backend health check
curl https://api-tiktokhubs.humahub.my.id/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-01-24T10:30:00.000Z"
}

# Frontend health check
curl https://tiktokhubs.humahub.my.id/api/_health

# Expected response:
{
  "status": "ok",
  "service": "frontend",
  "timestamp": "2026-01-24T10:30:00.000Z"
}
```

### 2. SSL Certificate Check

```bash
# Cek SSL certificate
curl -vI https://tiktokhubs.humahub.my.id 2>&1 | grep "SSL certificate"

# Expected:
# ✅ SSL certificate verify ok
```

### 3. Frontend Access

Buka browser dan akses:
- https://tiktokhubs.humahub.my.id

Verifikasi:
- ✅ Halaman login muncul
- ✅ Tidak ada error SSL
- ✅ Console browser tidak ada error

### 4. Login Test

1. Login dengan admin credentials yang dibuat di Step 5
2. Verifikasi redirect ke dashboard
3. Cek menu sidebar:
   - ✅ Dashboard
   - ✅ Stores
   - ✅ Accounts
   - ✅ Analytics (hanya admin/ops)
   - ✅ Users (hanya admin)
   - ✅ Data Management (admin/ops)
   - ✅ Audit Logs (hanya admin)

### 5. API Endpoint Test

```bash
# Test API dengan JWT token
# (Login dulu di browser, copy JWT dari cookies)

# Get stores (butuh auth)
curl -H "Cookie: access_token=YOUR_JWT_TOKEN" \
     https://api-tiktokhubs.humahub.my.id/api/admin/stores
```

### 6. Docker Resource Check

```bash
# Cek resource usage
docker stats --no-stream
```

Expected:
```
CONTAINER              CPU %    MEM USAGE / LIMIT    MEM %
tiktokhubs-backend     2-5%     200-400MB / 1GB      20-40%
tiktokhubs-frontend    2-5%     300-600MB / 1.5GB    20-40%
```

### 7. Database Connection Test

```bash
# Exec ke backend container
docker exec -it tiktokhubs-backend sh

# Test database connection
node -e "require('postgres')(process.env.DATABASE_URL).query('SELECT NOW()').then(r => console.log(r[0]))"

# Expected: Current timestamp
```

---

## 🔧 Troubleshooting

### Issue 1: Container Tidak Start / Unhealthy

**Gejala**:
```bash
docker compose ps
# Output: tiktokhubs-backend (unhealthy)
```

**Diagnosa**:
```bash
# Lihat logs detail
docker compose -f docker-compose.prod.yml logs backend

# Lihat health check
docker inspect tiktokhubs-backend | grep -A 10 Health
```

**Solusi**:

1. **Environment variables tidak lengkap**:
   ```bash
   # Cek .env.production
   docker exec tiktokhubs-backend env | grep -E "(DATABASE_URL|JWT_SECRET)"
   ```

2. **Database tidak bisa diakses**:
   ```bash
   # Test koneksi database dari container
   docker exec tiktokhubs-backend pg_isready -h localhost -U tiktokhubs_user
   ```

3. **Port sudah digunakan**:
   ```bash
   # Cek port 3000 dan 3001
   netstat -tulpn | grep -E "(3000|3001)"
   ```

### Issue 2: SSL Certificate Error

**Gejala**:
- Browser menampilkan "Your connection is not private"
- Traefik logs: `unable to generate certificate for domain`

**Solusi**:

1. **Cek DNS records**:
   ```bash
   dig tiktokhubs.humahub.my.id
   dig api-tiktokhubs.humahub.my.id
   ```
   
   Harus mengarah ke IP VPS!

2. **Cek Let's Encrypt rate limit**:
   - Let's Encrypt limit: 5 certificates per week per domain
   - Tunggu 1 minggu atau gunakan staging

3. **Force renew certificate**:
   ```bash
   # Restart Traefik
   docker restart traefik
   
   # Restart aplikasi
   docker compose -f docker-compose.prod.yml restart
   ```

### Issue 3: Frontend Tidak Bisa Connect ke Backend

**Gejala**:
- Frontend muncul tapi API calls gagal
- Console error: `Failed to fetch` atau `Network error`

**Diagnosa**:
```bash
# Test dari frontend container
docker exec tiktokhubs-frontend curl http://backend:3000/health

# Test dari browser (public URL)
curl https://api-tiktokhubs.humahub.my.id/health
```

**Solusi**:

1. **CORS issue**:
   ```bash
   # Cek CORS_ORIGIN di backend/.env.production
   docker exec tiktokhubs-backend env | grep CORS_ORIGIN
   
   # Harus berisi: https://tiktokhubs.humahub.my.id,https://api-tiktokhubs.humahub.my.id
   ```

2. **Network issue**:
   ```bash
   # Cek apakah container di network yang sama
   docker network inspect prod_net
   docker network inspect internal
   ```

### Issue 4: Database Migration Failed

**Gejala**:
```
Error: relation "users" does not exist
```

**Solusi**:

1. **Re-run migrations**:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm backend npm run db:migrate
   ```

2. **Cek database permissions**:
   ```bash
   psql -U tiktokhubs_user -d tiktok_hubs -c "\dt"
   ```

3. **Manual migration** (last resort):
   ```bash
   # Backup dulu!
   pg_dump -U tiktokhubs_user tiktok_hubs > backup.sql
   
   # Drop dan recreate
   psql -U postgres -c "DROP DATABASE tiktok_hubs;"
   psql -U postgres -c "CREATE DATABASE tiktok_hubs;"
   
   # Run migrations lagi
   docker compose -f docker-compose.prod.yml run --rm backend npm run db:migrate
   ```

### Issue 5: TikTok OAuth Redirect Error

**Gejala**:
- Setelah authorize di TikTok, muncul error `redirect_uri_mismatch`

**Solusi**:

1. **Cek redirect URI di TikTok Developer Console**:
   - Harus PERSIS: `https://api-tiktokhubs.humahub.my.id/auth/tiktok/callback`
   - Tidak boleh ada trailing slash
   - Harus HTTPS

2. **Cek TIKTOK_REDIRECT_URI di .env.production**:
   ```bash
   docker exec tiktokhubs-backend env | grep TIKTOK_REDIRECT_URI
   ```

3. **Cek logs**:
   ```bash
   docker compose logs backend | grep "tiktok"
   ```

### Issue 6: High Memory Usage

**Gejala**:
```bash
docker stats
# Backend: 900MB / 1GB (90%)
```

**Solusi**:

1. **Restart container** (temporary):
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```

2. **Increase memory limit** (jika masih ada RAM available):
   ```yaml
   # Edit docker-compose.prod.yml
   deploy:
     resources:
       limits:
         memory: 1.5G  # Increase from 1G
   ```

3. **Optimize backend**:
   - Reduce SYNC_DAYS in .env
   - Optimize database queries
   - Add indexes

### Issue 7: Port Already in Use

**Gejala**:
```
Error: bind: address already in use
```

**Solusi**:

1. **Cek process yang menggunakan port**:
   ```bash
   sudo lsof -i :3000
   sudo lsof -i :3001
   ```

2. **Kill process**:
   ```bash
   sudo kill -9 <PID>
   ```

3. **Atau ubah port** di docker-compose.prod.yml (tidak recommended)

---

## 🛠️ Maintenance

### Update Aplikasi

```bash
# 1. Backup database
pg_dump -U tiktokhubs_user tiktok_hubs > backup_$(date +%Y%m%d).sql

# 2. Pull latest code
cd /opt/tiktok-hubs
git pull origin main

# 3. Rebuild images
docker compose -f docker-compose.prod.yml build

# 4. Run migrations (jika ada)
docker compose -f docker-compose.prod.yml run --rm backend npm run db:migrate

# 5. Restart services
docker compose -f docker-compose.prod.yml up -d

# 6. Verify
docker compose ps
curl https://tiktokhubs.humahub.my.id/api/_health
```

### Rollback

```bash
# 1. Stop current version
docker compose -f docker-compose.prod.yml down

# 2. Checkout previous version
git log --oneline  # Find previous commit
git checkout <commit-hash>

# 3. Rebuild
docker compose -f docker-compose.prod.yml build

# 4. Restore database (jika perlu)
psql -U tiktokhubs_user -d tiktok_hubs < backup_20260124.sql

# 5. Start
docker compose -f docker-compose.prod.yml up -d
```

### Monitor Logs

```bash
# Real-time logs
docker compose -f docker-compose.prod.yml logs -f

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100

# Filter by keyword
docker compose -f docker-compose.prod.yml logs | grep ERROR

# Export logs
docker compose -f docker-compose.prod.yml logs > logs_$(date +%Y%m%d).txt
```

### Cleanup

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove all stopped containers
docker container prune

# See disk usage
docker system df
```

### Database Maintenance

```bash
# Vacuum database (optimize)
psql -U tiktokhubs_user -d tiktok_hubs -c "VACUUM ANALYZE;"

# Cek database size
psql -U tiktokhubs_user -d tiktok_hubs -c "SELECT pg_size_pretty(pg_database_size('tiktok_hubs'));"

# Cek table sizes
psql -U tiktokhubs_user -d tiktok_hubs -c "
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## 💾 Backup & Recovery

### Automated Backup Script

Buat script `/opt/scripts/backup-tiktokhubs.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/backups/tiktokhubs"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="tiktok_hubs"
DB_USER="tiktokhubs_user"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup .env files
tar -czf $BACKUP_DIR/env_$DATE.tar.gz \
  /opt/tiktok-hubs/backend/.env.production \
  /opt/tiktok-hubs/frontend/.env.production

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "✅ Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /opt/scripts/backup-tiktokhubs.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add line:
0 2 * * * /opt/scripts/backup-tiktokhubs.sh >> /var/log/tiktokhubs-backup.log 2>&1
```

### Manual Backup

```bash
# Database
pg_dump -U tiktokhubs_user tiktok_hubs > backup.sql

# Environment files
tar -czf env-backup.tar.gz backend/.env.production frontend/.env.production

# Docker volumes (jika ada)
docker run --rm -v tiktokhubs_data:/data -v $(pwd):/backup alpine \
  tar -czf /backup/volumes.tar.gz /data
```

### Recovery

```bash
# 1. Stop aplikasi
docker compose -f docker-compose.prod.yml down

# 2. Restore database
psql -U tiktokhubs_user -d tiktok_hubs < backup.sql

# 3. Restore env files
tar -xzf env-backup.tar.gz

# 4. Start aplikasi
docker compose -f docker-compose.prod.yml up -d

# 5. Verify
docker compose ps
curl https://tiktokhubs.humahub.my.id/api/_health
```

---

## 📊 Monitoring

### Resource Monitoring

```bash
# CPU & Memory usage
docker stats

# Disk usage
df -h
docker system df

# Database connections
psql -U tiktokhubs_user -d tiktok_hubs -c "
  SELECT count(*) as connections 
  FROM pg_stat_activity 
  WHERE datname = 'tiktok_hubs';
"
```

### Application Monitoring

```bash
# Health check script
cat > /opt/scripts/healthcheck.sh << 'EOF'
#!/bin/bash

echo "🔍 TikTok Hubs Health Check - $(date)"
echo "=================================="

# Frontend
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" https://tiktokhubs.humahub.my.id/api/_health)
echo "Frontend: $FRONTEND"

# Backend
BACKEND=$(curl -s -o /dev/null -w "%{http_code}" https://api-tiktokhubs.humahub.my.id/health)
echo "Backend: $BACKEND"

# Database
DB=$(docker exec tiktokhubs-backend pg_isready -h localhost -U tiktokhubs_user && echo "200" || echo "500")
echo "Database: $DB"

if [ "$FRONTEND" = "200" ] && [ "$BACKEND" = "200" ] && [ "$DB" = "200" ]; then
  echo "✅ All systems operational"
  exit 0
else
  echo "❌ System issues detected"
  exit 1
fi
EOF

chmod +x /opt/scripts/healthcheck.sh

# Run every 5 minutes
crontab -e
# Add:
*/5 * * * * /opt/scripts/healthcheck.sh >> /var/log/tiktokhubs-health.log 2>&1
```

---

## 🔒 Security Checklist

- ✅ `.env.production` tidak ter-commit ke Git
- ✅ `.env.keys` disimpan di tempat aman (password manager)
- ✅ Database user tidak menggunakan password default
- ✅ Admin password sudah diganti dari default
- ✅ SSL/TLS aktif (HTTPS) via Let's Encrypt
- ✅ Security headers sudah dikonfigurasi di Traefik
- ✅ CORS hanya allow domain yang diperlukan
- ✅ Rate limiting aktif
- ✅ Firewall configured (UFW atau iptables)
- ✅ SSH menggunakan key, bukan password
- ✅ Regular backup terjadwal
- ✅ Monitoring & alerting aktif

### Firewall Configuration

```bash
# Install UFW
sudo apt-get install ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow HTTP & HTTPS (untuk Traefik)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable
sudo ufw enable

# Check status
sudo ufw status
```

---

## 📞 Support & Troubleshooting

Jika mengalami masalah:

1. **Cek dokumentasi ini** - Kebanyakan masalah umum sudah ada di Troubleshooting section
2. **Cek logs** - `docker compose logs -f`
3. **Cek health status** - `docker compose ps`
4. **Verifikasi konfigurasi** - `.env.production`, Traefik labels, DNS records

---

## 📝 Changelog

### Version 1.0.0 (2026-01-24)
- ✅ Initial production deployment guide
- ✅ Docker Compose configuration
- ✅ Traefik integration
- ✅ Security hardening
- ✅ Backup & monitoring procedures

---

**Dokumentasi dibuat oleh**: OpenCode AI  
**Terakhir diupdate**: 24 Januari 2026  
**Status**: Production Ready ✅

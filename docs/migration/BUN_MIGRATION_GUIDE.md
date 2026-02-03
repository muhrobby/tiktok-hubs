# Panduan Migrasi dari Node.js/NPM ke Bun

## Ringkasan

Dokumen ini berisi panduan lengkap untuk migrasi project **TikTok Hubs** dari Node.js/NPM ke **Bun** untuk performa yang lebih cepat.

### Mengapa Bun?

- **20x lebih cepat** dari npm untuk install dependencies
- **3x lebih cepat** menjalankan TypeScript files
- **Drop-in replacement** untuk Node.js - sebagian besar package kompatibel
- **Built-in TypeScript support** - tidak perlu tsx untuk development
- **Built-in test runner** - bisa menggantikan vitest jika ingin

---

## Prasyarat

1. Install Bun di local machine:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Verifikasi instalasi:
   ```bash
   bun --version
   ```

---

## Bagian 1: Package.json

### File: `package.json`

#### Perubahan yang Diperlukan:

**1. Update Scripts Section**

```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun dist/index.js",
    "start:prod": "bun run src/index.ts",
    "test": "vitest",
    "test:bun": "bun test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun run src/db/seed.ts",
    "db:seed-test": "bun run src/db/seed-test-users.ts"
  }
}
```

**Perubahan Detail:**

| Script Lama | Script Baru | Penjelasan |
|------------|-------------|------------|
| `tsx watch src/index.ts` | `bun --watch src/index.ts` | Bun punya built-in watch mode |
| `tsc` | `bun build ...` | Menggunakan bun build (opsional, tsc juga bisa) |
| `node dist/index.js` | `bun dist/index.js` | Runtime bun lebih cepat |
| `tsx src/db/seed.ts` | `bun run src/db/seed.ts` | Built-in TypeScript support |

**2. Update Engines Field**

```json
{
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

**3. Opsional: Hapus tsx dari devDependencies**

Setelah migrasi, `tsx` tidak lagi diperlukan karena Bun bisa menjalankan TypeScript langsung:

```bash
bun remove tsx
```

---

## Bagian 2: Dockerfile

### File: `Dockerfile`

#### Versi Lama (Node.js):

```dockerfile
FROM node:20-alpine AS deps
# ... npm commands ...
```

#### Versi Baru (Bun):

```dockerfile
# ==============================================
# Stage 1: Dependencies
# ==============================================
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies (production + dev for build)
RUN bun install --frozen-lockfile

# ==============================================
# Stage 2: Builder
# ==============================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build TypeScript (opsional - bun bisa run TS langsung)
RUN bun run build

# ==============================================
# Stage 3: Production
# ==============================================
FROM oven/bun:1-alpine AS production

# Set production environment
ENV NODE_ENV=production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package.json bun.lockb* ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy database migrations and config
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bun -u 1001
USER bun

# Expose port
EXPOSE 3000

# Health check dengan bun
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun --eval "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application dengan bun
CMD ["bun", "dist/index.js"]
```

**Perubahan Utama:**

1. **Base Image**: `node:20-alpine` → `oven/bun:1-alpine`
2. **Package Manager**: `npm ci` → `bun install --frozen-lockfile`
3. **Lock File**: `package-lock.json` → `bun.lockb` (auto-generated)
4. **Runtime**: `node` → `bun`
5. **Health Check**: Menggunakan `bun --eval` alih-alih `node -e`

---

## Bagian 3: Docker Compose Development

### File: `docker-compose.yml`

Tambahkan service backend dengan Bun:

```yaml
version: "3.8"

services:
  # ==============================================
  # BACKEND SERVICE (Baru dengan Bun)
  # ==============================================
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: tiktok-hubs-backend
    restart: unless-stopped

    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://tiktok_user:${DB_PASSWORD}@postgres:5432/tiktok_hubs
      - PORT=3000

    ports:
      - "${API_PORT:-3000}:3000"

    volumes:
      # Hot reload untuk development
      - ./src:/app/src
      - ./drizzle.config.ts:/app/drizzle.config.ts

    depends_on:
      postgres:
        condition: service_healthy

    networks:
      - tiktok-hubs-network

  # ==============================================
  # POSTGRESQL DATABASE (Existing)
  # ==============================================
  postgres:
    image: postgres:16-alpine
    container_name: tiktok-hubs-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-tiktok_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Database password is required}
      POSTGRES_DB: ${DB_NAME:-tiktok_hubs}
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256"
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-tiktok_user} -d ${DB_NAME:-tiktok_hubs}"]
      interval: 10s
      timeout: 5s
      retries: 5
    security_opt:
      - no-new-privileges:true
    networks:
      - tiktok-hubs-network

  # ==============================================
  # PGADMIN (Optional - Development Only)
  # ==============================================
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: tiktok-hubs-pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL:-admin@local.dev}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD:?PgAdmin password is required}
    ports:
      - "${PGADMIN_PORT:-5050}:80"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    depends_on:
      - postgres
    profiles:
      - tools
    security_opt:
      - no-new-privileges:true
    networks:
      - tiktok-hubs-network

volumes:
  postgres_data:
  pgadmin_data:

networks:
  tiktok-hubs-network:
    name: tiktok-hubs-network
```

---

## Bagian 4: Docker Compose Production

### File: `docker-compose.prod.yml`

Update backend service untuk production:

```yaml
version: '3.8'

services:
  # ==============================================
  # BACKEND SERVICE dengan Bun
  # ==============================================
  backend:
    build:
      context: .
      dockerfile: Dockerfile
      target: production  # Multi-stage build target
    container_name: tiktokhubs-backend
    restart: unless-stopped

    env_file:
      - .env.production

    environment:
      - NODE_ENV=production
      - TZ=Asia/Jakarta

    # Health check dengan bun
    healthcheck:
      test: ["CMD", "bun", "--eval", "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # Resource limits
    deploy:
      resources:
        limits:
          memory: 512M      # Bun lebih efisien, bisa kurangi dari 1G
          cpus: '0.5'
        reservations:
          memory: 256M      # Kurangi dari 512M
          cpus: '0.25'

    networks:
      - prod_net
      - internal

    # Traefik labels
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tiktokhubs-backend.rule=Host(`api-tiktokhubs.humahub.my.id`)"
      - "traefik.http.routers.tiktokhubs-backend.entrypoints=websecure"
      - "traefik.http.routers.tiktokhubs-backend.tls=true"
      - "traefik.http.routers.tiktokhubs-backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.tiktokhubs-backend.loadbalancer.server.port=3000"
      - "traefik.http.routers.tiktokhubs-backend.middlewares=backend-security"
      - "traefik.docker.network=prod_net"

networks:
  prod_net:
    external: true
  internal:
    driver: bridge
```

**Catatan:** Frontend service dihapus karena tidak ada folder frontend di project.

---

## Bagian 5: TypeScript Configuration

### File: `tsconfig.json`

Minor adjustments untuk Bun compatibility:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["bun"], // Tambahkan "bun" types
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "outDir": "dist", // Ubah dari backend/dist ke dist
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Langkah-langkah Migrasi

### Step 1: Backup & Testing

1. **Backup project:**
   ```bash
   git checkout -b feature/bun-migration
   ```

2. **Install Bun locally:**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

### Step 2: Migrate package.json

```bash
# Update scripts di package.json
# Lihat bagian "Package.json" di atas
```

### Step 3: Install Dependencies dengan Bun

```bash
# Hapus node_modules dan lock file lama
rm -rf node_modules package-lock.json

# Install dengan Bun (auto-generate bun.lockb)
bun install
```

### Step 4: Test Development

```bash
# Test dev mode
bun run dev

# Test build
bun run build

# Test start
bun run start

# Test database scripts
bun run db:push
bun run db:seed
```

### Step 5: Update Dockerfiles

```bash
# Update Dockerfile
# Lihat bagian "Dockerfile" di atas
```

### Step 6: Test Docker Build

```bash
# Build image
docker build -t tiktok-hubs:bun .

# Test run container
docker run -p 3000:3000 --env-file .env tiktok-hubs:bun
```

### Step 7: Update Docker Compose

```bash
# Update docker-compose.yml dan docker-compose.prod.yml
# Lihat bagian terkait di atas
```

### Step 8: Test Docker Compose

```bash
# Development
docker-compose up backend

# Production
docker-compose -f docker-compose.prod.yml up backend
```

### Step 9: Final Verification

1. **Test semua endpoints API**
2. **Test database migrations**
3. **Test background jobs**
4. **Test authentication flow**

---

## Troubleshooting

### Issue: Package tidak kompatibel dengan Bun

**Solusi:**
- Cek [Bun Compatibility](https://bun.sh/docs/runtime/nodejs-compatibility)
- Sebagian besar Node.js package compatible
- Jika ada issue dengan native module, bisa gunakan `bun patch` atau fallback ke npm

### Issue: TypeScript types error

**Solusi:**
```bash
# Install @types/bun
bun add -d @types/bun

# Update tsconfig.json types
"types": ["bun"]
```

### Issue: Docker build gagal

**Solusi:**
- Pastikan menggunakan `oven/bun:1-alpine` base image
- Cek version compatibility dengan `bun --version` di dalam container

---

## Perbandingan Performa (Expected)

| Operation | Node.js | Bun | Improvement |
|-----------|---------|-----|-------------|
| Install deps | ~30s | ~2s | **15x faster** |
| Cold start | ~500ms | ~100ms | **5x faster** |
| TypeScript run | N/A (need tsx) | ~50ms | **Direct run** |
| Build time | ~5s | ~2s | **2.5x faster** |

---

## Checklist Migrasi

- [ ] Install Bun di local machine
- [ ] Update package.json scripts
- [ ] Update engines field
- [ ] Install dependencies dengan `bun install`
- [ ] Test semua scripts locally
- [ ] Update Dockerfile
- [ ] Test Docker build
- [ ] Update docker-compose.yml
- [ ] Update docker-compose.prod.yml
- [ ] Test docker-compose up
- [ ] Deploy ke staging environment
- [ ] Monitor untuk 24-48 jam
- [ ] Deploy ke production

---

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [Bun Discord](https://bun.sh/discord)
- [Bun GitHub](https://github.com/oven-sh/bun)
- [Hono with Bun](https://hono.dev/getting-started/bun)

---

## Catatan Penting

1. **Bun.lockb** adalah binary file - tidak perlu di-commit ke git jika menggunakan lockfile convention
2. **Traefik configuration** di docker-compose.prod.yml tetap sama
3. **Environment variables** tidak berubah
4. **Database credentials** dan migrations tidak terpengaruh

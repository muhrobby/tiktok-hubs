# 📚 Learning Guide Part 1: Project Setup & Foundation

## 🎯 Tujuan Pembelajaran

Memahami setup dasar project Node.js dengan TypeScript, struktur folder, dan konfigurasi development environment.

---

## 1. Inisialisasi Project

### 1.1 Setup Node.js Project

```bash
mkdir tiktok-hubs
cd tiktok-hubs
npm init -y
```

**Penjelasan:**

- `npm init -y` membuat file `package.json` yang berisi metadata project
- `-y` flag untuk auto-accept semua default values
- `package.json` adalah "blueprint" project yang mendefinisikan dependencies dan scripts

### 1.2 Install Dependencies Utama

```bash
npm install hono @hono/node-server dotenv drizzle-orm pg pino node-cron
```

**Breakdown setiap package:**

1. **`hono`** - Web framework modern untuk Node.js
   - **Kenapa Hono?**
     - Sangat cepat (lebih cepat dari Express)
     - TypeScript-first (type safety built-in)
     - Ukuran kecil (~20KB)
     - Mudah dipelajari, syntax simple
2. **`@hono/node-server`** - Adapter untuk menjalankan Hono di Node.js

   - Hono bisa jalan di berbagai platform (Node, Cloudflare Workers, Deno)
   - Package ini untuk spesifik Node.js runtime

3. **`dotenv`** - Load environment variables dari file `.env`

   - **Kenapa perlu?**
     - Menyimpan secrets (password, API keys) terpisah dari code
     - Beda environment (dev/staging/production) punya config beda
     - Security best practice

4. **`drizzle-orm`** - ORM (Object-Relational Mapping) untuk database

   - **Kenapa Drizzle?**
     - Type-safe queries (TypeScript mendukung penuh)
     - Performa tinggi (compile ke SQL murni)
     - Tidak perlu belajar DSL baru, mirip SQL biasa

5. **`pg`** - PostgreSQL client untuk Node.js

   - Driver untuk koneksi ke database PostgreSQL
   - Drizzle butuh ini untuk berkomunikasi dengan PostgreSQL

6. **`pino`** - Logger super cepat

   - **Kenapa Pino?**
     - Fastest logger untuk Node.js
     - JSON output (mudah di-parse oleh log management tools)
     - Low overhead (tidak memperlambat aplikasi)

7. **`node-cron`** - Scheduler untuk background jobs
   - Menjalankan task otomatis pada waktu tertentu (seperti cron di Linux)
   - Contoh: sync data setiap hari jam 2 pagi

### 1.3 Install Dev Dependencies

```bash
npm install -D typescript @types/node @types/pg @types/node-cron tsx drizzle-kit pino-pretty
```

**Dev Dependencies (hanya untuk development):**

1. **`typescript`** - Compiler TypeScript

   - Mengubah TypeScript (.ts) menjadi JavaScript (.js)

2. **`@types/node`, `@types/pg`, `@types/node-cron`** - Type definitions

   - File `.d.ts` yang memberikan type information untuk library JavaScript
   - Membuat autocomplete dan type checking bekerja

3. **`tsx`** - TypeScript executor

   - Menjalankan file .ts langsung tanpa compile manual
   - Fitur watch mode untuk auto-reload saat development

4. **`drizzle-kit`** - CLI tools untuk Drizzle

   - Generate migrations
   - Push schema ke database
   - Database studio (GUI untuk lihat data)

5. **`pino-pretty`** - Formatter untuk Pino logs
   - Membuat log lebih mudah dibaca manusia saat development
   - Production tetap pakai JSON (machine-readable)

---

## 2. Konfigurasi TypeScript

### 2.1 Buat `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Penjelasan setiap option:**

1. **`target: "ES2022"`** - Target JavaScript version

   - Compile TypeScript ke ES2022 (modern JavaScript)
   - Node.js 20 support ES2022 penuh

2. **`module: "ES2022"`** - Module system

   - Menggunakan ES Modules (`import/export`)
   - Bukan CommonJS (`require/module.exports`)
   - **Kenapa ES Modules?** Modern, tree-shakeable, async by design

3. **`moduleResolution: "node"`** - Cara resolve imports

   - Ikuti aturan Node.js untuk mencari modules

4. **`outDir: "./dist"`** - Output folder setelah compile

   - TypeScript (.ts) → JavaScript (.js) masuk ke folder `dist/`

5. **`rootDir: "./src"`** - Root source code folder

   - Semua code ada di `src/`
   - Struktur folder tetap sama di `dist/`

6. **`strict: true`** - Enable semua strict type checking

   - **SANGAT PENTING** untuk type safety
   - Catch bugs di compile time, bukan runtime

7. **`esModuleInterop: true`** - Better CommonJS interop

   - Memudahkan import library CommonJS di ES Modules

8. **`skipLibCheck: true`** - Skip type checking `.d.ts` files

   - Mempercepat compile
   - Kita percaya type definitions dari npm sudah benar

9. **`sourceMap: true`** - Generate source maps
   - Mapping dari compiled JS ke original TS
   - Debugging lebih mudah (error line numbers akurat)

### 2.2 Update `package.json`

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

**Penjelasan scripts:**

1. **`"type": "module"`** - PENTING!

   - Memberitahu Node.js bahwa ini ES Modules project
   - File `.js` akan diperlakukan sebagai ES Modules

2. **`dev`** - Development mode

   - `tsx watch` = jalankan dan auto-reload saat file berubah
   - Untuk coding sehari-hari

3. **`build`** - Compile TypeScript

   - Jalankan `tsc` (TypeScript compiler)
   - Output ke folder `dist/`

4. **`start`** - Production mode

   - Jalankan compiled JavaScript
   - Harus `npm run build` dulu

5. **`db:*`** - Database management commands
   - `generate`: buat migration files dari schema
   - `push`: langsung update database (development)
   - `studio`: buka GUI untuk manage data

---

## 3. Struktur Folder Project

```
tiktok-hubs/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Hono app setup
│   ├── db/
│   │   ├── client.ts         # Database connection
│   │   └── schema.ts         # Database schema (tables)
│   ├── routes/
│   │   ├── auth.routes.ts    # OAuth endpoints
│   │   └── admin.routes.ts   # Admin API endpoints
│   ├── services/
│   │   ├── tiktokAuth.service.ts
│   │   ├── tiktokApi.service.ts
│   │   ├── token.service.ts
│   │   └── sync.service.ts
│   ├── jobs/
│   │   ├── scheduler.ts
│   │   ├── refreshTokens.job.ts
│   │   ├── syncUserDaily.job.ts
│   │   └── syncVideoDaily.job.ts
│   └── utils/
│       ├── logger.ts
│       ├── crypto.ts
│       ├── backoff.ts
│       └── locks.ts
├── .env                      # Environment variables (JANGAN commit!)
├── .env.example              # Template environment variables
├── .gitignore                # Files yang diabaikan Git
├── tsconfig.json             # TypeScript config
├── drizzle.config.ts         # Drizzle ORM config
├── package.json              # Project metadata
└── README.md                 # Dokumentasi
```

**Penjelasan struktur:**

### 3.1 Folder `db/`

- **Responsibility:** Database-related code
- `client.ts`: Connection pool, Drizzle instance
- `schema.ts`: Table definitions

**Kenapa dipisah?**

- Separation of concerns
- Mudah di-test
- Mudah diganti database (misal PostgreSQL → MySQL)

### 3.2 Folder `routes/`

- **Responsibility:** HTTP endpoints (controllers)
- Menerima request, validasi input, return response
- Tidak boleh ada business logic

**Kenapa pisah routes?**

- Setiap route fokus ke satu concern
- Mudah maintain
- Mudah baca (tidak membingungkan)

### 3.3 Folder `services/`

- **Responsibility:** Business logic
- Operasi pada data
- Interaksi dengan external APIs

**Kenapa perlu services?**

- Reusable (bisa dipanggil dari routes, jobs, dll)
- Testable (mudah di-unit test)
- Single Responsibility Principle

### 3.4 Folder `jobs/`

- **Responsibility:** Background tasks
- Scheduled jobs (cron)
- Long-running operations

**Kenapa pisah?**

- Tidak blocking HTTP requests
- Bisa di-scale terpisah
- Monitoring lebih mudah

### 3.5 Folder `utils/`

- **Responsibility:** Helper functions
- Pure functions (input → output, no side effects)
- Reusable di seluruh aplikasi

---

## 4. Environment Variables

### 4.1 Buat `.env.example`

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# TikTok API
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback

# Security
TOKEN_ENC_KEY=generate_with_openssl_or_node_crypto
ADMIN_API_KEY=generate_random_string

# Server
PORT=3000
```

### 4.2 Copy dan isi `.env`

```bash
cp .env.example .env
# Edit .env dengan values yang real
```

**Kenapa pakai .env?**

1. **Security**

   - Secrets tidak masuk ke Git repository
   - Setiap developer punya credentials sendiri

2. **Flexibility**

   - Dev/staging/production punya config berbeda
   - Ganti config tanpa ubah code

3. **12-Factor App Principle**
   - Config disimpan di environment
   - Code dan config terpisah

**Best Practices:**

- ❌ JANGAN commit `.env` ke Git!
- ✅ Commit `.env.example` sebagai template
- ✅ Tambahkan `.env` ke `.gitignore`

---

## 5. Entry Point - `src/index.ts`

```typescript
// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config();

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  try {
    logger.info("Starting TikTok Content Reporting Hub...");

    const app = createApp();

    serve({
      fetch: app.fetch,
      port: PORT,
    });

    logger.info(`🚀 Server started on http://localhost:${PORT}`);
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

main();
```

**Penjelasan baris per baris:**

### Line 1-2: Load Environment Variables

```typescript
import dotenv from "dotenv";
dotenv.config();
```

- **HARUS di paling atas!**
- `dotenv.config()` membaca file `.env` dan set ke `process.env`
- Jika di bawah, modules lain yang butuh env vars akan error

### Line 4-6: Imports

```typescript
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";
```

- `.js` extension WAJIB di ES Modules (walaupun file aslinya `.ts`)
- TypeScript compiler akan transpile tapi tetap keep extension

### Line 8: Parse PORT

```typescript
const PORT = parseInt(process.env.PORT || "3000", 10);
```

- `process.env.PORT` adalah string (env vars selalu string)
- `parseInt(..., 10)` convert ke number (base 10)
- Default 3000 jika PORT tidak diset

### Line 10-25: Main Function

```typescript
async function main() {
  try {
    // Start server
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

main();
```

- **Kenapa async function?** Kita butuh await untuk async operations
- **Try-catch:** Catch unhandled errors saat startup
- **`process.exit(1)`:** Exit dengan error code (non-zero = error)

---

## 6. Logging dengan Pino

### 6.1 Setup Logger - `src/utils/logger.ts`

```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty" }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: "tiktok-hubs",
  },
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.client_secret",
    ],
    remove: true,
  },
});
```

**Penjelasan setiap option:**

### `level`

```typescript
level: process.env.LOG_LEVEL || "info";
```

- **Log levels:** trace, debug, info, warn, error, fatal
- Development: `"debug"` untuk lihat semua
- Production: `"info"` untuk performance

### `transport`

```typescript
transport: process.env.NODE_ENV !== "production"
  ? { target: "pino-pretty" }
  : undefined;
```

- **Development:** Pretty-print (human-readable)
- **Production:** JSON (machine-readable, untuk log aggregators)

### `base`

```typescript
base: {
  service: "tiktok-hubs",
}
```

- Metadata yang ditambahkan ke setiap log
- Berguna jika ada multiple services dalam satu log system

### `redact`

```typescript
redact: {
  paths: ["*.password", "*.token", ...],
  remove: true,
}
```

- **PENTING untuk security!**
- Automatically remove sensitive data dari logs
- Pattern matching dengan wildcard (`*`)

**Contoh penggunaan:**

```typescript
logger.info("User logged in");
// Output: {"level":"info","time":1234567890,"service":"tiktok-hubs","msg":"User logged in"}

logger.error({ err: error }, "Failed to connect");
// Output: {"level":"error","time":1234567890,"service":"tiktok-hubs","err":{...},"msg":"Failed to connect"}

logger.debug({ userId: 123, token: "secret" });
// Output: {"level":"debug","time":1234567890,"service":"tiktok-hubs","userId":123,"token":"[Redacted]"}
```

---

## 7. Git Setup

### 7.1 Buat `.gitignore`

```
# Dependencies
node_modules/

# Build output
dist/

# Environment variables
.env
.env.local
.env.*.local

# Logs
logs/
*.log

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Database
*.db
*.sqlite
```

**Kenapa ignore files ini?**

1. **`node_modules/`** - Besar (ratusan MB), bisa di-install ulang dengan `npm install`
2. **`dist/`** - Compiled code, bisa di-generate ulang dengan `npm run build`
3. **`.env`** - Contains secrets, JANGAN PERNAH commit!
4. **`logs/`** - Log files bisa jadi besar, tidak perlu di-version control

### 7.2 Initialize Git

```bash
git init
git add .
git commit -m "Initial commit: Project setup"
```

---

## 🎓 Kesimpulan Part 1

Anda telah belajar:

✅ **Setup Node.js + TypeScript project**

- Package management dengan npm
- TypeScript configuration
- ES Modules vs CommonJS

✅ **Project structure best practices**

- Separation of concerns
- Folder organization
- Naming conventions

✅ **Environment variables**

- Security considerations
- Configuration management
- dotenv usage

✅ **Logging fundamentals**

- Structured logging dengan Pino
- Log levels
- Redacting sensitive data

✅ **Version control**

- Git initialization
- .gitignore setup

---

## 📚 Next Steps

Lanjut ke **Part 2: Database Design & Drizzle ORM** untuk belajar:

- PostgreSQL setup
- Database schema design
- Drizzle ORM usage
- Migrations

---

## 💡 Tips Belajar

1. **Ketik ulang code** - Jangan copy-paste, ketik manual untuk muscle memory
2. **Eksperimen** - Ubah code dan lihat apa yang terjadi
3. **Baca error messages** - Error adalah guru terbaik
4. **Console.log everywhere** - Debug dengan print values
5. **Baca dokumentasi** - Official docs adalah source of truth

Happy coding! 🚀

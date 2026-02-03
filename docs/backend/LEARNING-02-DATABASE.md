# 📚 Learning Guide Part 2: Database Design & Drizzle ORM

## 🎯 Tujuan Pembelajaran

Memahami database design, PostgreSQL, dan cara menggunakan Drizzle ORM untuk type-safe database operations.

---

## 1. Database Design Fundamentals

### 1.1 Kenapa PostgreSQL?

**PostgreSQL vs MySQL vs MongoDB:**

| Feature         | PostgreSQL   | MySQL       | MongoDB     |
| --------------- | ------------ | ----------- | ----------- |
| Data Model      | Relational   | Relational  | Document    |
| ACID Compliance | ✅ Strong    | ✅ Good     | ❌ Eventual |
| JSON Support    | ✅ Native    | ⚠️ Limited  | ✅ Native   |
| Complex Queries | ✅ Excellent | ✅ Good     | ❌ Limited  |
| Type Safety     | ✅ Strong    | ⚠️ Moderate | ❌ Weak     |

**Pilih PostgreSQL karena:**

1. **ACID Compliance** - Data integrity terjamin
2. **JSON Support** - Flexible untuk semi-structured data
3. **Advanced Features** - Window functions, CTEs, full-text search
4. **Open Source** - Free, community-driven
5. **Scalability** - Production-ready untuk aplikasi besar

### 1.2 Database Schema Design

**Entities dalam aplikasi kita:**

```
Stores (Toko)
    ↓ has many
Store Accounts (Akun TikTok per toko)
    ↓ generates
User Daily Stats (Snapshot harian statistik user)
Video Daily Stats (Snapshot harian statistik video)
Sync Logs (Log proses sync)
```

**Prinsip Design:**

1. **Normalization** - Hindari redundant data
2. **Indexing** - Speed up queries yang sering dipakai
3. **Constraints** - Enforce data integrity di database level
4. **Timestamps** - Track created/updated untuk auditing

---

## 2. Drizzle ORM Setup

### 2.1 Konfigurasi - `drizzle.config.ts`

```typescript
import type { Config } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

**Penjelasan:**

### `schema`

```typescript
schema: "./src/db/schema.ts";
```

- Path ke file yang define tables
- Drizzle baca file ini untuk generate migrations

### `out`

```typescript
out: "./drizzle";
```

- Folder untuk migration files
- Generated automatically oleh `drizzle-kit generate`

### `dialect`

```typescript
dialect: "postgresql";
```

- Database type
- Options: `postgresql`, `mysql`, `sqlite`

### `dbCredentials`

```typescript
dbCredentials: {
  url: process.env.DATABASE_URL!,
}
```

- Connection string ke database
- Format: `postgresql://user:password@host:port/database`
- `!` adalah non-null assertion (kita yakin env var ada)

---

## 3. Database Schema - `src/db/schema.ts`

### 3.1 Imports & Enums

```typescript
import {
  pgTable,
  varchar,
  text,
  timestamp,
  date,
  integer,
  bigint,
  serial,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
```

**Penjelasan imports:**

- **`pgTable`** - Define table untuk PostgreSQL
- **Data types:**
  - `varchar(length)` - Variable character string (optimal untuk short strings)
  - `text` - Unlimited length string
  - `timestamp` - Date + time dengan timezone support
  - `date` - Date only (no time)
  - `integer` - 32-bit integer (-2B to 2B)
  - `bigint` - 64-bit integer (untuk very large numbers)
  - `serial` - Auto-incrementing integer
- **`pgEnum`** - PostgreSQL ENUM type (predefined set of values)
- **`unique`** - Unique constraint
- **`index`** - Create index for faster queries
- **`relations`** - Define relationships between tables

### 3.2 Enums

```typescript
export const accountStatusEnum = pgEnum("account_status", [
  "CONNECTED",
  "NEED_RECONNECT",
  "ERROR",
  "DISABLED",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "SUCCESS",
  "FAILED",
  "SKIPPED",
  "RUNNING",
]);
```

**Kenapa pakai ENUMs?**

1. **Type Safety** - Hanya values yang valid bisa disimpan
2. **Database Validation** - Database reject invalid values
3. **Self-documenting** - Clear possible states
4. **Performance** - ENUMs stored as integers internally

**Contoh penggunaan:**

```typescript
// ✅ Valid
status: "CONNECTED";

// ❌ Error (TypeScript + Database reject)
status: "INVALID_STATUS";
```

---

## 4. Table Definitions

### 4.1 Stores Table

```typescript
export const stores = pgTable("stores", {
  storeCode: varchar("store_code", { length: 50 }).primaryKey(),
  storeName: varchar("store_name", { length: 255 }).notNull(),
  picName: varchar("pic_name", { length: 255 }).notNull(),
  picContact: varchar("pic_contact", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**Penjelasan setiap field:**

#### `storeCode`

```typescript
varchar("store_code", { length: 50 }).primaryKey();
```

- **Primary Key** - Unique identifier
- **Kenapa varchar bukan serial?** Business identifier (e.g., "store_jakarta_01")
- **Length 50** - Cukup untuk kode yang readable

#### `storeName`

```typescript
varchar("store_name", { length: 255 }).notNull();
```

- **`.notNull()`** - Field wajib diisi
- **255 chars** - Standard untuk names

#### `picContact`

```typescript
varchar("pic_contact", { length: 255 });
```

- **No `.notNull()`** - Optional field
- Bisa store email atau phone number

#### `createdAt`

```typescript
timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
```

- **`withTimezone: true`** - PENTING! Timestamp dengan timezone info
- **`.defaultNow()`** - Automatically set saat insert
- **Kenapa timezone penting?** User bisa dari timezone berbeda

### 4.2 Store Accounts Table (TikTok Accounts)

```typescript
export const storeAccounts = pgTable(
  "store_accounts",
  {
    id: serial("id").primaryKey(),
    storeCode: varchar("store_code", { length: 50 })
      .references(() => stores.storeCode, { onDelete: "cascade" })
      .notNull(),
    openId: varchar("open_id", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
    }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }).notNull(),
    scope: text("scope").notNull(),
    status: accountStatusEnum("status").default("CONNECTED").notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    storeCodeIdx: index("store_accounts_store_code_idx").on(table.storeCode),
    uniqueStoreOpen: unique("unique_store_openid").on(
      table.storeCode,
      table.openId
    ),
  })
);
```

**Konsep penting:**

#### Foreign Key dengan Cascade Delete

```typescript
storeCode: varchar("store_code", { length: 50 }).references(
  () => stores.storeCode,
  { onDelete: "cascade" }
);
```

- **`references()`** - Foreign key ke table stores
- **`onDelete: "cascade"`** - Jika store dihapus, account ikut terhapus
- **Kenapa cascade?** Maintain referential integrity automatically

#### Encrypted Tokens

```typescript
encryptedAccessToken: text("encrypted_access_token").notNull();
```

- **`text` bukan `varchar`** - Encrypted string bisa panjang
- Token TIDAK disimpan plaintext (security!)
- Encrypted dengan AES-256-GCM (akan dijelaskan di Part 3)

#### Index untuk Performance

```typescript
(table) => ({
  storeCodeIdx: index("store_accounts_store_code_idx").on(table.storeCode),
});
```

- **Index** - B-tree structure untuk fast lookups
- Query `WHERE store_code = 'xxx'` jadi sangat cepat
- **Trade-off:** Index konsumsi disk space & slower writes

#### Unique Constraint

```typescript
uniqueStoreOpen: unique("unique_store_openid").on(
  table.storeCode,
  table.openId
);
```

- **Composite unique** - Kombinasi (storeCode, openId) harus unique
- Satu store tidak bisa connect TikTok account yang sama 2x
- Database level validation (lebih reliable dari app level)

### 4.3 User Daily Stats Table

```typescript
export const tiktokUserDaily = pgTable(
  "tiktok_user_daily",
  {
    id: serial("id").primaryKey(),
    storeCode: varchar("store_code", { length: 50 })
      .references(() => stores.storeCode, { onDelete: "cascade" })
      .notNull(),
    openId: varchar("open_id", { length: 100 }).notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    displayName: varchar("display_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    followerCount: integer("follower_count").default(0),
    followingCount: integer("following_count").default(0),
    likesCount: bigint("likes_count", { mode: "number" }).default(0),
    videoCount: integer("video_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    storeDateIdx: index("tiktok_user_daily_store_date_idx").on(
      table.storeCode,
      table.snapshotDate
    ),
    uniqueSnapshot: unique("unique_user_snapshot").on(
      table.storeCode,
      table.openId,
      table.snapshotDate
    ),
  })
);
```

**Konsep snapshot:**

#### Snapshot Date

```typescript
snapshotDate: date("snapshot_date").notNull();
```

- **Daily snapshot** - Satu record per hari per user
- **Type `date`** - Hanya tanggal, no time needed
- Untuk tracking perubahan metrics over time

#### BigInt untuk Large Numbers

```typescript
likesCount: bigint("likes_count", { mode: "number" }).default(0);
```

- **`bigint`** - JavaScript Number bisa overflow untuk likes jutaan
- **`mode: "number"`** - Return as JS number (default adalah string)
- TikTok viral videos bisa punya likes 100M+

#### Composite Index

```typescript
storeDateIdx: index("tiktok_user_daily_store_date_idx").on(
  table.storeCode,
  table.snapshotDate
);
```

- **Multi-column index** - Optimize queries yang filter by store AND date
- Query `WHERE store_code = 'xxx' AND snapshot_date = '2024-01-01'` sangat cepat

#### Unique Snapshot

```typescript
uniqueSnapshot: unique("unique_user_snapshot").on(
  table.storeCode,
  table.openId,
  table.snapshotDate
);
```

- **Prevent duplicates** - Hanya satu snapshot per user per day
- Idempotency (re-run sync tidak create duplicate data)

### 4.4 Video Daily Stats Table

```typescript
export const tiktokVideoDaily = pgTable(
  "tiktok_video_daily",
  {
    id: serial("id").primaryKey(),
    storeCode: varchar("store_code", { length: 50 })
      .references(() => stores.storeCode, { onDelete: "cascade" })
      .notNull(),
    videoId: varchar("video_id", { length: 100 }).notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    shareUrl: text("share_url"),
    createTime: timestamp("create_time", { withTimezone: true }),
    viewCount: bigint("view_count", { mode: "number" }).default(0),
    likeCount: bigint("like_count", { mode: "number" }).default(0),
    commentCount: integer("comment_count").default(0),
    shareCount: integer("share_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    storeVideoDateIdx: index("tiktok_video_daily_store_video_date_idx").on(
      table.storeCode,
      table.videoId,
      table.snapshotDate
    ),
    uniqueVideoSnapshot: unique("unique_video_snapshot").on(
      table.storeCode,
      table.videoId,
      table.snapshotDate
    ),
  })
);
```

**Kenapa pisah user & video stats?**

1. **Different growth rates** - User stats slow, video stats fast
2. **Query patterns** - Sering query top videos, tidak perlu load user data
3. **Storage** - Video bisa ribuan, user cuma satu
4. **Normalization** - Avoid repeated user info di setiap video

### 4.5 Sync Logs Table

```typescript
export const syncLogs = pgTable(
  "sync_logs",
  {
    id: serial("id").primaryKey(),
    storeCode: varchar("store_code", { length: 50 })
      .references(() => stores.storeCode, { onDelete: "cascade" })
      .notNull(),
    jobType: varchar("job_type", { length: 50 }).notNull(),
    status: syncStatusEnum("status").notNull(),
    message: text("message"),
    recordsProcessed: integer("records_processed"),
    errorDetails: text("error_details"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    storeJobIdx: index("sync_logs_store_job_idx").on(
      table.storeCode,
      table.jobType
    ),
    startedAtIdx: index("sync_logs_started_at_idx").on(table.startedAt),
  })
);
```

**Kenapa perlu sync logs?**

1. **Debugging** - Tracking kenapa sync fail
2. **Monitoring** - Dashboard metrics (success rate, duration)
3. **Auditing** - Compliance & historical analysis
4. **Alerting** - Automatic alerts jika sync fail repeatedly

---

## 5. Database Client - `src/db/client.ts`

### 5.1 Connection Pool

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on("error", (err: Error) => {
      logger.error({ err }, "Unexpected error on idle client");
    });
  }

  return pool;
}
```

**Konsep Connection Pool:**

#### Kenapa Perlu Pool?

```
Without Pool:
Request → Create Connection → Query → Close Connection → Repeat
❌ Slow (connection creation overhead ~100ms)
❌ Resource intensive

With Pool:
Request → Get Connection from Pool → Query → Return to Pool
✅ Fast (reuse existing connections)
✅ Efficient resource usage
```

#### Pool Configuration

```typescript
max: 20,
```

- **Max connections** - Maximum 20 concurrent connections
- **Tuning:** `max = (available_memory_MB / 15)`
- Default database max is usually 100, pool max should be < that

```typescript
idleTimeoutMillis: 30000,
```

- **Idle timeout** - Close connections idle > 30 seconds
- Free up database resources
- Pool will create new connections when needed

```typescript
connectionTimeoutMillis: 10000,
```

- **Connection timeout** - Fail if connection takes > 10 seconds
- Prevent hanging requests
- Alert us if database is down

#### Error Handling

```typescript
pool.on("error", (err: Error) => {
  logger.error({ err }, "Unexpected error on idle client");
});
```

- **Error event** - Catch connection errors yang terjadi di background
- Contoh: Network issues, database restart
- Log untuk debugging

### 5.2 Drizzle Instance dengan Lazy Loading

```typescript
export type Database = ReturnType<typeof getDb>;

let dbInstance: Database | null = null;

export const db = new Proxy({} as Database, {
  get(target, prop) {
    if (!dbInstance) {
      dbInstance = getDb();
    }
    return (dbInstance as any)[prop];
  },
});

function getDb() {
  return drizzle({
    client: getPool(),
    schema,
    logger: process.env.DB_LOGGING === "true",
  });
}
```

**Penjelasan Proxy Pattern:**

#### Kenapa Lazy Loading?

```typescript
// ❌ Without Proxy (eager loading)
const db = getDb(); // Called immediately saat import
// Problem: environment variables belum loaded!

// ✅ With Proxy (lazy loading)
const db = new Proxy(...); // Not called yet
db.select(...) // getDb() dipanggil pas pertama kali digunakan
```

#### Proxy Explained

```typescript
new Proxy({} as Database, {
  get(target, prop) {
    // Dipanggil setiap kali akses property
    // Contoh: db.select, db.insert, db.update

    if (!dbInstance) {
      dbInstance = getDb(); // Initialize on first access
    }

    return (dbInstance as any)[prop];
  },
});
```

**Analogy:**

- Proxy = receptionist
- Akses `db.select()` → Proxy intercept → Create real connection jika belum ada → Forward ke real database

### 5.3 Cleanup Function

```typescript
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
    logger.info("Database connection pool closed");
  }
}
```

**Kenapa perlu cleanup?**

1. **Graceful shutdown** - Close connections before app exit
2. **Testing** - Clean state between tests
3. **Resource management** - Prevent connection leaks

**Kapan dipanggil:**

```typescript
process.on("SIGTERM", async () => {
  await closeDb();
  process.exit(0);
});
```

---

## 6. Database Operations dengan Drizzle

### 6.1 Insert Data

```typescript
import { db } from "./client.js";
import { stores } from "./schema.js";

// Insert single row
await db.insert(stores).values({
  storeCode: "store_001",
  storeName: "Store Jakarta",
  picName: "John Doe",
  picContact: "john@example.com",
});

// Insert multiple rows
await db.insert(stores).values([
  { storeCode: "store_001", storeName: "Store 1", picName: "John" },
  { storeCode: "store_002", storeName: "Store 2", picName: "Jane" },
]);
```

**Penjelasan:**

- **Type-safe** - TypeScript tahu fields apa yang wajib/optional
- **Builder pattern** - Chainable methods
- **Batch insert** - Efficient untuk multiple rows

### 6.2 Select Data

```typescript
import { eq, and, gte, lte } from "drizzle-orm";

// Select all
const allStores = await db.select().from(stores);

// Select with where
const store = await db
  .select()
  .from(stores)
  .where(eq(stores.storeCode, "store_001"))
  .limit(1);

// Complex where
const accounts = await db
  .select()
  .from(storeAccounts)
  .where(
    and(
      eq(storeAccounts.storeCode, "store_001"),
      gte(storeAccounts.tokenExpiresAt, new Date())
    )
  );
```

**Operators:**

- `eq(field, value)` - Equal (=)
- `ne(field, value)` - Not equal (!=)
- `gt(field, value)` - Greater than (>)
- `gte(field, value)` - Greater than or equal (>=)
- `lt(field, value)` - Less than (<)
- `lte(field, value)` - Less than or equal (<=)
- `like(field, pattern)` - SQL LIKE
- `and(...)` - AND condition
- `or(...)` - OR condition

### 6.3 Update Data

```typescript
// Update with where
await db
  .update(storeAccounts)
  .set({
    status: "NEED_RECONNECT",
    updatedAt: new Date(),
  })
  .where(eq(storeAccounts.id, 123));
```

### 6.4 Delete Data

```typescript
// Delete with where
await db.delete(stores).where(eq(stores.storeCode, "store_001"));
```

### 6.5 Upsert (Insert or Update)

```typescript
await db
  .insert(tiktokUserDaily)
  .values({
    storeCode: "store_001",
    openId: "abc123",
    snapshotDate: new Date("2024-01-01"),
    followerCount: 1000,
  })
  .onConflictDoUpdate({
    target: [
      tiktokUserDaily.storeCode,
      tiktokUserDaily.openId,
      tiktokUserDaily.snapshotDate,
    ],
    set: {
      followerCount: 1000,
      updatedAt: new Date(),
    },
  });
```

**Penjelasan upsert:**

- **Atomic operation** - Insert or update dalam satu query
- **`onConflictDoUpdate`** - Jika unique constraint violated, update instead
- **Idempotent** - Safe untuk re-run

---

## 7. Migrations

### 7.1 Generate Migration

```bash
npm run db:generate
```

**Output:**

```
drizzle/
├── 0000_initial_schema.sql
└── meta/
    └── _journal.json
```

**File `.sql`:**

```sql
CREATE TABLE "stores" (
  "store_code" varchar(50) PRIMARY KEY NOT NULL,
  "store_name" varchar(255) NOT NULL,
  ...
);

CREATE INDEX "store_accounts_store_code_idx"
  ON "store_accounts" ("store_code");
```

### 7.2 Push Schema (Development)

```bash
npm run db:push
```

**Push vs Migrate:**

| Push               | Migrate            |
| ------------------ | ------------------ |
| Development        | Production         |
| Direct schema sync | Version controlled |
| No migration files | Creates .sql files |
| Fast iteration     | Auditable history  |

### 7.3 Apply Migrations (Production)

```bash
npm run db:migrate
```

**Best practices:**

1. Development: Use `db:push` for fast iteration
2. Before commit: Run `db:generate` untuk create migration
3. Production: Run `db:migrate` untuk apply migrations
4. Never edit migrations manually (kecuali tahu apa yang dilakukan)

---

## 8. Database Studio

```bash
npm run db:studio
```

**Drizzle Studio:**

- Web UI untuk manage data
- Browse tables
- Insert/update/delete via GUI
- Run SQL queries
- Alternative to pgAdmin/DBeaver

---

## 🎓 Kesimpulan Part 2

Anda telah belajar:

✅ **Database design principles**

- Normalization
- Indexing strategy
- Foreign keys & constraints

✅ **Drizzle ORM**

- Schema definition
- Type-safe queries
- Connection pooling
- Lazy loading pattern

✅ **CRUD operations**

- Insert, Select, Update, Delete
- Complex queries dengan operators
- Upsert pattern

✅ **Migrations**

- Schema versioning
- Development vs production workflow

---

## 📚 Next Steps

Lanjut ke **Part 3: OAuth & Security** untuk belajar:

- TikTok OAuth 2.0 flow dengan PKCE
- Token encryption (AES-256-GCM)
- Secure token storage
- Refresh token mechanism

Happy learning! 🚀

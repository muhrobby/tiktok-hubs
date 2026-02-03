# Changelog

All notable changes to the TikTok Content Reporting Hub project will be documented in this file.

## [1.0.0] - 2026-01-24

### Phase 1: Core Infrastructure & Database Schema

#### Added
- **Database Schema** (`backend/src/db/schema.ts`)
  - `stores` table - Store/outlet information with TikTok account linking
  - `sync_logs` table - Sync operation history tracking
  - `users` table - User management with roles (Admin, Ops, Store)
  - `sessions` table - JWT session management with refresh tokens
  - `video_stats` table - TikTok video performance metrics
  - `user_stats` table - TikTok account-level statistics

- **Backend Foundation**
  - Hono framework setup with TypeScript
  - Drizzle ORM configuration for PostgreSQL
  - Environment configuration and validation
  - CORS and security middleware

### Phase 2: TikTok OAuth & Data Sync

#### Added
- **TikTok OAuth 2.0 Integration** (`backend/src/routes/auth.routes.ts`)
  - `GET /auth/tiktok` - Initiate OAuth flow
  - `GET /auth/tiktok/callback` - Handle OAuth callback
  - Token storage and management
  - Automatic token refresh mechanism

- **Sync Service** (`backend/src/services/sync.service.ts`)
  - Video statistics sync from TikTok API
  - User/account statistics sync
  - Batch processing for multiple stores
  - Error handling and retry logic

- **Admin Routes** (`backend/src/routes/admin.routes.ts`)
  - Store CRUD operations
  - Manual sync trigger endpoints
  - Sync status monitoring

### Phase 3: Authentication & RBAC

#### Added
- **JWT Authentication** (`backend/src/routes/userAuth.routes.ts`)
  - `POST /user-auth/login` - User login with JWT issuance
  - `POST /user-auth/logout` - Session invalidation
  - `GET /user-auth/me` - Get current user info
  - `POST /user-auth/refresh` - Refresh access token
  - `PUT /user-auth/password` - Change password
  - `PUT /user-auth/profile` - Update user profile

- **Role-Based Access Control**
  - Three roles: `admin`, `ops`, `store`
  - Middleware for role verification
  - Route-level permission checks

- **User Management** (`backend/src/routes/users.routes.ts`)
  - `GET /users` - List all users (Admin only)
  - `POST /users` - Create new user (Admin only)
  - `GET /users/:id` - Get user by ID
  - `PUT /users/:id` - Update user
  - `DELETE /users/:id` - Delete user (Admin only)
  - `GET /users/:id/roles` - Get user roles
  - `PUT /users/:id/roles` - Update user roles

### Phase 4: Analytics Dashboard

#### Added
- **Analytics Endpoints** (`backend/src/routes/analytics.routes.ts`)
  - `GET /analytics/overview` - Dashboard overview metrics
  - `GET /analytics/video-performance` - Video performance data
  - `GET /analytics/store-comparison` - Store comparison metrics
  - `GET /analytics/trends` - Time-series trend data

- **Frontend Analytics Page** (`frontend/app/pages/analytics.vue`)
  - Overview cards with key metrics
  - Video performance charts using @unovis/vue
  - Store comparison visualizations
  - Date range filtering

### Phase 5: Export/Import Functionality

#### Added
- **Export Endpoints** (`backend/src/routes/exportImport.routes.ts`)
  - `GET /export/stores` - Export stores to CSV/Excel
  - `GET /export/user-stats` - Export user statistics
  - `GET /export/video-stats` - Export video statistics
  - `GET /export/sync-logs` - Export sync logs
  - Support for both CSV and Excel (XLSX) formats
  - Date range and store code filtering

- **Import Endpoints**
  - `POST /import/stores` - Bulk import stores from CSV/Excel
  - Validation and error reporting
  - Duplicate handling

- **Frontend Data Management** (`frontend/app/pages/admin/data-management.vue`)
  - Export interface with format selection
  - Import interface with file upload
  - Progress indicators and error handling

### Phase 6: Audit Logging

#### Added
- **Audit Log Schema** (`backend/src/db/schema.ts`)
  - `audit_logs` table with fields:
    - `id`, `userId`, `action`, `resourceType`, `resourceId`
    - `oldValue`, `newValue` (JSON for change tracking)
    - `ipAddress`, `userAgent`, `createdAt`

- **Audit Service** (`backend/src/services/audit.service.ts`)
  - `logAction()` - Create audit log entries
  - `getAuditLogs()` - Query audit logs with filtering
  - Support for pagination and date range filtering

- **Audit Middleware** (`backend/src/middleware/audit.middleware.ts`)
  - Automatic logging of API requests
  - User context extraction from JWT
  - IP address and user agent capture

- **Audit Routes** (`backend/src/routes/auditLogs.routes.ts`)
  - `GET /audit-logs` - List audit logs (Admin only)
  - Query parameters: `page`, `limit`, `action`, `userId`, `resourceType`, `startDate`, `endDate`

- **Frontend Audit Logs Page** (`frontend/app/pages/admin/audit-logs.vue`)
  - Filterable audit log table
  - User, action, and date filters
  - Pagination support
  - Change diff viewer for value changes

- **Database Migration**
  - `0002_colorful_franklin_richards.sql` - Add audit_logs table

### Phase 7: Profile Management

#### Added
- **Profile Update Endpoint** (`backend/src/routes/userAuth.routes.ts`)
  - `PUT /user-auth/profile` - Update current user's name and email

- **Frontend Settings Page** (`frontend/app/pages/settings/index.vue`)
  - Profile update form with validation
  - Success/error notifications
  - Real-time UI updates

### Documentation

#### Added
- **Swagger/OpenAPI Documentation** (`backend/src/docs/swagger.ts`)
  - Complete API documentation for all endpoints
  - Request/response schemas
  - Authentication requirements
  - Available at `/docs` endpoint

---

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Hono
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Authentication**: JWT with refresh tokens
- **Export**: ExcelJS for XLSX, custom CSV generation
- **Documentation**: Swagger/OpenAPI

### Frontend
- **Framework**: Nuxt 3 with Vue 3
- **UI Library**: Nuxt UI
- **Charts**: @unovis/vue
- **Styling**: TailwindCSS + UnoCSS
- **State**: Vue Composables
- **Type Safety**: TypeScript

---

## API Endpoints Summary

### Authentication (`/user-auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | User login |
| POST | `/logout` | User logout |
| GET | `/me` | Get current user |
| POST | `/refresh` | Refresh token |
| PUT | `/password` | Change password |
| PUT | `/profile` | Update profile |

### User Management (`/users`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List users |
| POST | `/` | Create user |
| GET | `/:id` | Get user |
| PUT | `/:id` | Update user |
| DELETE | `/:id` | Delete user |
| GET | `/:id/roles` | Get user roles |
| PUT | `/:id/roles` | Update roles |

### Stores (`/admin`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stores` | List stores |
| POST | `/stores` | Create store |
| GET | `/stores/:code` | Get store |
| PUT | `/stores/:code` | Update store |
| DELETE | `/stores/:code` | Delete store |
| POST | `/stores/:code/sync` | Trigger sync |
| GET | `/sync-logs` | List sync logs |

### Analytics (`/analytics`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/overview` | Dashboard overview |
| GET | `/video-performance` | Video metrics |
| GET | `/store-comparison` | Store comparison |
| GET | `/trends` | Trend data |

### Export/Import (`/export`, `/import`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/export/stores` | Export stores |
| GET | `/export/user-stats` | Export user stats |
| GET | `/export/video-stats` | Export video stats |
| GET | `/export/sync-logs` | Export sync logs |
| POST | `/import/stores` | Import stores |

### Audit Logs (`/audit-logs`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List audit logs |

### TikTok OAuth (`/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tiktok` | Start OAuth |
| GET | `/tiktok/callback` | OAuth callback |

---

## Database Migrations

| Migration | Description |
|-----------|-------------|
| `0000_*.sql` | Initial schema (stores, users, sessions, video_stats, user_stats, sync_logs) |
| `0002_colorful_franklin_richards.sql` | Add audit_logs table |

---

## Running the Application

### Backend
```bash
cd backend
npm install
npm run db:migrate  # Run database migrations
npm run dev         # Start development server (port 3000)
npm run build       # Build for production
```

### Frontend
```bash
cd frontend
pnpm install
pnpm dev            # Start development server (port 3001)
pnpm run build      # Build for production
pnpm run typecheck  # Type check
```

### Environment Variables

#### Backend (`.env`)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok_hubs
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
```

#### Frontend (`.env`)
```env
NUXT_PUBLIC_API_BASE=http://localhost:3000
```

# TikTok Hubs - Frontend

Frontend aplikasi TikTok Content Reporting Hub menggunakan **Nuxt 4** + **Nuxt UI** dengan template dashboard modern.

## 🚀 Tech Stack

- **Framework**: Nuxt 4 (Vue 3)
- **UI Library**: Nuxt UI (based on Tailwind CSS + Headless UI)
- **Icons**: Iconify (Lucide icons)
- **Date Handling**: date-fns
- **Type Safety**: TypeScript
- **Package Manager**: npm

## 📁 Struktur Project

```
frontend/
├── app/
│   ├── pages/              # Pages (file-based routing)
│   │   ├── index.vue       # Dashboard
│   │   ├── stores/
│   │   │   ├── index.vue   # Stores list
│   │   │   └── [storeCode].vue  # Store detail
│   │   ├── accounts.vue    # Accounts management
│   │   └── analytics.vue   # Analytics (placeholder)
│   ├── composables/        # Composables
│   │   ├── useStores.ts    # Store API calls
│   │   └── useFormatters.ts # Formatting utilities
│   ├── layouts/            # Layout components
│   └── components/         # Reusable components
├── server/
│   └── api/                # Nuxt Server Routes (Nitro)
│       ├── admin/[...path].ts   # Proxy to backend /admin/**
│       └── auth/[...path].ts    # Proxy to backend /auth/**
├── types/
│   └── api.ts              # Type definitions
├── nuxt.config.ts          # Nuxt configuration
├── .env                    # Environment variables (ignored by git)
├── .env.example            # Environment template
└── package.json
```

## 🔧 Setup & Installation

### Prerequisites

- Node.js 20+
- npm atau pnpm
- Backend API running di `http://localhost:3000`

### Install Dependencies

```bash
npm install
```

### Environment Variables

Copy `.env.example` ke `.env` dan isi variabel berikut:

```bash
# Backend API Configuration
BACKEND_URL=http://localhost:3000
ADMIN_API_KEY=your_admin_api_key_here
```

**⚠️ PENTING**:

- `ADMIN_API_KEY` **TIDAK PERNAH** diexpose ke browser
- Semua API calls ke backend `/admin/**` melalui Nuxt Server Routes (`/api/admin/**`)
- Server routes menggunakan `ADMIN_API_KEY` secara server-side only

## 🏃 Development

```bash
npm run dev
```

Frontend akan berjalan di `http://localhost:3000`

## 🏗️ Build untuk Production

```bash
npm run build
```

Output: `.output/` directory

### Preview Production Build

```bash
npm run preview
```

## 📝 Key Features

### 1. **Security First**

- ADMIN_API_KEY hanya digunakan di server-side (Nuxt Server Routes)
- Client-side tidak pernah akses backend langsung untuk admin endpoints
- Rate limiting di composables

### 2. **Modern UI with Nuxt UI**

- Component-based dengan Nuxt UI
- Dark mode support
- Responsive design
- Accessible (ARIA compliant)

### 3. **Type Safety**

- Full TypeScript support
- Type definitions untuk semua API responses
- Type-safe routing

### 4. **Composables Pattern**

```typescript
// Example usage in components
const { getStores, createStore } = useStores();
const { formatDate, formatNumber } = useFormatters();
```

## 🗂️ Halaman

### Dashboard (`/`)

- Overview total stores, connected accounts
- Last sync time
- Recent stores list

### Stores (`/stores`)

- List semua stores
- Create new store form
- Navigate ke store detail

### Store Detail (`/stores/:storeCode`)

- User statistics (followers, likes, videos)
- Top videos performance
- Sync history logs
- Manual sync trigger

### Accounts (`/accounts`)

- List semua connected TikTok accounts
- Connect/disconnect functionality
- Account status

### Analytics (`/analytics`)

- Placeholder for future analytics dashboard

## 🔄 API Integration

### Nuxt Server Routes

All API calls go through Nuxt Server Routes untuk ensure ADMIN_API_KEY tidak exposed:

```typescript
// Client-side (Browser)
const stores = await useFetch("/api/admin/stores");

// Server-side (Nuxt Server Route)
// → Proxy to: http://localhost:3000/admin/stores
//    with header: X-API-Key: ${ADMIN_API_KEY}
```

### Composable Pattern

```typescript
// composables/useStores.ts
export const useStores = () => {
  const getStores = async () => {
    const { data } = await useFetch('/api/admin/stores')
    return data.value?.data || []
  }

  return { getStores, ... }
}
```

## 🧪 Testing

```bash
npm run typecheck    # Type checking
npm run lint         # ESLint
```

## 📦 Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `npm run dev`       | Start development server     |
| `npm run build`     | Build for production         |
| `npm run preview`   | Preview production build     |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint`      | Run ESLint                   |

## 🔐 Security Best Practices

1. **Secrets Management**
   - ADMIN_API_KEY hanya di `.env` (server-side)
   - Tidak pernah hardcode secrets
   - Tidak log sensitive data

2. **API Security**
   - Semua admin endpoints melalui Nuxt Server Routes
   - CSRF protection dengan Nuxt built-in
   - Input validation di forms

3. **Authentication Flow**
   - OAuth callback handled via `/api/auth/callback`
   - Access tokens encrypted di backend
   - No tokens exposed to frontend

## 🚧 Migration Notes

Frontend ini hasil migrasi dari:

- **Old**: Vite + React/TSX + DaisyUI + Custom Router
- **New**: Nuxt 4 + Vue 3 + Nuxt UI + File-based routing

Backup frontend lama ada di folder `frontend-old/`

## 📚 Resources

- [Nuxt Documentation](https://nuxt.com/docs)
- [Nuxt UI Documentation](https://ui.nuxt.com)
- [Vue 3 Documentation](https://vuejs.org)

## 🤝 Contributing

1. Ikuti struktur folder yang ada
2. Gunakan composables untuk reusable logic
3. Type semua props dan return values
4. Test di development sebelum build production

---

**Built with ❤️ using Nuxt 4 + Nuxt UI**

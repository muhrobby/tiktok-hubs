# 🎯 TikTok Hubs

A comprehensive management platform for TikTok Shop stores, providing centralized analytics, data synchronization, and account management.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Nuxt 3](https://img.shields.io/badge/Nuxt_3-00DC82?style=flat&logo=nuxt.js&logoColor=white)](https://nuxt.com/)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Setup](#-environment-setup)
- [Development](#-development)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)

---

## ✨ Features

### 🏪 **Store Management**
- Multi-store account management in one dashboard
- TikTok OAuth integration for seamless account connection
- Real-time connection status monitoring
- Role-based access control (Admin, Ops, Store)

### 📊 **Analytics Dashboard**
- System-wide analytics and insights
- Followers trend visualization with interactive charts
- Video performance metrics (views, likes, comments, shares)
- Top performing stores ranking
- Engagement rate calculations
- Customizable date range filters (7, 14, 30, 90 days)
- Store-specific analytics filtering

### 🔄 **Data Synchronization**
- Automated daily sync jobs for user and video statistics
- Manual sync triggers for immediate data updates
- Bulk sync capability for all stores (Admin/Ops only)
- Sync health monitoring and status tracking
- Token refresh management
- Comprehensive sync logs with error tracking

### 📱 **Mobile-First Responsive Design**
- Fully responsive UI for all screen sizes
- Touch-friendly interface (44px minimum tap targets)
- Optimized layouts for mobile, tablet, and desktop
- No horizontal overflow on any device
- Progressive enhancement design approach

### 🔐 **Security**
- JWT-based authentication with refresh tokens
- Role-based authorization middleware
- CORS protection with environment-specific configuration
- Request ID tracking for audit trails
- Comprehensive audit logging system
- Rate limiting protection
- Security headers (Helmet.js)

### 📈 **Monitoring & Logging**
- Detailed audit logs for all administrative actions
- User activity tracking
- Sync job monitoring and health checks
- Error logging and tracking
- Performance metrics

---

## 🛠 Tech Stack

### **Frontend**
- **Framework**: [Nuxt 3](https://nuxt.com/) - Vue 3 meta-framework with SSR
- **UI Library**: [Nuxt UI](https://ui.nuxt.com/) - Beautiful, accessible components
- **Charts**: [Unovis](https://unovis.dev/) - Declarative data visualization
- **State Management**: Vue 3 Composition API with composables
- **Styling**: Tailwind CSS with custom design tokens
- **Type Safety**: TypeScript with strict mode
- **Icons**: Lucide Icons

### **Backend**
- **Framework**: [Hono](https://hono.dev/) - Ultrafast web framework
- **Database**: PostgreSQL with connection pooling
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) - TypeScript-first ORM
- **Authentication**: JWT with refresh token rotation
- **Validation**: Zod schema validation
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Custom audit logging system

### **DevOps**
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 16 with persistent volumes
- **Process Manager**: PM2 for production deployment
- **Testing**: Vitest for unit and integration tests
- **CI/CD**: GitHub Actions ready

---

## 📁 Project Structure

```
tiktok-hubs/
├── backend/                 # Hono backend application
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── db/             # Database schema and migrations
│   │   ├── middleware/     # Authentication, logging, security
│   │   ├── routes/         # API route handlers
│   │   ├── sync/           # Data synchronization jobs
│   │   ├── services/       # Business logic services
│   │   └── index.ts        # Application entry point
│   ├── tests/              # Unit and integration tests
│   ├── .env.example        # Environment variables template
│   └── package.json
│
├── frontend/               # Nuxt 3 frontend application
│   ├── app/
│   │   ├── assets/        # CSS and static assets
│   │   ├── components/    # Reusable Vue components
│   │   ├── composables/   # Vue composables (API calls, utilities)
│   │   ├── layouts/       # Page layouts
│   │   ├── middleware/    # Route middleware
│   │   ├── pages/         # File-based routing pages
│   │   └── types/         # TypeScript type definitions
│   ├── server/            # Nuxt server routes (API proxy)
│   ├── public/            # Static files
│   ├── .env.example       # Environment variables template
│   └── nuxt.config.ts     # Nuxt configuration
│
├── scripts/               # Utility scripts
│   ├── generate-keys.sh   # JWT key generation
│   └── seed-admin.ts      # Admin user seeding
│
├── docker-compose.yml     # Docker services configuration
├── .gitignore            # Git ignore rules
├── CHANGELOG.md          # Version history
├── DEPLOYMENT.md         # Deployment guide
└── README.md             # This file
```

---

## 🚀 Getting Started

### **Prerequisites**

- **Node.js** >= 18.x
- **npm** >= 9.x or **pnpm** >= 8.x
- **Docker** & **Docker Compose** (for PostgreSQL)
- **Git**

### **Quick Start**

1. **Clone the repository**
   ```bash
   git clone https://github.com/muhrobby/tiktok-hubs.git
   cd tiktok-hubs
   ```

2. **Start PostgreSQL database**
   ```bash
   docker-compose up -d
   ```

3. **Setup Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your TikTok API credentials
   npm install
   npm run db:generate
   npm run db:migrate
   npm run dev
   ```

4. **Setup Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3002
   - Backend API: http://localhost:3000

---

## ⚙️ Environment Setup

### **Backend Environment Variables** (`.env`)

```bash
# Database
DATABASE_URL=postgresql://dev_user:Dev_User123@localhost:5432/tiktok_hubs

# JWT Authentication
JWT_ACCESS_SECRET=your-access-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# TikTok API Credentials
TIKTOK_CLIENT_KEY=your-client-key
TIKTOK_CLIENT_SECRET=your-client-secret

# Application
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3002
```

### **Frontend Environment Variables** (`.env`)

```bash
# Backend API
NUXT_PUBLIC_API_BASE_URL=http://localhost:3000

# Application
NUXT_PUBLIC_APP_NAME="TikTok Hubs"
NUXT_PUBLIC_APP_URL=http://localhost:3002
```

### **Generate JWT Secrets**

```bash
chmod +x scripts/generate-keys.sh
./scripts/generate-keys.sh
```

### **Create Admin User**

```bash
cd backend
npm run seed:admin
```

Default admin credentials:
- Email: `admin@tiktok-hubs.com`
- Password: `Admin123!@#`

**⚠️ Change these credentials immediately after first login!**

---

## 💻 Development

### **Backend Development**

```bash
cd backend

# Development mode with hot reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint

# Database operations
npm run db:generate    # Generate migrations
npm run db:migrate     # Run migrations
npm run db:studio      # Open Drizzle Studio
```

### **Frontend Development**

```bash
cd frontend

# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint
```

### **Docker Development**

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset database (⚠️ destroys data)
docker-compose down -v
docker-compose up -d
```

---

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions including:

- Production environment setup
- Docker deployment
- PM2 process management
- Nginx configuration
- SSL certificate setup
- Database backup strategies
- Monitoring setup

---

## 📚 API Documentation

### **Authentication**

#### POST `/api/auth/login`
Login with credentials
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token

#### POST `/api/auth/logout`
Logout and invalidate tokens

### **Store Management**

#### GET `/api/admin/stores`
Get all stores (Admin/Ops)

#### POST `/api/admin/stores`
Create new store (requires `create_store` permission)

#### GET `/api/admin/stores/:storeCode/accounts`
Get store account connections

#### DELETE `/api/admin/stores/:storeCode/disconnect`
Disconnect store account

### **Analytics**

#### GET `/api/analytics/overview`
Get system-wide analytics overview
Query params: `?storeCode=XXX` (optional)

#### GET `/api/analytics/followers-trend`
Get followers trend data
Query params: `?days=30&storeCode=XXX`

#### GET `/api/analytics/video-performance`
Get video performance metrics
Query params: `?days=30&storeCode=XXX`

#### GET `/api/analytics/top-stores`
Get top performing stores
Query params: `?metric=followers&limit=10`

#### GET `/api/analytics/sync-health`
Get sync job health status

### **Data Synchronization**

#### POST `/api/admin/sync/run`
Trigger manual sync (Admin/Ops only)
```json
{
  "job": "all" | "user" | "video",
  "store_code": "A304" // optional
}
```

---

## 🎨 UI/UX Features

### **Responsive Breakpoints**

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | 1 column, stacked, touch-optimized |
| Tablet | 640px - 1024px | 2 columns, adaptive |
| Desktop | > 1024px | 3-4 columns, full sidebar |

### **Design System**

- **Colors**: Custom green palette with semantic tokens
- **Typography**: Public Sans font family, responsive sizes
- **Spacing**: Tailwind spacing scale (0.25rem increments)
- **Touch Targets**: Minimum 44px for mobile accessibility
- **Icons**: Lucide icon library

### **Key UI Components**

- **PageHeader**: Responsive header with burger menu and actions
- **DataTable**: Sortable, filterable, paginated tables with overflow handling
- **Cards**: Summary statistics with icons and trends
- **Charts**: Interactive line and area charts with tooltips
- **Modals**: Accessible dialog forms
- **Toast**: Success/error notifications

---

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Rotate JWT secrets regularly** - Especially in production
3. **Use strong passwords** - Minimum 8 characters, mixed case, numbers, symbols
4. **Enable 2FA** - For production admin accounts (coming soon)
5. **Keep dependencies updated** - Run `npm audit` regularly
6. **Review audit logs** - Monitor for suspicious activities
7. **Limit API access** - Use rate limiting and proper CORS settings
8. **Backup database** - Regular automated backups

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### **Commit Message Convention**

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Code style changes
refactor: Code refactoring
test: Add or update tests
chore: Maintenance tasks
```

---

## 📄 License

This project is proprietary and confidential.

---

## 👨‍💻 Author

**Muhammad Robby**
- GitHub: [@muhrobby](https://github.com/muhrobby)
- Email: muhrobby@example.com

---

## 🙏 Acknowledgments

- [TikTok for Developers](https://developers.tiktok.com/) - TikTok API
- [Nuxt UI](https://ui.nuxt.com/) - Beautiful UI components
- [Hono](https://hono.dev/) - Ultrafast web framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Unovis](https://unovis.dev/) - Data visualization library

---

## 📞 Support

For support, please contact muhrobby@example.com or open an issue on GitHub.

---

**Made with ❤️ by Muhammad Robby**

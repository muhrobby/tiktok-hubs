# 📚 Swagger Documentation Guide

## ✅ Implementation Complete

All API endpoints are now fully documented with interactive Swagger UI.

---

## 🚀 Quick Start

### 1. Start the Server
```bash
npm run dev
```

### 2. Access Swagger UI
Open your browser and navigate to:
- **Primary URL**: http://localhost:3000/api/docs
- **Alternative URLs**:
  - http://localhost:3000/docs
  - http://localhost:3000/swagger

### 3. Access OpenAPI Specification
Download the OpenAPI JSON spec:
- http://localhost:3000/api/openapi.json

---

## 📋 What's Documented

### Endpoints Documented (14 total)

#### 🏥 Health & Info
- `GET /health` - Health check endpoint
- `GET /` - Service information

#### 🏪 Store Management
- `GET /admin/stores` - List all stores
- `POST /admin/stores` - Create new store
- `GET /admin/stores/{store_code}` - Get store details
- `GET /admin/stores/{store_code}/accounts` - Get store's TikTok accounts

#### 📊 Statistics
- `GET /admin/stores/{store_code}/user-stats` - User statistics
- `GET /admin/stores/{store_code}/video-stats` - Video statistics

#### 🔄 Synchronization
- `POST /admin/sync/run` - Trigger manual sync
- `GET /admin/sync/status` - Get sync status
- `GET /admin/sync/logs` - Get all sync logs
- `GET /admin/stores/{store_code}/sync-logs` - Get store sync logs

#### 🔐 Authentication
- `GET /auth/url` - Get TikTok OAuth URL
- `GET /connect/tiktok` - Connect TikTok account (redirect)
- `GET /auth/tiktok/callback` - OAuth callback handler

---

## 🎯 Features

### ✅ Complete Request/Response Schemas
Every endpoint includes:
- Request parameters (path, query, body)
- Response schemas (success & error)
- Authentication requirements
- Example requests & responses

### ✅ Interactive Testing
Use the "Try it out" button in Swagger UI to:
- Test endpoints directly from the browser
- See real-time responses
- Validate API behavior

### ✅ Data Models
Complete schema definitions for:
- `Store` - Store information
- `TikTokAccount` - Connected TikTok accounts
- `UserStats` - User statistics
- `VideoStats` - Video performance metrics
- `SyncLog` - Synchronization logs
- `Error` - Error responses

### ✅ Authentication Documentation
- API Key authentication (`X-API-KEY` header)
- OAuth 2.0 flow documentation
- Security requirements per endpoint

### ✅ Error Codes Reference
Complete documentation of error responses:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## 🔧 Technical Details

### File Structure
```
src/docs/
├── index.ts          # Main export
├── swagger.ts        # OpenAPI 3.1.0 specification + Swagger UI setup
├── schemas.ts        # Zod schemas for validation
└── routes.ts         # OpenAPI route definitions
```

### Integration
- **App Integration**: `src/app.ts` (line 237-238)
- **CSP Configuration**: `src/middleware/security.ts` (line 36-40)
- **Dependencies**: 
  - `@hono/swagger-ui` v0.5.3
  - `@hono/zod-openapi` v1.2.0
  - `zod` v3.24.1

### Security
CSP (Content Security Policy) configured to allow:
- Scripts from `https://cdn.jsdelivr.net`
- Styles from `https://cdn.jsdelivr.net`
- Fonts from `https://cdn.jsdelivr.net`

---

## 🧪 Testing

### Verify Installation
```bash
# Run verification script
./test-swagger.sh

# Expected output:
# ✅ All checks passed!
```

### Manual Testing
```bash
# 1. Start server
npm run dev

# 2. Test Swagger UI endpoint
curl http://localhost:3000/api/docs

# 3. Test OpenAPI JSON endpoint
curl http://localhost:3000/api/openapi.json

# 4. Test with browser
# Open: http://localhost:3000/api/docs
```

---

## 📦 Export & Integration

### Export OpenAPI Spec
```bash
# Download OpenAPI JSON
curl http://localhost:3000/api/openapi.json -o openapi.json
```

### Import to API Testing Tools

#### Postman
1. Open Postman
2. Click "Import"
3. Upload `openapi.json`
4. All endpoints will be imported as a collection

#### Insomnia
1. Open Insomnia
2. Go to Application → Import/Export
3. Import Data → From File
4. Select `openapi.json`

#### Generate Client SDKs
```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-axios \
  -o ./client-sdk

# Generate Python client
openapi-generator-cli generate \
  -i openapi.json \
  -g python \
  -o ./python-sdk
```

---

## 🎨 Customization

### Update Documentation

#### Add New Endpoint
1. Add route definition in `src/docs/routes.ts`
2. Add request/response schemas in `src/docs/schemas.ts`
3. Update OpenAPI spec in `src/docs/swagger.ts`

#### Modify Existing Endpoint
1. Edit route definition in `src/docs/routes.ts`
2. Update schemas if needed in `src/docs/schemas.ts`
3. Refresh browser to see changes

#### Add More Examples
Edit `src/docs/swagger.ts` and add to `examples` property:
```typescript
examples: {
  example1: {
    summary: "Example description",
    value: { /* example data */ }
  }
}
```

---

## 🔍 Troubleshooting

### Issue: Swagger UI not loading

**Symptoms**: Blank page or CSP errors in browser console

**Solution**:
1. Check CSP configuration in `src/middleware/security.ts`
2. Verify jsDelivr CDN is whitelisted:
   ```typescript
   scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
   styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
   fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
   ```

### Issue: OpenAPI JSON returns 404

**Symptoms**: `/api/openapi.json` returns 404

**Solution**:
1. Verify docs app is mounted in `src/app.ts`:
   ```typescript
   const docsApp = createDocsApp();
   app.route("/", docsApp);
   ```
2. Restart server: `npm run dev`

### Issue: TypeScript compilation errors

**Symptoms**: `npm run build` fails

**Solution**:
1. Check imports in `src/docs/*.ts` files
2. Verify all schemas are properly typed
3. Run: `npm run build` to see specific errors

### Issue: "Try it out" doesn't work

**Symptoms**: API requests fail in Swagger UI

**Solution**:
1. Ensure server is running: `npm run dev`
2. Add `X-API-KEY` header in Swagger UI (click "Authorize" button)
3. Check CORS configuration in `src/app.ts`
4. Verify `.env` has `ADMIN_API_KEY` set

---

## 📖 Additional Resources

### OpenAPI Specification
- [OpenAPI 3.1.0 Specification](https://spec.openapis.org/oas/v3.1.0)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)

### Hono Integration
- [@hono/swagger-ui](https://github.com/honojs/middleware/tree/main/packages/swagger-ui)
- [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)

### API Testing
- [Postman](https://www.postman.com/)
- [Insomnia](https://insomnia.rest/)
- [Thunder Client (VS Code)](https://www.thunderclient.com/)

---

## ✅ Verification Checklist

Before deployment, verify:

- [ ] Server starts successfully: `npm run dev`
- [ ] Swagger UI loads: http://localhost:3000/api/docs
- [ ] OpenAPI JSON accessible: http://localhost:3000/api/openapi.json
- [ ] All 14 endpoints documented
- [ ] "Try it out" works for test endpoints
- [ ] TypeScript compiles: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] CSP allows Swagger UI assets (no console errors)

---

## 📝 Summary

**Status**: ✅ **COMPLETE & PRODUCTION READY**

- ✅ 14 endpoints fully documented
- ✅ Interactive Swagger UI at `/api/docs`
- ✅ OpenAPI 3.1.0 specification
- ✅ Request/response schemas with validation
- ✅ Authentication documentation
- ✅ Error codes reference
- ✅ CSP configured securely
- ✅ TypeScript compilation successful
- ✅ All features tested and working

---

**Created**: January 24, 2026  
**Version**: 1.0.0  
**OpenAPI Version**: 3.1.0

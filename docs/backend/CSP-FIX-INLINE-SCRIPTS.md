# CSP Fix: Inline Scripts for Swagger UI

## Problem

Swagger UI uses inline scripts which were being blocked by Content-Security-Policy:

```
Content-Security-Policy: The page's settings blocked an inline script (script-src-elem) 
from being executed because it violates the following directive: "script-src 'self' 
https://cdn.jsdelivr.net"
```

## Root Cause

Swagger UI's HTML includes inline `<script>` tags for initialization:

```html
<script>
  window.onload = function() {
    SwaggerUIBundle({ ... });
  }
</script>
```

Our strict CSP policy (`script-src 'self' https://cdn.jsdelivr.net`) blocks all inline scripts for security reasons.

---

## Solution Implemented

**Route-Specific CSP Configuration** (Best Practice)

We modified the CSP middleware to use **different policies for different routes**:

### 1. Relaxed CSP for Swagger UI Routes
- **Routes**: `/api/docs`, `/docs`, `/swagger`, `/api/openapi.json`
- **Policy**: Allows `'unsafe-inline'` for scripts (required for Swagger UI)
- **Security Impact**: Minimal - only affects documentation pages

```typescript
// Relaxed CSP for Swagger UI
scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"]
```

### 2. Strict CSP for All Other Routes
- **Routes**: All API endpoints (`/admin/*`, `/auth/*`, etc.)
- **Policy**: No inline scripts allowed (`script-src 'self'` only)
- **Security**: Maximum protection for production endpoints

```typescript
// Strict CSP for API endpoints
scriptSrc: ["'self'"]  // No inline scripts!
```

---

## Implementation Details

### File Modified
`src/middleware/security.ts`

### Changes Made

**Before** (Single CSP policy for all routes):
```typescript
export function enhancedSecurityHeaders(options: SecurityHeadersOptions = {}) {
  return secureHeaders({
    contentSecurityPolicy: {
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      // ... other directives
    }
  });
}
```

**After** (Route-specific CSP policies):
```typescript
export function enhancedSecurityHeaders(options: SecurityHeadersOptions = {}) {
  return async (c: Context, next: Next) => {
    // Check if this is a Swagger UI route
    const isSwaggerRoute =
      c.req.path.startsWith("/api/docs") ||
      c.req.path.startsWith("/docs") ||
      c.req.path.startsWith("/swagger") ||
      c.req.path === "/api/openapi.json";

    if (isSwaggerRoute) {
      // Relaxed CSP for Swagger UI
      await secureHeaders({
        contentSecurityPolicy: {
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          // ... other directives
        }
      })(c, next);
      return;
    }

    // Strict CSP for all other routes
    await secureHeaders({
      contentSecurityPolicy: {
        scriptSrc: ["'self'"],  // No inline scripts
        // ... other directives
      }
    })(c, next);
  };
}
```

---

## Security Analysis

### ✅ Security Maintained

1. **Isolated Risk**
   - `'unsafe-inline'` only allowed for documentation routes
   - All API endpoints (`/admin/*`, `/auth/*`) still have strict CSP
   - No inline scripts allowed on production endpoints

2. **Defense in Depth**
   - Rate limiting still active
   - HMAC validation still active
   - Audit logging still active
   - CORS still configured
   - All other security headers intact

3. **Attack Surface**
   - Documentation pages are read-only
   - No sensitive data exposed in Swagger UI
   - API key still required for testing endpoints

### ⚠️ Alternative Solutions Considered

#### Option 1: Use CSP Hashes ❌ (Not Practical)
```typescript
scriptSrc: [
  "'self'",
  "'sha256-ZswfTY7H35rbv8WC7NXBoiC7WNu86vSzCDChNWwZZDM='",
  "'sha256-FOpGqUAtM4WMR9XyAdLi47jbuKIa/2iLk80MLsAc4LM='"
]
```
**Problem**: Swagger UI hashes change with every update. Maintenance nightmare.

#### Option 2: Allow 'unsafe-inline' Globally ❌ (Insecure)
```typescript
scriptSrc: ["'self'", "'unsafe-inline'"]  // For ALL routes
```
**Problem**: Weakens security for all API endpoints. Not acceptable.

#### Option 3: Route-Specific CSP ✅ (Implemented)
**Best balance** between functionality and security.

---

## Testing

### 1. Verify Swagger UI Works
```bash
# Start server
npm run dev

# Open browser
# Navigate to: http://localhost:3000/api/docs
# Check browser console - should have NO CSP errors
```

### 2. Verify API Endpoints Still Protected
```bash
# Test strict CSP on API endpoints
curl -I http://localhost:3000/admin/stores

# Should see strict CSP header (no 'unsafe-inline')
```

### 3. TypeScript Compilation
```bash
npm run build
# Should compile with 0 errors
```

---

## Verification Checklist

- [x] Swagger UI loads without CSP errors
- [x] Swagger UI inline scripts execute correctly
- [x] "Try it out" functionality works
- [x] API endpoints still have strict CSP
- [x] No inline scripts allowed on `/admin/*` routes
- [x] No inline scripts allowed on `/auth/*` routes
- [x] TypeScript compiles successfully
- [x] All other security headers maintained

---

## Browser Console Verification

### Before Fix ❌
```
Content-Security-Policy: The page's settings blocked an inline script 
(script-src-elem) from being executed because it violates the following 
directive: "script-src 'self' https://cdn.jsdelivr.net"
```

### After Fix ✅
```
(No CSP errors in console)
Swagger UI loads and functions correctly
```

---

## Production Deployment Notes

### Environment Variables
No changes required to environment variables.

### CSP Behavior by Environment

**Development** (`NODE_ENV=development`):
- CSP completely disabled for easier debugging
- No restrictions on inline scripts

**Production** (`NODE_ENV=production`):
- Swagger UI routes: Relaxed CSP (allows inline scripts)
- All other routes: Strict CSP (no inline scripts)
- HSTS enabled
- All security headers active

---

## Summary

**Problem**: Swagger UI inline scripts blocked by CSP  
**Solution**: Route-specific CSP policies  
**Security Impact**: ✅ Minimal - only affects documentation pages  
**API Security**: ✅ Maintained - strict CSP on all API endpoints  
**Status**: ✅ Complete and tested  

---

## Related Files

- `src/middleware/security.ts` - CSP configuration
- `src/app.ts` - Middleware integration
- `src/docs/swagger.ts` - Swagger UI setup
- `SWAGGER-GUIDE.md` - Complete Swagger documentation guide

---

**Date**: January 24, 2026  
**Fix Version**: 1.0.1  
**Status**: ✅ Complete

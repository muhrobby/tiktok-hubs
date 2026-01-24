# 📋 Backend Security Quick Reference

**Last Updated:** 24 Januari 2026

---

## 🚨 Security Status: ⚠️ REQUIRES ATTENTION

### Critical Issues Found: 4
- Default database password in docker-compose.yml
- .env file in git history
- CORS wildcard in production
- Insufficient auth rate limiting

---

## 🎯 Quick Actions

### 1️⃣ Remove Secrets from Git (5 minutes)

```bash
cd backend
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

### 2️⃣ Generate New Secrets (2 minutes)

```bash
# Encryption key (64 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# API key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Database password
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3️⃣ Update docker-compose.yml (3 minutes)

Replace:
```yaml
POSTGRES_PASSWORD: postgres
```

With:
```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:?Required}
```

### 4️⃣ Fix CORS (2 minutes)

In `src/app.ts`:
```typescript
// Add validation
if (process.env.NODE_ENV === "production") {
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*") {
    throw new Error("CORS_ORIGIN required in production");
  }
}
```

---

## 🔒 Security Checklist

### Before Production Deployment

- [ ] All secrets regenerated and secured
- [ ] .env removed from git history
- [ ] Database passwords changed
- [ ] CORS configured for specific domains
- [ ] HTTPS enforced
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Logging to external service
- [ ] Monitoring and alerts setup
- [ ] Audit log implemented
- [ ] Security testing completed

---

## 📊 Security Score

**Current: 6.5/10** ⚠️  
**Target: 9.0/10** ✅

### Scoring Breakdown

| Category | Current | Target | Priority |
|----------|---------|--------|----------|
| Secrets Management | 4/10 | 9/10 | 🔴 CRITICAL |
| Authentication | 6/10 | 9/10 | 🟡 HIGH |
| Authorization | 7/10 | 9/10 | 🟡 HIGH |
| Data Protection | 9/10 | 9/10 | 🟢 GOOD |
| Input Validation | 8/10 | 9/10 | 🟢 GOOD |
| Error Handling | 8/10 | 9/10 | 🟢 GOOD |
| Logging | 6/10 | 9/10 | 🟡 MEDIUM |
| Monitoring | 4/10 | 9/10 | 🟡 MEDIUM |

---

## 🛡️ Security Features

### ✅ Already Implemented

- AES-256-GCM token encryption
- PKCE OAuth 2.0 flow
- Parameterized SQL queries (Drizzle ORM)
- Input validation with regex
- Secure headers middleware
- Token redaction in logs
- Graceful error handling
- Database connection health checks

### ⚠️ Needs Improvement

- Rate limiting (basic, needs enhancement)
- CORS (wildcard in production)
- Secrets management (hardcoded in docker-compose)
- Authentication (simple API key, needs JWT)
- Logging (local only, needs external)
- Monitoring (none, needs implementation)

### ❌ Missing

- Multi-factor authentication
- Session management
- API key rotation
- Security incident alerting
- Audit logging
- DDoS protection
- Request signing

---

## 🔐 Authentication Quick Guide

### OAuth Flow (TikTok)

```
1. GET /connect/tiktok?store_code=xxx
   → Generates PKCE challenge
   → Redirects to TikTok

2. User authorizes on TikTok
   → TikTok redirects back

3. GET /auth/tiktok/callback?code=xxx&state=yyy
   → Exchanges code + PKCE verifier
   → Stores encrypted tokens
```

### Admin API Authentication

```bash
# All /admin/* endpoints require API key
curl -H "X-API-KEY: your_key" \
  http://localhost:3000/admin/stores
```

---

## 📝 Environment Variables Reference

### Required

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
TIKTOK_CLIENT_KEY=from_tiktok_developer_portal
TIKTOK_CLIENT_SECRET=from_tiktok_developer_portal
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
TOKEN_ENC_KEY=64_char_hex_string
ADMIN_API_KEY=strong_random_key
```

### Security

```bash
# Production only
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
STATE_SECRET=random_secret_for_hmac

# Recommended
LOG_LEVEL=warn
DB_LOGGING=false
CRON_ENABLED=true
```

---

## 🔍 Security Testing Commands

### Test Health Endpoint
```bash
curl http://localhost:3000/health
```

### Test Admin Auth
```bash
# Should succeed
curl -H "X-API-KEY: $ADMIN_API_KEY" \
  http://localhost:3000/admin/stores

# Should fail (401)
curl -H "X-API-KEY: wrong_key" \
  http://localhost:3000/admin/stores
```

### Test Rate Limiting
```bash
# Rapid requests should trigger rate limit
for i in {1..150}; do
  curl http://localhost:3000/admin/stores
done
```

### Test CORS
```bash
# Should block in production
curl -H "Origin: https://evil.com" \
  http://localhost:3000/admin/stores
```

---

## 🚨 Incident Response

### If Security Breach Detected

1. **Immediately:**
   - Rotate all API keys and secrets
   - Revoke all TikTok OAuth tokens
   - Take affected systems offline if necessary

2. **Investigate:**
   - Check audit logs: `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`
   - Check sync logs: `SELECT * FROM sync_logs WHERE status = 'FAILED'`
   - Review application logs for suspicious activity

3. **Mitigate:**
   - Patch vulnerabilities
   - Update all credentials
   - Notify affected users if data breach

4. **Document:**
   - Record incident details
   - Document root cause
   - Update security procedures

### Emergency Contacts

- Security Team: [Add contact]
- Database Admin: [Add contact]
- DevOps: [Add contact]

---

## 📚 Additional Documentation

- [Full Security Audit Report](./SECURITY-AUDIT.md)
- [Security Fixes Guide](./SECURITY-FIXES.md)
- [Backend Documentation](./DOCUMENTATION.md)
- [API Endpoints](./doc/API-ENDPOINTS.md)

---

## 🔄 Regular Security Tasks

### Daily
- [ ] Review failed authentication logs
- [ ] Check system health

### Weekly
- [ ] Review audit logs
- [ ] Check for dependency updates: `npm audit`
- [ ] Verify backup integrity

### Monthly
- [ ] Rotate API keys
- [ ] Review access controls
- [ ] Security training refresher

### Quarterly
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Update security documentation
- [ ] Review incident response plan

---

**Last Security Audit:** 24 Januari 2026  
**Next Audit Due:** 24 April 2026  
**Security Contact:** [Your Security Team Email]

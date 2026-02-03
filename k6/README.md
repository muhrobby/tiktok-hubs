# K6 Load Testing & Security Testing Suite

Comprehensive performance and security testing suite for Sosmed HUB (TikTok Reporting Hub).

## 📋 Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Test Scenarios](#test-scenarios)
- [Running Tests](#running-tests)
- [Interpreting Results](#interpreting-results)
- [Security Testing](#security-testing)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

This test suite includes:

- **Smoke Test**: Basic functionality verification
- **Load Test**: Normal expected load (10 concurrent users)
- **Stress Test**: Beyond capacity testing (up to 100 users)
- **Spike Test**: Sudden traffic spikes
- **Security Test**: Authentication, authorization, input validation

## 📦 Installation

### 1. Install K6

**Ubuntu/Debian:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69

echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list

sudo apt-get update
sudo apt-get install k6
```

**macOS:**
```bash
brew install k6
```

**Windows:**
```powershell
choco install k6
```

**Docker:**
```bash
docker pull grafana/k6:latest
```

### 2. Verify Installation

```bash
k6 version
```

## 🚀 Quick Start

### 1. Start Backend Server

```bash
cd backend
npm run dev  # Runs on http://localhost:3000
```

### 2. Prepare Test Users

Make sure these users exist in your database:

```sql
-- Admin user
INSERT INTO users (username, password_hash, full_name, email, role_id)
VALUES ('admin', '<bcrypt_hash>', 'Admin User', 'admin@example.com', 1);

-- Ops user
INSERT INTO users (username, password_hash, full_name, email, role_id)
VALUES ('ops', '<bcrypt_hash>', 'Ops User', 'ops@example.com', 2);

-- Store user
INSERT INTO users (username, password_hash, full_name, email, role_id)
VALUES ('store_user', '<bcrypt_hash>', 'Store User', 'store@example.com', 3);
```

Or use the seed script:
```bash
cd backend
npm run db:seed-test
```

### 3. Configure Rate Limiting for Testing

**IMPORTANT:** Before running K6 tests, you must enable testing mode to increase rate limits, otherwise tests will fail with 429 errors.

**Enable Testing Mode:**
```bash
cd backend
# Add to your .env file
echo "TESTING_MODE=true" >> .env

# Restart backend server
npm run dev
```

**What Testing Mode Does:**
- Increases rate limits by 10x to allow load testing
- Admin endpoints: 100 → 1000 requests/minute
- OAuth/Auth endpoints: 10 → 100 requests/minute
- Strict endpoints: 5 → 50 requests/minute

**Verify Testing Mode is Active:**
When you start the backend, you should see:
```
🧪 TESTING MODE ENABLED - Rate limits increased by 10x
```

**⚠️ Production Warning:** Always set `TESTING_MODE=false` in production environments!

### 4. Run Tests

**Interactive Menu:**
```bash
cd k6-tests
./run-tests.sh
```

**Direct Test Execution:**
```bash
# Smoke test
k6 run scenarios/smoke-test.js

# Load test
k6 run scenarios/load-test.js

# Stress test
k6 run scenarios/stress-test.js

# Security test
k6 run scenarios/security-test.js

# Spike test
k6 run scenarios/spike-test.js
```

## 📊 Test Scenarios

### 1. Smoke Test
**Purpose:** Verify basic functionality  
**Duration:** ~1 minute  
**VUs:** 1-2  
**Tests:**
- Health check endpoint
- Root endpoint
- Login/logout flow
- User info retrieval

**When to run:** After every deployment, before other tests

### 2. Load Test
**Purpose:** Test normal expected load  
**Duration:** ~5 minutes  
**VUs:** 10  
**Tests:**
- Analytics endpoints
- Store management
- User management
- Audit logs

**Thresholds:**
- 95% of requests < 500ms
- 99% of requests < 1000ms
- Error rate < 1%
- Throughput > 100 RPS

**When to run:** Before releases, weekly

### 3. Stress Test
**Purpose:** Find system breaking point  
**Duration:** ~14 minutes  
**VUs:** 50 → 100  
**Tests:**
- Mixed user types (60% admin, 30% ops, 10% store)
- Realistic usage patterns
- Heavy analytics queries
- Multiple concurrent requests

**Thresholds:**
- 95% of requests < 2000ms
- Error rate < 10%
- Throughput > 50 RPS

**When to run:** Before major releases, after infrastructure changes

### 4. Spike Test
**Purpose:** Test recovery from sudden load  
**Duration:** ~3 minutes  
**VUs:** 10 → 100 → 10  
**Tests:**
- Sudden traffic increase
- System recovery
- Quick requests

**When to run:** Before promotions, after scaling changes

### 5. Security Test
**Purpose:** Identify security vulnerabilities  
**Duration:** ~3 minutes  
**VUs:** 5  
**Tests:**
- Invalid login attempts
- SQL injection prevention
- XSS prevention
- Path traversal prevention
- Authorization checks
- Session management
- Rate limiting (optional)

**When to run:** Weekly, before releases, after security patches

## 🔍 Interpreting Results

### K6 Output Metrics

```
checks.........................: 100.00% ✓ 150  ✗ 0   
data_received..................: 1.2 MB  20 kB/s
data_sent......................: 500 kB  8.3 kB/s
http_req_blocked...............: avg=1.2ms   min=0ms   med=1ms   max=5ms   p(90)=2ms   p(95)=3ms  
http_req_connecting............: avg=800µs   min=0µs   med=700µs max=3ms   p(90)=1.5ms p(95)=2ms  
http_req_duration..............: avg=250ms   min=50ms  med=200ms max=1s    p(90)=400ms p(95)=500ms
  { expected_response:true }...: avg=250ms   min=50ms  med=200ms max=1s    p(90)=400ms p(95)=500ms
http_req_failed................: 0.00%   ✓ 0    ✗ 150  
http_req_receiving.............: avg=1ms     min=0ms   med=1ms   max=10ms  p(90)=2ms   p(95)=3ms  
http_req_sending...............: avg=500µs   min=0µs   med=400µs max=2ms   p(90)=800µs p(95)=1ms  
http_req_tls_handshaking.......: avg=0s      min=0s    med=0s    max=0s    p(90)=0s    p(95)=0s   
http_req_waiting...............: avg=248.5ms min=49ms  med=198ms max=999ms p(90)=398ms p(95)=498ms
http_reqs......................: 150     2.5/s
iteration_duration.............: avg=5s      min=4s    med=5s    max=6s    p(90)=5.5s  p(95)=5.8s 
iterations.....................: 30      0.5/s
vus............................: 10      min=10 max=10
vus_max........................: 10      min=10 max=10
```

### Key Metrics Explained

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| `checks` | >95% | 90-95% | <90% |
| `http_req_duration p(95)` | <500ms | 500-1000ms | >1000ms |
| `http_req_failed` | <1% | 1-5% | >5% |
| `http_reqs` (RPS) | >100 | 50-100 | <50 |

### What to Look For

**✅ Good Signs:**
- High check pass rate (>95%)
- Low latency (p95 < 500ms)
- Low error rate (<1%)
- Consistent response times
- No timeouts

**⚠️ Warning Signs:**
- Checks passing 90-95%
- Increasing response times over test duration
- Error rate 1-5%
- Memory/CPU usage climbing
- Connection pool exhaustion

**❌ Critical Issues:**
- Checks failing >10%
- Response times >1 second
- Error rate >5%
- Server crashes
- Database connection errors
- Timeouts

## 🔒 Security Testing

### What is Tested

1. **Authentication Security**
   - Invalid credentials
   - SQL injection in login
   - Empty credentials
   - Invalid tokens

2. **Authorization**
   - Role-based access control
   - Cross-store data access
   - Admin endpoint protection

3. **Input Validation**
   - XSS prevention
   - SQL injection prevention
   - Path traversal prevention

4. **Session Management**
   - Session invalidation after logout
   - Session timeout
   - Cookie security

5. **Rate Limiting** (optional)
   - Rapid request throttling

### Security Checklist

After running security tests, manually verify:

- [ ] HTTPS enabled in production
- [ ] Secure cookie flags set (httpOnly, secure, sameSite)
- [ ] JWT tokens have expiration
- [ ] Passwords are hashed with bcrypt (cost >= 10)
- [ ] SQL queries use parameterized statements
- [ ] User input is sanitized
- [ ] CORS is properly configured
- [ ] Rate limiting is active
- [ ] API keys are not exposed in logs
- [ ] Sensitive data is encrypted in database
- [ ] Error messages don't leak sensitive info
- [ ] File uploads are validated and scanned
- [ ] Admin endpoints require authentication
- [ ] Audit logs are enabled and monitored

## 📈 Performance Baselines

Based on initial testing, expected baselines:

| Metric | Target | Acceptable | Needs Improvement |
|--------|--------|------------|-------------------|
| Response Time (p95) | <300ms | <500ms | >500ms |
| Response Time (p99) | <500ms | <1000ms | >1000ms |
| Throughput (RPS) | >200 | >100 | <100 |
| Error Rate | <0.5% | <1% | >1% |
| CPU Usage | <50% | <70% | >70% |
| Memory Usage | <60% | <80% | >80% |
| Database Connections | <50% pool | <70% pool | >70% pool |

## 🎯 Best Practices

### Before Testing

1. **Use dedicated test environment** - Don't test on production
2. **Prepare test data** - Seed database with realistic data
3. **Monitor system resources** - Have monitoring tools ready
4. **Warm up the system** - Run smoke test first
5. **Document baseline** - Record initial performance

### During Testing

1. **Monitor continuously** - Watch CPU, memory, database
2. **Check logs** - Look for errors in real-time
3. **Start small** - Begin with smoke test, then scale up
4. **Document observations** - Note any anomalies

### After Testing

1. **Analyze results** - Compare against baselines
2. **Identify bottlenecks** - Database? CPU? Network?
3. **Document findings** - Create performance report
4. **Plan improvements** - Prioritize optimizations
5. **Retest** - Verify improvements

## 🔧 Troubleshooting

### "Cannot connect to server"
```bash
# Check if backend is running
curl http://localhost:3000/health

# Start backend
cd backend && npm run dev
```

### "Login failed: 401"
```bash
# Verify test user exists and password is correct
# Check backend logs for authentication errors

# Reset test user password (in database)
UPDATE users SET password_hash = '<bcrypt_hash>' WHERE username = 'admin';
```

### "Too many errors (>5%)"
Possible causes:
- Server overloaded
- Database connection pool exhausted
- Rate limiting too strict
- Application bugs

Solutions:
- Reduce concurrent VUs
- Increase database connection pool
- Check application logs
- Optimize slow queries

### "Rate limit exceeded (429 errors)"
**This is the most common issue when running K6 tests!**

Symptoms:
- Tests fail with HTTP 429 (Too Many Requests)
- Error rate suddenly jumps to 100%
- Response headers show `X-RateLimit-Remaining: 0`

**Solution:**
```bash
# 1. Enable testing mode in backend/.env
echo "TESTING_MODE=true" >> backend/.env

# 2. Restart backend server
cd backend && npm run dev

# 3. Verify testing mode is active (look for this log):
# 🧪 TESTING MODE ENABLED - Rate limits increased by 10x

# 4. Run K6 tests again
cd ../k6-tests && ./run-tests.sh
```

**Testing Mode Rate Limits:**
- Admin: 1000 req/min (vs 100 in production)
- Auth: 100 req/min (vs 10 in production)
- Strict: 50 req/min (vs 5 in production)

**Note:** Always disable testing mode in production by setting `TESTING_MODE=false`

### "Memory leak detected"
Signs:
- Memory usage climbing continuously
- Eventual server crash
- GC pauses increasing

Solutions:
- Check for unclosed connections
- Review object references
- Use memory profiler
- Update dependencies

## 📝 Environment Variables

Override defaults with environment variables:

```bash
# Server URLs
export BASE_URL="http://localhost:3000"
export FRONTEND_URL="http://localhost:3002"

# Test credentials
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="admin123"
export OPS_USERNAME="ops"
export OPS_PASSWORD="ops123"
export STORE_USERNAME="store_user"
export STORE_PASSWORD="store123"

# API Key (if needed)
export API_KEY="your-api-key"

# Run test
./run-tests.sh
```

## 📊 Generating Reports

### JSON Report
```bash
k6 run --out json=reports/test-result.json scenarios/load-test.js
```

### HTML Report (using k6-reporter)
```bash
npm install -g k6-to-junit
k6 run --out json=reports/test.json scenarios/load-test.js
k6-to-junit reports/test.json > reports/test.xml
```

### Cloud Dashboard (optional)
```bash
k6 login cloud
k6 run --out cloud scenarios/load-test.js
```

## 🔗 Resources

- [K6 Documentation](https://k6.io/docs/)
- [K6 Examples](https://k6.io/docs/examples/)
- [K6 Best Practices](https://k6.io/docs/testing-guides/running-large-tests/)
- [Performance Testing Guide](https://k6.io/docs/testing-guides/)

## 📞 Support

If you encounter issues:

1. Check this README
2. Review K6 documentation
3. Check application logs
4. Monitor system resources
5. Review security checklist

---

**Happy Testing! 🚀**

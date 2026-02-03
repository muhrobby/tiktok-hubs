/**
 * K6 Test Configuration
 * Base configuration for all test scenarios
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const FRONTEND_URL = __ENV.FRONTEND_URL || 'http://localhost:3002';

// Test users (make sure these exist in your database)
export const TEST_USERS = {
  admin: {
    username: __ENV.ADMIN_USERNAME || 'admin',
    password: __ENV.ADMIN_PASSWORD || 'admin123',
  },
  ops: {
    username: __ENV.OPS_USERNAME || 'ops',
    password: __ENV.OPS_PASSWORD || 'ops123',
  },
  store: {
    username: __ENV.STORE_USERNAME || 'store_user',
    password: __ENV.STORE_PASSWORD || 'store123',
  },
};

// API Key for admin endpoints (if needed)
export const API_KEY = __ENV.API_KEY || '';

// Test thresholds - what constitutes a "passing" test
export const THRESHOLDS = {
  // 95% of requests must complete within 500ms
  'http_req_duration{status:200}': ['p(95)<500'],
  // 99% of requests must complete within 1000ms
  'http_req_duration': ['p(99)<1000'],
  // Less than 1% error rate
  'http_req_failed': ['rate<0.01'],
  // At least 100 requests per second
  'http_reqs': ['rate>100'],
};

// Test stages for different load scenarios
export const LOAD_STAGES = {
  // Smoke test - minimal load
  smoke: [
    { duration: '30s', target: 1 }, // 1 user for 30s
  ],
  
  // Load test - normal expected load
  load: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 10 },   // Stay at 10 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  
  // Stress test - beyond normal capacity
  stress: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Push to 100 users
    { duration: '3m', target: 100 },  // Hold at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  
  // Spike test - sudden traffic spike
  spike: [
    { duration: '30s', target: 10 },  // Normal load
    { duration: '1m', target: 100 },  // Sudden spike
    { duration: '30s', target: 10 },  // Back to normal
    { duration: '30s', target: 0 },   // Ramp down
  ],
  
  // Soak test - sustained load over time
  soak: [
    { duration: '2m', target: 20 },   // Ramp up
    { duration: '30m', target: 20 },  // Sustained load for 30 minutes
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

// Common headers
export const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Test data
export const TEST_DATA = {
  stores: ['STORE001', 'STORE002', 'STORE003'],
  invalidTokens: [
    'invalid.jwt.token',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
    '',
  ],
};

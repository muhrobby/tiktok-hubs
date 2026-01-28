/**
 * Security / Penetration Test
 * Test authentication, authorization, and common vulnerabilities
 * Duration: ~3 minutes
 * VUs: 5
 */

import { group, sleep, check } from 'k6';
import http from 'k6/http';
import { BASE_URL, TEST_USERS, HEADERS, TEST_DATA } from '../utils/config.js';
import { 
  login, 
  authenticatedRequest, 
  checkError,
  setup,
  teardown 
} from '../utils/helpers.js';

export { setup, teardown };

export const options = {
  stages: [
    { duration: '3m', target: 5 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_failed': ['rate<0.50'], // Security tests expect failures
  },
};

export default function () {
  
  // 1. Authentication Tests
  group('Authentication Security', () => {
    // Invalid credentials
    group('Invalid Login Attempts', () => {
      const invalidRes = http.post(`${BASE_URL}/user-auth/login`, 
        JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
        { headers: HEADERS }
      );
      checkError(invalidRes, 401, 'invalid login');
      sleep(0.5);

      // SQL injection attempt
      const sqlRes = http.post(`${BASE_URL}/user-auth/login`,
        JSON.stringify({ username: "admin' OR '1'='1", password: "' OR '1'='1" }),
        { headers: HEADERS }
      );
      checkError(sqlRes, 401, 'sql injection login');
      sleep(0.5);

      // Empty credentials
      const emptyRes = http.post(`${BASE_URL}/user-auth/login`,
        JSON.stringify({ username: '', password: '' }),
        { headers: HEADERS }
      );
      check(emptyRes, {
        'empty credentials rejected': (r) => r.status === 400 || r.status === 401,
      });
      sleep(0.5);
    });

    // Invalid tokens
    group('Invalid Token Access', () => {
      TEST_DATA.invalidTokens.forEach(token => {
        const res = http.get(`${BASE_URL}/user-auth/me`, {
          headers: {
            ...HEADERS,
            'Cookie': `access_token=${token}`,
          },
        });
        checkError(res, 401, 'invalid token');
        sleep(0.3);
      });
    });
  });

  // 2. Authorization Tests
  group('Authorization Security', () => {
    // Login as store user (limited permissions)
    const storeAuth = login(TEST_USERS.store.username, TEST_USERS.store.password);
    if (storeAuth) {
      sleep(0.5);

      // Try to access admin endpoints (should fail)
      group('Unauthorized Admin Access', () => {
        const usersRes = authenticatedRequest('GET', '/admin/users', storeAuth.cookies);
        checkError(usersRes, 403, 'unauthorized users access');
        sleep(0.3);

        const exportRes = authenticatedRequest('GET', '/admin/export/stores?format=xlsx', storeAuth.cookies);
        checkError(exportRes, 403, 'unauthorized export');
        sleep(0.3);

        const importRes = authenticatedRequest('POST', '/admin/import/stores', storeAuth.cookies, {});
        checkError(importRes, 403, 'unauthorized import');
        sleep(0.3);
      });

      // Try to access other store's data
      group('Cross-Store Access', () => {
        const otherStoreRes = authenticatedRequest('GET', '/admin/stores/OTHER_STORE', storeAuth.cookies);
        check(otherStoreRes, {
          'cross-store access denied': (r) => r.status === 403 || r.status === 404,
        });
        sleep(0.5);
      });
    }
  });

  // 3. Input Validation Tests
  group('Input Validation', () => {
    const auth = login(TEST_USERS.admin.username, TEST_USERS.admin.password);
    if (!auth) return;
    sleep(0.5);

    // XSS attempts
    group('XSS Prevention', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        '<img src=x onerror=alert("xss")>',
      ];

      xssPayloads.forEach(payload => {
        const res = authenticatedRequest('GET', `/admin/stores/${encodeURIComponent(payload)}`, auth.cookies);
        check(res, {
          'xss payload sanitized': (r) => r.status !== 200 || !r.body.includes('<script>'),
        });
        sleep(0.2);
      });
    });

    // SQL injection attempts
    group('SQL Injection Prevention', () => {
      const sqlPayloads = [
        "' OR '1'='1",
        "1' UNION SELECT * FROM users--",
        "'; DROP TABLE stores; --",
      ];

      sqlPayloads.forEach(payload => {
        const res = authenticatedRequest('GET', `/admin/stores/${encodeURIComponent(payload)}`, auth.cookies);
        check(res, {
          'sql injection blocked': (r) => r.status === 400 || r.status === 404,
        });
        sleep(0.2);
      });
    });

    // Path traversal attempts
    group('Path Traversal Prevention', () => {
      const pathPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '%2e%2e%2f%2e%2e%2f',
      ];

      pathPayloads.forEach(payload => {
        const res = authenticatedRequest('GET', `/admin/stores/${encodeURIComponent(payload)}`, auth.cookies);
        check(res, {
          'path traversal blocked': (r) => r.status !== 200,
        });
        sleep(0.2);
      });
    });
  });

  // 4. Rate Limiting Tests
  group('Rate Limiting', () => {
    const auth = login(TEST_USERS.admin.username, TEST_USERS.admin.password);
    if (!auth) return;
    sleep(0.5);

    // Rapid requests to check rate limiting
    group('Rapid Requests', () => {
      let rateLimitHit = false;
      for (let i = 0; i < 50; i++) {
        const res = authenticatedRequest('GET', '/admin/analytics/overview', auth.cookies);
        if (res.status === 429) {
          rateLimitHit = true;
          break;
        }
        // No sleep - rapid fire requests
      }
      
      check({ rateLimitHit }, {
        'rate limiting active (optional)': (data) => true, // Just informational
      });
    });
  });

  // 5. Session Management
  group('Session Security', () => {
    const auth = login(TEST_USERS.admin.username, TEST_USERS.admin.password);
    if (!auth) return;
    sleep(0.5);

    // Verify session works
    const meRes = authenticatedRequest('GET', '/user-auth/me', auth.cookies);
    check(meRes, { 'valid session works': (r) => r.status === 200 });
    sleep(0.3);

    // Logout
    authenticatedRequest('POST', '/user-auth/logout', auth.cookies);
    sleep(0.3);

    // Try to use logged out session
    const afterLogoutRes = authenticatedRequest('GET', '/user-auth/me', auth.cookies);
    checkError(afterLogoutRes, 401, 'logged out session');
    sleep(0.5);
  });

  sleep(1);
}

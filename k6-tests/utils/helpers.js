/**
 * K6 Helper Functions
 * Reusable functions for K6 tests
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, HEADERS } from './config.js';

// Custom metrics
export const errorRate = new Rate('errors');
export const loginDuration = new Trend('login_duration');
export const apiCallDuration = new Trend('api_call_duration');
export const authErrors = new Counter('auth_errors');

/**
 * Perform login and return cookies
 */
export function login(username, password) {
  const loginStart = Date.now();
  
  const payload = JSON.stringify({
    username: username,
    password: password,
  });

  const res = http.post(`${BASE_URL}/user-auth/login`, payload, {
    headers: HEADERS,
  });

  const duration = Date.now() - loginStart;
  loginDuration.add(duration);

  const success = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login returns success': (r) => {
      const body = JSON.parse(r.body || '{}');
      return body.success === true;
    },
    'login duration < 500ms': () => duration < 500,
  });

  if (!success) {
    authErrors.add(1);
    errorRate.add(1);
    console.error(`Login failed for ${username}: ${res.status} - ${res.body}`);
    return null;
  }

  errorRate.add(0);
  
  // Extract cookies from Set-Cookie header
  const cookies = {};
  const setCookie = res.headers['Set-Cookie'];
  if (setCookie) {
    const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie];
    cookieArray.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    });
  }

  return {
    cookies: cookies,
    body: JSON.parse(res.body || '{}'),
  };
}

/**
 * Make authenticated API request
 */
export function authenticatedRequest(method, endpoint, cookies, body = null) {
  const start = Date.now();
  
  // Build cookie header
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  const params = {
    headers: {
      ...HEADERS,
      'Cookie': cookieHeader,
    },
  };

  let res;
  const url = `${BASE_URL}${endpoint}`;
  
  if (method === 'GET') {
    res = http.get(url, params);
  } else if (method === 'POST') {
    res = http.post(url, body ? JSON.stringify(body) : null, params);
  } else if (method === 'PUT') {
    res = http.put(url, body ? JSON.stringify(body) : null, params);
  } else if (method === 'DELETE') {
    res = http.del(url, null, params);
  }

  const duration = Date.now() - start;
  apiCallDuration.add(duration);

  return res;
}

/**
 * Check response is successful
 */
export function checkSuccess(res, endpoint) {
  const success = check(res, {
    [`${endpoint} - status is 200`]: (r) => r.status === 200,
    [`${endpoint} - response time < 500ms`]: (r) => r.timings.duration < 500,
    [`${endpoint} - has body`]: (r) => r.body && r.body.length > 0,
  });

  errorRate.add(!success ? 1 : 0);
  return success;
}

/**
 * Check response is error (for negative tests)
 */
export function checkError(res, expectedStatus, endpoint) {
  const success = check(res, {
    [`${endpoint} - status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${endpoint} - has error message`]: (r) => {
      try {
        const body = JSON.parse(r.body || '{}');
        return body.error && body.error.message;
      } catch {
        return false;
      }
    },
  });

  return success;
}

/**
 * Random sleep between min and max seconds
 */
export function randomSleep(min = 1, max = 3) {
  const duration = min + Math.random() * (max - min);
  sleep(duration);
}

/**
 * Generate random store code
 */
export function randomStoreCode() {
  const codes = ['STORE001', 'STORE002', 'STORE003', 'STORE999'];
  return codes[Math.floor(Math.random() * codes.length)];
}

/**
 * Setup function - runs once per VU
 */
export function setup() {
  console.log('Starting K6 load test...');
  console.log(`Base URL: ${BASE_URL}`);
  
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    console.error('Health check failed! Server might be down.');
    return { healthy: false };
  }
  
  console.log('Server is healthy and ready for testing');
  return { healthy: true };
}

/**
 * Teardown function - runs once after all VUs finish
 */
export function teardown(data) {
  console.log('K6 load test completed');
}

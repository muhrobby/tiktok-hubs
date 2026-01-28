/**
 * Smoke Test
 * Minimal load test to verify basic functionality
 * Duration: ~1 minute
 * VUs: 1-2
 */

import { group, sleep } from 'k6';
import http from 'k6/http';
import { BASE_URL, TEST_USERS, LOAD_STAGES, THRESHOLDS } from '../utils/config.js';
import { 
  login, 
  authenticatedRequest, 
  checkSuccess,
  randomSleep,
  setup,
  teardown 
} from '../utils/helpers.js';

export { setup, teardown };

export const options = {
  stages: LOAD_STAGES.smoke,
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% under 1s (more lenient for smoke test)
    'http_req_failed': ['rate<0.05'],    // Less than 5% errors
  },
};

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    checkSuccess(res, 'health');
    sleep(1);
  });

  group('Root Endpoint', () => {
    const res = http.get(`${BASE_URL}/`);
    checkSuccess(res, 'root');
    sleep(1);
  });

  group('User Authentication Flow', () => {
    // Login
    const auth = login(TEST_USERS.admin.username, TEST_USERS.admin.password);
    if (!auth) {
      console.error('Smoke test failed: Cannot login');
      return;
    }
    sleep(1);

    // Get current user
    const meRes = authenticatedRequest('GET', '/user-auth/me', auth.cookies);
    checkSuccess(meRes, '/user-auth/me');
    sleep(1);

    // Logout
    const logoutRes = authenticatedRequest('POST', '/user-auth/logout', auth.cookies);
    checkSuccess(logoutRes, '/user-auth/logout');
    sleep(1);
  });

  randomSleep(1, 2);
}

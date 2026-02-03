/**
 * Stress Test
 * Push the system beyond normal capacity to find breaking point
 * Duration: ~14 minutes
 * VUs: Up to 100
 */

import { group, sleep } from 'k6';
import { BASE_URL, TEST_USERS, LOAD_STAGES } from '../utils/config.js';
import { 
  login, 
  authenticatedRequest, 
  checkSuccess,
  randomSleep,
  randomStoreCode,
  setup,
  teardown 
} from '../utils/helpers.js';

export { setup, teardown };

export const options = {
  stages: LOAD_STAGES.stress,
  thresholds: {
    // More lenient thresholds for stress test
    'http_req_duration': ['p(95)<2000'],  // 95% under 2s
    'http_req_failed': ['rate<0.10'],     // Less than 10% errors
    'http_reqs': ['rate>50'],             // At least 50 RPS
  },
};

export default function () {
  // Different user types
  const userType = Math.random();
  let username, password;
  
  if (userType < 0.6) {
    // 60% admin users
    username = TEST_USERS.admin.username;
    password = TEST_USERS.admin.password;
  } else if (userType < 0.9) {
    // 30% ops users
    username = TEST_USERS.ops.username;
    password = TEST_USERS.ops.password;
  } else {
    // 10% store users
    username = TEST_USERS.store.username;
    password = TEST_USERS.store.password;
  }

  const auth = login(username, password);
  if (!auth) return;

  sleep(0.5);

  // Simulate realistic user behavior with mixed requests
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% - Heavy analytics user
    group('Analytics Heavy', () => {
      authenticatedRequest('GET', '/admin/analytics/overview', auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', '/admin/analytics/followers-trend?days=7', auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', '/admin/analytics/video-performance?days=7', auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', '/admin/analytics/top-stores?limit=5', auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', '/admin/analytics/top-videos?limit=10', auth.cookies);
    });
  } else if (scenario < 0.6) {
    // 30% - Store browser
    group('Store Browsing', () => {
      authenticatedRequest('GET', '/admin/stores', auth.cookies);
      sleep(0.3);
      
      const storeCode = randomStoreCode();
      authenticatedRequest('GET', `/admin/stores/${storeCode}`, auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', `/admin/stores/${storeCode}/accounts`, auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', `/admin/stores/${storeCode}/user-stats?days=7`, auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', `/admin/stores/${storeCode}/video-stats?days=7`, auth.cookies);
    });
  } else if (scenario < 0.8) {
    // 20% - Admin tasks
    group('Admin Tasks', () => {
      authenticatedRequest('GET', '/admin/users', auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', '/admin/audit-logs?page=1&limit=50', auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', '/admin/audit-logs/summary', auth.cookies);
      sleep(0.3);
      authenticatedRequest('GET', '/admin/sync/status', auth.cookies);
    });
  } else {
    // 20% - Quick dashboard check
    group('Quick Check', () => {
      authenticatedRequest('GET', '/admin/analytics/overview', auth.cookies);
      sleep(0.2);
      authenticatedRequest('GET', '/admin/analytics/sync-health', auth.cookies);
    });
  }

  randomSleep(0.5, 1.5);
}

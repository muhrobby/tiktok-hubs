/**
 * Load Test - API Endpoints
 * Test normal expected load on main API endpoints
 * Duration: ~5 minutes
 * VUs: 10
 */

import { group, sleep } from 'k6';
import http from 'k6/http';
import { BASE_URL, TEST_USERS, LOAD_STAGES, THRESHOLDS } from '../utils/config.js';
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
  stages: LOAD_STAGES.load,
  thresholds: THRESHOLDS,
};

export default function () {
  // Login once per iteration
  const auth = login(TEST_USERS.admin.username, TEST_USERS.admin.password);
  if (!auth) return;

  sleep(1);

  // Dashboard / Analytics
  group('Analytics Endpoints', () => {
    authenticatedRequest('GET', '/admin/analytics/overview', auth.cookies);
    sleep(0.5);

    authenticatedRequest('GET', '/admin/analytics/followers-trend?days=30', auth.cookies);
    sleep(0.5);

    authenticatedRequest('GET', '/admin/analytics/video-performance?days=30', auth.cookies);
    sleep(0.5);

    authenticatedRequest('GET', '/admin/analytics/top-stores?limit=10', auth.cookies);
    sleep(0.5);

    authenticatedRequest('GET', '/admin/analytics/sync-health', auth.cookies);
    sleep(1);
  });

  // Store Management
  group('Store Endpoints', () => {
    const storesRes = authenticatedRequest('GET', '/admin/stores', auth.cookies);
    checkSuccess(storesRes, '/admin/stores');
    sleep(1);

    const storeCode = randomStoreCode();
    const storeRes = authenticatedRequest('GET', `/admin/stores/${storeCode}`, auth.cookies);
    // Don't check success as store might not exist
    sleep(1);

    const accountsRes = authenticatedRequest('GET', `/admin/stores/${storeCode}/accounts`, auth.cookies);
    sleep(1);
  });

  // User Management
  group('User Management', () => {
    authenticatedRequest('GET', '/admin/users', auth.cookies);
    sleep(0.5);

    authenticatedRequest('GET', '/admin/users/roles', auth.cookies);
    sleep(1);
  });

  // Audit Logs
  group('Audit Logs', () => {
    authenticatedRequest('GET', '/admin/audit-logs?page=1&limit=20', auth.cookies);
    sleep(0.5);

    authenticatedRequest('GET', '/admin/audit-logs/summary', auth.cookies);
    sleep(0.5);

    authenticatedRequest('GET', '/admin/audit-logs/resources', auth.cookies);
    sleep(1);
  });

  randomSleep(2, 4);
}

/**
 * Spike Test
 * Sudden increase in load to test system recovery
 * Duration: ~3 minutes
 * VUs: 10 → 100 → 10
 */

import { group, sleep } from 'k6';
import { BASE_URL, TEST_USERS, LOAD_STAGES } from '../utils/config.js';
import { 
  login, 
  authenticatedRequest,
  randomSleep,
  randomStoreCode,
  setup,
  teardown 
} from '../utils/helpers.js';

export { setup, teardown };

export const options = {
  stages: LOAD_STAGES.spike,
  thresholds: {
    'http_req_duration': ['p(95)<3000'],  // 95% under 3s during spike
    'http_req_failed': ['rate<0.15'],     // Less than 15% errors
  },
};

export default function () {
  const auth = login(TEST_USERS.admin.username, TEST_USERS.admin.password);
  if (!auth) return;

  sleep(0.3);

  // Quick requests during spike
  group('Spike Scenario', () => {
    const scenario = Math.floor(Math.random() * 4);

    switch (scenario) {
      case 0:
        authenticatedRequest('GET', '/admin/analytics/overview', auth.cookies);
        break;
      case 1:
        authenticatedRequest('GET', '/admin/stores', auth.cookies);
        break;
      case 2:
        authenticatedRequest('GET', '/admin/users', auth.cookies);
        break;
      case 3:
        const storeCode = randomStoreCode();
        authenticatedRequest('GET', `/admin/stores/${storeCode}`, auth.cookies);
        break;
    }
  });

  randomSleep(0.1, 0.5);
}

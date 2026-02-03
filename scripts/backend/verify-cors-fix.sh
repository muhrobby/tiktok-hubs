#!/bin/bash

# CORS Fix Verification Script
# Tests backend CORS configuration and cookie handling

set -e

BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3001"

echo "=================================================="
echo "   CORS FIX VERIFICATION SCRIPT"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
check_test() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

echo "Step 1: Check if backend is running"
echo "------------------------------------"
if curl -s "${BACKEND_URL}/health" > /dev/null; then
    check_test 0 "Backend is running on port 3000"
else
    check_test 1 "Backend is NOT running on port 3000"
    echo ""
    echo -e "${RED}ERROR: Please start the backend server first${NC}"
    echo "Run: cd /media/muhrobby/DataExternal/Project/tiktok-hubs/backend && npm run dev"
    exit 1
fi
echo ""

echo "Step 2: Check environment variables"
echo "------------------------------------"
cd /media/muhrobby/DataExternal/Project/tiktok-hubs/backend

if grep -q "CORS_ORIGIN=http://localhost:3001" .env; then
    check_test 0 "CORS_ORIGIN is set correctly"
else
    check_test 1 "CORS_ORIGIN is NOT set correctly"
fi

if grep -q "NODE_ENV=development" .env; then
    check_test 0 "NODE_ENV is set correctly"
else
    check_test 1 "NODE_ENV is NOT set correctly"
fi
echo ""

echo "Step 3: Test CORS Preflight (OPTIONS request)"
echo "----------------------------------------------"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS "${BACKEND_URL}/user-auth/login" \
    -H "Origin: ${FRONTEND_URL}" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type")

if [ "$RESPONSE" = "204" ] || [ "$RESPONSE" = "200" ]; then
    check_test 0 "OPTIONS request successful (HTTP $RESPONSE)"
else
    check_test 1 "OPTIONS request failed (HTTP $RESPONSE)"
fi

# Check CORS headers
CORS_HEADERS=$(curl -s -i \
    -X OPTIONS "${BACKEND_URL}/user-auth/login" \
    -H "Origin: ${FRONTEND_URL}" \
    -H "Access-Control-Request-Method: POST" | grep -i "access-control")

if echo "$CORS_HEADERS" | grep -iq "access-control-allow-origin.*${FRONTEND_URL}"; then
    check_test 0 "Access-Control-Allow-Origin header is correct"
else
    check_test 1 "Access-Control-Allow-Origin header is MISSING or incorrect"
    echo -e "${YELLOW}  Headers received:${NC}"
    echo "$CORS_HEADERS"
fi

if echo "$CORS_HEADERS" | grep -iq "access-control-allow-credentials.*true"; then
    check_test 0 "Access-Control-Allow-Credentials is true"
else
    check_test 1 "Access-Control-Allow-Credentials is MISSING or false"
fi
echo ""

echo "Step 4: Test Login Endpoint"
echo "----------------------------"
LOGIN_RESPONSE=$(curl -s -i -X POST "${BACKEND_URL}/user-auth/login" \
    -H "Origin: ${FRONTEND_URL}" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

# Check HTTP status
if echo "$LOGIN_RESPONSE" | head -1 | grep -q "200"; then
    check_test 0 "Login request successful (HTTP 200)"
else
    check_test 1 "Login request failed (not HTTP 200)"
    echo -e "${YELLOW}  Response:${NC}"
    echo "$LOGIN_RESPONSE" | head -10
fi

# Check for cookies
if echo "$LOGIN_RESPONSE" | grep -iq "set-cookie.*access_token"; then
    check_test 0 "access_token cookie is set"
else
    check_test 1 "access_token cookie is MISSING"
fi

if echo "$LOGIN_RESPONSE" | grep -iq "set-cookie.*refresh_token"; then
    check_test 0 "refresh_token cookie is set"
else
    check_test 1 "refresh_token cookie is MISSING"
fi

# Check cookie attributes
ACCESS_COOKIE=$(echo "$LOGIN_RESPONSE" | grep -i "set-cookie.*access_token" | head -1)

if echo "$ACCESS_COOKIE" | grep -iq "HttpOnly"; then
    check_test 0 "access_token has HttpOnly flag"
else
    check_test 1 "access_token is MISSING HttpOnly flag"
fi

if echo "$ACCESS_COOKIE" | grep -iq "SameSite=Lax\|SameSite=lax"; then
    check_test 0 "access_token has SameSite=Lax"
else
    check_test 1 "access_token is MISSING SameSite=Lax"
    echo -e "${YELLOW}  Cookie: $ACCESS_COOKIE${NC}"
fi

# In development, cookie should NOT have Secure flag (since we're using http)
if echo "$ACCESS_COOKIE" | grep -iq ";\s*Secure"; then
    check_test 1 "access_token has Secure flag (should be false in development)"
    echo -e "${YELLOW}  This will prevent cookies from working on http://localhost${NC}"
else
    check_test 0 "access_token does NOT have Secure flag (correct for development)"
fi
echo ""

echo "Step 5: Check CORS headers in login response"
echo "---------------------------------------------"
if echo "$LOGIN_RESPONSE" | grep -iq "access-control-allow-origin.*${FRONTEND_URL}"; then
    check_test 0 "Login response has correct CORS origin"
else
    check_test 1 "Login response MISSING correct CORS origin"
fi

if echo "$LOGIN_RESPONSE" | grep -iq "access-control-allow-credentials.*true"; then
    check_test 0 "Login response allows credentials"
else
    check_test 1 "Login response does NOT allow credentials"
fi
echo ""

echo "=================================================="
echo "   TEST RESULTS"
echo "=================================================="
echo ""
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "🎉 Backend CORS is configured correctly!"
    echo ""
    echo "Next steps:"
    echo "1. Start frontend: cd /media/muhrobby/DataExternal/Project/sosmed-hub-frontend && npm run dev"
    echo "2. Open browser: http://localhost:3001/login"
    echo "3. Login with: admin / admin123"
    echo "4. Check cookies in DevTools → Application → Cookies"
    echo ""
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo ""
    echo "1. Restart backend server:"
    echo "   cd /media/muhrobby/DataExternal/Project/tiktok-hubs/backend"
    echo "   pkill -f 'tsx watch' || pkill -f 'node dist/index.js'"
    echo "   npm run dev"
    echo ""
    echo "2. Check .env file has:"
    echo "   CORS_ORIGIN=http://localhost:3001"
    echo "   NODE_ENV=development"
    echo ""
    echo "3. Re-run this script to verify"
    echo ""
    exit 1
fi

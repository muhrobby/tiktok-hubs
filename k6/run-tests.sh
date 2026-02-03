#!/bin/bash

# K6 Load Testing Runner
# Automated script to run all K6 tests and generate reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3002}"
REPORTS_DIR="$(dirname "$0")/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Test users (override with environment variables)
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
OPS_USERNAME="${OPS_USERNAME:-ops}"
OPS_PASSWORD="${OPS_PASSWORD:-ops123}"
STORE_USERNAME="${STORE_USERNAME:-store_user}"
STORE_PASSWORD="${STORE_PASSWORD:-store123}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  K6 Load Testing Suite${NC}"
echo -e "${BLUE}  Sosmed HUB - TikTok Reporting${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if K6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: K6 is not installed${NC}"
    echo ""
    echo "Please install K6 first:"
    echo ""
    echo "  Ubuntu/Debian:"
    echo "    sudo gpg -k"
    echo "    sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
    echo "    echo 'deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main' | sudo tee /etc/apt/sources.list.d/k6.list"
    echo "    sudo apt-get update"
    echo "    sudo apt-get install k6"
    echo ""
    echo "  macOS:"
    echo "    brew install k6"
    echo ""
    echo "  Other OS: Visit https://k6.io/docs/getting-started/installation/"
    exit 1
fi

echo -e "${GREEN}✓ K6 is installed: $(k6 version)${NC}"
echo ""

# Check if server is running
echo -e "${YELLOW}Checking if server is running...${NC}"
if ! curl -sf "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Backend server is not running at ${BASE_URL}${NC}"
    echo ""
    echo "Please start the backend server first:"
    echo "  cd backend && npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ Backend server is running${NC}"
echo ""

# Create reports directory
mkdir -p "${REPORTS_DIR}"

# Export environment variables for K6
export BASE_URL
export FRONTEND_URL
export ADMIN_USERNAME
export ADMIN_PASSWORD
export OPS_USERNAME
export OPS_PASSWORD
export STORE_USERNAME
export STORE_PASSWORD

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local report_file="${REPORTS_DIR}/${test_name}_${TIMESTAMP}.json"
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Running: ${test_name}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Run K6 test with JSON output
    if k6 run --out json="${report_file}" "${test_file}"; then
        echo ""
        echo -e "${GREEN}✓ ${test_name} completed successfully${NC}"
        echo -e "  Report saved: ${report_file}"
    else
        echo ""
        echo -e "${RED}✗ ${test_name} failed${NC}"
        echo -e "  Check report: ${report_file}"
    fi
    echo ""
}

# Main menu
echo "Select test to run:"
echo ""
echo "  1) Smoke Test (1 min, 1-2 VUs)"
echo "  2) Load Test (5 min, 10 VUs)"
echo "  3) Stress Test (14 min, up to 100 VUs)"
echo "  4) Spike Test (3 min, 10→100→10 VUs)"
echo "  5) Security/Pentest (3 min, 5 VUs)"
echo "  6) Run All Tests (~30 min)"
echo "  7) Quick Test Suite (Smoke + Security, ~5 min)"
echo ""
read -p "Enter choice [1-7]: " choice

case $choice in
    1)
        run_test "smoke-test" "scenarios/smoke-test.js"
        ;;
    2)
        run_test "load-test" "scenarios/load-test.js"
        ;;
    3)
        echo -e "${YELLOW}Warning: Stress test will push your system to its limits!${NC}"
        read -p "Continue? [y/N]: " confirm
        if [[ $confirm == [yY] ]]; then
            run_test "stress-test" "scenarios/stress-test.js"
        fi
        ;;
    4)
        run_test "spike-test" "scenarios/spike-test.js"
        ;;
    5)
        run_test "security-test" "scenarios/security-test.js"
        ;;
    6)
        echo -e "${YELLOW}Running all tests (this will take ~30 minutes)...${NC}"
        echo ""
        run_test "smoke-test" "scenarios/smoke-test.js"
        sleep 5
        run_test "load-test" "scenarios/load-test.js"
        sleep 5
        run_test "security-test" "scenarios/security-test.js"
        sleep 5
        run_test "spike-test" "scenarios/spike-test.js"
        sleep 5
        echo -e "${YELLOW}Warning: Starting stress test (14 minutes)...${NC}"
        run_test "stress-test" "scenarios/stress-test.js"
        ;;
    7)
        echo -e "${YELLOW}Running Quick Test Suite...${NC}"
        echo ""
        run_test "smoke-test" "scenarios/smoke-test.js"
        sleep 3
        run_test "security-test" "scenarios/security-test.js"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}Testing complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Reports saved in: ${REPORTS_DIR}"
echo ""
echo "To view detailed results:"
echo "  k6 inspect ${REPORTS_DIR}/<test>_${TIMESTAMP}.json"
echo ""
echo "To analyze with k6 Cloud (optional):"
echo "  k6 login cloud"
echo "  k6 run --out cloud scenarios/<test>.js"

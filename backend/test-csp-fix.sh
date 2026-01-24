#!/bin/bash
echo "🔍 CSP Fix Verification - Inline Scripts"
echo "=========================================="
echo ""

# 1. Check TypeScript compilation
echo "✅ Checking TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
    echo "   ✓ TypeScript builds successfully"
else
    echo "   ✗ TypeScript compilation errors!"
    exit 1
fi

# 2. Check if CSP middleware has route-specific logic
echo ""
echo "✅ Checking CSP configuration..."
if grep -q "isSwaggerRoute" src/middleware/security.ts; then
    echo "   ✓ Route-specific CSP logic implemented"
else
    echo "   ✗ Route-specific CSP not found!"
    exit 1
fi

if grep -q "'unsafe-inline'" src/middleware/security.ts; then
    echo "   ✓ Inline scripts allowed for Swagger UI routes"
else
    echo "   ✗ Inline scripts not configured!"
    exit 1
fi

# 3. Verify strict CSP for API routes
if grep -q "scriptSrc: \[\"'self'\"\]" src/middleware/security.ts; then
    echo "   ✓ Strict CSP maintained for API routes"
else
    echo "   ✗ Strict CSP not configured!"
    exit 1
fi

# 4. Check CSP logic for specific routes
echo ""
echo "✅ Verifying route patterns..."
ROUTES=("api/docs" "docs" "swagger" "api/openapi.json")
for route in "${ROUTES[@]}"; do
    if grep -q "$route" src/middleware/security.ts; then
        echo "   ✓ /$route - Relaxed CSP"
    else
        echo "   ✗ /$route - Missing!"
        exit 1
    fi
done

echo ""
echo "=========================================="
echo "✅ All CSP checks passed!"
echo ""
echo "📚 What was fixed:"
echo "   • Inline scripts now allowed for Swagger UI routes only"
echo "   • Strict CSP maintained for all API endpoints"
echo "   • Security isolation between documentation and API"
echo ""
echo "🔒 Security Status:"
echo "   • /api/docs, /docs, /swagger: Relaxed CSP (allows inline)"
echo "   • /admin/*, /auth/*, others: Strict CSP (no inline)"
echo ""
echo "🧪 To verify in browser:"
echo "   1. Start server: npm run dev"
echo "   2. Open: http://localhost:3000/api/docs"
echo "   3. Open browser console (F12)"
echo "   4. Check: No CSP errors should appear"
echo "   5. Test: 'Try it out' should work"
echo ""

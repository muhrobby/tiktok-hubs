#!/bin/bash
echo "🔍 Verification Script - Swagger Documentation"
echo "=============================================="
echo ""

# 1. Check if dependencies are installed
echo "✅ Checking dependencies..."
if [ -d "node_modules/@hono/swagger-ui" ] && [ -d "node_modules/@hono/zod-openapi" ]; then
    echo "   ✓ @hono/swagger-ui installed"
    echo "   ✓ @hono/zod-openapi installed"
else
    echo "   ✗ Missing dependencies! Run: npm install"
    exit 1
fi

# 2. Check if docs files exist
echo ""
echo "✅ Checking documentation files..."
if [ -f "src/docs/swagger.ts" ] && [ -f "src/docs/schemas.ts" ] && [ -f "src/docs/routes.ts" ]; then
    echo "   ✓ src/docs/swagger.ts exists"
    echo "   ✓ src/docs/schemas.ts exists"
    echo "   ✓ src/docs/routes.ts exists"
else
    echo "   ✗ Missing documentation files!"
    exit 1
fi

# 3. Check if CSP is configured for Swagger
echo ""
echo "✅ Checking CSP configuration..."
if grep -q "https://cdn.jsdelivr.net" src/middleware/security.ts; then
    echo "   ✓ CSP configured to allow jsDelivr CDN"
else
    echo "   ✗ CSP not configured for Swagger UI!"
    exit 1
fi

# 4. Check if docs are integrated in app.ts
echo ""
echo "✅ Checking app integration..."
if grep -q "createDocsApp" src/app.ts; then
    echo "   ✓ Docs integrated in main app"
else
    echo "   ✗ Docs not integrated in app.ts!"
    exit 1
fi

# 5. Check TypeScript compilation
echo ""
echo "✅ Checking TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
    echo "   ✓ TypeScript builds successfully"
else
    echo "   ✗ TypeScript compilation errors!"
    exit 1
fi

echo ""
echo "=============================================="
echo "✅ All checks passed!"
echo ""
echo "📚 Swagger Documentation Endpoints:"
echo "   • Swagger UI:   http://localhost:3000/api/docs"
echo "   • OpenAPI JSON: http://localhost:3000/api/openapi.json"
echo ""
echo "🚀 To start the server:"
echo "   npm run dev"
echo ""
echo "🧪 To run tests:"
echo "   npm test"
echo ""

#!/bin/bash

# ==============================================
# GENERATE SECURITY KEYS
# ==============================================
# Script untuk generate semua security keys yang dibutuhkan
# untuk production deployment TikTok Hubs
#
# Usage: bash scripts/generate-keys.sh
# Output: File .env.keys yang berisi semua keys

set -e

echo "================================================"
echo "🔐 TikTok Hubs - Security Keys Generator"
echo "================================================"
echo ""

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl tidak ditemukan!"
    echo "   Install openssl terlebih dahulu:"
    echo "   - Ubuntu/Debian: sudo apt-get install openssl"
    echo "   - MacOS: brew install openssl"
    exit 1
fi

echo "✅ Generating security keys..."
echo ""

# Generate keys
TOKEN_ENC_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -base64 32)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_API_KEY=$(openssl rand -base64 32)

# Output file
OUTPUT_FILE=".env.keys"

# Write to file
cat > "$OUTPUT_FILE" << EOF
# ==============================================
# SECURITY KEYS - GENERATED $(date)
# ==============================================
# PENTING: 
# 1. Simpan file ini di tempat yang AMAN
# 2. JANGAN commit file ini ke Git
# 3. Copy nilai-nilai ini ke backend/.env.production
# ==============================================

# Token Encryption Key (64 char hex)
TOKEN_ENC_KEY=$TOKEN_ENC_KEY

# JWT Secret (base64)
JWT_SECRET=$JWT_SECRET

# Refresh Token Secret (base64)
REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET

# Encryption Key (64 char hex)
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Admin API Key (optional - base64)
ADMIN_API_KEY=$ADMIN_API_KEY

# ==============================================
# NEXT STEPS
# ==============================================
# 1. Copy file backend/.env.production.template menjadi backend/.env.production
# 2. Buka backend/.env.production
# 3. Replace nilai "GENERATE_WITH_SCRIPT" dengan nilai dari file ini
# 4. Isi nilai lainnya (DATABASE_URL, TIKTOK_CLIENT_KEY, dll)
# 5. Simpan dan deploy!
EOF

echo "================================================"
echo "✅ Security keys berhasil di-generate!"
echo "================================================"
echo ""
echo "📄 File output: $OUTPUT_FILE"
echo ""
echo "🔍 Preview keys:"
echo "   TOKEN_ENC_KEY: ${TOKEN_ENC_KEY:0:16}... (64 chars)"
echo "   JWT_SECRET: ${JWT_SECRET:0:16}... (44 chars)"
echo "   REFRESH_TOKEN_SECRET: ${REFRESH_TOKEN_SECRET:0:16}... (44 chars)"
echo "   ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:16}... (64 chars)"
echo "   ADMIN_API_KEY: ${ADMIN_API_KEY:0:16}... (44 chars)"
echo ""
echo "📋 Next Steps:"
echo "   1. Backup file $OUTPUT_FILE ke tempat yang aman"
echo "   2. Copy backend/.env.production.template → backend/.env.production"
echo "   3. Salin keys dari $OUTPUT_FILE ke backend/.env.production"
echo "   4. Lengkapi konfigurasi lainnya (database, TikTok API, dll)"
echo ""
echo "⚠️  PENTING: Jangan commit file $OUTPUT_FILE ke Git!"
echo "================================================"

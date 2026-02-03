# 📚 Learning Guide Part 3: OAuth & Security

## 🎯 Tujuan Pembelajaran

Memahami OAuth 2.0 flow, PKCE security extension, token encryption, dan best practices untuk secure authentication.

---

## 1. OAuth 2.0 Fundamentals

### 1.1 Apa itu OAuth?

**OAuth 2.0** adalah **authorization framework** (bukan authentication!).

**Analogy:**

```
Tanpa OAuth:
User memberikan username+password TikTok ke aplikasi kita
❌ Security risk (kita bisa akses semua data user)
❌ User tidak bisa revoke access tanpa ganti password

Dengan OAuth:
TikTok memberikan "key card" dengan akses terbatas ke aplikasi kita
✅ User tidak share password
✅ User bisa revoke access kapan saja
✅ Kita hanya bisa akses data yang di-authorize
```

### 1.2 OAuth Flow (Authorization Code Grant)

```
User Browser          Our Server           TikTok Server
     │                    │                      │
     ├─1. Click "Connect"─→                     │
     │                    │                      │
     │  2. Redirect to TikTok                   │
     ├──────────────────────────────────────────→
     │                    │                      │
     │  3. User login & authorize               │
     │◄─────────────────────────────────────────┤
     │                    │                      │
     │  4. Redirect back with code              │
     ├──────────────────→│                      │
     │                    │                      │
     │                    ├─5. Exchange code────→
     │                    │                      │
     │                    │◄─6. Access Token────┤
     │                    │                      │
     │◄─7. Success page──┤                      │
     │                    │                      │
```

**Steps explained:**

1. **User clicks "Connect TikTok"** - Initiate OAuth flow
2. **Redirect to TikTok** - With client_id, scope, redirect_uri
3. **User authorizes** - Login & grant permissions
4. **TikTok redirects back** - With authorization code
5. **Exchange code for token** - Server-to-server call
6. **TikTok returns tokens** - Access token + refresh token
7. **Show success** - User connected!

### 1.3 PKCE (Proof Key for Code Exchange)

**Problem tanpa PKCE:**

```
Attacker bisa intercept authorization code di redirect
→ Steal code
→ Exchange for access token
→ Access user data!
```

**Solution: PKCE**

```
1. Generate random code_verifier
2. Hash code_verifier → code_challenge
3. Send code_challenge ke TikTok
4. TikTok store code_challenge
5. Saat exchange token, kirim code_verifier
6. TikTok verify: hash(code_verifier) == stored code_challenge
```

**Kenapa aman?**

- Attacker hanya bisa steal code + code_challenge (public)
- Tapi tidak punya code_verifier (private, tidak pernah di-transmit ke browser)
- Tanpa code_verifier, tidak bisa exchange token

---

## 2. TikTok OAuth Implementation

### 2.1 PKCE Helper Functions - `src/services/tiktokAuth.service.ts`

```typescript
import { createHash, randomBytes } from "crypto";

function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
```

**Penjelasan:**

#### `randomBytes(32)`

```typescript
randomBytes(32);
```

- Generate 32 bytes random data (256 bits)
- **Cryptographically secure** random (tidak predictable)
- Node.js `crypto` module menggunakan OS entropy

#### Base64URL Encoding

```typescript
.toString("base64")
.replace(/\+/g, "-")
.replace(/\//g, "_")
.replace(/=/g, "")
```

- **Base64** encoding: Binary → ASCII text
- **URL-safe:** Replace characters yang tidak URL-safe:
  - `+` → `-`
  - `/` → `_`
  - `=` (padding) → removed
- **RFC 7636 specification** untuk PKCE

**Example output:**

```
Before: "a+b/c==="
After:  "a-b_c"
```

#### Generate Code Challenge

```typescript
function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
```

**SHA-256 Hash:**

- **One-way function** - Tidak bisa reverse (hash → original)
- **Deterministic** - Same input → same output
- **256-bit output** - Virtually impossible untuk collision

**Flow:**

```
code_verifier = "random_string_abc123"
         ↓ SHA-256
code_challenge = "hashed_value_xyz789"
```

### 2.2 Store Code Verifier untuk Callback

```typescript
async function storeCodeVerifier(
  state: string,
  codeVerifier: string,
  storeCode: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(oauthState).values({
    state,
    codeVerifier,
    storeCode,
    expiresAt,
  });

  logger.debug({ state }, "Stored code_verifier for PKCE");
}
```

**Kenapa store di database?**

1. **Stateless server** - Tidak pakai session/memory
2. **Horizontal scaling** - Callback bisa handled oleh server berbeda
3. **Expiry** - Auto cleanup expired states

**Expiry 10 menit:**

- Cukup untuk user authorize (biasanya < 1 menit)
- Tidak terlalu lama (minimize attack window)
- Clean up automatically

### 2.3 Build Authorization URL

```typescript
export async function buildAuthUrl(storeCode: string): Promise<string> {
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = `${storeCode}_${randomBytes(8).toString("hex")}`;

  // Store code_verifier for later use
  await storeCodeVerifier(state, codeVerifier, storeCode);

  const params = new URLSearchParams({
    client_key: getClientKey(),
    scope: REQUIRED_SCOPES.join(","),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const url = `${AUTHORIZE_URL}?${params.toString()}`;

  logger.info(
    { storeCode, state, url: url.replace(getClientKey(), "[REDACTED]") },
    "Built auth URL with PKCE"
  );

  return url;
}
```

**Parameters explained:**

#### `client_key`

- Your TikTok app identifier
- Public (tidak rahasia)
- Dari TikTok Developer Portal

#### `scope`

```typescript
scope: "user.info.basic,user.info.stats,video.list";
```

- **Permissions** yang diminta
- User lihat ini saat authorize
- Comma-separated list

#### `response_type: "code"`

- Authorization Code Grant flow
- Alternative: `"token"` (Implicit Grant - less secure)

#### `redirect_uri`

- Callback URL setelah user authorize
- **MUST match** URL di TikTok Developer Portal (exact match!)
- Include protocol, domain, port, path

#### `state`

```typescript
state: `${storeCode}_${randomBytes(8).toString("hex")}`;
```

- **CSRF protection** - Prevent cross-site request forgery
- Random value yang kita generate
- TikTok echo back di callback
- Kita verify: state yang kembali == state yang kita kirim

**Format:** `store_001_a1b2c3d4`

- Store code untuk lookup nanti
- Random hex untuk uniqueness

#### `code_challenge` & `code_challenge_method`

- **PKCE parameters**
- `code_challenge`: Hashed code_verifier
- `code_challenge_method: "S256"`: SHA-256 hash method

### 2.4 Exchange Code for Token

```typescript
export async function exchangeCodeForToken(
  code: string,
  state: string
): Promise<TikTokTokenResult> {
  logger.info({ state }, "Exchanging authorization code for token");

  // Retrieve code_verifier
  const codeVerifier = await retrieveCodeVerifier(state);
  if (!codeVerifier) {
    throw new Error("Invalid or expired OAuth state");
  }

  const response = await withRetry(
    async () => {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_key: getClientKey(),
          client_secret: getClientSecret(),
          code,
          grant_type: "authorization_code",
          redirect_uri: getRedirectUri(),
          code_verifier: codeVerifier,
        }).toString(),
      });

      const data = (await res.json()) as TikTokTokenResponse;

      if (data.error?.code && data.error.code !== "ok") {
        throw new TikTokApiError(
          data.error.message,
          data.error.code,
          data.error.log_id,
          res.status
        );
      }

      return data;
    },
    { maxRetries: 3 },
    "exchangeCodeForToken"
  );

  // Transform response
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    openId: response.open_id,
    expiresAt: new Date(Date.now() + response.expires_in * 1000),
    refreshExpiresAt: new Date(Date.now() + response.refresh_expires_in * 1000),
    scope: response.scope,
  };
}
```

**Parameters untuk token exchange:**

#### `grant_type: "authorization_code"`

- OAuth grant type
- Ada juga: `"refresh_token"`, `"client_credentials"`

#### `code_verifier`

- **PKCE proof**
- Original code_verifier (plaintext)
- TikTok akan hash dan compare dengan stored code_challenge

**Security:**

- `code` alone tidak cukup untuk get token
- Butuh `code_verifier` yang hanya server kita yang punya
- Man-in-the-middle attacker tidak bisa steal token

---

## 3. Token Encryption

### 3.1 Kenapa Encrypt Tokens?

**Tokens adalah credentials:**

```
Access Token = Password to TikTok API
Refresh Token = Master key (can regenerate access token)
```

**Threats:**

1. **Database breach** - Attacker steal database dump
2. **SQL injection** - Attacker query tokens
3. **Insider threat** - Malicious employee/contractor
4. **Backup exposure** - Unencrypted backups

**Defense: Encryption at rest**

- Store encrypted version di database
- Decrypt hanya saat dibutuhkan
- Even if database compromised, tokens tidak readable

### 3.2 AES-256-GCM Encryption - `src/utils/crypto.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
```

**Algorithm choice: AES-256-GCM**

#### AES (Advanced Encryption Standard)

- **Industry standard** symmetric encryption
- Used by NSA untuk classified information
- Fast (hardware-accelerated di modern CPUs)

#### 256-bit Key

- **Key space:** 2^256 possible keys
- **Brute force:** Would take billions of years with all computers on Earth
- Quantum-resistant (for now)

#### GCM (Galois/Counter Mode)

- **Authenticated encryption** - Provides confidentiality + integrity
- Detects tampering (modified ciphertext → decryption fails)
- Fast (parallelizable)

**Why GCM over CBC?**

- CBC: Encryption only (no integrity check)
- GCM: Encryption + authentication
- CBC vulnerable to padding oracle attacks

### 3.3 Encrypt Function

```typescript
export function encrypt(plaintext: string, key: Buffer): string {
  // Generate random IV (Initialization Vector)
  const iv = randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine: iv + authTag + encrypted
  // Format: <iv_hex>:<authTag_hex>:<encrypted_hex>
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}
```

**Step-by-step explanation:**

#### 1. Generate IV (Initialization Vector)

```typescript
const iv = randomBytes(IV_LENGTH);
```

- **Random 12 bytes** (96 bits)
- **MUST be unique** per encryption
- Not secret (transmitted with ciphertext)
- Ensures same plaintext → different ciphertext

**Why random IV?**

```
Without IV:
encrypt("secret") → always "abc123xyz"
❌ Attacker bisa detect duplicate data

With IV:
encrypt("secret") → "iv1:abc123xyz"
encrypt("secret") → "iv2:def456abc"
✅ Different ciphertext setiap kali
```

#### 2. Create Cipher

```typescript
const cipher = createCipheriv(ALGORITHM, key, iv);
```

- **`createCipheriv`** - Create cipher dengan IV
- Key must be exactly 32 bytes (256 bits)

#### 3. Encrypt Data

```typescript
let encrypted = cipher.update(plaintext, "utf8", "hex");
encrypted += cipher.final("hex");
```

- **`update()`** - Process data (can call multiple times)
- **`final()`** - Finalize encryption
- **Input:** UTF-8 string
- **Output:** Hex string

#### 4. Get Auth Tag

```typescript
const authTag = cipher.getAuthTag();
```

- **Authentication tag** (16 bytes)
- Cryptographic checksum
- Verifies data tidak di-tamper

#### 5. Combine Components

```typescript
return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
```

- Format: `IV:AuthTag:Ciphertext`
- All components needed untuk decrypt
- Separated by `:` delimiter

**Example output:**

```
a1b2c3d4e5f6g7h8i9j0k1l2:m3n4o5p6q7r8s9t0u1v2w3x4:encrypted_data_here
```

### 3.4 Decrypt Function

```typescript
export function decrypt(encryptedText: string, key: Buffer): string {
  // Parse components
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  // Convert from hex to Buffer
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

**Decryption steps:**

#### 1. Parse Components

```typescript
const [ivHex, authTagHex, encryptedHex] = parts;
```

- Split by `:` delimiter
- Validate format (must have 3 parts)

#### 2. Convert to Buffers

```typescript
const iv = Buffer.from(ivHex, "hex");
const authTag = Buffer.from(authTagHex, "hex");
```

- Hex strings → binary buffers
- Required format untuk crypto functions

#### 3. Create Decipher

```typescript
const decipher = createDecipheriv(ALGORITHM, key, iv);
decipher.setAuthTag(authTag);
```

- **Same algorithm, key, IV** as encryption
- **Set auth tag** for verification

#### 4. Decrypt & Verify

```typescript
let decrypted = decipher.update(encryptedHex, "hex", "utf8");
decrypted += decipher.final("utf8");
```

- **`final()` will throw** if auth tag verification fails
- Automatic tampering detection

**Security property:**

```typescript
try {
  decrypt(tamperedCiphertext, key);
} catch (err) {
  // Auth tag verification failed
  // Data was modified!
}
```

### 3.5 Key Management

```typescript
export function validateEncryptionSetup(): void {
  const key = process.env.TOKEN_ENC_KEY;

  if (!key) {
    throw new Error("TOKEN_ENC_KEY environment variable is required");
  }

  if (key.length !== KEY_LENGTH * 2) {
    // Hex string: 32 bytes = 64 hex chars
    throw new Error(
      `TOKEN_ENC_KEY must be ${
        KEY_LENGTH * 2
      } hex characters (${KEY_LENGTH} bytes)`
    );
  }

  try {
    Buffer.from(key, "hex");
  } catch (err) {
    throw new Error("TOKEN_ENC_KEY must be valid hex string");
  }
}
```

**Key requirements:**

1. **32 bytes (256 bits)** - For AES-256
2. **Hex encoded** - 64 hex characters
3. **Random** - Cryptographically secure random

**Generate key:**

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32
```

**Key rotation:**

```
1. Generate new key
2. Add as TOKEN_ENC_KEY_NEW
3. Re-encrypt all tokens with new key
4. Swap TOKEN_ENC_KEY_NEW → TOKEN_ENC_KEY
5. Delete old key
```

---

## 4. Token Storage - `src/services/token.service.ts`

### 4.1 Save Token Securely

```typescript
export async function saveToken(
  storeCode: string,
  tokenResult: TikTokTokenResult,
  userInfo: UserStats
): Promise<void> {
  const key = getEncryptionKey();

  // Encrypt tokens
  const encryptedAccessToken = encrypt(tokenResult.accessToken, key);
  const encryptedRefreshToken = encrypt(tokenResult.refreshToken, key);

  // Check existing account
  const existing = await db
    .select()
    .from(storeAccounts)
    .where(
      and(
        eq(storeAccounts.storeCode, storeCode),
        eq(storeAccounts.openId, tokenResult.openId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(storeAccounts)
      .set({
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: tokenResult.expiresAt,
        refreshTokenExpiresAt: tokenResult.refreshExpiresAt,
        scope: tokenResult.scope,
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        status: "CONNECTED",
        updatedAt: new Date(),
      })
      .where(eq(storeAccounts.id, existing[0].id));
  } else {
    // Insert new
    await db.insert(storeAccounts).values({
      storeCode,
      openId: tokenResult.openId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiresAt: tokenResult.expiresAt,
      refreshTokenExpiresAt: tokenResult.refreshExpiresAt,
      scope: tokenResult.scope,
      displayName: userInfo.displayName,
      avatarUrl: userInfo.avatarUrl,
      status: "CONNECTED",
    });
  }

  log.info({ storeCode, openId: tokenResult.openId }, "Token saved securely");
}
```

**Upsert pattern:**

1. **Check existing** - Query by (storeCode, openId)
2. **Update or Insert** - Depending on existence
3. **Atomic** - Within single transaction

**Security notes:**

- ✅ Tokens encrypted before database
- ✅ Encryption key dari environment variable
- ✅ Never log plaintext tokens
- ✅ Set status to "CONNECTED"

### 4.2 Get Valid Token

```typescript
export async function getValidAccessToken(
  storeCode: string
): Promise<string | null> {
  const account = await getStoreAccount(storeCode);

  if (!account) {
    return null;
  }

  // Check if token expired
  const now = new Date();
  if (account.tokenExpiresAt <= now) {
    log.info("Access token expired, attempting refresh");

    // Try refresh token
    const refreshed = await refreshAccessToken(account);
    if (!refreshed) {
      return null;
    }

    return refreshed;
  }

  // Decrypt and return
  const key = getEncryptionKey();
  return decrypt(account.encryptedAccessToken, key);
}
```

**Token lifecycle:**

```
Access Token (24h)         Refresh Token (30d)
     ↓                            ↓
  Expired?                    Expired?
     ↓                            ↓
   YES → Refresh            YES → Re-authorize
     ↓                            ↓
  New Access Token          User login again
```

### 4.3 Refresh Token

```typescript
export async function refreshAccessToken(
  account: StoreAccount
): Promise<string | null> {
  // Check refresh token validity
  if (account.refreshTokenExpiresAt <= new Date()) {
    await markNeedReconnect(account.storeCode, "Refresh token expired");
    return null;
  }

  const key = getEncryptionKey();
  const refreshToken = decrypt(account.encryptedRefreshToken, key);

  try {
    // Call TikTok refresh endpoint
    const tokenResult = await tiktokAuth.refreshToken(refreshToken);

    // Save new tokens
    await updateTokens(account.id, tokenResult);

    return tokenResult.accessToken;
  } catch (error) {
    await markNeedReconnect(account.storeCode, "Token refresh failed");
    return null;
  }
}
```

**Refresh flow:**

1. **Validate refresh token** - Check expiry
2. **Decrypt refresh token** - From database
3. **Call TikTok API** - Exchange refresh → new access
4. **Save new tokens** - Encrypt and update database
5. **Handle errors** - Mark account as NEED_RECONNECT

---

## 5. Security Best Practices

### 5.1 Environment Variables

```env
# ✅ Good
TOKEN_ENC_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# ❌ Bad
TOKEN_ENC_KEY=mysecretkey
```

**Checklist:**

- ✅ Random generated (not dictionary words)
- ✅ Correct length (32 bytes for AES-256)
- ✅ Hex encoded (only 0-9, a-f)
- ✅ Stored in `.env` (not in code)
- ✅ Different per environment (dev/staging/prod)

### 5.2 Logging Security

```typescript
// ❌ DON'T
logger.info({ accessToken: token }, "Token received");

// ✅ DO
logger.info({ openId: account.openId }, "Token received");
```

**Pino redaction:**

```typescript
redact: {
  paths: ["*.token", "*.accessToken", "*.password"],
  remove: true,
}
```

### 5.3 Error Handling

```typescript
// ❌ DON'T - Leak details
throw new Error(`Decryption failed: ${key}`);

// ✅ DO - Generic error
throw new Error("Decryption failed");
```

### 5.4 HTTPS in Production

```typescript
// ❌ DON'T in production
TIKTOK_REDIRECT_URI=http://example.com/callback

// ✅ DO
TIKTOK_REDIRECT_URI=https://example.com/callback
```

**Why HTTPS?**

- Encrypt data in transit
- Prevent man-in-the-middle attacks
- TikTok might reject non-HTTPS redirect URIs

---

## 🎓 Kesimpulan Part 3

Anda telah belajar:

✅ **OAuth 2.0 fundamentals**

- Authorization Code Grant flow
- PKCE security extension
- State parameter for CSRF protection

✅ **Token encryption**

- AES-256-GCM algorithm
- Encryption at rest
- Key management

✅ **Secure token storage**

- Database encryption
- Token refresh mechanism
- Error handling

✅ **Security best practices**

- Environment variable management
- Log redaction
- HTTPS enforcement

---

## 📚 Next Steps

Lanjut ke **Part 4: API Integration & Services** untuk belajar:

- TikTok Display API integration
- Rate limiting & retry logic
- Data synchronization patterns
- Error handling strategies

Happy learning! 🔐

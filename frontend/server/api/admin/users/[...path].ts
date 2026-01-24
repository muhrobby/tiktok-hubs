/**
 * Proxy handler untuk user management routes ke backend
 * Handles CRUD operations for users (Admin only)
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const backendUrl = config.backendUrl;

  // Get path dari [...path]
  const path = event.context.params?.path || [];
  const endpoint = Array.isArray(path) ? path.join("/") : path;

  // Build target URL
  const targetUrl = `${backendUrl}/admin/users/${endpoint}`;

  // Get query params
  const query = getQuery(event);
  const queryString = new URLSearchParams(
    query as Record<string, string>
  ).toString();
  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  // Get request method and body
  const method = event.method;
  let body = null;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    body = await readBody(event).catch(() => null);
  }

  // Get cookies from incoming request to forward to backend
  const cookies = getHeader(event, "cookie");
  
  console.log("[Users Proxy]", {
    method,
    endpoint,
    fullUrl,
    hasCookies: !!cookies,
    cookies: cookies || 'none',
    allHeaders: Object.fromEntries(
      Object.entries(event.node.req.headers).map(([k, v]) => 
        [k, k.toLowerCase() === 'cookie' ? (v ? String(v).substring(0, 50) + '...' : 'none') : v]
      )
    )
  });

  try {
    // Forward request ke backend
    const response = await fetch(fullUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookies ? { Cookie: cookies } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    // Get response body
    const responseData = await response.json().catch(() => ({}));

    // Forward Set-Cookie headers from backend to client
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      for (const cookieStr of setCookieHeaders) {
        appendResponseHeader(event, "Set-Cookie", cookieStr);
      }
    }

    // Set response status
    setResponseStatus(event, response.status);

    return responseData;
  } catch (error: unknown) {
    const err = (error ?? {}) as Record<string, unknown>;
    const statusCode =
      typeof err.statusCode === "number" ? err.statusCode : 500;
    const message =
      typeof err.message === "string"
        ? err.message
        : "Failed to proxy users request";
    console.error("[Users Proxy Error]", err);
    throw createError({
      statusCode,
      message,
    });
  }
});

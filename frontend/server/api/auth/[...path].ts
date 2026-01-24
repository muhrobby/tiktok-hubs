/**
 * Proxy handler untuk auth routes ke backend Hono
 * Untuk OAuth callback dan login flow
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const backendUrl = config.backendUrl;

  // Get path dari [...path]
  const path = event.context.params?.path || [];
  const endpoint = Array.isArray(path) ? path.join("/") : path;

  // Build target URL
  const targetUrl = `${backendUrl}/auth/${endpoint}`;

  // Get query params (untuk OAuth callback)
  const query = getQuery(event);
  const queryString = new URLSearchParams(
    query as Record<string, string>,
  ).toString();
  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  // Get request method
  const method = event.method;

  try {
    // Forward request ke backend (auth routes biasanya tidak butuh API key)
    const response = await $fetch(fullUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      ignoreResponseError: true,
    });

    return response;
  } catch (error: unknown) {
    const err = (error ?? {}) as Record<string, unknown>;
    const statusCode =
      typeof err.statusCode === "number" ? err.statusCode : 500;
    const message =
      typeof err.message === "string"
        ? err.message
        : "Failed to proxy auth request";
    console.error("[Auth Proxy Error]", err);
    throw createError({
      statusCode,
      message,
    });
  }
});

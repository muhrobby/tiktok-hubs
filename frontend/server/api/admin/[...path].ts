/**
 * Proxy handler untuk semua admin routes ke backend Hono
 * ADMIN_API_KEY hanya digunakan di server-side, tidak pernah ke browser
 * Supports both JSON and binary (file download) responses
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const backendUrl = config.backendUrl;

  // Get path params dari [...path]
  const path = event.context.params?.path || [];
  const endpoint = Array.isArray(path) ? path.join("/") : path;

  // Build target URL
  const targetUrl = `${backendUrl}/admin/${endpoint}`;

  // Get query params
  const query = getQuery(event);
  const queryString = new URLSearchParams(
    query as Record<string, string>,
  ).toString();
  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  // Get request method
  const method = event.method;
  
  // Get content type from request
  const contentType = getHeader(event, "content-type") || "";
  
  // Get cookies from incoming request to forward to backend
  const cookies = getHeader(event, "cookie");
  
  // Prepare headers - Only send JWT cookies, NOT API Key
  // This ensures user role-based filtering works correctly
  const headers: Record<string, string> = {
    ...(cookies ? { Cookie: cookies } : {}),
  };
  
  // Handle body based on content type
  let body: any = undefined;
  
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (contentType.includes("multipart/form-data")) {
      // For file uploads, read raw body and forward form data
      const formData = await readMultipartFormData(event);
      if (formData) {
        // Create a new FormData to send to backend
        const backendFormData = new FormData();
        for (const field of formData) {
          if (field.filename) {
            // File field - convert Buffer to Uint8Array for Blob compatibility
            const uint8Array = new Uint8Array(field.data);
            const blob = new Blob([uint8Array], { type: field.type || "application/octet-stream" });
            backendFormData.append(field.name || "file", blob, field.filename);
          } else {
            // Regular field
            backendFormData.append(field.name || "", field.data.toString());
          }
        }
        body = backendFormData;
        // Let fetch set the content-type with boundary
      } else {
        body = undefined;
      }
    } else {
      // JSON or other content types
      body = await readBody(event).catch(() => null);
      if (body) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
      }
    }
  }

  try {
    // Check if this is an export endpoint (expect binary response)
    const isExportEndpoint = endpoint.startsWith("export/");
    
    if (isExportEndpoint) {
      // For export endpoints, use native fetch to get raw response
      const response = await fetch(fullUrl, {
        method,
        headers,
        body,
      });
      
      if (!response.ok) {
        // Try to parse error as JSON
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw createError({
          statusCode: response.status,
          message: errorData.error?.message || "Export failed",
        });
      }
      
      // Forward response headers for file download
      const responseHeaders: Record<string, string> = {};
      const contentDisposition = response.headers.get("content-disposition");
      const responseContentType = response.headers.get("content-type");
      const contentLength = response.headers.get("content-length");
      
      if (contentDisposition) {
        responseHeaders["Content-Disposition"] = contentDisposition;
      }
      if (responseContentType) {
        responseHeaders["Content-Type"] = responseContentType;
      }
      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }
      
      // Set headers on the event
      for (const [key, value] of Object.entries(responseHeaders)) {
        setHeader(event, key, value);
      }
      
      // Return the binary data as ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
    
    // For import endpoints with multipart form data
    if (body instanceof FormData) {
      const response = await fetch(fullUrl, {
        method,
        headers: {
          // Only send cookies for JWT auth, not API Key
          ...(cookies ? { Cookie: cookies } : {}),
        },
        body,
      });
      
      return response.json();
    }
    
    // Forward regular JSON request ke backend dengan ADMIN_API_KEY
    const response = await $fetch(fullUrl, {
      method,
      headers,
      body: body ? body : undefined,
      // Return raw response untuk handling manual
      ignoreResponseError: true,
    });

    return response;
  } catch (error: unknown) {
    // Handle fetch errors
    const err = (error ?? {}) as Record<string, unknown>;
    const statusCode =
      typeof err.statusCode === "number" ? err.statusCode : 500;
    const message =
      typeof err.message === "string"
        ? err.message
        : "Failed to proxy request to backend";
    console.error("[Admin Proxy Error]", err);
    throw createError({
      statusCode,
      message,
    });
  }
});

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface ErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildError(code: string, message: string): ErrorPayload {
  return {
    error: {
      code,
      message,
    },
  };
}

export function errorResponse(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return c.json(
    {
      ...buildError(code, message),
      ...(extra ?? {}),
    },
    status
  );
}

export function successResponse<T>(
  c: Context,
  data: T,
  pagination?: PaginationMeta,
  status: ContentfulStatusCode = 200
) {
  if (pagination) {
    return c.json(
      {
        data,
        pagination,
      },
      status
    );
  }
  return c.json({ data }, status);
}

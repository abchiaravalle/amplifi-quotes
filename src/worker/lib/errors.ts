/** Uniform API errors. Every error response body is { error: { code, message, details? } }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Sign in required') => new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'Not allowed') => new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Not found') => new ApiError(404, 'not_found', message);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, 'conflict', message, details);
export const tooMany = (message = 'Too many attempts, try again later') =>
  new ApiError(429, 'rate_limited', message);
export const unavailable = (message: string) => new ApiError(503, 'unavailable', message);

export function errorBody(e: ApiError) {
  return {
    error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) },
  };
}

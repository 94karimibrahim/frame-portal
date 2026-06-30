/**
 * Transport-level contracts shared by every feature: the success envelope, the paged-result shape, the
 * RFC 7807 error bodies, and the normalized {@link AppError} the error interceptor produces.
 */

/** The standard success envelope returned by the API (`ApiResponse<T>`). */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string | null;
  correlationId: string | null;
}

/** A page of items plus navigation metadata (`PagedResult<T>`). */
export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/** Common paged query params accepted by list endpoints. */
export interface PagedQuery {
  pageNumber?: number;
  pageSize?: number;
  search?: string | null;
}

/** RFC 7807 problem document. `title` carries the stable machine code; `detail` the localized message. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

/** RFC 7807 validation problem: `errors[field]` is an array of (already-localized) stable codes. */
export interface ValidationProblemDetails extends ProblemDetails {
  errors?: Record<string, string[]>;
}

/**
 * Normalized error the {@link import('./errors').AppError} interceptor surfaces to the app. `code` is the
 * stable backend code (from `problem.title`) used to look up a user-facing i18n message; `fieldErrors`
 * maps form-control names to their stable codes for reactive-form binding.
 */
export interface AppError {
  /** HTTP status (0 when the request never reached the server). */
  status: number;
  /** Stable machine code, e.g. `Auth.InvalidCredentials`; `null` for non-problem responses. */
  code: string | null;
  /** Localized human message from the server, when present. */
  detail: string | null;
  /** Per-field validation codes, when the error was a validation problem. */
  fieldErrors: Record<string, string[]> | null;
  /** Seconds to wait before retrying, parsed from `Retry-After` on a 429. */
  retryAfterSeconds: number | null;
  /** The correlation id, when the server returned one (for support). */
  correlationId: string | null;
}

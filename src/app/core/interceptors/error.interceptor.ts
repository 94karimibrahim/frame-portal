import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AppError, ValidationProblemDetails } from '../models';

/** Stable client-side codes for failures that don't carry a backend `title`. */
export const ClientErrorCodes = {
  network: 'Client.NetworkUnreachable',
  ipBlocked: 'Client.IpBlocked',
  rateLimited: 'Client.RateLimited',
  unknown: 'Client.Unknown',
} as const;

function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * The single place every HTTP failure is normalized into an {@link AppError}: the stable `code` (from
 * `ProblemDetails.title`), the localized `detail`, per-field validation codes, and special cases the
 * backend expresses outside the JSON envelope — the **plain-text IP-filter 403** and the **body-less 429
 * with `Retry-After`** (FRONTEND_PLAN §7). Components/services catch `AppError`, never the raw response.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }
      return throwError(() => toAppError(err));
    }),
  );

function toAppError(err: HttpErrorResponse): AppError {
  const correlationId = err.headers.get('X-Correlation-ID');
  const body: unknown = err.error;

  // Connection failure / CORS block / offline.
  if (err.status === 0) {
    return base(0, ClientErrorCodes.network, null, null, null, correlationId);
  }

  // Rate limited — typically no body, back-off carried by Retry-After.
  if (err.status === 429) {
    return base(
      429,
      problemCode(body) ?? ClientErrorCodes.rateLimited,
      problemDetail(body),
      null,
      parseRetryAfter(err.headers.get('Retry-After')),
      correlationId,
    );
  }

  // IP-filter block is plain text, not JSON.
  if (err.status === 403 && typeof body === 'string') {
    return base(403, ClientErrorCodes.ipBlocked, body, null, null, correlationId);
  }

  // Standard ProblemDetails / ValidationProblemDetails envelope.
  if (body && typeof body === 'object') {
    const problem = body as ValidationProblemDetails;
    return base(
      err.status,
      problem.title ?? ClientErrorCodes.unknown,
      problem.detail ?? null,
      problem.errors ?? null,
      null,
      correlationId,
    );
  }

  return base(err.status, ClientErrorCodes.unknown, null, null, null, correlationId);
}

function problemCode(body: unknown): string | null {
  return body && typeof body === 'object'
    ? ((body as ValidationProblemDetails).title ?? null)
    : null;
}

function problemDetail(body: unknown): string | null {
  return body && typeof body === 'object'
    ? ((body as ValidationProblemDetails).detail ?? null)
    : null;
}

function base(
  status: number,
  code: string | null,
  detail: string | null,
  fieldErrors: Record<string, string[]> | null,
  retryAfterSeconds: number | null,
  correlationId: string | null,
): AppError {
  return { status, code, detail, fieldErrors, retryAfterSeconds, correlationId };
}

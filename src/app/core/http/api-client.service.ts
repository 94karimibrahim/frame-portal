import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

/** Query params accepted by {@link ApiClient}; `null`/`undefined` values are dropped. */
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Thin typed wrapper over `HttpClient` that (a) prefixes every path with `environment.apiBaseUrl` and
 * (b) unwraps the `ApiResponse<T>` envelope so callers get the payload directly. Header attachment,
 * token refresh, and error mapping live in the interceptors, not here.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.url(path), { params: this.toParams(params) })
      .pipe(map((res) => res?.data as T));
  }

  post<T>(path: string, body?: unknown, params?: QueryParams): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), body ?? {}, { params: this.toParams(params) })
      .pipe(map((res) => res?.data as T));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(this.url(path), body ?? {})
      .pipe(map((res) => res?.data as T));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(this.url(path)).pipe(map((res) => res?.data as T));
  }

  private url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  private toParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    if (!params) {
      return httpParams;
    }
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }
}

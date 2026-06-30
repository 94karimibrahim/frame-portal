import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import {
  CreateDepartmentRequest,
  DepartmentTreeNode,
  RowTranslation,
  UpdateDepartmentRequest,
} from '../../core/models';

/**
 * Thin data layer for the department hierarchy (`/api/departments`). Returns the **portal** tree — every
 * node carries its raw per-culture `translations` map alongside the base name/description, so the editing
 * UI can resolve any culture and round-trip translations back on save. (The anonymous, pre-resolved tree
 * at `/api/public/departments/tree` is a different concern and not used here.)
 */
@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly api = inject(ApiClient);

  getTree(): Observable<DepartmentTreeNode[]> {
    return this.api.get<DepartmentTreeNode[]>('/departments/tree');
  }

  create(request: CreateDepartmentRequest): Observable<string> {
    return this.api.post<string>('/departments', request);
  }

  update(id: string, request: UpdateDepartmentRequest): Observable<void> {
    return this.api.put<void>(`/departments/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/departments/${id}`);
  }
}

/**
 * Resolves a node's display name for the active culture: the matching translation's `name` if present and
 * non-empty, otherwise the base (default-culture) name. Pure so it's trivially testable and usable in
 * `OnPush` templates (callers read the culture signal to stay reactive).
 */
export function resolveName(node: DepartmentTreeNode, culture: string): string {
  return pickTranslation(node.translations, culture)?.name?.trim() || node.name;
}

/** Same resolution rule as {@link resolveName}, for the optional description. */
export function resolveDescription(node: DepartmentTreeNode, culture: string): string | null {
  const translated = pickTranslation(node.translations, culture)?.description?.trim();
  return translated || node.description?.trim() || null;
}

function pickTranslation(
  translations: RowTranslation[] | undefined,
  culture: string,
): RowTranslation | undefined {
  return translations?.find((t) => t.lang === culture);
}

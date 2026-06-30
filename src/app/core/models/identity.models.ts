import { Gender, UserStatus } from './enums';

/** A single per-language translation row (`{lang, name?, description?}`). */
export interface RowTranslation {
  lang: string;
  name?: string | null;
  description?: string | null;
}

// ----- Auth -----

/** Tokens + identity returned by a successful authentication (`AuthResultDto`). */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  userId: string;
  email: string;
  fullName: string;
}

export interface SwitchTenantResult {
  accessToken: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginTwoFactorRequest {
  email: string;
  password: string;
  code: string;
}

// ----- Users -----

export interface UserListItem {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
  /** Protected system account (e.g. the bootstrap admin); guarded from deletion. */
  isSystem: boolean;
  createdAt: string;
}

/** Per-status user totals for the current tenant; drives the list quick-filter counts. */
export interface UserStatusCounts {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  deactivated: number;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  status: UserStatus;
  /** Protected system account (e.g. the bootstrap admin); guarded from deletion. */
  isSystem: boolean;
  emailConfirmed: boolean;
  emailVerifiedAt?: string | null;
  phoneConfirmed: boolean;
  phoneVerifiedAt?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  timeZone?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  twoFactorEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  /** Optional. Normally omitted: the user sets their own password via the emailed set-password link. */
  password?: string | null;
  phoneNumber?: string | null;
}

export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  timeZone?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
}

// ----- Roles & permissions -----

export interface RoleListItem {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  hierarchy: number;
  parentRoleId?: string | null;
  displayOrder: number;
  color?: string | null;
  translations: RowTranslation[];
}

export interface Role extends RoleListItem {
  permissionCodes: string[];
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  hierarchy: number;
  permissionCodes?: string[] | null;
  displayOrder?: number;
  color?: string | null;
  parentRoleId?: string | null;
  translations?: RowTranslation[] | null;
}

export interface UpdateRoleRequest {
  name: string;
  description?: string | null;
  permissionCodes?: string[] | null;
  isActive?: boolean | null;
  displayOrder?: number | null;
  color?: string | null;
  updateParent?: boolean;
  parentRoleId?: string | null;
  translations?: RowTranslation[] | null;
}

export interface Permission {
  id: string;
  code: string;
  displayName: string;
  description?: string | null;
  module: string;
  isSystem: boolean;
  translations: RowTranslation[];
}

// ----- Departments -----

export interface DepartmentTreeNode {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  children: DepartmentTreeNode[];
  translations: RowTranslation[];
}

export interface CreateDepartmentRequest {
  name: string;
  parentId?: string | null;
  sortOrder: number;
  description?: string | null;
  translations?: RowTranslation[] | null;
}

export type UpdateDepartmentRequest = CreateDepartmentRequest;

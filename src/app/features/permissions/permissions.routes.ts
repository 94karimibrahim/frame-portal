import { Routes } from '@angular/router';
import { PermissionsPageComponent } from './permissions-page.component';

/** Permissions feature routes (single read-only page). Lazy-loaded behind the `permissions.list` guard. */
export const PERMISSIONS_ROUTES: Routes = [{ path: '', component: PermissionsPageComponent }];

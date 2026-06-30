import { Routes } from '@angular/router';
import { RolesPageComponent } from './roles-page.component';

/** Roles feature routes (single page). Lazy-loaded from the shell behind the `roles.list` guard. */
export const ROLES_ROUTES: Routes = [{ path: '', component: RolesPageComponent }];

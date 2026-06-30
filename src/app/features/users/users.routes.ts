import { Routes } from '@angular/router';
import { UsersPageComponent } from './users-page.component';

/** Users feature routes (single page). Lazy-loaded from the shell behind the `users.list` guard. */
export const USERS_ROUTES: Routes = [{ path: '', component: UsersPageComponent }];

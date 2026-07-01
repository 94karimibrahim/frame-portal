import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { UserDetailsPageComponent } from './user-details-page.component';
import { UserFormPageComponent } from './user-form-page.component';
import { UsersPageComponent } from './users-page.component';

/**
 * Users feature routes. The list at `''`, plus dedicated pages for create/details/edit reached by URL
 * (bookmarkable, with real browser history). Create/edit carry `unsavedChangesGuard` to protect in-flight
 * edits; each page declares a `titleKey` so the shell breadcrumb builds itself. Lazy-loaded from the shell
 * behind the `users.list` guard.
 */
export const USERS_ROUTES: Routes = [
  { path: '', component: UsersPageComponent },
  {
    path: 'new',
    component: UserFormPageComponent,
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'users.createTitle' },
  },
  {
    path: ':id/details',
    component: UserDetailsPageComponent,
    data: { titleKey: 'users.detailTitle' },
  },
  {
    path: ':id/edit',
    component: UserFormPageComponent,
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'users.editTitle' },
  },
];

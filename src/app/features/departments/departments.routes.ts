import { Routes } from '@angular/router';
import { DepartmentsPageComponent } from './departments-page.component';

/** Departments feature routes (single page). Lazy-loaded from the shell behind the `departments.view` guard. */
export const DEPARTMENTS_ROUTES: Routes = [{ path: '', component: DepartmentsPageComponent }];

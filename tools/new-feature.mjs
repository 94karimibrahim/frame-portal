// Feature scaffolder — see docs/USING-AS-A-TEMPLATE.md §4.
//
//   npm run new:feature -- <kebab-name>      e.g.  npm run new:feature -- reports
//
// Creates src/app/features/<name>/ with an idiomatic service, an OnPush page, and a lazy routes file
// (all matching the house style), then prints the six wiring snippets to paste. It only CREATES files —
// it never edits app.routes.ts / nav.model.ts / permissions.ts / i18n, so it can't corrupt the app.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const name = process.argv[2];

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(
    'Usage: npm run new:feature -- <kebab-name>   (lowercase, digits, hyphens; e.g. audit-logs)',
  );
  process.exit(1);
}

const pascal = name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const ns = pascal.charAt(0).toLowerCase() + pascal.slice(1); // i18n namespace, camelCase
const ROUTES = name.replace(/-/g, '_').toUpperCase() + '_ROUTES';
const Component = `${pascal}PageComponent`;
const Service = `${pascal}Service`;
const Item = `${pascal}Item`;
const selector = `app-${name}-page`;

const dir = join('src', 'app', 'features', name);
if (existsSync(dir)) {
  console.error(`✖ ${dir} already exists — choose another name or remove it first.`);
  process.exit(1);
}

const service = `import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';

/** A single ${name} record. Replace these fields with your real DTO. */
export interface ${Item} {
  id: string;
  name: string;
}

/** Data layer for ${name} (\`/api/${name}\`). Calls the typed ApiClient (base URL + envelope handled). */
@Injectable({ providedIn: 'root' })
export class ${Service} {
  private readonly api = inject(ApiClient);

  /** Fetches the ${name} list. */
  list(): Observable<${Item}[]> {
    return this.api.get<${Item}[]>('/${name}');
  }
}
`;

const page = `import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { ${Item}, ${Service} } from './${name}.service';

/**
 * ${pascal} page (scaffolded). Loads ${name} from the API and renders them with the shared UI kit.
 * Replace the placeholder list with your real columns/cells — see features/users for a server-paged grid.
 */
@Component({
  selector: '${selector}',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, PageHeaderComponent, CardComponent, SpinnerComponent, EmptyStateComponent],
  template: \`
    <app-page-header [title]="'${ns}.title' | transloco" [subtitle]="'${ns}.subtitle' | transloco" />

    <app-card>
      @if (loading()) {
        <div class="flex justify-center py-12"><app-spinner /></div>
      } @else if (error()) {
        <app-empty-state [title]="'${ns}.loadError' | transloco" />
      } @else if (items().length === 0) {
        <app-empty-state [title]="'${ns}.empty' | transloco" />
      } @else {
        <ul class="divide-y divide-gray-100 dark:divide-gray-800">
          @for (item of items(); track item.id) {
            <li class="py-3 text-theme-sm text-gray-800 dark:text-gray-200">{{ item.name }}</li>
          }
        </ul>
      }
    </app-card>
  \`,
})
export class ${Component} {
  private readonly service = inject(${Service});

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<${Item}[]>([]);

  constructor() {
    this.service.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
`;

const routes = `import { Routes } from '@angular/router';
import { ${Component} } from './${name}-page.component';

/** ${pascal} feature routes (single page). Lazy-loaded; gate with hasAnyPermission in app.routes.ts. */
export const ${ROUTES}: Routes = [{ path: '', component: ${Component} }];
`;

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${name}.service.ts`), service);
writeFileSync(join(dir, `${name}-page.component.ts`), page);
writeFileSync(join(dir, `${name}.routes.ts`), routes);

console.log(
  `✓ Created src/app/features/${name}/ (${name}.service.ts, ${name}-page.component.ts, ${name}.routes.ts)\n`,
);
console.log('Now do the six wiring edits (docs/USING-AS-A-TEMPLATE.md §2):\n');

console.log(`1) src/app/app.routes.ts — add a lazy child of the shell:
      {
        path: '${name}',
        canMatch: [hasAnyPermission([Permissions.${ns}.list])],
        data: { titleKey: 'nav.${ns}' },
        loadChildren: () => import('./features/${name}/${name}.routes').then((m) => m.${ROUTES}),
      },
`);

console.log(`2) src/app/layout/nav.model.ts — add a NavItem (pick an icon from ICONS):
      { labelKey: 'nav.${ns}', link: '/${name}', icon: ICONS.dashboard, permissions: [Permissions.${ns}.list] },
`);

console.log(`3) src/app/core/auth/permissions.ts — add the permission block:
      ${ns}: { list: '${name}.list', view: '${name}.view' },
`);

console.log(`4) public/i18n/en.json AND ar.json — add the namespace + nav label:
      "${ns}": { "title": "${pascal}", "subtitle": "Manage ${name}", "empty": "Nothing here yet", "loadError": "Couldn't load ${name}" }
      nav: { ..., "${ns}": "${pascal}" }
`);

console.log(
  `5) (optional) src/app/features/dashboard/dashboard.component.ts — add a gated quick-link card.`,
);
console.log(`6) Verify: npm run lint && npm test && npm run build\n`);

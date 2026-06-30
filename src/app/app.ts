import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/ui/toast-container.component';

/** Application root: hosts the router outlet and the app-wide toast container. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastContainerComponent],
  template: `
    <router-outlet />
    <app-toast-container />
  `,
})
export class App {}

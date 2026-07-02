import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { NotificationService } from '../../core/notifications/notification.service';

/**
 * Renders the app-wide toast queue from {@link NotificationService}. Mounted once at the app root so any
 * service (including the error interceptor) can surface feedback without a UI dependency. Pinned to the
 * top-end corner using logical properties, so it flips correctly under RTL. `aria-live="polite"` and
 * `role="status"` announce new toasts to assistive tech without stealing focus.
 */
@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <div
      class="pointer-events-none fixed top-4 end-4 z-[100] flex w-full max-w-sm flex-col gap-3"
      aria-live="polite"
      aria-atomic="false"
    >
      @for (toast of notifications.items(); track toast.id) {
        <div
          role="status"
          animate.enter="toast-enter"
          animate.leave="toast-leave"
          class="pointer-events-auto flex items-start gap-3 rounded-theme-lg border bg-white p-4 shadow-theme-lg dark:bg-gray-dark"
          [class]="borderClass(toast.kind)"
          (mouseenter)="notifications.pause(toast.id)"
          (mouseleave)="notifications.resume(toast.id)"
        >
          <span
            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
            [class]="iconClass(toast.kind)"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path [attr.d]="iconPath(toast.kind)" fill-rule="evenodd" clip-rule="evenodd" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-theme-sm font-medium text-gray-800 dark:text-gray-100">
              {{ toast.title }}
            </p>
            @if (toast.text) {
              <p class="mt-0.5 break-words text-theme-xs text-gray-500 dark:text-gray-400">
                {{ toast.text }}
              </p>
            }
          </div>
          <button
            type="button"
            class="-me-1 -mt-1 rounded-theme-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            [attr.aria-label]="'common.close' | transloco"
            (click)="notifications.dismiss(toast.id)"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
              />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected readonly notifications = inject(NotificationService);

  protected borderClass(kind: string): string {
    switch (kind) {
      case 'success':
        return 'border-success-100 dark:border-success-500/30';
      case 'error':
        return 'border-error-100 dark:border-error-500/30';
      case 'warning':
        return 'border-warning-100 dark:border-warning-500/30';
      case 'info':
        return 'border-info-100 dark:border-info-500/30';
      default:
        return 'border-gray-200 dark:border-gray-700';
    }
  }

  protected iconClass(kind: string): string {
    switch (kind) {
      case 'success':
        return 'text-success-500';
      case 'error':
        return 'text-error-500';
      case 'warning':
        return 'text-warning-500';
      case 'info':
        return 'text-info-500';
      default:
        return 'text-brand-500';
    }
  }

  protected iconPath(kind: string): string {
    switch (kind) {
      case 'success':
        return 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z';
      case 'error':
        return 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293Z';
      case 'warning':
        return 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92ZM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-8a1 1 0 0 0-1 1v3a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1Z';
      default:
        return 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9Z';
    }
  }
}

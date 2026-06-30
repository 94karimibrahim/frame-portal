import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ModalComponent } from './modal.component';
import { SpinnerComponent } from './spinner.component';

/**
 * Reusable confirmation dialog built on {@link ModalComponent}. The host renders it conditionally and reacts
 * to {@link confirmed}/{@link cancelled}; `busy` disables the buttons while the confirmed action runs.
 * Title/message are already-localized strings; `danger` styles the confirm button as destructive.
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, ModalComponent, SpinnerComponent],
  template: `
    <app-modal [title]="title()" widthClass="max-w-md" (closed)="cancelled.emit()">
      <p class="text-theme-sm text-gray-600 dark:text-gray-300">{{ message() }}</p>
      <div modalFooter class="flex items-center justify-end gap-3">
        <button
          type="button"
          class="btn btn-secondary"
          (click)="cancelled.emit()"
          [disabled]="busy()"
        >
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          type="button"
          [class]="danger() ? 'btn btn-danger' : 'btn btn-primary'"
          (click)="confirmed.emit()"
          [disabled]="busy()"
        >
          @if (busy()) {
            <app-spinner size="sm" />
          }
          {{ confirmLabel() || ('common.confirm' | transloco) }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input<string>('');
  readonly danger = input<boolean>(false);
  readonly busy = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}

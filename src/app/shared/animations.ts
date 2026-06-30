import { animate, group, query, style, transition, trigger } from '@angular/animations';

/**
 * Route transition for the authenticated shell: a subtle cross-fade where the entering view also lifts a
 * few pixels into place. The leaving view is taken out of normal flow (absolute, logical insets so it
 * stays correct under RTL) so the two briefly-mounted views don't stack and shove the page height while
 * the swap plays. Applied on the wrapper that directly contains `<router-outlet>`.
 *
 * Honor `prefers-reduced-motion` at the call site by binding `[@.disabled]` — keep all motion opt-out in
 * one place rather than encoding it into the trigger.
 */
export const routeFade = trigger('routeFade', [
  transition('* <=> *', [
    style({ position: 'relative' }),
    query(
      ':enter, :leave',
      [style({ position: 'absolute', top: 0, insetInlineStart: 0, insetInlineEnd: 0 })],
      { optional: true },
    ),
    query(':enter', [style({ opacity: 0, transform: 'translateY(8px)' })], { optional: true }),
    group([
      query(':leave', [animate('120ms ease-in', style({ opacity: 0 }))], { optional: true }),
      query(':enter', [animate('260ms 80ms ease-out', style({ opacity: 1, transform: 'none' }))], {
        optional: true,
      }),
    ]),
  ]),
]);

/**
 * Per-item enter/leave for **in-flow block lists** (e.g. `<li>` rows). New items expand open while fading
 * in; removed items collapse and fade out, so the surrounding list reflows smoothly instead of snapping.
 * Height **and** vertical padding animate so the collapse is complete (padding alone would leave a stub).
 * Apply on each item — `<li [@listItem]>` — and Angular fires `:enter`/`:leave` as `@for` adds/removes it.
 */
export const listItem = trigger('listItem', [
  transition(':enter', [
    style({ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, overflow: 'hidden' }),
    animate(
      '200ms ease-out',
      style({ opacity: 1, height: '*', paddingTop: '*', paddingBottom: '*' }),
    ),
  ]),
  transition(':leave', [
    style({ overflow: 'hidden' }),
    animate('170ms ease-in', style({ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 })),
  ]),
]);

/**
 * Enter/leave for the **toast stack**. Toasts drop in from slightly above and fade/scale out — a
 * transform-only animation (direction-agnostic, so it's correct under RTL) that stays crisp without the
 * height bookkeeping in-flow lists need. Apply on each toast element.
 */
export const toastItem = trigger('toastItem', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-8px) scale(0.98)' }),
    animate('220ms ease-out', style({ opacity: 1, transform: 'none' })),
  ]),
  transition(':leave', [
    animate('160ms ease-in', style({ opacity: 0, transform: 'translateY(-8px) scale(0.97)' })),
  ]),
]);

/**
 * Whether the user has asked the OS to minimize motion. Bind the result to `[@.disabled]` on an animated
 * subtree so all motion opts out in one place. Read once at construction — this rarely flips mid-session.
 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, input, output } from '@angular/core';

/** Modal del prototipo. Los formularios largos solo se cierran con Cancelar o Escape. */
@Component({
  selector: 'app-modal',
  imports: [CdkTrapFocus],
  template: `
    <div class="modal-bg" (keydown.escape)="cerrar.emit()">
      <div
        class="modal"
        [class.n]="angosto()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="titulo()"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
      >
        <div class="mh">
          <h2 class="h2 sp">{{ titulo() }}</h2>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class Modal {
  readonly titulo = input.required<string>();
  readonly angosto = input(false);
  readonly cerrar = output<void>();
}

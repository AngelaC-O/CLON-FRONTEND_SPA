import { Component, computed, inject, input } from '@angular/core';
import { NotificacionesService } from '../../core/notificaciones/notificaciones.service';

/** Muestra un enlace para copiarlo o enviarlo: el back-end solo lo genera, no lo envía. */
@Component({
  selector: 'app-compartir-enlace',
  template: `
    <div class="col" style="gap: 8px">
      <div class="row nw">
        <input class="inp" readonly aria-label="Enlace para compartir" [value]="enlace()" />
        <button class="btn sec" type="button" (click)="copiar()">Copiar</button>
      </div>
      <div class="row" style="gap: 8px">
        @if (canal() !== 'CORREO') {
          <a class="btn sec sm" target="_blank" rel="noopener" [href]="whatsapp()">
            Enviar por WhatsApp
          </a>
        }
        @if (canal() !== 'WHATSAPP') {
          <a class="btn sec sm" [href]="correoElectronico()">Enviar por correo</a>
        }
      </div>
    </div>
  `,
})
export class CompartirEnlace {
  private readonly notificaciones = inject(NotificacionesService);

  readonly enlace = input.required<string>();
  readonly asunto = input.required<string>();
  readonly canal = input<'WHATSAPP' | 'CORREO' | null>(null);
  readonly correo = input('');

  protected readonly whatsapp = computed(
    () => `https://wa.me/?text=${encodeURIComponent(`${this.asunto()}: ${this.enlace()}`)}`,
  );
  protected readonly correoElectronico = computed(
    () =>
      `mailto:${encodeURIComponent(this.correo())}?subject=${encodeURIComponent(this.asunto())}` +
      `&body=${encodeURIComponent(this.enlace())}`,
  );

  protected copiar(): void {
    navigator.clipboard?.writeText(this.enlace()).then(
      () => this.notificaciones.mostrar('Enlace copiado.'),
      () => this.notificaciones.mostrar('No se pudo copiar: selecciona el enlace.', 'error'),
    );
  }
}

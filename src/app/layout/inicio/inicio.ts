import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { nombreO } from '../../core/api/nombres';
import { PERMISOS } from '../../core/sesion/permisos';
import { SesionService } from '../../core/sesion/sesion.service';
import { MENU } from '../menu';
import { PanelAvisos } from './panel-avisos';

/**
 * Cabecera, acciones y avisos del nodo 4:17 (CUS50). Los indicadores, las próximas citas y la
 * ocupación de ese nodo no tienen operación en el contrato (ver docs/NOTAS_IT2.md).
 */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, PanelAvisos],
  template: `
    <div class="col" style="gap: 16px">
      <div class="row">
        <div class="sp">
          <div class="xs mut eyebrow">{{ fecha }} · {{ nombreSede() }}</div>
          <h1 class="h1">{{ saludo }}, {{ nombre() }}</h1>
        </div>
        @if (puedeSinCita()) {
          <a class="btn lg salon" routerLink="/ventas/sin-cita">
            <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 2L4 14h7l-1 8 9-12h-7z"></path>
            </svg>
            Atención sin cita
          </a>
        }
        @if (puedeNuevaCita()) {
          <a class="btn lg sec" routerLink="/agenda">Nueva cita</a>
        }
      </div>
      <app-panel-avisos />
      <div class="gf">
        @for (item of accesos(); track item.ruta) {
          <a class="card" [routerLink]="item.ruta">
            <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path [attr.d]="item.icono"></path>
            </svg>
            <div class="h3" style="margin-top: 10px">{{ item.etiqueta }}</div>
            <div class="xs mut">{{ item.grupo }}</div>
          </a>
        }
      </div>
    </div>
  `,
})
export class Inicio {
  protected readonly sesion = inject(SesionService);
  /** SesionDTO.nombreSede (Duda 7, It. 2.1). */
  protected readonly nombreSede = computed(() => nombreO(this.sesion.sesion()?.nombreSede));

  protected readonly fecha = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(new Date())
    .replace(',', '')
    .toUpperCase();
  protected readonly saludo = saludoDe(new Date().getHours());
  protected readonly nombre = computed(() => {
    const sesion = this.sesion.sesion();
    if (sesion?.nombres) {
      return sesion.nombres.split(' ')[0];
    }
    const primero = (sesion?.nombreUsuario ?? '').split(/[.\s_-]+/)[0];
    return primero.charAt(0).toUpperCase() + primero.slice(1);
  });
  protected readonly puedeSinCita = computed(() => this.sesion.tienePermiso(PERMISOS.ventasCrear));
  protected readonly puedeNuevaCita = computed(
    () =>
      this.sesion.tienePermiso(PERMISOS.agendaCrear) &&
      this.sesion.tienePermiso(PERMISOS.agendaVer),
  );
  protected readonly accesos = computed(() =>
    MENU.filter((item) => item.ruta !== '/inicio' && this.sesion.tienePermiso(...item.permisos)),
  );
}

function saludoDe(hora: number): string {
  if (hora < 12) {
    return 'Buen día';
  }
  return hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

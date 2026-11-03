import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SesionService } from '../../core/sesion/sesion.service';
import { MENU } from '../menu';

/** Accesos a los módulos del rol; los pendientes del prototipo no tienen endpoint en el contrato. */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  template: `
    <div class="col" style="gap: 16px">
      <h1 class="h1">Hola, {{ sesion.sesion()?.nombreUsuario }}</h1>
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
  protected readonly accesos = computed(() =>
    MENU.filter((item) => item.ruta !== '/inicio' && this.sesion.tienePermiso(...item.permisos)),
  );
}

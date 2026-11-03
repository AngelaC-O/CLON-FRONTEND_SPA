import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GrupoMenu } from '../menu';

/** Menú «Más» de la barra inferior en móvil. */
@Component({
  selector: 'app-mas-modulos',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="modal">
      <div class="mh">
        <h2 class="h2 sp">Todos los módulos</h2>
        <button class="btn ghost sm" type="button" (click)="dialogo.close()">Cerrar</button>
      </div>
      <div class="mb" style="gap: 2px">
        @for (grupo of grupos; track grupo.nombre) {
          <div class="grp">{{ grupo.nombre }}</div>
          @for (item of grupo.items; track item.ruta) {
            <a
              class="nv"
              [routerLink]="item.ruta"
              routerLinkActive="on"
              [routerLinkActiveOptions]="{ exact: true }"
              (click)="dialogo.close()"
            >
              <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
                <path [attr.d]="item.icono"></path>
              </svg>
              <span class="nvl">{{ item.etiqueta }}</span>
            </a>
          }
        }
      </div>
    </div>
  `,
})
export class MasModulos {
  protected readonly dialogo = inject(DialogRef);
  protected readonly grupos = inject<GrupoMenu[]>(DIALOG_DATA);
}

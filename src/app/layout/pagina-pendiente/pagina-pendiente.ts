import { Component, input } from '@angular/core';

/** Lugar de cada frontera IGU_ hasta que se implementen sus formularios. */
@Component({
  selector: 'app-pagina-pendiente',
  template: `
    <div class="col" style="gap: 16px">
      <h1 class="h1">{{ titulo() }}</h1>
      <div class="card col">
        <div class="row">
          <span class="chip dk">{{ frontera() }}</span>
          @for (caso of cus(); track caso) {
            <span class="chip">{{ caso }}</span>
          }
        </div>
        <div class="alert info" role="status">
          Pantalla pendiente: la ruta, la guarda y el servicio HTTP ya están listos.
        </div>
      </div>
    </div>
  `,
})
export class PaginaPendiente {
  readonly titulo = input.required<string>();
  readonly frontera = input.required<string>();
  readonly cus = input.required<string[]>();
}

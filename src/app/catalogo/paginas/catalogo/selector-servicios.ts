import { Component, input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ServicioDTO } from '../../modelos/catalogo.modelos';

/** Casillas de servicios para un paquete o una promoción; escribe los id en el control. */
@Component({
  selector: 'app-selector-servicios',
  template: `
    <fieldset class="fld" style="border: 0; padding: 0; margin: 0">
      <legend class="lbl">SERVICIOS</legend>
      <div class="row" style="gap: 6px 14px">
        @for (servicio of servicios(); track servicio.idServicio) {
          <label class="row nw sm" style="gap: 6px">
            <input
              type="checkbox"
              [checked]="elegido(servicio.idServicio)"
              (change)="alternar(servicio.idServicio, $any($event.target).checked)"
            />
            {{ servicio.nombre }}
          </label>
        } @empty {
          <span class="xs mut">No hay servicios activos.</span>
        }
      </div>
    </fieldset>
  `,
})
export class SelectorServicios {
  readonly servicios = input<ServicioDTO[]>([]);
  readonly control = input.required<FormControl<number[]>>();

  protected elegido(idServicio?: number): boolean {
    return idServicio !== undefined && this.control().value.includes(idServicio);
  }

  protected alternar(idServicio: number | undefined, marcado: boolean): void {
    if (idServicio === undefined) {
      return;
    }
    const actuales = this.control().value.filter((id) => id !== idServicio);
    this.control().setValue(marcado ? [...actuales, idServicio] : actuales);
  }
}

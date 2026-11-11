import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ListasService } from '../../core/api/listas.service';
import { ServicioDTO, VarianteDTO } from '../../core/api/modelos.generados';
import { soles } from '../../core/api/moneda';
import { PERMISOS } from '../../core/sesion/permisos';
import { SesionService } from '../../core/sesion/sesion.service';

export interface VarianteElegida {
  servicio: ServicioDTO;
  variante: VarianteDTO;
}

/**
 * Servicio y variante desde GET /servicios (CUS58) en lugar del código escrito a mano (Duda 2 de
 * NOTAS_IT1). Escribe el idVariante en el control que recibe. Esa lectura pide CATALOGO:VER: sin
 * ese permiso queda el código de la variante, como en la Iteración 1 (ver docs/NOTAS_IT2.md).
 */
@Component({
  selector: 'app-selector-variante',
  imports: [ReactiveFormsModule],
  template: `
    @if (conLista()) {
      <div class="g2">
        <div class="fld">
          <label class="lbl" [for]="prefijo() + 'Servicio'">SERVICIO</label>
          <select class="inp" [id]="prefijo() + 'Servicio'" [formControl]="servicio">
            <option [ngValue]="null" disabled>Elige el servicio</option>
            @for (opcion of servicios(); track opcion.idServicio) {
              <option [ngValue]="opcion.idServicio">{{ opcion.nombre }}</option>
            }
          </select>
        </div>
        <div class="fld">
          <label class="lbl" [for]="prefijo() + 'IdVariante'">VARIANTE</label>
          <select class="inp" [id]="prefijo() + 'IdVariante'" [formControl]="control()">
            <option [ngValue]="null" disabled>Elige la variante</option>
            @for (opcion of variantes(); track opcion.idVariante) {
              <option [ngValue]="opcion.idVariante">
                {{ opcion.nombreVariante }} · {{ soles(opcion.precio) }}
              </option>
            }
          </select>
        </div>
      </div>
    } @else {
      <div class="fld">
        <label class="lbl" [for]="prefijo() + 'IdVariante'">CÓDIGO DE LA VARIANTE</label>
        <input
          class="inp"
          type="number"
          min="1"
          [id]="prefijo() + 'IdVariante'"
          [formControl]="control()"
        />
      </div>
    }
  `,
})
export class SelectorVariante implements OnInit {
  private readonly listas = inject(ListasService);
  private readonly sesion = inject(SesionService);
  private readonly destruir = inject(DestroyRef);

  /** Control del idVariante en el formulario de la página. */
  readonly control = input.required<FormControl<number | null>>();
  /** Prefijo de los id de los campos: citaIdVariante, esperaIdVariante... */
  readonly prefijo = input.required<string>();
  readonly elegida = output<VarianteElegida | null>();

  protected readonly soles = soles;
  protected readonly conLista = computed(() => this.sesion.tienePermiso(PERMISOS.catalogoVer));
  protected readonly servicios = signal<ServicioDTO[]>([]);
  protected readonly servicio = new FormControl<number | null>(null);
  private readonly idServicio = signal<number | null>(null);
  protected readonly variantes = computed(
    () => this.servicios().find((s) => s.idServicio === this.idServicio())?.variantes ?? [],
  );

  ngOnInit(): void {
    this.control()
      .valueChanges.pipe(takeUntilDestroyed(this.destruir))
      .subscribe((idVariante) => this.avisar(idVariante));
    if (!this.conLista()) {
      return;
    }
    this.servicio.valueChanges
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe((idServicio) => this.cambiarServicio(idServicio));
    this.listas.serviciosActivos().subscribe((servicios) => {
      this.servicios.set(servicios);
      const inicial = this.buscar(this.control().value);
      if (inicial) {
        this.idServicio.set(inicial.servicio.idServicio ?? null);
        this.servicio.setValue(inicial.servicio.idServicio ?? null, { emitEvent: false });
        this.elegida.emit(inicial);
      }
    });
  }

  private cambiarServicio(idServicio: number | null): void {
    this.idServicio.set(idServicio);
    const variantes = this.variantes();
    // Con una sola variante no hay nada que elegir.
    this.control().setValue(variantes.length === 1 ? (variantes[0].idVariante ?? null) : null);
  }

  private avisar(idVariante: number | null): void {
    this.elegida.emit(this.buscar(idVariante));
  }

  private buscar(idVariante: number | null): VarianteElegida | null {
    if (idVariante === null) {
      return null;
    }
    for (const servicio of this.servicios()) {
      const variante = servicio.variantes?.find((v) => v.idVariante === idVariante);
      if (variante) {
        return { servicio, variante };
      }
    }
    return null;
  }
}

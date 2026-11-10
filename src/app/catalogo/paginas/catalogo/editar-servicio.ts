import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { TIPOS_RECURSO } from '../../../core/api/tipos-recurso';
import { Modal } from '../../../layout/modal/modal';
import { ServicioDTO, VarianteDTO } from '../../modelos/catalogo.modelos';
import { CatalogoService } from '../../servicios/catalogo.service';

function crearInsumo(
  fb: NonNullableFormBuilder,
  idProducto: number | null,
  cantidad: number | null,
) {
  return fb.group({
    idProducto: [idProducto, [Validators.required, Validators.min(1)]],
    cantidadEstimada: [cantidad, [Validators.required, Validators.min(0.0001)]],
  });
}
type FormInsumo = ReturnType<typeof crearInsumo>;

/**
 * CUS58 Actualizar Servicio: datos, estado e insumos con «Guardar cambios» (PUT; desactivar es
 * INACTIVO, no se borra) y el precio de cada variante con «Cambiar precio» (PATCH; el anterior y el
 * nuevo quedan en la auditoría, RN25). Pide CATALOGO:EDITAR.
 */
@Component({
  selector: 'app-editar-servicio',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal titulo="Editar servicio" [ancho]="true" (cerrar)="cerrar.emit()">
      <form [formGroup]="formulario" (ngSubmit)="guardar()">
        <div class="mb">
          @if (error(); as mensaje) {
            <div class="alert bad" role="alert">{{ mensaje }}</div>
          }
          <div class="g2">
            <div class="fld">
              <label class="lbl" for="editarNombre">NOMBRE</label>
              <input class="inp" id="editarNombre" maxlength="80" formControlName="nombre" />
            </div>
            <div class="fld">
              <label class="lbl" for="editarDuracion">DURACIÓN DE REFERENCIA (MIN)</label>
              <input
                class="inp"
                id="editarDuracion"
                type="number"
                min="5"
                max="600"
                formControlName="duracionRefMin"
              />
            </div>
            <div class="fld">
              <label class="lbl" for="editarTipoRecurso">TIPO DE RECURSO</label>
              <select class="inp" id="editarTipoRecurso" formControlName="tipoRecurso">
                @for (tipo of tipos; track tipo.valor) {
                  <option [value]="tipo.valor">{{ tipo.etiqueta }}</option>
                }
              </select>
            </div>
            <div class="fld">
              <label class="lbl" for="editarEstado">ESTADO</label>
              <select class="inp" id="editarEstado" formControlName="estado">
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo (no se ofrece)</option>
              </select>
            </div>
          </div>

          @for (variante of variantes(); track variante.idVariante; let v = $index) {
            <div class="card col variante" style="gap: 8px">
              <div class="row nw" style="align-items: flex-end">
                <div class="sp">
                  <div class="b">{{ variante.nombreVariante }}</div>
                  <div class="xs mut">Precio actual {{ soles(variante.precio) }}</div>
                </div>
                <div class="fld" style="max-width: 140px">
                  <label class="lbl" [for]="'precioNuevo' + v">PRECIO NUEVO</label>
                  <input
                    class="inp"
                    type="number"
                    min="0"
                    step="0.01"
                    [id]="'precioNuevo' + v"
                    [formControl]="precioNuevo(variante)"
                  />
                </div>
                <button
                  class="btn sec sm"
                  type="button"
                  [disabled]="enviando()"
                  (click)="cambiarPrecio(variante)"
                >
                  Cambiar precio
                </button>
              </div>
              <div class="lbl">INSUMOS POR ATENCIÓN</div>
              @for (insumo of insumos(variante).controls; track insumo; let n = $index) {
                <div class="row nw" [formGroup]="insumo">
                  <input
                    class="inp"
                    type="number"
                    min="1"
                    placeholder="Código del producto"
                    [attr.aria-label]="
                      'Producto del insumo ' + (n + 1) + ' de ' + variante.nombreVariante
                    "
                    formControlName="idProducto"
                  />
                  <input
                    class="inp"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Cantidad estimada"
                    [attr.aria-label]="
                      'Cantidad del insumo ' + (n + 1) + ' de ' + variante.nombreVariante
                    "
                    formControlName="cantidadEstimada"
                  />
                  <button
                    class="btn ghost sm"
                    type="button"
                    (click)="insumos(variante).removeAt(n)"
                  >
                    Quitar
                  </button>
                </div>
              }
              <button
                class="btn ghost sm"
                type="button"
                style="align-self: flex-start"
                (click)="agregarInsumo(variante)"
              >
                + Insumo
              </button>
            </div>
          }
          <div class="xs mut">
            El precio se cambia aparte y queda en la auditoría con el anterior (RN25).
          </div>
        </div>
        <div class="mf">
          <button class="btn sec" type="button" (click)="cerrar.emit()">Cancelar</button>
          <button class="btn" type="submit" [disabled]="enviando()">Guardar cambios</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class EditarServicio implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(CatalogoService);

  readonly original = input.required<ServicioDTO>();
  readonly cerrar = output<void>();
  readonly actualizado = output<ServicioDTO>();

  protected readonly soles = soles;
  protected readonly tipos = TIPOS_RECURSO;
  protected readonly variantes = signal<VarianteDTO[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    duracionRefMin: [
      null as number | null,
      [Validators.required, Validators.min(5), Validators.max(600)],
    ],
    tipoRecurso: ['SILLON' as ServicioDTO['tipoRecurso'], Validators.required],
    estado: ['ACTIVO' as NonNullable<ServicioDTO['estado']>],
  });
  private readonly insumosPorVariante = new Map<number, FormArray<FormInsumo>>();
  private readonly precios = new Map<number, FormControl<number | null>>();

  ngOnInit(): void {
    const servicio = this.original();
    this.formulario.reset({
      nombre: servicio.nombre,
      duracionRefMin: servicio.duracionRefMin,
      tipoRecurso: servicio.tipoRecurso,
      estado: servicio.estado ?? 'ACTIVO',
    });
    this.variantes.set(servicio.variantes ?? []);
  }

  protected insumos(variante: VarianteDTO): FormArray<FormInsumo> {
    const id = variante.idVariante ?? 0;
    let lista = this.insumosPorVariante.get(id);
    if (!lista) {
      lista = new FormArray(
        (variante.insumos ?? []).map((i) => crearInsumo(this.fb, i.idProducto, i.cantidadEstimada)),
      );
      this.insumosPorVariante.set(id, lista);
    }
    return lista;
  }

  protected precioNuevo(variante: VarianteDTO): FormControl<number | null> {
    const id = variante.idVariante ?? 0;
    let control = this.precios.get(id);
    if (!control) {
      control = new FormControl<number | null>(null);
      this.precios.set(id, control);
    }
    return control;
  }

  protected agregarInsumo(variante: VarianteDTO): void {
    this.insumos(variante).push(crearInsumo(this.fb, null, null));
  }

  protected cambiarPrecio(variante: VarianteDTO): void {
    const idServicio = this.original().idServicio;
    const precio = this.precioNuevo(variante).value;
    if (idServicio === undefined || variante.idVariante === undefined) {
      return;
    }
    if (precio === null || precio < 0) {
      this.error.set(`Escribe el precio nuevo de ${variante.nombreVariante} (0 o más, RN40).`);
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio.cambiarPrecio(idServicio, variante.idVariante, precio).subscribe({
      next: (servicio) => {
        this.enviando.set(false);
        this.precioNuevo(variante).reset();
        // Solo cambia el precio: los insumos que se están editando se conservan.
        this.variantes.update((lista) =>
          lista.map((v) => {
            const nueva = servicio.variantes?.find((n) => n.idVariante === v.idVariante);
            return nueva ? { ...v, precio: nueva.precio } : v;
          }),
        );
        this.actualizado.emit(servicio);
      },
      error: (error: HttpErrorResponse) => this.fallar(error),
    });
  }

  protected guardar(): void {
    const idServicio = this.original().idServicio;
    if (idServicio === undefined) {
      return;
    }
    const invalidos = this.variantes().some((v) => this.insumos(v).invalid);
    if (this.formulario.invalid || invalidos) {
      this.error.set(
        'Revisa el nombre y la duración (5 a 600 minutos); cada insumo necesita producto y una cantidad mayor que 0.',
      );
      return;
    }
    const valor = this.formulario.getRawValue();
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .actualizarServicio(idServicio, {
        idArea: this.original().idArea,
        nombre: valor.nombre.trim(),
        duracionRefMin: valor.duracionRefMin!,
        tipoRecurso: valor.tipoRecurso,
        estado: valor.estado,
        variantes: this.variantes().map((v) => ({
          idVariante: v.idVariante,
          nombreVariante: v.nombreVariante,
          precio: v.precio,
          insumos: this.insumos(v)
            .getRawValue()
            .map((i) => ({ idProducto: i.idProducto!, cantidadEstimada: i.cantidadEstimada! })),
        })),
      })
      .subscribe({
        next: (servicio) => {
          this.enviando.set(false);
          this.actualizado.emit(servicio);
          this.cerrar.emit();
        },
        error: (error: HttpErrorResponse) => this.fallar(error),
      });
  }

  private fallar(error: HttpErrorResponse): void {
    this.enviando.set(false);
    if ([400, 404, 422].includes(error.status)) {
      this.error.set(mensajeDelProblema(error, 'No se pudo guardar el servicio.'));
    }
  }
}

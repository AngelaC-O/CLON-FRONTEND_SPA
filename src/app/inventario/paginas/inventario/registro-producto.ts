import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import { CategoriaProductoDTO, ProductoDTO } from '../../modelos/inventario.modelos';
import { precioSugerido, UNIDADES_INSUMO } from '../../modelos/inventario.vista';
import { ProductosService } from '../../servicios/productos.service';

type TipoUso = NonNullable<ProductoDTO['tipoUso']>;

/**
 * CUS32 Registrar Producto («Registrar»). El precio de venta lo calcula el back-end:
 * costo × (1 + margen) (RF87). Sin margen escrito usa el del negocio (PARAMETRO); con margen, la
 * pantalla muestra el precio sugerido antes de guardar. Un insumo va en su unidad mínima (RN54).
 * El producto nace con stock 0 en la sede.
 */
@Component({
  selector: 'app-registro-producto',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal titulo="Registrar producto o insumo" (cerrar)="cerrar.emit()">
      <form [formGroup]="formulario" (ngSubmit)="registrar()">
        <div class="mb">
          @if (error(); as mensaje) {
            <div class="alert bad" role="alert">{{ mensaje }}</div>
          }
          <div class="fld">
            <span class="lbl">TIPO DE USO (RN13)</span>
            <div class="seg" role="group" aria-label="Tipo de uso">
              <button
                type="button"
                [class.on]="tipoUso() === 'VENTA'"
                [attr.aria-pressed]="tipoUso() === 'VENTA'"
                (click)="elegirUso('VENTA')"
              >
                Producto de venta
              </button>
              <button
                type="button"
                [class.on]="tipoUso() === 'INSUMO'"
                [attr.aria-pressed]="tipoUso() === 'INSUMO'"
                (click)="elegirUso('INSUMO')"
              >
                Insumo
              </button>
            </div>
          </div>
          <div class="g2">
            <div class="fld">
              <label class="lbl" for="productoCodigo">CÓDIGO</label>
              <input class="inp" id="productoCodigo" maxlength="20" formControlName="codigo" />
            </div>
            <div class="fld">
              <label class="lbl" for="productoNombreNuevo">NOMBRE</label>
              <input
                class="inp"
                id="productoNombreNuevo"
                maxlength="100"
                formControlName="nombre"
              />
            </div>
            <div class="fld">
              <label class="lbl" for="productoMarcaNueva">MARCA</label>
              <input class="inp" id="productoMarcaNueva" maxlength="60" formControlName="marca" />
            </div>
            <div class="fld">
              <label class="lbl" for="productoIdCategoria">CATEGORÍA</label>
              <select class="inp" id="productoIdCategoria" formControlName="idCategoria">
                <option [ngValue]="null" disabled>Elige la categoría</option>
                @for (categoria of categorias(); track categoria.idCategoria) {
                  <option [ngValue]="categoria.idCategoria">{{ categoria.nombre }}</option>
                }
              </select>
            </div>
            <div class="fld">
              <label class="lbl" for="productoUnidad">
                {{ tipoUso() === 'INSUMO' ? 'UNIDAD MÍNIMA (RN54)' : 'UNIDAD' }}
              </label>
              @if (tipoUso() === 'INSUMO') {
                <select class="inp" id="productoUnidad" formControlName="unidad">
                  @for (unidad of unidadesInsumo; track unidad.codigo) {
                    <option [value]="unidad.codigo">{{ unidad.texto }}</option>
                  }
                </select>
              } @else {
                <input class="inp" id="productoUnidad" maxlength="10" formControlName="unidad" />
              }
            </div>
            <div class="fld">
              <label class="lbl" for="productoStockMinimo">STOCK MÍNIMO</label>
              <input
                class="inp"
                id="productoStockMinimo"
                type="number"
                min="0"
                formControlName="stockMinimo"
              />
            </div>
            <div class="fld">
              <label class="lbl" for="productoUbicacion">UBICACIÓN EN LA SEDE</label>
              <input
                class="inp"
                id="productoUbicacion"
                maxlength="60"
                placeholder="Ej. Estante A"
                formControlName="ubicacion"
              />
            </div>
          </div>
          <div class="g2">
            <div class="fld">
              <label class="lbl" for="productoCosto">COSTO (S/)</label>
              <input
                class="inp"
                id="productoCosto"
                type="number"
                min="0"
                step="0.01"
                formControlName="costo"
              />
            </div>
            <div class="fld">
              <label class="lbl" for="productoMargen">MARGEN (%) · OPCIONAL</label>
              <input
                class="inp"
                id="productoMargen"
                type="number"
                min="0"
                step="0.1"
                placeholder="El del negocio"
                formControlName="margen"
              />
            </div>
          </div>
          <div class="alert info" id="precioSugerido">
            @if (sugerido() !== null) {
              Precio de venta sugerido: <b>{{ soles(sugerido()) }}</b> (costo +
              {{ valor().margen }} %). Ajusta el margen para cambiarlo.
            } @else {
              Sin margen escrito, el precio sale del costo y el margen vigente del negocio (RF87).
            }
          </div>
          <label class="row nw" style="gap: 10px">
            <input id="productoPremium" type="checkbox" formControlName="esPremium" />
            <span>Producto premium</span>
          </label>
          <div class="xs mut">
            Nace con stock 0 en la sede: el stock solo cambia por el kardex (compras, salidas y
            ajustes).
          </div>
        </div>
        <div class="mf">
          <button class="btn sec" type="button" (click)="cerrar.emit()">Cancelar</button>
          <button class="btn" type="submit" [disabled]="enviando()">Registrar</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class RegistroProducto {
  private readonly servicio = inject(ProductosService);

  readonly categorias = input<CategoriaProductoDTO[]>([]);
  readonly cerrar = output<void>();
  readonly registrado = output<ProductoDTO>();

  protected readonly soles = soles;
  protected readonly unidadesInsumo = UNIDADES_INSUMO;
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    tipoUso: ['VENTA' as TipoUso],
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    marca: ['', Validators.maxLength(60)],
    idCategoria: [null as number | null, Validators.required],
    unidad: ['UND', Validators.required],
    stockMinimo: [null as number | null, [Validators.required, Validators.min(0)]],
    ubicacion: ['', Validators.maxLength(60)],
    costo: [null as number | null, [Validators.required, Validators.min(0)]],
    margen: [null as number | null, Validators.min(0)],
    esPremium: [false],
  });
  protected readonly valor = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });
  protected readonly tipoUso = computed(() => this.valor().tipoUso ?? 'VENTA');
  protected readonly sugerido = computed(() =>
    precioSugerido(this.valor().costo ?? null, this.valor().margen ?? null),
  );

  /** Un insumo se mide en ml, g o unidad; se propone la unidad. */
  protected elegirUso(tipoUso: TipoUso): void {
    this.formulario.patchValue({ tipoUso, unidad: 'UND' });
  }

  protected registrar(): void {
    const valor = this.formulario.getRawValue();
    if (this.formulario.invalid) {
      this.error.set('Completa código, nombre, categoría, unidad, stock mínimo y costo.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .registrar({
        tipoUso: valor.tipoUso,
        codigo: valor.codigo.trim(),
        nombre: valor.nombre.trim(),
        ...(valor.marca.trim() ? { marca: valor.marca.trim() } : {}),
        idCategoria: valor.idCategoria!,
        unidad: valor.unidad.trim().toUpperCase(),
        stockMinimo: valor.stockMinimo!,
        ...(valor.ubicacion.trim() ? { ubicacion: valor.ubicacion.trim() } : {}),
        costo: valor.costo!,
        // El contrato guarda el margen como fracción: 50 % es 0.5.
        ...(valor.margen !== null ? { margen: valor.margen / 100 } : {}),
        esPremium: valor.esPremium,
      })
      .subscribe({
        next: (producto) => {
          this.enviando.set(false);
          this.registrado.emit(producto);
        },
        // El 409 (código repetido) y el 422 (RN54) también los avisa el interceptor.
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          if ([400, 409, 422].includes(error.status)) {
            this.error.set(mensajeDelProblema(error, 'Revisa los datos del producto.'));
          }
        },
      });
  }
}

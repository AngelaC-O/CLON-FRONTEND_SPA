import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { MovimientoDTO, ProductoDTO } from '../../modelos/inventario.modelos';
import { KardexService } from '../../servicios/kardex.service';

export type TipoMovimiento = 'SALIDA' | 'AJUSTE';

/**
 * CUS33 Registrar Salida de Insumos («Registrar salida de insumo»: cantidad, motivo y atención
 * opcional; solo insumos) y CUS34 Registrar Ajuste de Inventario («Registrar ajuste»: lo contado y
 * el motivo, con la diferencia a la vista antes de guardar). Las dos avisan el stock mínimo (RF47).
 */
@Component({
  selector: 'app-movimiento-inventario',
  imports: [ReactiveFormsModule],
  template: `
    <form
      class="card col"
      style="max-width: 640px"
      [formGroup]="formulario"
      (ngSubmit)="registrar()"
    >
      <div class="mut sm">
        @if (tipo() === 'SALIDA') {
          Consumo interno de insumos fuera del descuento automático de la atención. Si fue en una
          atención, indícala.
        } @else {
          Diferencia entre el conteo físico y el stock del sistema; exige motivo.
        }
      </div>
      @if (error(); as mensaje) {
        <div class="alert bad" role="alert">{{ mensaje }}</div>
      }
      <div class="fld">
        <label class="lbl" [for]="prefijo() + 'Producto'">
          {{ tipo() === 'SALIDA' ? 'INSUMO' : 'PRODUCTO' }}
        </label>
        <select class="inp" [id]="prefijo() + 'Producto'" formControlName="idProducto">
          <option [ngValue]="null" disabled>Elige</option>
          @for (producto of ofrecidos(); track producto.idProducto) {
            <option [ngValue]="producto.idProducto">
              {{ producto.codigo }} · {{ producto.nombre }} · stock {{ producto.stockActual }}
              {{ producto.unidad }}
            </option>
          }
        </select>
      </div>
      <div class="g2">
        <div class="fld">
          <label class="lbl" [for]="prefijo() + 'Cantidad'">
            {{ tipo() === 'SALIDA' ? 'CANTIDAD' : 'CANTIDAD CONTADA' }}
            @if (elegido(); as producto) {
              ({{ producto.unidad }})
            }
          </label>
          <input
            class="inp"
            type="number"
            [min]="tipo() === 'SALIDA' ? 1 : 0"
            [id]="prefijo() + 'Cantidad'"
            formControlName="cantidad"
          />
        </div>
        @if (tipo() === 'SALIDA') {
          <div class="fld">
            <label class="lbl" for="salidaIdAtencion">ATENCIÓN (OPCIONAL)</label>
            <input
              class="inp"
              id="salidaIdAtencion"
              type="number"
              min="1"
              placeholder="N° de atención"
              formControlName="idAtencion"
            />
          </div>
        }
      </div>
      <div class="fld">
        <label class="lbl" [for]="prefijo() + 'Motivo'">MOTIVO (OBLIGATORIO)</label>
        <input
          class="inp"
          maxlength="200"
          [id]="prefijo() + 'Motivo'"
          [placeholder]="
            tipo() === 'SALIDA' ? 'Ej. Uso en cabina' : 'Ej. Conteo físico de fin de mes'
          "
          formControlName="motivo"
        />
      </div>
      @if (elegido(); as producto) {
        @if (resultado(); as cuenta) {
          <div
            class="alert"
            [class.info]="cuenta.diferencia !== 0"
            [class.warn]="cuenta.diferencia === 0"
            [attr.id]="prefijo() + 'Diferencia'"
          >
            Stock del sistema {{ producto.stockActual }} → {{ cuenta.saldo }}
            @if (tipo() === 'AJUSTE') {
              · diferencia {{ cuenta.diferencia > 0 ? '+' : '' }}{{ cuenta.diferencia }}
              @if (cuenta.diferencia === 0) {
                : lo contado es igual al stock, no hay nada que ajustar.
              }
            }
          </div>
        }
      }
      @if (alerta(); as texto) {
        <div class="alert warn" role="status">{{ texto }}</div>
      }
      <button class="btn" type="submit" style="align-self: flex-start" [disabled]="enviando()">
        {{ tipo() === 'SALIDA' ? 'Registrar salida de insumo' : 'Registrar ajuste' }}
      </button>
    </form>
  `,
})
export class MovimientoInventario {
  private readonly servicio = inject(KardexService);

  readonly tipo = input.required<TipoMovimiento>();
  readonly productos = input<ProductoDTO[]>([]);
  readonly registrado = output<{ producto: ProductoDTO; movimiento: MovimientoDTO }>();

  protected readonly error = signal<string | null>(null);
  protected readonly alerta = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    idProducto: [null as number | null, Validators.required],
    cantidad: [null as number | null, [Validators.required, Validators.min(0)]],
    idAtencion: [null as number | null, Validators.min(1)],
    motivo: ['', [Validators.required, Validators.maxLength(200)]],
  });
  private readonly valor = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  protected readonly prefijo = computed(() => (this.tipo() === 'SALIDA' ? 'salida' : 'ajuste'));
  /** La salida manual es de insumos (RN13); el ajuste, de cualquier producto activo. */
  protected readonly ofrecidos = computed(() =>
    this.productos().filter(
      (p) => p.estado !== 'INACTIVO' && (this.tipo() === 'AJUSTE' || p.tipoUso === 'INSUMO'),
    ),
  );
  protected readonly elegido = computed(() =>
    this.productos().find((p) => p.idProducto === this.valor().idProducto),
  );
  /** Saldo que quedaría y, en el ajuste, la diferencia con signo (contado − stock). */
  protected readonly resultado = computed(() => {
    const cantidad = this.valor().cantidad;
    const stock = this.elegido()?.stockActual ?? 0;
    if (cantidad === null || cantidad === undefined) {
      return null;
    }
    return this.tipo() === 'SALIDA'
      ? { saldo: stock - cantidad, diferencia: -cantidad }
      : { saldo: cantidad, diferencia: cantidad - stock };
  });

  protected registrar(): void {
    const { idProducto, cantidad, idAtencion, motivo } = this.formulario.getRawValue();
    const producto = this.elegido();
    const mensaje = this.validar(producto, cantidad, motivo.trim());
    if (mensaje || !producto || idProducto === null || cantidad === null) {
      this.error.set(mensaje ?? 'Elige el producto.');
      return;
    }
    this.error.set(null);
    this.alerta.set(null);
    this.enviando.set(true);
    const peticion =
      this.tipo() === 'SALIDA'
        ? this.servicio.registrarSalida(idProducto, {
            cantidad,
            motivo: motivo.trim(),
            ...(idAtencion ? { idAtencion } : {}),
          })
        : this.servicio.registrarAjuste(idProducto, cantidad, motivo.trim());
    peticion.subscribe({
      next: (movimiento) => {
        this.enviando.set(false);
        this.formulario.reset();
        if (movimiento.estaEnMinimo) {
          this.alerta.set(
            `${producto.nombre} quedó en ${movimiento.saldo} ${producto.unidad ?? ''}: en su stock mínimo o por debajo (RF47).`,
          );
        }
        this.registrado.emit({ producto, movimiento });
      },
      // El 409 (sin stock, RN15) y el 422 también los avisa el interceptor.
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if ([400, 404, 409, 422].includes(error.status)) {
          this.error.set(mensajeDelProblema(error, 'No se pudo registrar el movimiento.'));
        }
      },
    });
  }

  private validar(
    producto: ProductoDTO | undefined,
    cantidad: number | null,
    motivo: string,
  ): string | null {
    if (!producto) {
      return 'Elige el producto.';
    }
    if (cantidad === null || cantidad < 0 || (this.tipo() === 'SALIDA' && cantidad <= 0)) {
      return 'Indica una cantidad válida.';
    }
    if (this.tipo() === 'SALIDA' && cantidad > (producto.stockActual ?? 0)) {
      return `No hay stock suficiente: quedan ${producto.stockActual} ${producto.unidad ?? ''} (RN15).`;
    }
    if (this.tipo() === 'AJUSTE' && cantidad === producto.stockActual) {
      return 'Lo contado es igual al stock: no hay nada que ajustar.';
    }
    if (!motivo) {
      return 'Escribe el motivo.';
    }
    return null;
  }
}

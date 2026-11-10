import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { mensajeDelProblema } from '../../../core/api/problema';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { MovimientoKardexDTO, ProductoDTO } from '../../modelos/inventario.modelos';
import { enMinimo, fechaHora, fechaIso, origenMovimiento } from '../../modelos/inventario.vista';
import { KardexService } from '../../servicios/kardex.service';
import { ProductosService } from '../../servicios/productos.service';

const TIPOS: Record<string, { texto: string; clase: string }> = {
  ENTRADA: { texto: 'Entrada', clase: 'ok' },
  SALIDA: { texto: 'Salida', clase: 'warn' },
  AJUSTE: { texto: 'Ajuste', clase: 'info' },
};

/**
 * Nodo 4:161 «13 · Kardex»: CUS35 Consultar Kardex («Ver kardex»). Movimientos del producto en la
 * sede con tipo, cantidad, saldo, fecha, origen (la atención en las salidas automáticas, la venta
 * o la compra) y usuario, entre dos fechas; por defecto, los últimos 30 días. El producto se elige
 * de GET /productos (PRODUCTOS:VER); sin ese permiso se escribe su código.
 */
@Component({
  selector: 'app-kardex',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './kardex.html',
})
export class Kardex implements OnInit {
  private readonly servicio = inject(KardexService);
  private readonly productosServicio = inject(ProductosService);
  private readonly sesion = inject(SesionService);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly fechaHora = fechaHora;
  protected readonly origenMovimiento = origenMovimiento;
  protected readonly enMinimo = enMinimo;
  protected readonly conLista = computed(() => this.sesion.tienePermiso(PERMISOS.productosVer));
  protected readonly productos = signal<ProductoDTO[]>([]);
  /** null: aún no se consulta. */
  protected readonly movimientos = signal<MovimientoKardexDTO[] | null>(null);
  protected readonly consultado = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly filtro = inject(FormBuilder).nonNullable.group({
    idProducto: [null as number | null, [Validators.required, Validators.min(1)]],
    fechaInicio: [fechaIso(-30), Validators.required],
    fechaFin: [fechaIso(), Validators.required],
  });

  /** El producto consultado, si está en la lista: muestra su stock y su mínimo. */
  protected readonly producto = computed(() =>
    this.productos().find((p) => p.idProducto === this.consultado()),
  );

  ngOnInit(): void {
    const idProducto = Number(this.ruta.snapshot.queryParamMap.get('idProducto')) || null;
    if (this.conLista()) {
      this.productosServicio.listar().subscribe((productos) => this.productos.set(productos));
    }
    if (idProducto) {
      this.filtro.controls.idProducto.setValue(idProducto);
      this.verKardex();
    }
  }

  protected tipo(movimiento: MovimientoKardexDTO): { texto: string; clase: string } {
    return TIPOS[movimiento.tipo ?? ''] ?? { texto: movimiento.tipo ?? '', clase: '' };
  }

  protected verKardex(): void {
    const { idProducto, fechaInicio, fechaFin } = this.filtro.getRawValue();
    if (!idProducto || idProducto < 1) {
      this.error.set('Elige el producto.');
      return;
    }
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      this.error.set('La fecha de inicio es posterior a la de fin.');
      return;
    }
    this.error.set(null);
    this.servicio
      .consultarKardex(idProducto, {
        ...(fechaInicio ? { fechaInicio } : {}),
        ...(fechaFin ? { fechaFin } : {}),
      })
      .subscribe({
        next: (movimientos) => {
          this.movimientos.set(movimientos);
          this.consultado.set(idProducto);
        },
        error: (error: HttpErrorResponse) => {
          this.movimientos.set(null);
          if (error.status === 404 || error.status === 422 || error.status === 400) {
            this.error.set(mensajeDelProblema(error, 'No se pudo consultar el kardex.'));
          }
        },
      });
  }
}

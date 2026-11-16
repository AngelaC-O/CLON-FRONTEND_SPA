import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { startWith } from 'rxjs';
import { ClientaElegida, SelectorClienta } from '../../../agenda/paginas/agenda/selector-clienta';
import { CitasService } from '../../../agenda/servicios/citas.service';
import { ListasService } from '../../../core/api/listas.service';
import { CanalCobro, canalPropuesto, etiquetaMedio, mediosActivos } from '../../../core/api/medios';
import { Especialista, MedioPagoDTO, TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { redondear, soles } from '../../../core/api/moneda';
import { nombreCompleto } from '../../../core/api/nombres';
import { leerProblema, mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { CategoriaProductoDTO, ProductoStockDTO, VentaDTO } from '../../modelos/ventas.modelos';
import { VentasService } from '../../servicios/ventas.service';
import { ComprobanteEmitido } from '../comprobante/comprobante-emitido';
import {
  crearFormularioComprador,
  DatosComprador,
  leerComprador,
} from '../comprobante/datos-comprador';

/**
 * IGU_VentaProductos, nodo 4:77: CUS25 Buscar Producto («Buscar») y CUS26 Vender Producto
 * («Vender»). Solo productos de venta con su stock en la sede (RN15); cada línea puede llevar la
 * especialista que lo recomendó. El pago y el comprobante son los de IGU_Cobro: un cobro digital que
 * la pasarela no aprueba al instante deja la venta ABIERTA (202) y se cierra en Cobros (RN52).
 */
@Component({
  selector: 'app-venta-productos',
  imports: [ReactiveFormsModule, ComprobanteEmitido, DatosComprador, SelectorClienta],
  templateUrl: './venta-productos.html',
})
export class VentaProductos implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(VentasService);
  private readonly citas = inject(CitasService);
  private readonly listas = inject(ListasService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly soles = soles;
  protected readonly etiquetaMedio = etiquetaMedio;
  /** GET /categorias-producto pide PRODUCTOS:VER: sin él, se busca sin categoría. */
  protected readonly conCategorias = computed(() =>
    this.sesion.tienePermiso(PERMISOS.productosVer),
  );
  /** Las especialistas salen de GET /citas/filtros (AGENDA:VER); sin él, se escribe el código. */
  protected readonly conEspecialistas = computed(() =>
    this.sesion.tienePermiso(PERMISOS.agendaVer),
  );
  protected readonly categorias = signal<CategoriaProductoDTO[]>([]);
  protected readonly especialistas = signal<Especialista[]>([]);
  protected readonly medios = signal<MedioPagoDTO[]>([]);
  protected readonly activos = computed(() => mediosActivos(this.medios()));
  private readonly tipos = signal<TipoDocumentoDTO[]>([]);
  /** null: aún no se busca. */
  protected readonly productos = signal<ProductoStockDTO[] | null>(null);
  /** Datos de cada producto del carrito, por idProducto. */
  private readonly enCarrito = new Map<number, ProductoStockDTO>();
  protected readonly registrada = signal(false);
  protected readonly clienta = signal<ClientaElegida | null>(null);
  protected readonly venta = signal<VentaDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly busqueda = this.fb.group({
    nombre: [''],
    marca: [''],
    idCategoria: [null as number | null],
  });
  protected readonly lineas = new FormArray<LineaCarrito>([]);
  protected readonly cobro = this.fb.group({
    idMedioPago: [null as number | null, Validators.required],
    canal: [null as CanalCobro | null],
  });
  protected readonly comprador = crearFormularioComprador(this.fb);

  private readonly valorLineas = toSignal(
    this.lineas.valueChanges.pipe(startWith(this.lineas.getRawValue())),
    { initialValue: [] },
  );
  /** IGV 0 % (Amazonía, RN06): el total es la suma de las líneas. */
  protected readonly total = computed(() =>
    redondear(
      this.valorLineas().reduce(
        (suma, linea) =>
          suma +
          (this.enCarrito.get(linea.idProducto ?? 0)?.precioVenta ?? 0) * (linea.cantidad ?? 0),
        0,
      ),
    ),
  );

  ngOnInit(): void {
    this.listas.tiposDocumento().subscribe((tipos) => this.tipos.set(tipos));
    this.listas.mediosPago().subscribe((medios) => {
      this.medios.set(medios);
      this.proponerEfectivo();
    });
    if (this.conCategorias()) {
      this.listas.categoriasProducto().subscribe((categorias) => this.categorias.set(categorias));
    }
    if (this.conEspecialistas()) {
      this.citas
        .listarFiltros()
        .subscribe((filtros) => this.especialistas.set(filtros.especialistas ?? []));
    }
  }

  protected buscar(): void {
    const { nombre, marca, idCategoria } = this.busqueda.getRawValue();
    this.servicio
      .buscarProductos({ nombre: nombre.trim(), marca: marca.trim(), idCategoria })
      .subscribe((productos) => this.productos.set(productos));
  }

  /** «PRD-001 · Loreal · Cuidado del cabello». */
  protected detalleProducto(producto: ProductoStockDTO): string {
    const categoria = this.categorias().find((c) => c.idCategoria === producto.idCategoria);
    return [producto.codigo, producto.marca, categoria?.nombre].filter(Boolean).join(' · ');
  }

  protected nombreEspecialista(especialista: Especialista): string {
    return nombreCompleto(especialista);
  }

  protected producto(idProducto: number | null | undefined): ProductoStockDTO | undefined {
    return this.enCarrito.get(idProducto ?? 0);
  }

  /** Con stock cero no se vende (RN15); si ya está, suma una unidad. */
  protected agregar(producto: ProductoStockDTO): void {
    const id = producto.idProducto;
    if (id === undefined || !producto.stockActual) {
      return;
    }
    const existente = this.lineas.controls.find((l) => l.controls.idProducto.value === id);
    if (existente) {
      this.cambiarCantidad(this.lineas.controls.indexOf(existente), 1);
      return;
    }
    this.enCarrito.set(id, producto);
    this.lineas.push(crearLinea(this.fb, id));
  }

  protected cambiarCantidad(indice: number, cambio: number): void {
    const linea = this.lineas.at(indice);
    const stock = this.producto(linea.controls.idProducto.value)?.stockActual ?? 0;
    const cantidad = (linea.controls.cantidad.value ?? 0) + cambio;
    if (cantidad < 1) {
      this.quitar(indice);
      return;
    }
    linea.controls.cantidad.setValue(Math.min(cantidad, stock));
  }

  protected quitar(indice: number): void {
    this.enCarrito.delete(this.lineas.at(indice).controls.idProducto.value ?? 0);
    this.lineas.removeAt(indice);
  }

  protected subtotal(indice: number): number {
    const linea = this.lineas.at(indice).getRawValue();
    return redondear((this.producto(linea.idProducto)?.precioVenta ?? 0) * (linea.cantidad ?? 0));
  }

  protected esDigital(): boolean {
    return canalPropuesto(this.medio(this.cobro.controls.idMedioPago.value)) !== null;
  }

  protected elegirClienta(registrada: boolean): void {
    this.registrada.set(registrada);
    this.clienta.set(null);
  }

  protected elegirMedio(id: number | undefined): void {
    this.cobro.patchValue({ idMedioPago: id ?? null, canal: canalPropuesto(this.medio(id)) });
  }

  protected vender(): void {
    if (this.lineas.length === 0) {
      this.error.set('Agrega al menos un producto al carrito.');
      return;
    }
    if (this.registrada() && !this.clienta()) {
      this.error.set('Elige a la clienta o vende como cliente de paso.');
      return;
    }
    const { idMedioPago, canal } = this.cobro.getRawValue();
    if (!idMedioPago) {
      this.error.set('Elige el medio de pago.');
      return;
    }
    const cierre = leerComprador(this.comprador, this.tipos());
    if (typeof cierre === 'string') {
      this.error.set(cierre);
      return;
    }
    const clienta = this.clienta();
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .venderProductos({
        ...cierre,
        ...(this.registrada() && clienta ? { idCliente: clienta.idCliente } : {}),
        lineas: this.lineas.getRawValue().map((linea) => ({
          idProducto: linea.idProducto!,
          cantidad: linea.cantidad!,
          ...(linea.idPersonal ? { idPersonal: linea.idPersonal } : {}),
        })),
        idMedioPago,
        monto: this.total(),
        ...(canal ? { canal } : {}),
      })
      .subscribe({
        next: (venta) => {
          this.enviando.set(false);
          if (venta.estado === 'ABIERTA') {
            // 202: el cobro digital espera a la pasarela; la venta se cierra en IGU_Cobro (RN52).
            this.notificaciones.mostrar(
              'El pago digital espera la aprobación de Izipay: la venta quedó abierta en Cobros.',
            );
            void this.router.navigate(['/ventas/cobros'], {
              queryParams: { idVenta: venta.idVenta },
            });
            return;
          }
          this.venta.set(venta);
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          // El 409 de stock (RN15) y los 422 los avisa el interceptor; el stock se queda a la vista.
          if (leerProblema(error)?.regla === 'RN15') {
            this.error.set(mensajeDelProblema(error, 'No hay stock suficiente en la sede.'));
          } else if (error.status === 400 || error.status === 404) {
            this.error.set(mensajeDelProblema(error, 'Revisa el carrito.'));
          }
        },
      });
  }

  protected nueva(): void {
    this.venta.set(null);
    this.lineas.clear();
    this.enCarrito.clear();
    this.productos.set(null);
    this.clienta.set(null);
    this.registrada.set(false);
    this.comprador.reset();
    this.proponerEfectivo();
  }

  /** Se propone el efectivo: el primer medio activo que no pasa por la pasarela. */
  private proponerEfectivo(): void {
    const activos = this.activos();
    const efectivo = activos.find((m) => !m.usaPasarela) ?? activos[0];
    this.elegirMedio(efectivo?.idMedioPago);
  }

  private medio(id: number | null | undefined): MedioPagoDTO | undefined {
    return this.medios().find((m) => m.idMedioPago === id);
  }
}

function crearLinea(fb: NonNullableFormBuilder, idProducto: number) {
  return fb.group({
    idProducto: [idProducto as number | null],
    cantidad: [1 as number | null, [Validators.required, Validators.min(1)]],
    idPersonal: [null as number | null],
  });
}

type LineaCarrito = ReturnType<typeof crearLinea>;

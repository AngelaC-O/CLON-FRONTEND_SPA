import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ListasService } from '../../../core/api/listas.service';
import { soles } from '../../../core/api/moneda';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { CategoriaProductoDTO, MovimientoDTO, ProductoDTO } from '../../modelos/inventario.modelos';
import { enMinimo, margenTexto } from '../../modelos/inventario.vista';
import { ProductosService } from '../../servicios/productos.service';
import { CategoriasProducto } from './categorias-producto';
import { ConsumosPendientes } from './consumos-pendientes';
import { MovimientoInventario } from './movimiento-inventario';
import { RegistroProducto } from './registro-producto';

type Pestana = 'productos' | 'categorias' | 'salida' | 'ajuste' | 'consumos';

/**
 * IGU_Inventario, nodo 4:149 «12 · Productos e insumos»: CUS32 (productos), CUS66 (categorías),
 * CUS33 (salida de insumos y consumos pendientes) y CUS34 (ajuste por conteo), con la alerta de
 * stock mínimo (RF47). Productos y categorías piden PRODUCTOS:VER; los movimientos, KARDEX:CREAR;
 * los consumos pendientes, KARDEX:VER. El costo y el margen solo se muestran si vienen (RN24).
 */
@Component({
  selector: 'app-inventario',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CategoriasProducto,
    ConsumosPendientes,
    MovimientoInventario,
    RegistroProducto,
  ],
  templateUrl: './inventario.html',
})
export class Inventario implements OnInit {
  private readonly servicio = inject(ProductosService);
  private readonly listas = inject(ListasService);
  private readonly sesion = inject(SesionService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly soles = soles;
  protected readonly margenTexto = margenTexto;
  protected readonly enMinimo = enMinimo;

  protected readonly verProductos = computed(() => this.sesion.tienePermiso(PERMISOS.productosVer));
  protected readonly crearProductos = computed(() =>
    this.sesion.tienePermiso(PERMISOS.productosCrear),
  );
  protected readonly verKardex = computed(() => this.sesion.tienePermiso(PERMISOS.kardexVer));
  /** Elegir el producto de un movimiento pide la lista: PRODUCTOS:VER además de KARDEX:CREAR. */
  protected readonly moverStock = computed(
    () => this.sesion.tienePermiso(PERMISOS.kardexCrear) && this.verProductos(),
  );
  protected readonly resolverConsumos = computed(() =>
    this.sesion.tienePermiso(PERMISOS.kardexCrear),
  );

  protected readonly productos = signal<ProductoDTO[]>([]);
  protected readonly categorias = signal<CategoriaProductoDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly registroAbierto = signal(false);
  protected readonly pendientes = signal<number | null>(null);
  protected readonly pestana = signal<Pestana>('productos');

  protected readonly pestanas = computed(() => {
    const lista: { id: Pestana; texto: string }[] = [];
    if (this.verProductos()) {
      lista.push(
        { id: 'productos', texto: 'Productos' },
        { id: 'categorias', texto: 'Categorías' },
      );
    }
    if (this.moverStock()) {
      lista.push(
        { id: 'salida', texto: 'Salida de insumos' },
        { id: 'ajuste', texto: 'Ajuste por conteo' },
      );
    }
    if (this.verKardex()) {
      lista.push({ id: 'consumos', texto: 'Consumos pendientes' });
    }
    return lista;
  });
  /** RN24: el costo y el margen solo vienen para la Administradora. */
  protected readonly conCosto = computed(() =>
    this.productos().some((p) => p.costo !== undefined && p.costo !== null),
  );
  protected readonly conMargen = computed(() =>
    this.productos().some((p) => p.margen !== undefined && p.margen !== null),
  );
  /** Alerta de stock mínimo (RF47). */
  protected readonly bajoMinimo = computed(() => this.productos().filter(enMinimo));
  protected readonly porCategoria = computed(() => {
    const cuenta: Record<number, number> = {};
    for (const producto of this.productos()) {
      const id = producto.idCategoria ?? 0;
      cuenta[id] = (cuenta[id] ?? 0) + 1;
    }
    return cuenta;
  });

  protected readonly filtro = inject(FormBuilder).nonNullable.group({
    nombre: [''],
    idCategoria: [null as number | null],
  });

  ngOnInit(): void {
    if (!this.verProductos()) {
      this.pestana.set('consumos');
      return;
    }
    this.listas.categoriasProducto().subscribe((categorias) => this.categorias.set(categorias));
    this.buscar();
  }

  protected buscar(): void {
    const { nombre, idCategoria } = this.filtro.getRawValue();
    this.cargando.set(true);
    this.servicio.listar({ nombre: nombre.trim(), idCategoria }).subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** «Consumos pendientes (3)». */
  protected textoPestana(opcion: { id: Pestana; texto: string }): string {
    const cantidad = this.pendientes();
    return opcion.id === 'consumos' && cantidad ? `${opcion.texto} (${cantidad})` : opcion.texto;
  }

  protected categoria(idCategoria?: number): string {
    return this.categorias().find((c) => c.idCategoria === idCategoria)?.nombre ?? '';
  }

  protected nombresBajoMinimo(): string {
    return this.bajoMinimo()
      .map((p) =>
        `${p.nombre} (${p.stockActual ?? 0} de ${p.stockMinimo} ${p.unidad ?? ''})`.trim(),
      )
      .join(', ');
  }

  protected productoRegistrado(producto: ProductoDTO): void {
    this.registroAbierto.set(false);
    this.productos.update((lista) => [producto, ...lista]);
    this.notificaciones.mostrar(`${producto.nombre} registrado con stock 0.`);
  }

  protected categoriaCreada(categoria: CategoriaProductoDTO): void {
    this.categorias.update((lista) =>
      [...lista, categoria].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')),
    );
    this.notificaciones.mostrar(`Categoría ${categoria.nombre} registrada.`);
  }

  /** El movimiento trae el saldo: se actualiza el stock sin volver a pedir la lista. */
  protected movimientoRegistrado(evento: {
    producto: ProductoDTO;
    movimiento: MovimientoDTO;
  }): void {
    const { producto, movimiento } = evento;
    this.productos.update((lista) =>
      lista.map((p) =>
        p.idProducto === producto.idProducto ? { ...p, stockActual: movimiento.saldo } : p,
      ),
    );
    this.notificaciones.mostrar(
      movimiento.tipo === 'AJUSTE' ? 'Ajuste registrado.' : 'Salida de insumo registrada.',
    );
  }

  /** Una regularización saca stock: se vuelve a leer la lista. */
  protected consumoRegularizado(): void {
    if (this.verProductos()) {
      this.buscar();
    }
  }
}

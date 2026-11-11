import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { ProductoDTO } from '../../modelos/inventario.modelos';
import { Inventario } from './inventario';

const CATEGORIAS = [
  { idCategoria: 1, nombre: 'Cuidado Capilar' },
  { idCategoria: 4, nombre: 'Insumos de cabina' },
];
const SHAMPOO: ProductoDTO = {
  idProducto: 1,
  codigo: 'CAP-001',
  nombre: 'Champú Post-Alisado',
  marca: 'Marca',
  idCategoria: 1,
  tipoUso: 'VENTA',
  estado: 'ACTIVO',
  precioVenta: 65,
  stockActual: 8,
  stockMinimo: 5,
  ubicacion: 'Vitrina 1',
  unidad: 'UND',
};
const KERATINA: ProductoDTO = {
  idProducto: 40,
  codigo: 'INS-007',
  nombre: 'Keratina',
  idCategoria: 4,
  tipoUso: 'INSUMO',
  estado: 'ACTIVO',
  precioVenta: 0.75,
  stockActual: 90,
  stockMinimo: 100,
  ubicacion: 'Estante A',
  unidad: 'ML',
};
const ENCARGADA = ['PRODUCTOS:VER', 'PRODUCTOS:CREAR', 'KARDEX:VER', 'KARDEX:CREAR'];

describe('Inventario (IGU_Inventario)', () => {
  let fixture: ComponentFixture<Inventario>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const pestanas = () =>
    [...raiz.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
  const pestana = async (texto: string) => {
    [...raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((t) => t.textContent?.includes(texto))!
      .click();
    await estable();
  };
  const encabezados = () =>
    [...raiz.querySelectorAll('thead th')].map((t) => t.textContent?.trim());

  const montar = async (permisos: string[], productos: ProductoDTO[] = [SHAMPOO, KERATINA]) => {
    TestBed.configureTestingModule({
      imports: [Inventario],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Inventario);
    await estable();
    raiz = fixture.nativeElement;
    if (permisos.includes('PRODUCTOS:VER')) {
      http.expectOne('/api/v1/categorias-producto').flush(CATEGORIAS);
      http.expectOne('/api/v1/productos').flush(productos);
    }
    if (permisos.includes('KARDEX:VER')) {
      http
        .expectOne('/api/v1/consumos-pendientes')
        .flush([{ idConsumo: 12, producto: 'Keratina', cantidadPendiente: 20, idAtencion: 1532 }]);
    }
    await estable();
  };

  afterEach(() => http.verify());

  it('lista productos e insumos con su stock, ubicación y categoría', async () => {
    await montar(ENCARGADA);
    const filas = raiz.querySelectorAll('#tablaProductos tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('CAP-001');
    expect(filas[0].textContent).toContain('Cuidado Capilar');
    expect(filas[0].textContent).toContain('Vitrina 1');
    expect(filas[1].textContent).toContain('Insumo');
    expect(filas[1].querySelector('a')?.getAttribute('href')).toBe(
      '/inventario/kardex?idProducto=40',
    );
    expect(pestanas()).toEqual([
      'Productos',
      'Categorías',
      'Salida de insumos',
      'Ajuste por conteo',
      'Consumos pendientes (1)',
    ]);
  });

  it('RF47: avisa los productos en stock mínimo o por debajo', async () => {
    await montar(ENCARGADA);
    const alerta = raiz.querySelector('#alertaMinimo')!;
    expect(alerta.textContent).toContain('1 en stock mínimo o menos');
    expect(alerta.textContent).toContain('Keratina (90 de 100 ML)');
    expect(alerta.textContent).not.toContain('Champú');
  });

  it('RN24: costo y margen solo se muestran si vienen en la respuesta', async () => {
    await montar(ENCARGADA);
    expect(encabezados()).not.toContain('Costo');
    expect(encabezados()).not.toContain('Margen');
  });

  it('RN24: a la Administradora le llegan costo y margen y se muestran', async () => {
    await montar(ENCARGADA, [{ ...SHAMPOO, costo: 43.33, margen: 0.5 }]);
    expect(encabezados()).toContain('Costo');
    expect(encabezados()).toContain('Margen');
    expect(raiz.querySelector('#tablaProductos tbody tr')?.textContent).toContain('50 %');
  });

  it('filtra por nombre y categoría', async () => {
    await montar(ENCARGADA);
    const nombre = raiz.querySelector<HTMLInputElement>('#filtroNombre')!;
    nombre.value = 'Kera';
    nombre.dispatchEvent(new Event('input'));
    const categoria = raiz.querySelector<HTMLSelectElement>('#filtroCategoria')!;
    categoria.selectedIndex = 2;
    categoria.dispatchEvent(new Event('change'));
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectOne('/api/v1/productos?nombre=Kera&idCategoria=4').flush([KERATINA]);
    await estable();
    expect(raiz.querySelectorAll('#tablaProductos tbody tr')).toHaveLength(1);
  });

  it('CUS66: «Guardar categoría» la agrega a la lista', async () => {
    await montar(ENCARGADA);
    await pestana('Categorías');
    expect(raiz.querySelector('app-categorias-producto')?.textContent).toContain('1 producto(s)');
    const entrada = raiz.querySelector<HTMLInputElement>('#nuevaCategoria')!;
    entrada.value = 'cuidado capilar';
    entrada.dispatchEvent(new Event('input'));
    raiz.querySelector('app-categorias-producto form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectNone('/api/v1/categorias-producto');
    expect(raiz.querySelector('app-categorias-producto .alert.bad')?.textContent).toContain(
      'Ya existe',
    );

    entrada.value = 'Accesorios';
    entrada.dispatchEvent(new Event('input'));
    raiz.querySelector('app-categorias-producto form')!.dispatchEvent(new Event('submit'));
    await estable();
    const peticion = http.expectOne('/api/v1/categorias-producto');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ nombre: 'Accesorios' });
    peticion.flush({ idCategoria: 5, nombre: 'Accesorios' });
    await estable();
    expect(raiz.querySelector('app-categorias-producto')?.textContent).toContain('Accesorios');
  });

  it('la salida de insumos solo ofrece insumos (RN13)', async () => {
    await montar(ENCARGADA);
    await pestana('Salida de insumos');
    const opciones = [...raiz.querySelectorAll('#salidaProducto option')].map((o) =>
      o.textContent?.trim(),
    );
    // La salida manual es de insumos: el champú no se ofrece.
    expect(opciones).toEqual(['Elige', 'INS-007 · Keratina · stock 90 ML']);
  });

  it('solo con KARDEX:VER ve los consumos pendientes', async () => {
    await montar(['KARDEX:VER']);
    expect(pestanas()).toEqual(['Consumos pendientes (1)']);
    expect(raiz.querySelector('app-consumos-pendientes')?.textContent).toContain('Keratina');
    expect(raiz.textContent).not.toContain('Regularizar');
    expect(raiz.textContent).not.toContain('+ Producto');
  });

  it('sin PRODUCTOS:CREAR no ofrece registrar productos ni categorías', async () => {
    await montar(['PRODUCTOS:VER']);
    expect(raiz.textContent).not.toContain('+ Producto');
    expect(pestanas()).toEqual(['Productos', 'Categorías']);
    await pestana('Categorías');
    expect(raiz.querySelector('#nuevaCategoria')).toBeNull();
  });
});

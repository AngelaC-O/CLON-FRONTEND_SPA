import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { MedioPagoDTO, TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { entrarComo } from '../../../../testing/sesion';
import { ProductoStockDTO } from '../../modelos/ventas.modelos';
import { VentaProductos } from './venta-productos';

const MEDIOS: MedioPagoDTO[] = [
  { idMedioPago: 11, nombre: 'EFECTIVO', estado: 'ACTIVO', usaPasarela: false },
  { idMedioPago: 12, nombre: 'YAPE', estado: 'ACTIVO', usaPasarela: true },
];
const TIPOS: TipoDocumentoDTO[] = [
  { idTipoDocumento: 1, abreviatura: 'DNI', longitudMin: 8, longitudMax: 8, soloNumeros: true },
];
const PRODUCTOS: ProductoStockDTO[] = [
  {
    idProducto: 40,
    codigo: 'PRD-001',
    nombre: 'Shampoo reparador',
    marca: 'Loreal',
    idCategoria: 2,
    precioVenta: 45,
    stockActual: 2,
    unidad: 'UND',
  },
  {
    idProducto: 41,
    codigo: 'PRD-002',
    nombre: 'Acondicionador',
    marca: 'Loreal',
    idCategoria: 2,
    precioVenta: 38,
    stockActual: 0,
    unidad: 'UND',
  },
];
const CERRADA = {
  idVenta: 620,
  estado: 'CERRADA',
  total: 90,
  comprobante: {
    idComprobante: 700,
    tipo: 'BOLETA',
    serie: 'B001',
    numero: '00000125',
    estadoSunat: 'ACEPTADO',
  },
};
const TODOS = [
  'VENTAS:CREAR',
  'VENTAS:VER',
  'VENTAS:ANULAR',
  'PRODUCTOS:VER',
  'AGENDA:VER',
  'CLIENTAS:VER',
];

describe('VentaProductos (CUS25 y CUS26)', () => {
  let fixture: ComponentFixture<VentaProductos>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);
  const clic = async (texto: string) => {
    boton(texto)!.click();
    await estable();
  };
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const elegir = async (id: string, texto: string) => {
    const lista = raiz.querySelector<HTMLSelectElement>(`#${id}`)!;
    lista.selectedIndex = [...lista.options].findIndex((o) => o.textContent?.includes(texto));
    lista.dispatchEvent(new Event('change'));
    await estable();
  };
  const buscar = async (url = '/api/v1/ventas/productos') => {
    raiz.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectOne(url).flush(PRODUCTOS);
    await estable();
  };
  const agregar = async (nombre: string) => {
    raiz.querySelector<HTMLButtonElement>(`button[aria-label="Agregar ${nombre}"]`)!.click();
    await estable();
  };
  const vender = async () => {
    raiz.querySelectorAll<HTMLFormElement>('form')[1].dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos = TODOS) => {
    TestBed.configureTestingModule({
      imports: [VentaProductos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(VentaProductos);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/tipos-documento').flush(TIPOS);
    http.expectOne('/api/v1/medios-pago').flush(MEDIOS);
    if (permisos.includes('PRODUCTOS:VER')) {
      http
        .expectOne('/api/v1/categorias-producto')
        .flush([{ idCategoria: 2, nombre: 'Cuidado del cabello' }]);
    }
    if (permisos.includes('AGENDA:VER')) {
      http.expectOne('/api/v1/citas/filtros').flush({
        especialistas: [{ idPersonal: 4, nombres: 'Lucía', apellidos: 'Ramos' }],
        recursos: [],
      });
    }
    await estable();
  };

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('CUS25: busca por nombre, marca y categoría, con el stock de la sede', async () => {
    await montar();
    escribir('productoNombre', 'Shampoo');
    escribir('productoMarca', 'Loreal');
    await elegir('productoCategoria', 'Cuidado del cabello');
    await buscar('/api/v1/ventas/productos?nombre=Shampoo&marca=Loreal&idCategoria=2');
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('PRD-001 · Loreal · Cuidado del cabello');
    expect(filas[0].textContent).toContain('S/ 45.00');
    expect(filas[0].textContent).toContain('2 UND');
    // Con stock cero no se vende (RN15).
    expect(filas[1].textContent).toContain('Sin stock');
    expect(
      raiz.querySelector<HTMLButtonElement>('button[aria-label="Agregar Acondicionador"]')
        ?.disabled,
    ).toBe(true);
  });

  it('CUS26: carrito con la especialista que recomendó, sin pasar el stock', async () => {
    await montar();
    expect(boton('Vender')?.disabled).toBe(true);
    await buscar();
    await agregar('Shampoo reparador');
    await agregar('Shampoo reparador');
    expect(raiz.querySelector('#cantidad0')?.textContent).toBe('2');
    expect(
      raiz.querySelector<HTMLButtonElement>(
        'button[aria-label="Sumar una unidad de Shampoo reparador"]',
      )?.disabled,
    ).toBe(true);
    expect(raiz.querySelector('#totalVenta')?.textContent).toBe('S/ 90.00');
    await elegir('recomendo0', 'Lucía Ramos');
    await vender();
    const peticion = http.expectOne('/api/v1/ventas/productos');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      tipo: 'BOLETA',
      lineas: [{ idProducto: 40, cantidad: 2, idPersonal: 4 }],
      idMedioPago: 11,
      monto: 90,
    });
    peticion.flush(CERRADA, { status: 201, statusText: 'Created' });
    await estable();
    const comprobante = raiz.querySelector('app-comprobante-emitido')!;
    expect(comprobante.textContent).toContain('Boleta B001-00000125');
    // Desde la venta CERRADA se pide la anulación (CUS22).
    expect(comprobante.querySelector('a[href="/ventas/anulaciones?idVenta=620"]')).not.toBeNull();
  });

  it('CUS26: quitar la última unidad saca el producto del carrito', async () => {
    await montar();
    await buscar();
    await agregar('Shampoo reparador');
    raiz
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Quitar una unidad de Shampoo reparador"]',
      )!
      .click();
    await estable();
    expect(raiz.textContent).toContain('Agrega productos para comenzar.');
    expect(raiz.querySelector('#totalVenta')?.textContent).toBe('S/ 0.00');
  });

  it('RN52: un pago digital pendiente deja la venta abierta y lleva a Cobros', async () => {
    await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await buscar();
    await agregar('Shampoo reparador');
    await clic('Yape');
    await vender();
    const peticion = http.expectOne('/api/v1/ventas/productos');
    expect(peticion.request.body).toMatchObject({ idMedioPago: 12, canal: 'QR', monto: 45 });
    peticion.flush(
      { idVenta: 621, estado: 'ABIERTA', total: 45, pendiente: 45 },
      { status: 202, statusText: 'Accepted' },
    );
    await estable();
    expect(navegar).toHaveBeenCalledWith(['/ventas/cobros'], { queryParams: { idVenta: 621 } });
  });

  it('RN15: el 409 de stock queda junto al carrito', async () => {
    await montar();
    await buscar();
    await agregar('Shampoo reparador');
    await vender();
    http
      .expectOne('/api/v1/ventas/productos')
      .flush(
        { detail: 'No hay stock suficiente en la sede', regla: 'RN15' },
        { status: 409, statusText: 'Conflict' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('No hay stock suficiente');
  });

  it('sin PRODUCTOS:VER ni AGENDA:VER busca sin categoría y pide el código', async () => {
    await montar(['VENTAS:CREAR', 'VENTAS:VER']);
    expect(raiz.querySelector('#productoCategoria')).toBeNull();
    await buscar();
    await agregar('Shampoo reparador');
    expect(raiz.querySelector('input#recomendo0')).not.toBeNull();
  });
});

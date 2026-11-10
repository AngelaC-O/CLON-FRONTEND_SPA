import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductoDTO } from '../../modelos/inventario.modelos';
import { RegistroProducto } from './registro-producto';

describe('RegistroProducto (CUS32)', () => {
  let fixture: ComponentFixture<RegistroProducto>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const escribir = async (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    await estable();
  };
  const elegir = async (id: string, indice: number) => {
    const lista = raiz.querySelector<HTMLSelectElement>(`#${id}`)!;
    lista.selectedIndex = indice;
    lista.dispatchEvent(new Event('change'));
    await estable();
  };
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)!;
  const enviar = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };
  const llenarComun = async () => {
    await escribir('productoCodigo', 'INS-007');
    await escribir('productoNombreNuevo', 'Keratina');
    await elegir('productoIdCategoria', 2);
    await escribir('productoStockMinimo', '100');
    await escribir('productoUbicacion', 'Estante A');
    await escribir('productoCosto', '0.5');
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RegistroProducto],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RegistroProducto);
    fixture.componentRef.setInput('categorias', [
      { idCategoria: 1, nombre: 'Cuidado Capilar' },
      { idCategoria: 4, nombre: 'Insumos de cabina' },
    ]);
    await estable();
    raiz = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('RN54: un insumo elige su unidad mínima entre ml, g y unidad', async () => {
    expect(raiz.querySelector('input#productoUnidad')).not.toBeNull();
    boton('Insumo').click();
    await estable();
    const unidades = [...raiz.querySelectorAll('select#productoUnidad option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(unidades).toEqual(['Mililitro (ml)', 'Gramo (g)', 'Unidad']);
  });

  it('RF87: con margen muestra el precio sugerido y lo envía como fracción', async () => {
    let registrado: ProductoDTO | undefined;
    fixture.componentInstance.registrado.subscribe((p) => (registrado = p));
    boton('Insumo').click();
    await estable();
    await llenarComun();
    await elegir('productoUnidad', 0);
    expect(raiz.querySelector('#precioSugerido')?.textContent).toContain('margen vigente');
    await escribir('productoMargen', '50');
    expect(raiz.querySelector('#precioSugerido')?.textContent).toContain('S/ 0.75');
    await enviar();
    const peticion = http.expectOne('/api/v1/productos');
    expect(peticion.request.body).toEqual({
      tipoUso: 'INSUMO',
      codigo: 'INS-007',
      nombre: 'Keratina',
      idCategoria: 4,
      unidad: 'ML',
      stockMinimo: 100,
      ubicacion: 'Estante A',
      costo: 0.5,
      margen: 0.5,
      esPremium: false,
    });
    peticion.flush({ idProducto: 40, nombre: 'Keratina', stockActual: 0, precioVenta: 0.75 });
    await estable();
    expect(registrado?.idProducto).toBe(40);
  });

  it('sin margen no lo envía: el back-end usa el del negocio', async () => {
    await llenarComun();
    await enviar();
    const peticion = http.expectOne('/api/v1/productos');
    expect(peticion.request.body.margen).toBeUndefined();
    expect(peticion.request.body.unidad).toBe('UND');
    peticion.flush({ idProducto: 41 });
  });

  it('exige los datos obligatorios y muestra el 409 del código repetido', async () => {
    await enviar();
    http.expectNone('/api/v1/productos');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('Completa');
    await llenarComun();
    await enviar();
    http
      .expectOne('/api/v1/productos')
      .flush(
        { detail: 'Ya existe un producto con ese código', regla: 'UQ_PRODUCTO_CODIGO' },
        { status: 409, statusText: 'Conflict' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('Ya existe un producto');
  });
});

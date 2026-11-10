import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductoDTO } from '../../modelos/inventario.modelos';
import { MovimientoInventario, TipoMovimiento } from './movimiento-inventario';

const PRODUCTOS: ProductoDTO[] = [
  {
    idProducto: 40,
    codigo: 'INS-007',
    nombre: 'Keratina',
    tipoUso: 'INSUMO',
    estado: 'ACTIVO',
    stockActual: 5,
    stockMinimo: 2,
    unidad: 'ML',
  },
  {
    idProducto: 1,
    codigo: 'CAP-001',
    nombre: 'Champú',
    tipoUso: 'VENTA',
    estado: 'ACTIVO',
    stockActual: 8,
    stockMinimo: 5,
    unidad: 'UND',
  },
];

describe('MovimientoInventario (CUS33 y CUS34)', () => {
  let fixture: ComponentFixture<MovimientoInventario>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const escribir = async (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    await estable();
  };
  const elegir = async (id: string, texto: string) => {
    const lista = raiz.querySelector<HTMLSelectElement>(`#${id}`)!;
    lista.selectedIndex = [...lista.options].findIndex((o) => o.textContent?.includes(texto));
    lista.dispatchEvent(new Event('change'));
    await estable();
  };
  const enviar = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (tipo: TipoMovimiento) => {
    TestBed.configureTestingModule({
      imports: [MovimientoInventario],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MovimientoInventario);
    fixture.componentRef.setInput('tipo', tipo);
    fixture.componentRef.setInput('productos', PRODUCTOS);
    await estable();
    raiz = fixture.nativeElement;
  };

  afterEach(() => http.verify());

  it('CUS33: registra la salida con motivo y atención, y avisa el stock mínimo (RF47)', async () => {
    await montar('SALIDA');
    await elegir('salidaProducto', 'Keratina');
    await escribir('salidaCantidad', '4');
    await escribir('salidaIdAtencion', '1532');
    await escribir('salidaMotivo', 'Uso en cabina');
    expect(raiz.querySelector('#salidaDiferencia')?.textContent).toContain('5 → 1');
    await enviar();
    const peticion = http.expectOne('/api/v1/productos/40/salidas');
    expect(peticion.request.body).toEqual({
      cantidad: 4,
      motivo: 'Uso en cabina',
      idAtencion: 1532,
    });
    peticion.flush({ tipo: 'SALIDA', cantidad: 4, saldo: 1, estaEnMinimo: true });
    await estable();
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain(
      'Keratina quedó en 1 ML: en su stock mínimo',
    );
  });

  it('CUS33: la atención es opcional y no deja sacar más del stock (RN15)', async () => {
    await montar('SALIDA');
    await elegir('salidaProducto', 'Keratina');
    await escribir('salidaCantidad', '6');
    await escribir('salidaMotivo', 'Uso');
    await enviar();
    http.expectNone('/api/v1/productos/40/salidas');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('No hay stock suficiente');
    await escribir('salidaCantidad', '2');
    await enviar();
    const peticion = http.expectOne('/api/v1/productos/40/salidas');
    expect(peticion.request.body).toEqual({ cantidad: 2, motivo: 'Uso' });
    peticion.flush({ tipo: 'SALIDA', saldo: 3, estaEnMinimo: false });
  });

  it('CUS34: muestra la diferencia antes de guardar y envía lo contado', async () => {
    await montar('AJUSTE');
    await elegir('ajusteProducto', 'Champú');
    await escribir('ajusteCantidad', '6');
    expect(raiz.querySelector('#ajusteDiferencia')?.textContent).toContain('diferencia -2');
    await escribir('ajusteCantidad', '8');
    expect(raiz.querySelector('#ajusteDiferencia')?.textContent).toContain(
      'no hay nada que ajustar',
    );
    await escribir('ajusteMotivo', 'Conteo físico');
    await enviar();
    http.expectNone('/api/v1/productos/1/ajustes');
    await escribir('ajusteCantidad', '10');
    expect(raiz.querySelector('#ajusteDiferencia')?.textContent).toContain('diferencia +2');
    await enviar();
    const peticion = http.expectOne('/api/v1/productos/1/ajustes');
    expect(peticion.request.body).toEqual({ cantidad: 10, motivo: 'Conteo físico' });
    peticion.flush({ tipo: 'AJUSTE', cantidad: 2, saldo: 10, estaEnMinimo: false });
  });

  it('CUS34: sin motivo no guarda', async () => {
    await montar('AJUSTE');
    await elegir('ajusteProducto', 'Champú');
    await escribir('ajusteCantidad', '7');
    await enviar();
    http.expectNone('/api/v1/productos/1/ajustes');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('motivo');
  });
});

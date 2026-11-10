import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { MovimientoKardexDTO } from '../../modelos/inventario.modelos';
import { fechaIso } from '../../modelos/inventario.vista';
import { Kardex } from './kardex';

const MOVIMIENTOS: MovimientoKardexDTO[] = [
  {
    idMovimiento: 311,
    tipo: 'SALIDA',
    cantidad: -3,
    saldo: 7,
    fechaHora: '2026-11-09T11:05:00',
    idAtencion: 1532,
    motivo: 'Consumo estimado de la atención N° 1532',
    usuario: 'especialista1',
  },
  {
    idMovimiento: 312,
    tipo: 'AJUSTE',
    cantidad: 2,
    saldo: 9,
    fechaHora: '2026-11-09T18:00:00',
    motivo: 'Conteo físico',
    usuario: 'almacen1',
  },
  {
    idMovimiento: 313,
    tipo: 'SALIDA',
    cantidad: -1,
    saldo: 8,
    fechaHora: '2026-11-10T10:00:00',
    idDetalleVenta: 900,
    usuario: 'recepcion1',
  },
];
const DESDE = fechaIso(-30);
const HASTA = fechaIso();

describe('Kardex (CUS35)', () => {
  let fixture: ComponentFixture<Kardex>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const escribir = async (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    await estable();
  };
  const ver = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos: string[], idProducto?: number) => {
    TestBed.configureTestingModule({
      imports: [Kardex],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(
                idProducto ? { idProducto: String(idProducto) } : {},
              ),
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Kardex);
    await estable();
    raiz = fixture.nativeElement;
    if (permisos.includes('PRODUCTOS:VER')) {
      http.expectOne('/api/v1/productos').flush([
        {
          idProducto: 40,
          codigo: 'INS-007',
          nombre: 'Keratina',
          stockActual: 8,
          stockMinimo: 10,
          unidad: 'ML',
        },
      ]);
    }
    await estable();
  };

  afterEach(() => http.verify());

  it('llega con el producto y muestra tipo, cantidad, saldo, fecha, origen y usuario', async () => {
    await montar(['KARDEX:VER', 'PRODUCTOS:VER'], 40);
    http
      .expectOne(`/api/v1/productos/40/kardex?fechaInicio=${DESDE}&fechaFin=${HASTA}`)
      .flush(MOVIMIENTOS);
    await estable();
    const filas = [...raiz.querySelectorAll('tbody tr')].map((f) =>
      f.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(filas[0]).toContain('09/11/2026 11:05');
    expect(filas[0]).toContain('Salida');
    // Las salidas automáticas muestran la atención que las originó.
    expect(filas[0]).toContain('Atención N° 1532');
    expect(filas[0]).toContain('-3');
    expect(filas[0]).toContain('especialista1');
    expect(filas[1]).toContain('Ajuste');
    expect(filas[1]).toContain('+2');
    expect(filas[1]).toContain('Manual');
    expect(filas[2]).toContain('Venta (línea 900)');
    expect(raiz.querySelector('#resumenProducto')?.textContent).toContain('En stock mínimo');
  });

  it('filtra por fechas y no consulta si el inicio es posterior al fin', async () => {
    await montar(['KARDEX:VER', 'PRODUCTOS:VER']);
    const producto = raiz.querySelector<HTMLSelectElement>('#kardexProducto')!;
    producto.selectedIndex = 1;
    producto.dispatchEvent(new Event('change'));
    await escribir('kardexInicio', '2026-11-10');
    await escribir('kardexFin', '2026-11-01');
    await ver();
    http.expectNone((req) => req.url.includes('/kardex'));
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('posterior');

    await escribir('kardexInicio', '2026-11-01');
    await escribir('kardexFin', '2026-11-09');
    await ver();
    http
      .expectOne('/api/v1/productos/40/kardex?fechaInicio=2026-11-01&fechaFin=2026-11-09')
      .flush([]);
    await estable();
    expect(raiz.textContent).toContain('No hay movimientos entre esas fechas.');
  });

  it('solo con KARDEX:VER escribe el código del producto', async () => {
    await montar(['KARDEX:VER']);
    expect(raiz.querySelector('input#kardexProducto')).not.toBeNull();
    await escribir('kardexProducto', '99');
    await ver();
    http
      .expectOne(`/api/v1/productos/99/kardex?fechaInicio=${DESDE}&fechaFin=${HASTA}`)
      .flush(
        { detail: 'El producto no existe', regla: 'RF44' },
        { status: 404, statusText: 'Not Found' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('El producto no existe');
  });
});

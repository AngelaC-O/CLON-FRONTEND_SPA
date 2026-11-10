import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { SeriesComprobante } from './series-comprobante';

describe('SeriesComprobante (CUS63)', () => {
  let fixture: ComponentFixture<SeriesComprobante>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const escribir = (valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>('#serieCodigo')!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const elegirTipo = (valor: string) => {
    const lista = raiz.querySelector<HTMLSelectElement>('#serieTipo')!;
    lista.value = valor;
    lista.dispatchEvent(new Event('change'));
  };
  const enviar = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos: string[]) => {
    TestBed.configureTestingModule({
      imports: [SeriesComprobante],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 2, permisos });
    fixture = TestBed.createComponent(SeriesComprobante);
    await estable();
    raiz = fixture.nativeElement;
    http
      .expectOne('/api/v1/series-comprobante')
      .flush([{ idSerie: 1, serie: 'B001', tipo: 'BOLETA', ultimoNumero: 125, estado: 'ACTIVA' }]);
    await estable();
  };

  afterEach(() => http.verify());

  it('lista las series de la sede con su último número', async () => {
    await montar(['CATALOGO:VER']);
    const fila = raiz.querySelector('#tablaSeries tbody tr')!;
    expect(fila.textContent).toContain('B001');
    expect(fila.textContent).toContain('Boleta');
    expect(fila.textContent).toContain('125');
    expect(raiz.querySelector('form')).toBeNull();
  });

  it('una factura empieza con F y tiene 4 caracteres (RF107)', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:CREAR']);
    elegirTipo('FACTURA');
    escribir('B002');
    await enviar();
    http.expectNone({ method: 'POST', url: '/api/v1/series-comprobante' });
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('empieza con F');
  });

  it('«Guardar serie» la registra para la sede de la sesión', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:CREAR']);
    elegirTipo('NC_BOLETA');
    escribir('bc02');
    await enviar();
    const peticion = http.expectOne({ method: 'POST', url: '/api/v1/series-comprobante' });
    expect(peticion.request.body).toEqual({ tipo: 'NC_BOLETA', serie: 'BC02', idSede: 2 });
    peticion.flush({
      idSerie: 9,
      serie: 'BC02',
      tipo: 'NC_BOLETA',
      ultimoNumero: 0,
      estado: 'ACTIVA',
    });
    await estable();
    expect(raiz.querySelectorAll('#tablaSeries tbody tr')).toHaveLength(2);
  });

  it('muestra el 409 de una serie ACTIVA repetida', async () => {
    await montar(['CATALOGO:VER', 'CATALOGO:CREAR']);
    escribir('B003');
    await enviar();
    http
      .expectOne({ method: 'POST', url: '/api/v1/series-comprobante' })
      .flush(
        { detail: 'La sede ya tiene una serie ACTIVA de ese tipo', regla: 'UQ_SERIE_COMPR_ACTIVA' },
        { status: 409, statusText: 'Conflict' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('ya tiene una serie ACTIVA');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { entrarComo } from '../../../../testing/sesion';
import { ReporteDTO } from '../../modelos/reportes.modelos';
import { fechaIso, inicioDeMes } from '../../modelos/reportes.vista';
import { Reportes } from './reportes';

const VENTAS: ReporteDTO = {
  tipoReporte: 'ventas',
  titulo: 'Ventas',
  agrupacion: 'LINEA',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-30',
  idSede: 1,
  columnas: [
    { campo: 'grupo', titulo: 'Grupo' },
    { campo: 'cantidad', titulo: 'Ventas o unidades' },
    { campo: 'importe', titulo: 'Importe S/' },
  ],
  filas: [
    { grupo: 'SALON', cantidad: 42, importe: 1470 },
    { grupo: 'SPA', cantidad: 18, importe: 735 },
  ],
};
const DESDE = inicioDeMes();
const HASTA = fechaIso();

describe('Reportes (CUS48 y CUS49)', () => {
  let fixture: ComponentFixture<Reportes>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === texto,
    );
  const opciones = (id: string) =>
    [...raiz.querySelectorAll(`#${id} option`)].map((o) => o.textContent?.trim());
  const elegir = async (id: string, valor: string) => {
    const lista = raiz.querySelector<HTMLSelectElement>(`#${id}`)!;
    lista.value = valor;
    lista.dispatchEvent(new Event('change'));
    await estable();
  };
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const generar = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  const montar = async (permisos: string[], rol = 'ADMINISTRADORA') => {
    TestBed.configureTestingModule({
      imports: [Reportes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, rol, permisos });
    fixture = TestBed.createComponent(Reportes);
    await estable();
    raiz = fixture.nativeElement;
  };

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('la administradora ve los seis reportes; ventas se agrupa', async () => {
    await montar(['REPORTES:VER']);
    expect(opciones('reporteTipo')).toEqual([
      'Ventas',
      'Productos (rotación, stock y margen)',
      'Margen por servicio y línea',
      'Demanda y días pico',
      'Ocupación de recursos',
      'Ingresos por especialista',
    ]);
    expect(opciones('reporteAgrupacion')).toEqual([
      'Día',
      'Mes',
      'Línea',
      'Servicio',
      'Especialista',
      'Medio de pago',
      'Tipo de atención',
    ]);
    expect(opciones('reporteSede')).toEqual(['Sede 1 (la de la sesión)', 'Todas (consolidado)']);
  });

  it('RN24: sin ser administradora no se ofrecen productos ni margen', async () => {
    await montar(['REPORTES:VER'], 'RECEPCIONISTA');
    expect(opciones('reporteTipo')).toEqual([
      'Ventas',
      'Demanda y días pico',
      'Ocupación de recursos',
      'Ingresos por especialista',
    ]);
    expect(raiz.textContent).toContain('solo se muestran con el rol de Administradora');
  });

  it('«Generar» muestra la tabla y el gráfico con los datos de GET /reportes', async () => {
    await montar(['REPORTES:VER']);
    await elegir('reporteAgrupacion', 'MEDIO_PAGO');
    await generar();
    http
      .expectOne(
        `/api/v1/reportes/ventas?fechaInicio=${DESDE}&fechaFin=${HASTA}&agrupacion=MEDIO_PAGO&idSede=1`,
      )
      .flush(VENTAS);
    await estable();
    expect(raiz.querySelector('#tituloReporte')?.textContent).toBe('Ventas');
    const encabezados = [...raiz.querySelectorAll('#tablaReporte th')].map((t) =>
      t.textContent?.trim(),
    );
    expect(encabezados).toEqual(['Grupo', 'Ventas o unidades', 'Importe S/']);
    const fila = raiz.querySelector('#tablaReporte tbody tr')!.textContent;
    expect(fila).toContain('SALON');
    expect(fila).toContain('S/ 1,470.00');
    // El gráfico usa el importe: la barra mayor llena la pista y la otra va a la mitad.
    const rellenos = [...raiz.querySelectorAll<HTMLElement>('.grafico .relleno')];
    expect(rellenos.map((r) => r.style.width)).toEqual(['100%', '50%']);
    expect(raiz.querySelector('.grafico figcaption')?.textContent).toContain('Importe S/');
  });

  it('RF93: «Todas» pide el consolidado sin sede; otro tipo no lleva agrupación', async () => {
    await montar(['REPORTES:VER']);
    await elegir('reporteTipo', 'demanda');
    expect(raiz.querySelector('#reporteAgrupacion')).toBeNull();
    const sede = raiz.querySelector<HTMLSelectElement>('#reporteSede')!;
    sede.selectedIndex = 1;
    sede.dispatchEvent(new Event('change'));
    await generar();
    http
      .expectOne(`/api/v1/reportes/demanda?fechaInicio=${DESDE}&fechaFin=${HASTA}`)
      .flush({
        ...VENTAS,
        tipoReporte: 'demanda',
        titulo: 'Demanda',
        idSede: undefined,
        filas: [],
      });
    await estable();
    expect(raiz.textContent).toContain('Todas las sedes');
    expect(raiz.textContent).toContain('Sin datos en este periodo');
  });

  it('valida las fechas antes de pedir el reporte', async () => {
    await montar(['REPORTES:VER']);
    escribir('reporteInicio', '2026-11-10');
    escribir('reporteFin', '2026-11-01');
    await generar();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('posterior');
    escribir('reporteInicio', '2025-01-01');
    escribir('reporteFin', '2026-11-01');
    await generar();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('366 días');
    http.expectNone((req) => req.url.startsWith('/api/v1/reportes'));
  });

  it('el 422 del back-end queda a la vista', async () => {
    await montar(['REPORTES:VER']);
    await generar();
    http
      .expectOne((req) => req.url === '/api/v1/reportes/ventas')
      .flush(
        { detail: 'La agrupación no es de ese reporte', regla: 'RF68' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('La agrupación no es');
  });

  it('sin REPORTES:EXPORTAR no ofrece exportar', async () => {
    await montar(['REPORTES:VER']);
    await generar();
    http.expectOne((req) => req.url === '/api/v1/reportes/ventas').flush(VENTAS);
    await estable();
    expect(boton('Exportar a Excel')).toBeUndefined();
    expect(boton('Exportar a PDF')).toBeUndefined();
  });

  it('CUS49: «Exportar a Excel» y «Exportar a PDF» descargan lo generado', async () => {
    await montar(['REPORTES:VER', 'REPORTES:EXPORTAR']);
    await generar();
    http.expectOne((req) => req.url === '/api/v1/reportes/ventas').flush(VENTAS);
    await estable();
    URL.createObjectURL = vi.fn(() => 'blob:reporte');
    URL.revokeObjectURL = vi.fn();
    const descargas: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      descargas.push(this.download);
    });

    boton('Exportar a Excel')!.click();
    await estable();
    const excel = http.expectOne((req) => req.url === '/api/v1/reportes/ventas/exportacion');
    expect(excel.request.params.get('formato')).toBe('EXCEL');
    expect(excel.request.params.get('agrupacion')).toBe('LINEA');
    expect(excel.request.responseType).toBe('blob');
    excel.flush(new Blob(['xlsx']), {
      headers: {
        'Content-Disposition': 'attachment; filename="reporte_ventas_2026-11-01_2026-11-30.xlsx"',
      },
    });
    // La exportación termina en una promesa: se deja que se asiente antes del segundo clic.
    await new Promise((listo) => setTimeout(listo));
    await estable();

    boton('Exportar a PDF')!.click();
    await estable();
    const pdf = http.expectOne((req) => req.url === '/api/v1/reportes/ventas/exportacion');
    expect(pdf.request.params.get('formato')).toBe('PDF');
    pdf.flush(new Blob(['%PDF']));
    await new Promise((listo) => setTimeout(listo));
    await estable();

    expect(descargas).toEqual([
      'reporte_ventas_2026-11-01_2026-11-30.xlsx',
      `reporte_ventas_${DESDE}_${HASTA}.pdf`,
    ]);
  });
});

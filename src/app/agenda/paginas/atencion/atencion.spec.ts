import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { AtencionDTO } from '../../modelos/agenda.modelos';
import { MENSAJE_RN50 } from '../../modelos/agenda.vista';
import { Atencion } from './atencion';

const ATENCION: AtencionDTO = {
  idAtencion: 60,
  idCita: 950,
  idPersonal: 4,
  idRecurso: 1,
  idVariante: 2,
  tiempoDeclaradoMin: 45,
  estado: 'EN_CURSO',
  horaInicio: '2026-11-03T10:00:00',
};

describe('Atencion', () => {
  let fixture: ComponentFixture<Atencion>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const montar = async (idCita: number | null, permisos: string[] = []) => {
    TestBed.configureTestingModule({
      imports: [Atencion],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(idCita ? { idCita: String(idCita) } : {}),
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos: ['ATENCION:VER', ...permisos] });
    fixture = TestBed.createComponent(Atencion);
    await estable();
    raiz = fixture.nativeElement;
  };
  const retomar = async (atencion: AtencionDTO, permisos: string[] = []) => {
    await montar(950, permisos);
    http.expectOne('/api/v1/atenciones/en-curso?idCita=950').flush(atencion);
    await estable();
  };
  const finalizar = () =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes('Finalizar'))!;

  afterEach(() => http.verify());

  it('sin cita en curso en Mi agenda lleva a Mi agenda', async () => {
    await montar(null);
    http.expectOne('/api/v1/atenciones/mi-agenda').flush([{ idCita: 951, estado: 'PENDIENTE' }]);
    await estable();
    expect(raiz.textContent).toContain('No hay atención en curso');
    expect(raiz.querySelector('a[href="/agenda/mi-agenda"]')).not.toBeNull();
  });

  it('desde el menú retoma la cita EN_CURSO de Mi agenda (Duda 7)', async () => {
    await montar(null);
    http
      .expectOne('/api/v1/atenciones/mi-agenda')
      .flush([{ idCita: 950, estado: 'EN_ATENCION', estadoAtencion: 'EN_CURSO' }]);
    http.expectOne('/api/v1/atenciones/en-curso?idCita=950').flush(ATENCION);
    await estable();
    expect(raiz.textContent).toContain('Cita 950');
  });

  it('muestra el 404 de una cita sin atención en curso', async () => {
    await montar(950);
    http
      .expectOne('/api/v1/atenciones/en-curso?idCita=950')
      .flush(
        { detail: 'La cita no tiene una atención EN_CURSO' },
        { status: 404, statusText: 'Not Found' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('no tiene una atención');
  });

  it('muestra el cronómetro desde la hora de inicio', async () => {
    const hace90s = new Date(Date.now() - 90_000);
    const local = new Date(hace90s.getTime() - hace90s.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 19);
    await retomar({ ...ATENCION, horaInicio: local });
    expect(raiz.querySelector('.reloj')?.textContent).toMatch(/00:01:3\d/);
    expect(raiz.textContent).toContain('Duración declarada: 45 min');
    expect(raiz.textContent).not.toContain('Recomendar');
  });

  it('CUS11: finaliza con las observaciones y deja la atención lista para cobro', async () => {
    await retomar(ATENCION);
    const texto = raiz.querySelector<HTMLTextAreaElement>('#observaciones')!;
    texto.value = 'Sin novedad';
    texto.dispatchEvent(new Event('input'));
    finalizar().click();
    const peticion = http.expectOne('/api/v1/atenciones/60/fin');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ observaciones: 'Sin novedad' });
    peticion.flush({ ...ATENCION, estado: 'FINALIZADA', horaFin: '2026-11-03T10:45:00' });
    await estable();
    expect(raiz.textContent).toContain('Atención finalizada');
    expect(raiz.textContent).toContain('10:45');
    expect(raiz.textContent).toContain('servicio individual');
    expect(raiz.textContent).not.toContain('Faltó stock');
  });

  it('RN53: avisa los consumos pendientes que trae la respuesta', async () => {
    await retomar(ATENCION);
    finalizar().click();
    http.expectOne('/api/v1/atenciones/60/fin').flush({
      ...ATENCION,
      estado: 'FINALIZADA',
      consumosPendientes: [
        { idConsumo: 12, producto: 'Keratina', cantidadPendiente: 20 },
        { idConsumo: 13, producto: 'Tinte rubio', cantidadPendiente: 5 },
      ],
    });
    await estable();
    expect(raiz.querySelector('.alert.warn')?.textContent?.trim()).toBe(
      'Faltó stock de: Keratina, Tinte rubio; almacén lo regularizará.',
    );
  });

  it('avisa si se descontó una sesión de paquete', async () => {
    await retomar(ATENCION);
    finalizar().click();
    const peticion = http.expectOne('/api/v1/atenciones/60/fin');
    expect(peticion.request.body).toEqual({});
    peticion.flush({ ...ATENCION, estado: 'FINALIZADA', idClientePaquete: 9 });
    await estable();
    expect(raiz.textContent).toContain('Se descontó una sesión');
  });

  it('CUS18: con VENTAS:CREAR lleva al cobro de la atención finalizada', async () => {
    await retomar(ATENCION, ['VENTAS:CREAR']);
    finalizar().click();
    http.expectOne('/api/v1/atenciones/60/fin').flush({ ...ATENCION, estado: 'FINALIZADA' });
    await estable();
    expect(raiz.querySelector('a[href="/ventas/cobros?idAtencion=60"]')).not.toBeNull();
  });

  it('RN50: muestra el mensaje y conserva la atención', async () => {
    await retomar(ATENCION);
    finalizar().click();
    http
      .expectOne('/api/v1/atenciones/60/fin')
      .flush({ regla: 'RN50' }, { status: 403, statusText: 'Forbidden' });
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain(MENSAJE_RN50);
    expect(finalizar()).toBeDefined();
  });

  it('muestra el 404 y conserva la atención', async () => {
    await retomar(ATENCION);
    finalizar().click();
    http
      .expectOne('/api/v1/atenciones/60/fin')
      .flush({ detail: 'La atención no existe' }, { status: 404, statusText: 'Not Found' });
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('no existe');
    expect(finalizar()).toBeDefined();
  });
});

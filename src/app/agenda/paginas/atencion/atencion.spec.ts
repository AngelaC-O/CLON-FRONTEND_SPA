import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Atencion } from './atencion';

const ATENCION = {
  idAtencion: 60,
  idCita: 950,
  idPersonal: 4,
  idRecurso: 1,
  idVariante: 2,
  tiempoDeclaradoMin: 45,
  estado: 'EN_CURSO',
};

describe('Atencion', () => {
  let fixture: ComponentFixture<Atencion>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const montar = async (atencion: object | null) => {
    if (atencion) {
      sessionStorage.setItem('cautiva.atencion', JSON.stringify(atencion));
    }
    TestBed.configureTestingModule({
      imports: [Atencion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Atencion);
    await estable();
    raiz = fixture.nativeElement;
  };
  const finalizar = () =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes('Finalizar'))!;

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('sin atención en curso lleva a Mi agenda', async () => {
    await montar(null);
    expect(raiz.textContent).toContain('No hay atención en curso');
    expect(raiz.querySelector('a[href="/agenda/mi-agenda"]')).not.toBeNull();
  });

  it('muestra el cronómetro desde la hora de inicio, sin recomendación de productos', async () => {
    const hace90s = new Date(Date.now() - 90_000);
    const local = new Date(hace90s.getTime() - hace90s.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 19);
    await montar({ ...ATENCION, horaInicio: local });
    expect(raiz.querySelector('.reloj')?.textContent).toMatch(/00:01:3\d/);
    expect(raiz.textContent).toContain('Duración declarada: 45 min');
    expect(raiz.textContent).not.toContain('Recomendar');
  });

  it('CUS11: finaliza con las observaciones y deja la atención lista para cobro', async () => {
    await montar({ ...ATENCION, horaInicio: '2026-11-03T10:00:00' });
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
    expect(sessionStorage.getItem('cautiva.atencion')).toBeNull();
  });

  it('avisa si se descontó una sesión de paquete', async () => {
    await montar({ ...ATENCION, horaInicio: '2026-11-03T10:00:00' });
    finalizar().click();
    const peticion = http.expectOne('/api/v1/atenciones/60/fin');
    expect(peticion.request.body).toEqual({});
    peticion.flush({ ...ATENCION, estado: 'FINALIZADA', idClientePaquete: 9 });
    await estable();
    expect(raiz.textContent).toContain('Se descontó una sesión');
  });

  it('CUS18: con VENTAS:CREAR lleva al cobro de la atención finalizada', async () => {
    sessionStorage.setItem('cautiva.sesion', JSON.stringify({ permisos: ['VENTAS:CREAR'] }));
    await montar({ ...ATENCION, horaInicio: '2026-11-03T10:00:00' });
    finalizar().click();
    http.expectOne('/api/v1/atenciones/60/fin').flush({ ...ATENCION, estado: 'FINALIZADA' });
    await estable();
    expect(raiz.querySelector('a[href="/ventas/cobros?idAtencion=60"]')).not.toBeNull();
  });

  it('muestra el 404 y conserva la atención', async () => {
    await montar({ ...ATENCION, horaInicio: '2026-11-03T10:00:00' });
    finalizar().click();
    http
      .expectOne('/api/v1/atenciones/60/fin')
      .flush({ detail: 'La atención no existe' }, { status: 404, statusText: 'Not Found' });
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('no existe');
    expect(sessionStorage.getItem('cautiva.atencion')).not.toBeNull();
  });
});

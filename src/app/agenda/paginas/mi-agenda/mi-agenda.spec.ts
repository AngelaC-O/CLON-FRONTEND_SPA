import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { CitaAtencionDTO } from '../../modelos/agenda.modelos';
import { hoyIso, MENSAJE_RN50 } from '../../modelos/agenda.vista';
import { MiAgenda } from './mi-agenda';

const HOY = hoyIso();
const cita = (
  idCita: number,
  hora: string,
  estado: CitaAtencionDTO['estado'],
  extra: Partial<CitaAtencionDTO> = {},
): CitaAtencionDTO => ({
  idCita,
  idCliente: 407,
  idRecurso: 1,
  idVariante: 2,
  duracionMin: 30,
  fechaHoraInicio: `${HOY}T${hora}:00`,
  fechaHoraFin: `${HOY}T${hora.slice(0, 3)}40:00`,
  estado,
  ...extra,
});

describe('MiAgenda', () => {
  let fixture: ComponentFixture<MiAgenda>;
  let raiz: HTMLElement;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
  const tarjetas = () => [...raiz.querySelectorAll('.card')];

  const montar = async (citas: CitaAtencionDTO[]) => {
    TestBed.configureTestingModule({
      imports: [MiAgenda],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(MiAgenda);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/atenciones/mi-agenda').flush(citas);
    await estable();
  };

  afterEach(() => http.verify());

  it('lista las citas de la especialista de la sesión, sin selector (Duda 6)', async () => {
    await montar([cita(951, '11:00', 'PENDIENTE'), cita(950, '10:00', 'FINALIZADA')]);
    expect(raiz.querySelector('select')).toBeNull();
    expect(tarjetas().map((t) => t.querySelector('.b')?.textContent?.trim())).toEqual([
      'Cita 950',
      'Cita 951',
    ]);
    expect(tarjetas()[1].textContent).toContain('Iniciar atención');
    expect(tarjetas()[0].querySelector('button')).toBeNull();
  });

  it('sin citas lo dice', async () => {
    await montar([]);
    expect(raiz.querySelector('.vacio')?.textContent).toContain('No tienes citas hoy');
  });

  it('CUS11: inicia la atención con el tiempo exacto y la abre', async () => {
    await montar([cita(951, '11:00', 'PENDIENTE')]);
    boton('Iniciar atención')!.click();
    await estable();
    const tiempo = raiz.querySelector<HTMLInputElement>('#tiempoDeclaradoMin')!;
    expect(tiempo.value).toBe('30');
    tiempo.value = '45';
    tiempo.dispatchEvent(new Event('input'));
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    const peticion = http.expectOne('/api/v1/atenciones');
    expect(peticion.request.body).toEqual({ idCita: 951, tiempoDeclaradoMin: 45 });
    peticion.flush({ idAtencion: 60, idCita: 951, estado: 'EN_CURSO' });
    await estable();
    expect(navegar).toHaveBeenCalledWith(['/agenda/atencion'], { queryParams: { idCita: 951 } });
  });

  it('RN50: avisa en el modal si la cita es de otra especialista', async () => {
    await montar([cita(951, '11:00', 'PENDIENTE')]);
    boton('Iniciar atención')!.click();
    await estable();
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/atenciones')
      .flush({ regla: 'RN50' }, { status: 403, statusText: 'Forbidden' });
    await estable();
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain(MENSAJE_RN50);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('retoma la atención en curso desde cualquier equipo (Duda 7)', async () => {
    await montar([
      cita(950, '10:00', 'EN_ATENCION', { estadoAtencion: 'EN_CURSO', idAtencion: 60 }),
    ]);
    boton('Continuar atención')!.click();
    expect(navegar).toHaveBeenCalledWith(['/agenda/atencion'], { queryParams: { idCita: 950 } });
  });
});

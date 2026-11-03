import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { BloqueAgendaDTO } from '../../modelos/agenda.modelos';
import { hoyIso } from '../../modelos/agenda.vista';
import { AtencionEnCursoService } from '../../servicios/atencion-en-curso.service';
import { MiAgenda } from './mi-agenda';

const HOY = hoyIso();
const bloque = (idOrigen: number, idPersonal: number, hora: string, estado: string) =>
  ({
    franja: 'OCUPADA',
    origen: 'CITA',
    idOrigen,
    idPersonal,
    idRecurso: 1,
    idVariante: 2,
    inicio: `${HOY}T${hora}:00`,
    fin: `${HOY}T${hora}:30`,
    estado,
  }) satisfies BloqueAgendaDTO;

describe('MiAgenda', () => {
  let fixture: ComponentFixture<MiAgenda>;
  let raiz: HTMLElement;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
  const tarjetas = () => [...raiz.querySelectorAll('.card')];

  const montar = async (bloques: BloqueAgendaDTO[]) => {
    TestBed.configureTestingModule({
      imports: [MiAgenda],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(MiAgenda);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne(`/api/v1/citas/agenda?fecha=${HOY}`).flush(bloques);
    await estable();
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('muestra solo las citas de la especialista elegida, en orden', async () => {
    await montar([
      bloque(2, 4, '11:00', 'PENDIENTE'),
      bloque(1, 4, '09:00', 'FINALIZADA'),
      bloque(3, 5, '10:00', 'PENDIENTE'),
    ]);
    expect(tarjetas().map((t) => t.querySelector('.b')?.textContent)).toEqual(['Cita 1', 'Cita 2']);
    const lista = raiz.querySelector<HTMLSelectElement>('#miEspecialista')!;
    lista.value = '5';
    lista.dispatchEvent(new Event('change'));
    await estable();
    expect(tarjetas().map((t) => t.querySelector('.b')?.textContent)).toEqual(['Cita 3']);
    expect(localStorage.getItem('cautiva.especialista')).toBe('5');
  });

  it('CUS11: inicia con el tiempo declarado y abre la atención', async () => {
    await montar([bloque(950, 4, '10:00', 'PENDIENTE')]);
    boton('Iniciar atención')!.click();
    await estable();
    const entrada = raiz.querySelector<HTMLInputElement>('#tiempoDeclaradoMin')!;
    entrada.value = '45';
    entrada.dispatchEvent(new Event('input'));
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    const peticion = http.expectOne('/api/v1/atenciones');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ idCita: 950, tiempoDeclaradoMin: 45 });
    peticion.flush({ idAtencion: 60, idCita: 950, estado: 'EN_CURSO' });
    await estable();
    expect(TestBed.inject(AtencionEnCursoService).actual()?.idAtencion).toBe(60);
    expect(navegar).toHaveBeenCalledWith('/agenda/atencion');
  });

  it('no inicia sin tiempo declarado', async () => {
    await montar([bloque(950, 4, '10:00', 'PENDIENTE')]);
    boton('Iniciar atención')!.click();
    await estable();
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectNone('/api/v1/atenciones');
    expect(raiz.querySelector('app-modal .alert.bad')).not.toBeNull();
  });

  it('continúa la atención de esta pestaña y avisa si se inició en otra', async () => {
    sessionStorage.setItem('cautiva.atencion', JSON.stringify({ idAtencion: 60, idCita: 950 }));
    await montar([bloque(950, 4, '10:00', 'EN_ATENCION'), bloque(951, 4, '11:00', 'EN_ATENCION')]);
    expect(tarjetas()[0].textContent).toContain('Continuar atención');
    expect(tarjetas()[1].textContent).toContain('otra pestaña');
    boton('Continuar atención')!.click();
    expect(navegar).toHaveBeenCalledWith('/agenda/atencion');
  });
});

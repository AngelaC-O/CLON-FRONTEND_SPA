import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BloqueAgendaDTO } from '../../modelos/agenda.modelos';
import { hoyIso } from '../../modelos/agenda.vista';
import { Agenda } from './agenda';

const HOY = hoyIso();
const BLOQUES: BloqueAgendaDTO[] = [
  {
    franja: 'OCUPADA',
    origen: 'CITA',
    idOrigen: 950,
    idPersonal: 4,
    idRecurso: 1,
    idVariante: 2,
    inicio: `${HOY}T10:00:00`,
    fin: `${HOY}T11:00:00`,
    estado: 'PENDIENTE',
  },
  { franja: 'LIBRE', idPersonal: 5, inicio: `${HOY}T09:00:00`, fin: `${HOY}T19:00:00` },
  { franja: 'LIBRE', idRecurso: 2, inicio: `${HOY}T09:00:00`, fin: `${HOY}T19:00:00` },
];

describe('Agenda', () => {
  let fixture: ComponentFixture<Agenda>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
  const clic = async (texto: string) => {
    boton(texto)!.click();
    await estable();
  };
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const elegirClienta = async () => {
    escribir('buscarClientaCita', 'Marisol');
    await clic('Buscar');
    http
      .expectOne('/api/v1/clientes?nombres=Marisol')
      .flush([{ idCliente: 407, nombres: 'Marisol', apellidos: 'Quispe', telefono: '987' }]);
    await estable();
    await clic('Marisol Quispe');
  };

  const montar = async (permisos: string[]) => {
    sessionStorage.setItem('cautiva.sesion', JSON.stringify({ idSede: 1, permisos }));
    TestBed.configureTestingModule({
      imports: [Agenda],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Agenda);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne(`/api/v1/citas/agenda?fecha=${HOY}`).flush(BLOQUES);
    await estable();
  };

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  const permisos = ['AGENDA:VER', 'AGENDA:CREAR', 'CLIENTAS:VER'];

  it('CUS08: arma columnas por especialista y por recurso', async () => {
    await montar(permisos);
    const titulos = () => [...raiz.querySelectorAll('.cabeza')].map((c) => c.textContent);
    expect(titulos()).toEqual(['Especialista 4', 'Especialista 5']);
    expect(raiz.querySelector('.bloque')?.textContent).toContain('10:00 · Cita 950');
    expect(raiz.querySelector<HTMLElement>('.bloque')?.style.top).toBe('60px');
    await clic('Por recurso');
    expect(titulos()).toEqual(['Recurso 1', 'Recurso 2']);
  });

  it('CUS08: filtra por día, especialista y recurso', async () => {
    await montar(permisos);
    escribir('filtroFecha', '2026-11-09');
    const especialista = raiz.querySelector<HTMLSelectElement>('#filtroPersonal')!;
    especialista.selectedIndex = 1;
    especialista.dispatchEvent(new Event('change'));
    await clic('Ver agenda');
    http.expectOne('/api/v1/citas/agenda?fecha=2026-11-09&idPersonal=4').flush([]);
    await estable();
    expect(raiz.querySelector('.vacio')).not.toBeNull();
    expect(especialista.options.length).toBe(3);
  });

  it('sin AGENDA:CREAR no ofrece agendar', async () => {
    await montar(['AGENDA:VER']);
    expect(boton('+ Nueva cita')).toBeUndefined();
    expect(boton('Lista de espera')).toBeUndefined();
  });

  it('CUS05: ve la disponibilidad, agenda y recarga el día', async () => {
    await montar(permisos);
    await clic('+ Nueva cita');
    await elegirClienta();
    escribir('citaIdVariante', '2');
    await clic('Ver disponibilidad');
    http
      .expectOne(`/api/v1/citas/disponibilidad?idVariante=2&fecha=${HOY}`)
      .flush([
        { inicio: `${HOY}T15:00:00`, duracionMin: 30, idsPersonal: [4, 5], idsRecurso: [1] },
      ]);
    await estable();
    await clic('15:00');
    await clic('Agendar');
    const peticion = http.expectOne('/api/v1/citas');
    expect(peticion.request.body).toEqual({
      idCliente: 407,
      idVariante: 2,
      idPersonal: 4,
      idRecurso: 1,
      fechaHoraInicio: `${HOY}T15:00:00`,
      duracionMin: 30,
    });
    peticion.flush({ idCita: 951, fechaHoraInicio: `${HOY}T15:00:00` });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    http.expectOne(`/api/v1/citas/agenda?fecha=${HOY}`).flush(BLOQUES);
  });

  it('CUS05: un cruce deja el modal abierto para corregir', async () => {
    await montar(permisos);
    await clic('+ Nueva cita');
    await elegirClienta();
    escribir('citaIdVariante', '2');
    await clic('Ver disponibilidad');
    http
      .expectOne(`/api/v1/citas/disponibilidad?idVariante=2&fecha=${HOY}`)
      .flush([{ inicio: `${HOY}T15:00:00`, duracionMin: 30, idsPersonal: [4], idsRecurso: [1] }]);
    await estable();
    await clic('15:00');
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/citas')
      .flush({ detail: 'Cruce', regla: 'RN02' }, { status: 409, statusText: 'Conflict' });
    await estable();
    expect(raiz.querySelector('app-modal')).not.toBeNull();
  });

  it('CUS06: sin horas libres pasa a la lista con los datos ya elegidos', async () => {
    await montar(permisos);
    await clic('+ Nueva cita');
    await elegirClienta();
    escribir('citaIdVariante', '2');
    await clic('Ver disponibilidad');
    http.expectOne(`/api/v1/citas/disponibilidad?idVariante=2&fecha=${HOY}`).flush([]);
    await estable();
    await clic('Anotar en lista de espera');
    expect(raiz.querySelector('app-lista-espera')?.textContent).toContain('Marisol Quispe');
    expect(raiz.querySelector<HTMLInputElement>('#esperaIdVariante')?.value).toBe('2');

    escribir('esperaDesde', '15:00');
    escribir('esperaHasta', '18:00');
    raiz.querySelector('app-lista-espera form')!.dispatchEvent(new Event('submit'));
    const peticion = http.expectOne('/api/v1/citas/lista-espera');
    expect(peticion.request.body).toEqual({
      idCliente: 407,
      idVariante: 2,
      fechaDeseada: HOY,
      horaDesde: '15:00',
      horaHasta: '18:00',
    });
    peticion.flush({
      idEspera: 1,
      idCliente: 407,
      idVariante: 2,
      fechaDeseada: HOY,
      horasLibres: [{ inicio: `${HOY}T16:00:00` }],
    });
    await estable();
    expect(boton('Lista de espera')?.textContent).toContain('(1)');
    expect(raiz.textContent).toContain('Otras horas libres');
    expect(raiz.textContent).toContain('16:00');
  });

  it('CUS06: exige clienta y un rango de horas válido', async () => {
    await montar(permisos);
    await clic('Lista de espera');
    const form = () => raiz.querySelector('app-lista-espera form')!;
    form().dispatchEvent(new Event('submit'));
    await estable();
    expect(raiz.querySelector('app-lista-espera .alert.bad')?.textContent).toContain('clienta');
    await elegirClienta();
    escribir('esperaIdVariante', '2');
    escribir('esperaDesde', '18:00');
    escribir('esperaHasta', '15:00');
    form().dispatchEvent(new Event('submit'));
    await estable();
    expect(raiz.querySelector('app-lista-espera .alert.bad')?.textContent).toContain('anterior');
    http.expectNone('/api/v1/citas/lista-espera');
  });

  const permisosAdelanto = [...permisos, 'AGENDA:EDITAR'];
  const adelantoDeLaCita = async () => {
    await montar(permisosAdelanto);
    raiz
      .querySelector<HTMLButtonElement>('.bloque button[aria-label="Adelanto de la cita 950"]')!
      .click();
    await estable();
    expect(raiz.querySelector<HTMLInputElement>('#adelantoIdCita')?.value).toBe('950');
    escribir('adelantoMonto', '50');
  };

  it('CUS07: sin AGENDA:EDITAR no ofrece adelanto', async () => {
    await montar(permisos);
    expect(boton('Adelanto')).toBeUndefined();
  });

  it('CUS07: registra el adelanto en efectivo', async () => {
    await adelantoDeLaCita();
    await clic('Registrar adelanto en efectivo');
    const peticion = http.expectOne('/api/v1/citas/950/adelanto');
    expect(peticion.request.body).toEqual({ adelantoMonto: 50, idMedioPago: 1 });
    peticion.flush({ idCita: 950, adelantoMonto: 50 });
    await estable();
    expect(raiz.querySelector('app-adelanto-cita')).toBeNull();
  });

  it('CUS07: genera el enlace de pago para compartir, sin darlo por pagado', async () => {
    await adelantoDeLaCita();
    await clic('Tarjeta');
    await clic('Generar enlace de pago');
    const peticion = http.expectOne('/api/v1/citas/950/enlace-adelanto');
    expect(peticion.request.body).toEqual({ adelantoMonto: 50, idMedioPago: 4 });
    peticion.flush({
      idTransaccion: 5521,
      canal: 'LINK',
      estado: 'PENDIENTE',
      enlacePago: 'https://izipay.example/abc',
      fechaExpiracion: '2026-11-04T15:30:00',
    });
    await estable();
    const modal = raiz.querySelector('app-adelanto-cita')!;
    expect(modal.textContent).toContain('RN04');
    expect(modal.textContent).toContain('15:30');
    expect(modal.querySelector<HTMLInputElement>('app-compartir-enlace input')?.value).toBe(
      'https://izipay.example/abc',
    );
    expect(modal.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
  });

  it('CUS07: muestra el 404 y deja el modal abierto', async () => {
    await adelantoDeLaCita();
    await clic('Registrar adelanto en efectivo');
    http
      .expectOne('/api/v1/citas/950/adelanto')
      .flush({ detail: 'La cita no existe' }, { status: 404, statusText: 'Not Found' });
    await estable();
    expect(raiz.querySelector('app-adelanto-cita .alert.bad')?.textContent).toContain('no existe');
  });

  it('CUS07: después de agendar, ofrece el adelanto de esa cita', async () => {
    await montar(permisosAdelanto);
    await clic('+ Nueva cita');
    await elegirClienta();
    escribir('citaIdVariante', '2');
    await clic('Ver disponibilidad');
    http
      .expectOne(`/api/v1/citas/disponibilidad?idVariante=2&fecha=${HOY}`)
      .flush([{ inicio: `${HOY}T15:00:00`, duracionMin: 30, idsPersonal: [4], idsRecurso: [1] }]);
    await estable();
    await clic('15:00');
    await clic('Agendar');
    http.expectOne('/api/v1/citas').flush({ idCita: 951, fechaHoraInicio: `${HOY}T15:00:00` });
    await estable();
    http.expectOne(`/api/v1/citas/agenda?fecha=${HOY}`).flush(BLOQUES);
    await estable();
    await clic('Registrar adelanto');
    expect(raiz.querySelector<HTMLInputElement>('#adelantoIdCita')?.value).toBe('951');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MedioPagoDTO, ServicioDTO } from '../../../core/api/modelos.generados';
import { entrarComo } from '../../../../testing/sesion';
import { FiltrosAgendaDTO, FranjaAgendaDTO, ListaEsperaDTO } from '../../modelos/agenda.modelos';
import { hoyIso, MENSAJE_RN49 } from '../../modelos/agenda.vista';
import { Agenda } from './agenda';

const HOY = hoyIso();
const BLOQUES: FranjaAgendaDTO[] = [
  {
    franja: 'OCUPADA',
    origen: 'CITA',
    idOrigen: 950,
    idCliente: 407,
    idPersonal: 4,
    idRecurso: 1,
    idVariante: 2,
    inicio: `${HOY}T10:00:00`,
    finServicio: `${HOY}T10:30:00`,
    fin: `${HOY}T10:40:00`,
    estado: 'PENDIENTE',
    nombreCliente: 'Marisol Quispe',
    nombreEspecialista: 'Lucía Ramos',
    nombreServicio: 'Corte de Cabello Caballero',
  },
  {
    franja: 'LIBRE',
    idPersonal: 5,
    inicio: `${HOY}T09:00:00`,
    fin: `${HOY}T19:00:00`,
    nombreEspecialista: 'Ana Torres',
  },
  { franja: 'LIBRE', idRecurso: 2, inicio: `${HOY}T09:00:00`, fin: `${HOY}T19:00:00` },
];
const FILTROS: FiltrosAgendaDTO = {
  especialistas: [
    { idPersonal: 4, nombres: 'Lucía', apellidos: 'Ramos' },
    { idPersonal: 5, nombres: 'Ana', apellidos: 'Torres' },
  ],
  recursos: [
    { idRecurso: 1, nombre: 'Sillón 1', tipo: 'SILLON', estado: 'DISPONIBLE' },
    { idRecurso: 2, nombre: 'Sillón 2', tipo: 'SILLON', estado: 'DISPONIBLE' },
  ],
};
const SERVICIOS: ServicioDTO[] = [
  {
    idServicio: 1,
    idArea: 1,
    nombre: 'Corte de Cabello Caballero',
    duracionRefMin: 30,
    tipoRecurso: 'SILLON',
    variantes: [{ idVariante: 2, nombreVariante: 'Clásico', precio: 25 }],
  },
  {
    idServicio: 21,
    idArea: 1,
    nombre: 'Corte de novia',
    duracionRefMin: 60,
    tipoRecurso: 'SILLON',
    variantes: [
      { idVariante: 30, nombreVariante: 'Estándar', precio: 80 },
      { idVariante: 31, nombreVariante: 'Premium', precio: 120 },
    ],
  },
];
const ESPERA: ListaEsperaDTO = {
  idEspera: 31,
  estado: 'PENDIENTE',
  idCliente: 408,
  idVariante: 2,
  fechaDeseada: HOY,
  horaDesde: '15:00',
  horaHasta: '18:00',
  nombreCliente: 'Rosaura Quispe',
  nombreServicio: 'Corte de Cabello Caballero',
};
const MEDIOS: MedioPagoDTO[] = [
  { idMedioPago: 11, nombre: 'EFECTIVO', estado: 'ACTIVO', usaPasarela: false },
  { idMedioPago: 12, nombre: 'YAPE', estado: 'ACTIVO', usaPasarela: true },
  { idMedioPago: 13, nombre: 'PLIN', estado: 'INACTIVO', usaPasarela: true },
  { idMedioPago: 14, nombre: 'TARJETA', estado: 'ACTIVO', usaPasarela: true },
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
  const clicEn = async (dentro: string, texto: string) => {
    [...raiz.querySelectorAll<HTMLButtonElement>(`${dentro} button`)]
      .find((b) => b.textContent?.includes(texto))!
      .click();
    await estable();
  };
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const elegir = async (id: string, texto: string) => {
    const lista = raiz.querySelector<HTMLSelectElement>(`#${id}`)!;
    lista.selectedIndex = [...lista.options].findIndex((o) => o.textContent?.includes(texto));
    lista.dispatchEvent(new Event('change'));
    await estable();
  };
  const elegirClienta = async () => {
    escribir('buscarClientaCita', 'Marisol');
    await clic('Buscar');
    http
      .expectOne('/api/v1/clientes?nombres=Marisol')
      .flush([{ idCliente: 407, nombres: 'Marisol', apellidos: 'Quispe', telefono: '987' }]);
    await estable();
    await clicEn('app-selector-clienta', 'Marisol Quispe');
  };
  /** Abre la nueva cita, elige clienta y «Corte de Cabello Caballero» (variante 2, única). */
  const prepararCita = async () => {
    await clic('+ Nueva cita');
    http.expectOne('/api/v1/servicios?estado=ACTIVO').flush(SERVICIOS);
    await estable();
    await elegirClienta();
    await elegir('citaServicio', 'Corte de Cabello Caballero');
  };
  const verHoras = async (horas: object[]) => {
    await clic('Ver disponibilidad');
    http.expectOne(`/api/v1/citas/disponibilidad?idVariante=2&fecha=${HOY}`).flush(horas);
    await estable();
  };

  /** GET /citas/agenda y, con él, GET /citas/lista-espera del mismo día. */
  const responderDia = async (
    fecha = HOY,
    bloques: FranjaAgendaDTO[] = BLOQUES,
    esperas: ListaEsperaDTO[] = [],
  ) => {
    http.expectOne(`/api/v1/citas/agenda?fecha=${fecha}`).flush(bloques);
    http.expectOne(`/api/v1/citas/lista-espera?fecha=${fecha}`).flush(esperas);
    await estable();
  };
  const abrirCita = async () => {
    raiz.querySelector<HTMLButtonElement>('.bloque .abrir')!.click();
    await estable();
  };

  const montar = async (permisos: string[], esperas: ListaEsperaDTO[] = []) => {
    TestBed.configureTestingModule({
      imports: [Agenda],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Agenda);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/citas/filtros').flush(FILTROS);
    await responderDia(HOY, BLOQUES, esperas);
  };

  afterEach(() => http.verify());

  const permisos = ['AGENDA:VER', 'AGENDA:CREAR', 'CLIENTAS:VER', 'CATALOGO:VER'];

  it('CUS08: columnas con nombres y franjas con clienta, servicio y recurso (diferencia 24)', async () => {
    await montar(permisos);
    const titulos = () => [...raiz.querySelectorAll('.cabeza')].map((c) => c.textContent);
    expect(titulos()).toEqual(['Lucía Ramos', 'Ana Torres']);
    const bloque = raiz.querySelector<HTMLElement>('.bloque')!;
    expect(bloque.textContent).toContain('10:00 · Marisol Quispe');
    expect(bloque.textContent).toContain('Corte de Cabello Caballero · Sillón 1');
    expect(bloque.style.top).toBe('60px');
    // La especialista queda libre al terminar el servicio: sin la limpieza (RN03).
    expect(bloque.style.height).toBe('30px');
    expect(raiz.querySelector('.bloque.limpieza')).toBeNull();
    await clic('Por recurso');
    expect(titulos()).toEqual(['Sillón 1', 'Sillón 2']);
    expect(raiz.querySelector('.bloque')?.textContent).toContain('Lucía Ramos');
  });

  it('CUS08: el bloque de limpieza se pinta solo en el recurso', async () => {
    await montar(permisos);
    await clic('Por recurso');
    const limpieza = raiz.querySelector<HTMLElement>('.bloque.limpieza')!;
    expect(limpieza.textContent?.trim()).toBe('Limpieza');
    expect(limpieza.style.top).toBe('90px');
    expect(limpieza.style.height).toBe('10px');
  });

  it('CUS08: filtra con las especialistas y recursos de GET /citas/filtros', async () => {
    await montar(permisos);
    const especialista = raiz.querySelector<HTMLSelectElement>('#filtroPersonal')!;
    expect([...especialista.options].map((o) => o.textContent?.trim())).toEqual([
      'Todas',
      'Lucía Ramos',
      'Ana Torres',
    ]);
    const recurso = raiz.querySelector<HTMLSelectElement>('#filtroRecurso')!;
    expect([...recurso.options].map((o) => o.textContent?.trim())).toEqual([
      'Todos',
      'Sillón 1',
      'Sillón 2',
    ]);
    escribir('filtroFecha', '2026-11-09');
    await elegir('filtroPersonal', 'Lucía Ramos');
    await clic('Ver agenda');
    http.expectOne('/api/v1/citas/agenda?fecha=2026-11-09&idPersonal=4').flush([]);
    http.expectOne('/api/v1/citas/lista-espera?fecha=2026-11-09').flush([]);
    await estable();
    expect(raiz.querySelector('.vacio')).not.toBeNull();
  });

  it('sin AGENDA:CREAR no ofrece agendar', async () => {
    await montar(['AGENDA:VER']);
    expect(boton('+ Nueva cita')).toBeUndefined();
    expect(boton('Lista de espera')).toBeUndefined();
  });

  it('CUS05: elige servicio y variante de GET /servicios', async () => {
    await montar(permisos);
    await clic('+ Nueva cita');
    http.expectOne('/api/v1/servicios?estado=ACTIVO').flush(SERVICIOS);
    await estable();
    await elegir('citaServicio', 'Corte de novia');
    const variantes = [...raiz.querySelectorAll('#citaIdVariante option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(variantes).toEqual(['Elige la variante', 'Estándar · S/ 80.00', 'Premium · S/ 120.00']);
  });

  it('CUS05: ve las horas que devuelve el back-end, agenda y recarga el día', async () => {
    await montar(permisos);
    await prepararCita();
    await verHoras([
      { inicio: `${HOY}T15:00:00`, duracionMin: 30, idsPersonal: [4, 5], idsRecurso: [1] },
      { inicio: `${HOY}T15:15:00`, duracionMin: 30, idsPersonal: [4], idsRecurso: [1] },
    ]);
    expect(boton('15:15')).toBeDefined();
    await clic('15:00');
    const especialistas = [...raiz.querySelectorAll('#citaIdPersonal option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(especialistas).toEqual(['Lucía Ramos', 'Ana Torres']);
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
    await responderDia();
  });

  it('RN49: no consulta horas de un día que ya pasó', async () => {
    await montar(permisos);
    await prepararCita();
    escribir('citaFecha', '2020-01-01');
    await clic('Ver disponibilidad');
    http.expectNone((req) => req.url.endsWith('/citas/disponibilidad'));
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain(MENSAJE_RN49);
  });

  it('RN49: muestra en el modal el 422 del back-end', async () => {
    await montar(permisos);
    await prepararCita();
    await verHoras([
      { inicio: `${HOY}T15:00:00`, duracionMin: 30, idsPersonal: [4], idsRecurso: [1] },
    ]);
    await clic('15:00');
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/citas')
      .flush(
        { detail: 'La fecha y hora ya pasaron', regla: 'RN49' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await estable();
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain(
      'La fecha y hora ya pasaron',
    );
  });

  it('CUS05: un cruce deja el modal abierto para corregir', async () => {
    await montar(permisos);
    await prepararCita();
    await verHoras([
      { inicio: `${HOY}T15:00:00`, duracionMin: 30, idsPersonal: [4], idsRecurso: [1] },
    ]);
    await clic('15:00');
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/citas')
      .flush({ detail: 'Cruce', regla: 'RN02' }, { status: 409, statusText: 'Conflict' });
    await estable();
    expect(raiz.querySelector('app-modal')).not.toBeNull();
  });

  it('sin CATALOGO:VER la variante se escribe por código', async () => {
    await montar(['AGENDA:VER', 'AGENDA:CREAR', 'CLIENTAS:VER']);
    await clic('+ Nueva cita');
    http.expectNone('/api/v1/servicios?estado=ACTIVO');
    expect(raiz.querySelector('#citaServicio')).toBeNull();
    expect(raiz.querySelector('input#citaIdVariante')).not.toBeNull();
  });

  it('CUS06: sin horas libres pasa a la lista con los datos ya elegidos', async () => {
    await montar(permisos);
    await prepararCita();
    await verHoras([]);
    await clic('Anotar en lista de espera');
    expect(raiz.querySelector('app-lista-espera')?.textContent).toContain('Marisol Quispe');
    await estable();
    expect(raiz.querySelector<HTMLSelectElement>('#esperaIdVariante')?.selectedIndex).toBe(1);
    expect(
      raiz.querySelector<HTMLSelectElement>('#esperaServicio')?.selectedOptions[0].textContent,
    ).toContain('Corte de Cabello Caballero');

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
      nombreCliente: 'Marisol Quispe',
      horasLibres: [{ inicio: `${HOY}T16:00:00` }],
    });
    await estable();
    // Anotada para el día que se ve: el panel se vuelve a leer del back-end.
    http
      .expectOne(`/api/v1/citas/lista-espera?fecha=${HOY}`)
      .flush([{ ...ESPERA, idEspera: 1, nombreCliente: 'Marisol Quispe' }]);
    await estable();
    expect(boton('Lista de espera')?.textContent).toContain('(1)');
    expect(raiz.querySelector('section')?.textContent).toContain('Marisol Quispe');
    expect(raiz.textContent).toContain('Otras horas libres');
    expect(raiz.textContent).toContain('16:00');
  });

  it('CUS06: exige clienta y un rango de horas válido', async () => {
    await montar(permisos);
    await clic('Lista de espera');
    http.expectOne('/api/v1/servicios?estado=ACTIVO').flush(SERVICIOS);
    await estable();
    const form = () => raiz.querySelector('app-lista-espera form')!;
    form().dispatchEvent(new Event('submit'));
    await estable();
    expect(raiz.querySelector('app-lista-espera .alert.bad')?.textContent).toContain('clienta');
    escribir('buscarClientaCita', 'Marisol');
    await clic('Buscar');
    http
      .expectOne('/api/v1/clientes?nombres=Marisol')
      .flush([{ idCliente: 407, nombres: 'Marisol', apellidos: 'Quispe', telefono: '987' }]);
    await estable();
    await clicEn('app-selector-clienta', 'Marisol Quispe');
    await elegir('esperaServicio', 'Corte de Cabello Caballero');
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
    http.expectOne('/api/v1/medios-pago').flush(MEDIOS);
    await estable();
    expect(raiz.querySelector<HTMLInputElement>('#adelantoIdCita')?.value).toBe('950');
    escribir('adelantoMonto', '50');
  };

  it('CUS07: sin AGENDA:EDITAR no ofrece adelanto', async () => {
    await montar(permisos);
    expect(boton('Adelanto')).toBeUndefined();
  });

  it('CUS07: ofrece los medios activos de GET /medios-pago (Duda 11)', async () => {
    await adelantoDeLaCita();
    const medios = [...raiz.querySelectorAll('app-adelanto-cita .seg button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(medios).toEqual(['Efectivo', 'Yape', 'Tarjeta']);
  });

  it('CUS07: registra el adelanto en efectivo con el id del contrato', async () => {
    await adelantoDeLaCita();
    await clic('Registrar adelanto en efectivo');
    const peticion = http.expectOne('/api/v1/citas/950/adelanto');
    expect(peticion.request.body).toEqual({ adelantoMonto: 50, idMedioPago: 11 });
    peticion.flush({ idCita: 950, adelantoMonto: 50 });
    await estable();
    expect(raiz.querySelector('app-adelanto-cita')).toBeNull();
  });

  it('CUS07: genera el enlace de pago para compartir, sin darlo por pagado', async () => {
    await adelantoDeLaCita();
    await clic('Tarjeta');
    await clic('Generar enlace de pago');
    const peticion = http.expectOne('/api/v1/citas/950/enlace-adelanto');
    expect(peticion.request.body).toEqual({ adelantoMonto: 50, idMedioPago: 14 });
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
    await prepararCita();
    await verHoras([
      { inicio: `${HOY}T15:00:00`, duracionMin: 30, idsPersonal: [4], idsRecurso: [1] },
    ]);
    await clic('15:00');
    await clic('Agendar');
    http.expectOne('/api/v1/citas').flush({ idCita: 951, fechaHoraInicio: `${HOY}T15:00:00` });
    await estable();
    await responderDia();
    await clic('Registrar adelanto');
    http.expectOne('/api/v1/medios-pago').flush(MEDIOS);
    await estable();
    expect(raiz.querySelector<HTMLInputElement>('#adelantoIdCita')?.value).toBe('951');
  });

  const permisosEdicion = [...permisos, 'AGENDA:EDITAR'];

  it('detalle de la cita: sin AGENDA:EDITAR no ofrece reprogramar ni cancelar', async () => {
    await montar(permisos);
    await abrirCita();
    const modal = raiz.querySelector('app-modal')!;
    expect(modal.textContent).toContain('Marisol Quispe');
    expect(modal.textContent).toContain('Lucía Ramos');
    expect(modal.textContent).toContain('Sillón 1');
    expect(boton('Reprogramar')).toBeUndefined();
    expect(boton('Cancelar cita')).toBeUndefined();
  });

  it('CUS09: reprograma con las horas libres y propone la especialista de la cita', async () => {
    await montar(permisosEdicion);
    await abrirCita();
    await clic('Reprogramar');
    expect(raiz.querySelector<HTMLInputElement>('#reprogramarFecha')?.value).toBe(HOY);
    await clic('Ver disponibilidad');
    http
      .expectOne(`/api/v1/citas/disponibilidad?idVariante=2&fecha=${HOY}`)
      .flush([
        { inicio: `${HOY}T16:00:00`, duracionMin: 30, idsPersonal: [5, 4], idsRecurso: [2] },
      ]);
    await estable();
    await clic('16:00');
    const especialista = raiz.querySelector<HTMLSelectElement>('#reprogramarIdPersonal')!;
    expect(especialista.selectedOptions[0].textContent?.trim()).toBe('Lucía Ramos');
    await elegir('reprogramarIdPersonal', 'Ana Torres');
    raiz.querySelector('app-reprogramar-cita form')!.dispatchEvent(new Event('submit'));
    const peticion = http.expectOne('/api/v1/citas/950/reprogramacion');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      fechaHoraInicio: `${HOY}T16:00:00`,
      idPersonal: 5,
      idRecurso: 2,
    });
    peticion.flush({ idCita: 952, idCitaOrigen: 950, fechaHoraInicio: `${HOY}T16:00:00` });
    await estable();
    expect(raiz.querySelector('app-reprogramar-cita')).toBeNull();
    await responderDia();
  });

  it('CUS09: el 422 de RN49 queda en el modal', async () => {
    await montar(permisosEdicion);
    await abrirCita();
    await clic('Reprogramar');
    await clic('Ver disponibilidad');
    http
      .expectOne(`/api/v1/citas/disponibilidad?idVariante=2&fecha=${HOY}`)
      .flush([{ inicio: `${HOY}T16:00:00`, duracionMin: 30, idsPersonal: [4], idsRecurso: [1] }]);
    await estable();
    await clic('16:00');
    raiz.querySelector('app-reprogramar-cita form')!.dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/citas/950/reprogramacion')
      .flush(
        { detail: 'La fecha y hora ya pasaron', regla: 'RN49' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await estable();
    expect(raiz.querySelector('app-reprogramar-cita .alert.bad')?.textContent).toContain(
      'La fecha y hora ya pasaron',
    );
  });

  it('CUS10: «No se presentó» cancela y muestra el saldo a favor que quedó', async () => {
    await montar(permisosEdicion);
    await abrirCita();
    await clic('Cancelar cita');
    await clic('No se presentó');
    expect(raiz.querySelector<HTMLInputElement>('#motivoCancelacion')?.value).toBe(
      'No se presentó',
    );
    raiz.querySelector('app-cancelar-cita form')!.dispatchEvent(new Event('submit'));
    const peticion = http.expectOne('/api/v1/citas/950/cancelacion');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ motivoCancelacion: 'No se presentó' });
    peticion.flush({ idCita: 950, estado: 'CANCELADA', adelantoMonto: 20 });
    await estable();
    await responderDia();
    expect(raiz.querySelector('#saldoQuedo')?.textContent).toContain('S/ 20.00');
    expect(raiz.querySelector('#saldoQuedo')?.textContent).toContain('saldo a favor');
    await clic('Cerrar');
    expect(raiz.querySelector('app-cancelar-cita')).toBeNull();
  });

  it('CUS10: sin motivo no cancela', async () => {
    await montar(permisosEdicion);
    await abrirCita();
    await clic('Cancelar cita');
    raiz.querySelector('app-cancelar-cita form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectNone('/api/v1/citas/950/cancelacion');
    expect(raiz.querySelector('app-cancelar-cita .alert.bad')?.textContent).toContain('motivo');
  });

  it('CUS06: el panel lista las esperas del día de GET /citas/lista-espera', async () => {
    await montar(permisosEdicion, [ESPERA]);
    const panel = raiz.querySelector('section')!;
    expect(panel.textContent).toContain('Rosaura Quispe');
    expect(panel.textContent).toContain('Corte de Cabello Caballero · de 15:00 a 18:00');
    expect(boton('Lista de espera')?.textContent).toContain('(1)');
  });

  it('CUS06: «Programar» abre la cita con los datos de la espera y envía idEspera', async () => {
    await montar(permisosEdicion, [ESPERA]);
    await clic('Programar');
    http.expectOne('/api/v1/servicios?estado=ACTIVO').flush(SERVICIOS);
    await estable();
    const modal = raiz.querySelector('app-nueva-cita')!;
    expect(modal.querySelector('.chip.salon')?.textContent).toContain('Rosaura Quispe');
    expect(
      raiz.querySelector<HTMLSelectElement>('#citaServicio')?.selectedOptions[0].textContent,
    ).toContain('Corte de Cabello Caballero');
    await verHoras([
      { inicio: `${HOY}T15:30:00`, duracionMin: 30, idsPersonal: [4], idsRecurso: [1] },
    ]);
    await clic('15:30');
    await clic('Agendar');
    const peticion = http.expectOne('/api/v1/citas');
    expect(peticion.request.body).toEqual({
      idCliente: 408,
      idVariante: 2,
      idPersonal: 4,
      idRecurso: 1,
      fechaHoraInicio: `${HOY}T15:30:00`,
      duracionMin: 30,
      idEspera: 31,
    });
    peticion.flush({ idCita: 953, fechaHoraInicio: `${HOY}T15:30:00` });
    await estable();
    await responderDia();
    expect(raiz.querySelector('section')?.textContent).toContain('No hay clientas en espera.');
  });

  it('CUS06: «Descartar espera» pide confirmación y la quita del panel', async () => {
    await montar(permisosEdicion, [ESPERA]);
    await clic('Descartar espera');
    const confirmar = raiz.querySelector<HTMLButtonElement>('app-modal .btn.bad')!;
    expect(raiz.querySelector('app-modal')?.textContent).toContain('Rosaura Quispe');
    http.expectNone('/api/v1/citas/lista-espera/31/descarte');
    confirmar.click();
    await estable();
    const peticion = http.expectOne('/api/v1/citas/lista-espera/31/descarte');
    expect(peticion.request.method).toBe('PATCH');
    peticion.flush({ ...ESPERA, estado: 'DESCARTADA' });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(raiz.querySelector('section')?.textContent).toContain('No hay clientas en espera.');
  });

  it('CUS06: sin AGENDA:EDITAR no ofrece descartar', async () => {
    await montar(permisos, [ESPERA]);
    expect(boton('Programar')).toBeDefined();
    expect(boton('Descartar espera')).toBeUndefined();
  });
});

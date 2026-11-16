import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { Caja } from './caja';

const TODOS = ['CAJA:VER', 'CAJA:CREAR', 'CAJA:EDITAR'];
const CAJA = {
  idCaja: 214,
  estado: 'ABIERTA',
  montoInicial: 100,
  fechaApertura: '2026-11-03T08:55:00',
};
const MEDIOS = [
  { idMedioPago: 1, nombre: 'EFECTIVO', estado: 'ACTIVO', usaPasarela: false },
  { idMedioPago: 2, nombre: 'YAPE', estado: 'ACTIVO', usaPasarela: true },
];
const ESPERADO = {
  idCaja: 214,
  estado: 'ABIERTA',
  montoInicial: 100,
  medios: [
    { idMedioPago: 1, medioPago: 'EFECTIVO', esperado: 160, aprobadoPasarela: 0 },
    { idMedioPago: 2, medioPago: 'YAPE', esperado: 40, aprobadoPasarela: 40 },
  ],
  comprobantesPendientes: [{ idComprobante: 7121, estadoSunat: 'PENDIENTE' }],
};

describe('Caja', () => {
  let fixture: ComponentFixture<Caja>;
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
  /** La caja abierta sale de GET /cajas/abierta: 200 con la caja o 204 sin caja (Duda 10). */
  const montar = async (permisos: string[], caja: object | null = null) => {
    TestBed.configureTestingModule({
      imports: [Caja],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, nombreSede: 'Pichanaki Centro', permisos });
    fixture = TestBed.createComponent(Caja);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/medios-pago').flush(MEDIOS);
    http
      .expectOne('/api/v1/cajas/abierta')
      .flush(caja, caja ? {} : { status: 204, statusText: 'No Content' });
    await estable();
  };
  /** Con la caja abierta, llega hasta el modal del arqueo. */
  const abrirArqueo = async () => {
    await montar(TODOS, CAJA);
    http.expectOne('/api/v1/cajas/214/esperado').flush(ESPERADO);
    await estable();
    await clic('Cerrar caja');
    http.expectOne('/api/v1/cajas/214/esperado').flush(ESPERADO);
    await estable();
  };

  afterEach(() => http.verify());

  it('lee la caja abierta de la sede sin pedir su código', async () => {
    await montar(TODOS, CAJA);
    http.expectOne('/api/v1/cajas/214/esperado').flush(ESPERADO);
    await estable();
    expect(raiz.textContent).toContain('Caja N° 214');
    // La sede por su nombre (SesionDTO.nombreSede, It. 2.1), nunca «Sede 1».
    expect(raiz.querySelector('.h1 + .mut')?.textContent).toContain('Pichanaki Centro');
    expect(raiz.textContent).not.toContain('Sede 1');
    expect(raiz.querySelector('#cajaCodigo')).toBeNull();
    expect(raiz.querySelector('.gf1')?.textContent).toContain('Efectivo');
  });

  it('CUS44: abre con el monto inicial y muestra lo esperado', async () => {
    await montar(TODOS);
    escribir('cajaMontoInicial', '100');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    const peticion = http.expectOne('/api/v1/cajas');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ montoInicial: 100 });
    peticion.flush(CAJA);
    await estable();
    http.expectOne('/api/v1/cajas/214/esperado').flush(ESPERADO);
    await estable();
    expect(raiz.textContent).toContain('Abierta desde 08:55');
    expect(raiz.querySelector('.gf1')?.textContent).toContain('S/ 160.00');
    expect(sessionStorage.length).toBe(0);
  });

  it('CUS44: si otra persona ya la abrió, la lee de GET /cajas/abierta', async () => {
    await montar(TODOS);
    escribir('cajaMontoInicial', '100');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/cajas')
      .flush({ detail: 'Ya abierta', regla: 'RN30' }, { status: 409, statusText: 'Conflict' });
    await estable();
    http.expectOne('/api/v1/cajas/abierta').flush(CAJA);
    http.expectOne('/api/v1/cajas/214/esperado').flush(ESPERADO);
    await estable();
    expect(boton('Cerrar caja')).toBeDefined();
  });

  it('oculta lo que el rol no puede hacer', async () => {
    await montar(['CAJA:VER']);
    expect(boton('Abrir caja')).toBeUndefined();
  });

  it('CUS45: sin diferencia cierra con esperado, egresos y contado', async () => {
    await abrirArqueo();
    expect(raiz.querySelector('app-modal')?.textContent).toContain('pendientes de envío a SUNAT');
    expect(raiz.querySelector<HTMLInputElement>('#contado2')?.value).toBe('40');
    expect(raiz.querySelector<HTMLInputElement>('#contado2')?.readOnly).toBe(true);

    await clic('+ Egreso');
    escribir('egresoConcepto0', 'Compra menor');
    escribir('egresoMonto0', '10');
    escribir('contado1', '150');
    await estable();
    expect(raiz.querySelector('#observacion1')).toBeNull();
    await clic('Confirmar cierre');
    const peticion = http.expectOne('/api/v1/cajas/214/cierre');
    expect(peticion.request.body).toEqual({
      arqueos: [
        { idMedioPago: 1, montoContado: 150 },
        { idMedioPago: 2, montoContado: 40 },
      ],
      egresos: [{ concepto: 'Compra menor', monto: 10 }],
    });
    peticion.flush({
      idCaja: 214,
      estado: 'CERRADA',
      arqueos: [{ idMedioPago: 1, montoEsperado: 150, montoContado: 150, diferencia: 0 }],
    });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(raiz.textContent).toContain('Cierre de la caja N° 214');
    expect(boton('Abrir caja')).toBeDefined();
  });

  it('CUS45 y RN30: con diferencia exige la observación', async () => {
    await abrirArqueo();
    escribir('contado1', '155');
    await estable();
    expect(raiz.querySelector('app-modal tbody')?.textContent).toContain('-5.00');
    await clic('Confirmar cierre');
    http.expectNone('/api/v1/cajas/214/cierre');
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('RN30');

    const observacion = raiz.querySelector<HTMLTextAreaElement>('#observacion1')!;
    observacion.value = 'Faltan cinco soles';
    observacion.dispatchEvent(new Event('input'));
    await clic('Confirmar cierre');
    const peticion = http.expectOne('/api/v1/cajas/214/cierre');
    expect(peticion.request.body.arqueos[0]).toEqual({
      idMedioPago: 1,
      montoContado: 155,
      observacion: 'Faltan cinco soles',
    });
    peticion.flush({ idCaja: 214, estado: 'CERRADA', arqueos: [] });
    await estable();
  });

  it('CUS45: exige contar el efectivo', async () => {
    await abrirArqueo();
    await clic('Confirmar cierre');
    http.expectNone('/api/v1/cajas/214/cierre');
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('contado');
  });

  it('si lo esperado dice CERRADA, ofrece abrir otra', async () => {
    await montar(TODOS, CAJA);
    http.expectOne('/api/v1/cajas/214/esperado').flush({ ...ESPERADO, estado: 'CERRADA' });
    await estable();
    expect(boton('Abrir caja')).toBeDefined();
  });
});

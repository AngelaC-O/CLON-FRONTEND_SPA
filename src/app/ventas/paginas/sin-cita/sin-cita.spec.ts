import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { SinCita } from './sin-cita';

const LIBRES = [
  { inicio: '2026-11-03T10:15:00', duracionMin: 30, idsPersonal: [4, 5], idsRecurso: [1, 2] },
];
const CERRADA = {
  idVenta: 8813,
  estado: 'CERRADA',
  total: 35,
  comprobante: {
    idComprobante: 7121,
    tipo: 'BOLETA',
    serie: 'B001',
    numero: '00000420',
    estadoSunat: 'ACEPTADO',
  },
};

describe('SinCita', () => {
  let fixture: ComponentFixture<SinCita>;
  let raiz: HTMLElement;
  let http: HttpTestingController;
  /** Cuenta como el RNF29: un clic para cada campo que se toca y cada botón. */
  let clics: number;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
  const clic = async (texto: string) => {
    clics++;
    boton(texto)!.click();
    await estable();
  };
  const escribir = (id: string, valor: string, evento = 'input') => {
    clics++;
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event(evento));
  };
  const enviar = async () => {
    clics++;
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };
  const verLibres = async (libres: object[] = LIBRES) => {
    escribir('rapidaVariante', '2', 'change');
    http.expectOne('/api/v1/ventas/rapidas/libres?idVariante=2').flush(libres);
    await estable();
  };

  beforeEach(async () => {
    clics = 0;
    sessionStorage.setItem(
      'cautiva.sesion',
      JSON.stringify({ idSede: 1, permisos: ['VENTAS:CREAR', 'VENTAS:VER', 'CLIENTAS:VER'] }),
    );
    TestBed.configureTestingModule({
      imports: [SinCita],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SinCita);
    await estable();
    raiz = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    document.querySelectorAll('iframe').forEach((marco) => marco.remove());
    vi.restoreAllMocks();
  });

  it('RNF29 y CUS13: atención, cobro y comprobante en una pantalla, con 6 clics o menos', async () => {
    escribir('rapidaPaso', 'De paso');
    await verLibres();
    expect(raiz.querySelector<HTMLSelectElement>('#rapidaPersonal')?.options.length).toBe(2);
    expect(raiz.querySelector<HTMLInputElement>('#rapidaDuracion')?.value).toBe('30');
    escribir('rapidaMonto', '35');
    await enviar();
    const peticion = http.expectOne('/api/v1/ventas/rapidas');
    expect(peticion.request.body).toEqual({
      tipo: 'BOLETA',
      nombreClientePaso: 'De paso',
      idVariante: 2,
      idPersonal: 4,
      idRecurso: 1,
      tiempoDeclaradoMin: 30,
      idMedioPago: 1,
      monto: 35,
    });
    peticion.flush(CERRADA);
    await estable();
    expect(raiz.querySelector('app-comprobante-emitido')?.textContent).toContain(
      'Boleta B001-00000420',
    );
    expect(raiz.textContent).toContain('SUNAT: ACEPTADO');

    URL.createObjectURL = vi.fn(() => 'blob:comprobante');
    URL.revokeObjectURL = vi.fn();
    await clic('Imprimir comprobante');
    http
      .expectOne('/api/v1/comprobantes/7121/representacion')
      .flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    await estable();
    expect(clics).toBeLessThanOrEqual(6);

    boton('Nueva atención')!.click();
    await estable();
    expect(raiz.querySelector<HTMLInputElement>('#rapidaPaso')?.value).toBe('');
  });

  it('RN35: pide el nombre del cliente de paso', async () => {
    await verLibres();
    escribir('rapidaMonto', '35');
    await enviar();
    http.expectNone('/api/v1/ventas/rapidas');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('RN35');
  });

  it('avisa si no hay especialista o recurso libres, y no deja cobrar', async () => {
    escribir('rapidaPaso', 'De paso');
    await verLibres([]);
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain('No hay especialista');
    escribir('rapidaMonto', '35');
    await enviar();
    http.expectNone('/api/v1/ventas/rapidas');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('especialista');
  });

  it('cobra a una clienta registrada, con factura y Yape por QR', async () => {
    await clic('Clienta registrada');
    escribir('buscarClientaCita', 'Marisol');
    await clic('Buscar');
    http
      .expectOne('/api/v1/clientes?nombres=Marisol')
      .flush([{ idCliente: 407, nombres: 'Marisol', apellidos: 'Quispe', telefono: '987' }]);
    await estable();
    await clic('Marisol Quispe');
    await verLibres();
    await clic('Yape');
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain('RN42');
    escribir('rapidaMonto', '35');
    await clic('Factura');
    escribir('compradorRuc', '20601234567');
    escribir('compradorNombre', 'EMPRESA DEMO S.A.C.');
    await enviar();
    const peticion = http.expectOne('/api/v1/ventas/rapidas');
    expect(peticion.request.body).toEqual({
      tipo: 'FACTURA',
      idTipoDocComprador: 3,
      nroDocComprador: '20601234567',
      nombreComprador: 'EMPRESA DEMO S.A.C.',
      idCliente: 407,
      idVariante: 2,
      idPersonal: 4,
      idRecurso: 1,
      tiempoDeclaradoMin: 30,
      idMedioPago: 2,
      monto: 35,
      canal: 'QR',
    });
    peticion.flush({ detail: 'Sin aprobar', regla: 'RN11' }, { status: 422, statusText: 'Error' });
    await estable();
    expect(raiz.querySelector('app-comprobante-emitido')).toBeNull();
    expect(raiz.querySelector('form.gs')).not.toBeNull();
  });
});

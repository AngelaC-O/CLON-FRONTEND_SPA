import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { MedioPagoDTO, ServicioDTO, TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { entrarComo } from '../../../../testing/sesion';
import { SinCita } from './sin-cita';

const LIBRES = [
  { inicio: '2026-11-03T10:15:00', duracionMin: 30, idsPersonal: [4, 5], idsRecurso: [1, 2] },
];
const MEDIOS: MedioPagoDTO[] = [
  { idMedioPago: 11, nombre: 'EFECTIVO', estado: 'ACTIVO', usaPasarela: false },
  { idMedioPago: 12, nombre: 'YAPE', estado: 'ACTIVO', usaPasarela: true },
  { idMedioPago: 14, nombre: 'TARJETA', estado: 'ACTIVO', usaPasarela: true },
];
const TIPOS: TipoDocumentoDTO[] = [
  { idTipoDocumento: 1, abreviatura: 'DNI', longitudMin: 8, longitudMax: 8, soloNumeros: true },
  { idTipoDocumento: 3, abreviatura: 'RUC', longitudMin: 11, longitudMax: 11, soloNumeros: true },
];
const SERVICIOS: ServicioDTO[] = [
  {
    idServicio: 1,
    idArea: 1,
    nombre: 'Corte de Cabello Caballero',
    duracionRefMin: 30,
    tipoRecurso: 'SILLON',
    variantes: [{ idVariante: 2, nombreVariante: 'Clásico', precio: 35 }],
  },
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
  const escribir = (id: string, valor: string) => {
    clics++;
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    clics++;
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
  };
  /** Un clic: el servicio tiene una sola variante, que queda elegida, y propone su precio. */
  const elegirServicio = async (libres: object[] = LIBRES) => {
    clics++;
    const lista = raiz.querySelector<HTMLSelectElement>('#rapidaServicio')!;
    lista.selectedIndex = 1;
    lista.dispatchEvent(new Event('change'));
    await estable();
    http.expectOne('/api/v1/ventas/rapidas/libres?idVariante=2').flush(libres);
    await estable();
  };

  const montar = async (
    permisos = ['VENTAS:CREAR', 'VENTAS:VER', 'CLIENTAS:VER', 'CATALOGO:VER'],
  ) => {
    clics = 0;
    TestBed.configureTestingModule({
      imports: [SinCita],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(SinCita);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/tipos-documento').flush(TIPOS);
    http.expectOne('/api/v1/medios-pago').flush(MEDIOS);
    if (permisos.includes('CATALOGO:VER')) {
      http.expectOne('/api/v1/servicios?estado=ACTIVO').flush(SERVICIOS);
    }
    await estable();
  };

  afterEach(() => {
    http.verify();
    document.querySelectorAll('iframe').forEach((marco) => marco.remove());
    vi.restoreAllMocks();
  });

  it('RNF29 y CUS13: servicio de GET /servicios, cobro y comprobante en 5 clics', async () => {
    await montar();
    escribir('rapidaPaso', 'De paso');
    await elegirServicio();
    expect(raiz.querySelector<HTMLSelectElement>('#rapidaPersonal')?.options.length).toBe(2);
    expect(raiz.querySelector<HTMLInputElement>('#rapidaDuracion')?.value).toBe('30');
    expect(raiz.querySelector<HTMLInputElement>('#rapidaMonto')?.value).toBe('35');
    await enviar();
    const peticion = http.expectOne('/api/v1/ventas/rapidas');
    expect(peticion.request.body).toEqual({
      tipo: 'BOLETA',
      nombreClientePaso: 'De paso',
      idVariante: 2,
      idPersonal: 4,
      idRecurso: 1,
      tiempoDeclaradoMin: 30,
      idMedioPago: 11,
      monto: 35,
    });
    peticion.flush(CERRADA, { status: 201, statusText: 'Created' });
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
    expect(clics).toBeLessThanOrEqual(5);

    boton('Nueva atención')!.click();
    await estable();
    expect(raiz.querySelector<HTMLInputElement>('#rapidaPaso')?.value).toBe('');
  });

  it('ofrece los medios activos de GET /medios-pago y propone el efectivo (Duda 11)', async () => {
    await montar();
    const medios = [...raiz.querySelectorAll('[aria-label="Medio de pago"] button')];
    expect(medios.map((b) => b.textContent?.trim())).toEqual(['Efectivo', 'Yape', 'Tarjeta']);
    expect(medios[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('sin CATALOGO:VER la variante se escribe por código', async () => {
    await montar(['VENTAS:CREAR', 'VENTAS:VER']);
    expect(raiz.querySelector('#rapidaServicio')).toBeNull();
    escribir('rapidaIdVariante', '2');
    http.expectOne('/api/v1/ventas/rapidas/libres?idVariante=2').flush(LIBRES);
  });

  it('RN35: pide el nombre del cliente de paso', async () => {
    await montar();
    await elegirServicio();
    await enviar();
    http.expectNone('/api/v1/ventas/rapidas');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('RN35');
  });

  it('avisa si no hay especialista o recurso libres, y no deja cobrar', async () => {
    await montar();
    escribir('rapidaPaso', 'De paso');
    await elegirServicio([]);
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain('No hay especialista');
    await enviar();
    http.expectNone('/api/v1/ventas/rapidas');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('especialista');
  });

  it('RN52: con 202 la venta queda abierta y lleva a IGU_Cobro para cerrarla', async () => {
    await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await clic('Clienta registrada');
    escribir('buscarClientaCita', 'Marisol');
    await clic('Buscar');
    http
      .expectOne('/api/v1/clientes?nombres=Marisol')
      .flush([{ idCliente: 407, nombres: 'Marisol', apellidos: 'Quispe', telefono: '987' }]);
    await estable();
    await clic('Marisol Quispe');
    await elegirServicio();
    await clic('Yape');
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain('RN52');
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
      idMedioPago: 12,
      monto: 35,
      canal: 'QR',
    });
    peticion.flush(
      {
        idVenta: 8814,
        estado: 'ABIERTA',
        pendiente: 35,
        total: 35,
        cobrosPendientes: [{ idTransaccion: 5512, enlacePago: 'https://izipay.example/xyz' }],
      },
      { status: 202, statusText: 'Accepted' },
    );
    await estable();
    expect(raiz.querySelector('app-comprobante-emitido')).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/ventas/cobros'], { queryParams: { idVenta: 8814 } });
  });

  it('un 422 deja el formulario para corregir', async () => {
    await montar();
    escribir('rapidaPaso', 'De paso');
    await elegirServicio();
    await enviar();
    http
      .expectOne('/api/v1/ventas/rapidas')
      .flush(
        { detail: 'El monto no coincide', regla: 'RN11' },
        { status: 422, statusText: 'Error' },
      );
    await estable();
    expect(raiz.querySelector('app-comprobante-emitido')).toBeNull();
    expect(raiz.querySelector('form.gs')).not.toBeNull();
  });
});

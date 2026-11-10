import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MedioPagoDTO } from '../../../core/api/modelos.generados';
import { entrarComo } from '../../../../testing/sesion';
import { SolicitudAnulacionDTO, VentaDTO } from '../../modelos/ventas.modelos';
import { Devoluciones } from './devoluciones';

const MEDIOS: MedioPagoDTO[] = [
  { idMedioPago: 11, nombre: 'EFECTIVO', estado: 'ACTIVO', usaPasarela: false },
  { idMedioPago: 12, nombre: 'YAPE', estado: 'ACTIVO', usaPasarela: true },
  { idMedioPago: 14, nombre: 'TARJETA', estado: 'ACTIVO', usaPasarela: true },
];
const aprobada = (
  idVenta: number,
  formaDevolucion: SolicitudAnulacionDTO['formaDevolucion'],
): SolicitudAnulacionDTO => ({
  idSolicitud: idVenta,
  idVenta,
  comprobante: `B001-${idVenta}`,
  estado: 'APROBADA',
  totalVenta: 90,
  formaDevolucion,
  fechaResolucion: '2026-11-09T11:30:00',
});
const ANULADA: VentaDTO = {
  idVenta: 620,
  estado: 'ANULADA',
  total: 90,
  pagos: [
    { idPago: 1, idMedioPago: 14, idTransaccion: 80, monto: 50, referencia: 'IZ-80' },
    { idPago: 2, idMedioPago: 12, idTransaccion: 81, monto: 30 },
    { idPago: 3, idMedioPago: 11, monto: 10 },
  ],
};

describe('Devoluciones (CUS24)', () => {
  let fixture: ComponentFixture<Devoluciones>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === texto,
    );
  const clic = async (texto: string) => {
    boton(texto)!.click();
    await estable();
  };
  const verPagos = async () => {
    await clic('Ver pagos');
    http.expectOne('/api/v1/ventas/620').flush(ANULADA);
    await estable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Devoluciones],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos: ['VENTAS:EDITAR', 'VENTAS:VER'] });
    fixture = TestBed.createComponent(Devoluciones);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/medios-pago').flush(MEDIOS);
    http
      .expectOne('/api/v1/solicitudes-anulacion?estado=APROBADA')
      .flush([aprobada(620, 'MEDIO_ORIGINAL'), aprobada(621, 'SALDO_FAVOR')]);
    await estable();
  });

  afterEach(() => http.verify());

  it('lista solo las ventas anuladas con devolución por el medio original', () => {
    const tarjetas = raiz.querySelectorAll('.devolucion');
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0].textContent).toContain('B001-620');
    expect(tarjetas[0].textContent).toContain('09/11/2026 11:30');
  });

  it('según el medio: tarjeta por Izipay, Yape con número de operación, efectivo en caja', async () => {
    await verPagos();
    const pagos = [...raiz.querySelectorAll('.pago')].map((p) => p.textContent ?? '');
    expect(pagos[0]).toContain('Tarjeta');
    expect(pagos[1]).toContain('Yape');
    expect(pagos[1]).toContain('Registrar devolución manual');
    expect(pagos[2]).toContain('El efectivo se devuelve desde la caja.');
    expect(boton('Devolver pago')).toBeDefined();
  });

  it('«Devolver pago» devuelve la tarjeta por la pasarela', async () => {
    await verPagos();
    await clic('Devolver pago');
    const peticion = http.expectOne('/api/v1/ventas/620/devolucion');
    expect(peticion.request.body).toEqual({ formaDevolucion: 'MEDIO_ORIGINAL' });
    peticion.flush({
      idVenta: 620,
      devoluciones: [{ idTransaccion: 80, codigoOperacion: 'REEMB-80', estado: 'APROBADA' }],
    });
    await estable();
    expect(raiz.querySelector('.pago .chip.ok')?.textContent).toContain('REEMB-80');
    expect(boton('Devolver pago')).toBeUndefined();
  });

  it('«Registrar devolución manual» pide el número de operación de la app', async () => {
    await verPagos();
    await clic('Registrar devolución manual');
    http.expectNone('/api/v1/ventas/620/devolucion-manual');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('número de operación');

    const codigo = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Número de operación del pago 81"]',
    )!;
    codigo.value = 'YAPE-123456';
    codigo.dispatchEvent(new Event('input'));
    await clic('Registrar devolución manual');
    const peticion = http.expectOne('/api/v1/ventas/620/devolucion-manual');
    expect(peticion.request.body).toEqual({ idTransaccion: 81, codigoOperacion: 'YAPE-123456' });
    peticion.flush(
      { idVenta: 620, idTransaccion: 81, codigoOperacion: 'YAPE-123456' },
      { status: 201, statusText: 'Created' },
    );
    await estable();
    expect(raiz.querySelectorAll('.pago')[1].textContent).toContain('Devuelto · YAPE-123456');
  });

  it('el 422 de la pasarela queda junto a la venta', async () => {
    await verPagos();
    await clic('Devolver pago');
    http
      .expectOne('/api/v1/ventas/620/devolucion')
      .flush(
        { detail: 'La pasarela rechazó la devolución', regla: 'RN44' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('rechazó la devolución');
  });
});

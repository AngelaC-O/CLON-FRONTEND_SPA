import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { SolicitudAnulacionDTO } from '../../modelos/ventas.modelos';
import { BandejaAnulaciones } from './bandeja-anulaciones';

const PENDIENTE: SolicitudAnulacionDTO = {
  idSolicitud: 15,
  idVenta: 620,
  comprobante: 'B001-00000125',
  estado: 'PENDIENTE',
  totalVenta: 90,
  motivo: 'La clienta desistió',
  codigoMotivo: '06',
  formaDevolucion: 'MEDIO_ORIGINAL',
  idUsuarioSolicita: 2,
  idCliente: 407,
  nombreCliente: 'Rosaura Quispe',
  nombreUsuarioSolicita: 'Rosa Quispe',
  fechaSolicitud: '2026-11-09T11:00:00',
};
const LISTA = '/api/v1/solicitudes-anulacion?estado=PENDIENTE';

describe('BandejaAnulaciones (CUS23)', () => {
  let fixture: ComponentFixture<BandejaAnulaciones>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string, dentro = '') =>
    [...raiz.querySelectorAll<HTMLButtonElement>(`${dentro} button`.trim())].find(
      (b) => b.textContent?.trim() === texto,
    );
  const clic = async (texto: string, dentro = '') => {
    boton(texto, dentro)!.click();
    await estable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BandejaAnulaciones],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos: ['VENTAS:EDITAR'] });
    fixture = TestBed.createComponent(BandejaAnulaciones);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne(LISTA).flush([PENDIENTE]);
    await estable();
  });

  afterEach(() => http.verify());

  it('lista las PENDIENTES con venta, total, motivo, quién y cuándo', () => {
    const fila = raiz.querySelector('tbody tr')!;
    expect(fila.textContent).toContain('B001-00000125');
    expect(fila.textContent).toContain('S/ 90.00');
    expect(fila.textContent).toContain('La clienta desistió');
    expect(fila.textContent).toContain('06 · Devolución total');
    // Quién solicitó y la clienta, por su nombre (Duda 14, It. 2.1).
    expect(fila.textContent).toContain('Rosa Quispe');
    expect(fila.textContent).toContain('Rosaura Quispe');
    expect(fila.textContent).not.toMatch(/Usuario 2|Clienta 407|Venta 620/);
    expect(fila.textContent).toContain('09/11/2026 11:00');
  });

  it('«Aprobar anulación» confirma y muestra la nota de crédito con su estado SUNAT', async () => {
    let aprobada: SolicitudAnulacionDTO | undefined;
    fixture.componentInstance.aprobacion.subscribe((s) => (aprobada = s));
    await clic('Aprobar anulación', 'tbody');
    http.expectNone('/api/v1/solicitudes-anulacion/15/aprobacion');
    await clic('Aprobar anulación', 'app-modal');
    const peticion = http.expectOne('/api/v1/solicitudes-anulacion/15/aprobacion');
    expect(peticion.request.method).toBe('POST');
    peticion.flush({ ...PENDIENTE, estado: 'APROBADA', idNotaCredito: 701 });
    await estable();
    http.expectOne('/api/v1/comprobantes/701').flush({
      idComprobante: 701,
      tipo: 'NC_BOLETA',
      serie: 'BC01',
      numero: '00000004',
      estadoSunat: 'PENDIENTE',
    });
    await estable();
    const nota = raiz.querySelector('#notaCredito')!;
    expect(nota.textContent).toContain('Nota de crédito BC01-00000004');
    expect(nota.textContent).toContain('SUNAT: PENDIENTE');
    expect(nota.textContent).toContain('«Devoluciones»');
    expect(aprobada?.idSolicitud).toBe(15);
    expect(raiz.querySelector('tbody')?.textContent).toContain('No hay solicitudes pendientes.');

    await clic('Actualizar estado SUNAT');
    http
      .expectOne('/api/v1/comprobantes/701')
      .flush({ idComprobante: 701, serie: 'BC01', numero: '00000004', estadoSunat: 'ACEPTADO' });
    await estable();
    expect(nota.textContent).toContain('SUNAT: ACEPTADO');
  });

  it('el 409 de una solicitud ya resuelta vuelve a leer la bandeja', async () => {
    await clic('Aprobar anulación', 'tbody');
    await clic('Aprobar anulación', 'app-modal');
    http
      .expectOne('/api/v1/solicitudes-anulacion/15/aprobacion')
      .flush(
        { detail: 'La solicitud ya está resuelta', regla: 'RN32' },
        { status: 409, statusText: 'Conflict' },
      );
    await estable();
    http.expectOne(LISTA).flush([]);
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
  });

  it('«Rechazar» pide el motivo y quita la solicitud', async () => {
    await clic('Rechazar', 'tbody');
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectNone('/api/v1/solicitudes-anulacion/15/rechazo');
    expect(raiz.querySelector('app-modal .alert.bad')?.textContent).toContain('motivo');

    const motivo = raiz.querySelector<HTMLInputElement>('#motivoRechazo')!;
    motivo.value = 'La venta es correcta';
    motivo.dispatchEvent(new Event('input'));
    raiz.querySelector('app-modal form')!.dispatchEvent(new Event('submit'));
    await estable();
    const peticion = http.expectOne('/api/v1/solicitudes-anulacion/15/rechazo');
    expect(peticion.request.body).toEqual({ motivoRechazo: 'La venta es correcta' });
    peticion.flush({ ...PENDIENTE, estado: 'RECHAZADA', motivoRechazo: 'La venta es correcta' });
    await estable();
    expect(raiz.querySelector('app-modal')).toBeNull();
    expect(raiz.querySelector('tbody')?.textContent).toContain('No hay solicitudes pendientes.');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entrarComo } from '../../../../testing/sesion';
import { VentaDTO } from '../../modelos/ventas.modelos';
import { SolicitudAnulacion } from './solicitud-anulacion';

const CERRADA: VentaDTO = {
  idVenta: 620,
  idCliente: 407,
  estado: 'CERRADA',
  total: 90,
  comprobante: { idComprobante: 700, tipo: 'BOLETA', serie: 'B001', numero: '00000125' },
};

describe('SolicitudAnulacion (CUS22)', () => {
  let fixture: ComponentFixture<SolicitudAnulacion>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const boton = (texto: string) =>
    [...raiz.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const solicitar = async () => {
    raiz.querySelector('#ventaAnular form')!.dispatchEvent(new Event('submit'));
    await estable();
  };

  /** Monta la vista con la venta en la ruta y responde GET /ventas/{idVenta}. */
  const montar = async (venta: VentaDTO = CERRADA) => {
    TestBed.configureTestingModule({
      imports: [SolicitudAnulacion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos: ['VENTAS:ANULAR', 'VENTAS:VER'] });
    fixture = TestBed.createComponent(SolicitudAnulacion);
    fixture.componentRef.setInput('idVentaInicial', venta.idVenta);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne(`/api/v1/ventas/${venta.idVenta}`).flush(venta);
    await estable();
  };

  afterEach(() => http.verify());

  it('pide motivo, código SUNAT y forma de devolución, sin usuario ni clave', async () => {
    await montar();
    expect(raiz.querySelector('#ventaAnular')?.textContent).toContain('B001-00000125');
    const codigos = [...raiz.querySelectorAll('#anularCodigo option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(codigos).toEqual([
      '01 · Anulación de la operación',
      '02 · Anulación por error en el RUC',
      '06 · Devolución total',
    ]);
    expect(raiz.querySelector('input[type="password"]')).toBeNull();
    expect(raiz.textContent).not.toContain('USUARIO');
  });

  it('envía la solicitud y la venta muestra «Anulación pendiente»', async () => {
    await montar();
    escribir('anularMotivo', 'La clienta desistió');
    const codigo = raiz.querySelector<HTMLSelectElement>('#anularCodigo')!;
    codigo.value = '06';
    codigo.dispatchEvent(new Event('change'));
    boton('Como saldo a favor de la clienta')!.click();
    await estable();
    await solicitar();
    const peticion = http.expectOne('/api/v1/ventas/620/solicitudes-anulacion');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      motivo: 'La clienta desistió',
      codigoMotivo: '06',
      formaDevolucion: 'SALDO_FAVOR',
    });
    peticion.flush({ idSolicitud: 15, estado: 'PENDIENTE', idVenta: 620 });
    await estable();
    expect(raiz.querySelector('.alert.ok')?.textContent).toContain(
      'Solicitud enviada a la administradora.',
    );
    expect(raiz.querySelector('.chip.warn')?.textContent).toContain('Anulación pendiente');
    expect(boton('Solicitar anulación')).toBeUndefined();
  });

  it('sin motivo no envía', async () => {
    await montar();
    await solicitar();
    http.expectNone('/api/v1/ventas/620/solicitudes-anulacion');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('motivo');
  });

  it('el 409 de otra solicitud PENDIENTE marca la venta', async () => {
    await montar();
    escribir('anularMotivo', 'Error en el monto');
    await solicitar();
    http.expectOne('/api/v1/ventas/620/solicitudes-anulacion').flush(
      {
        detail: 'La venta ya tiene una solicitud de anulación PENDIENTE',
        regla: 'UQ_SOL_ANUL_PENDIENTE',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await estable();
    expect(raiz.textContent).toContain('Anulación pendiente');
  });

  it('un cliente de paso no puede elegir saldo a favor (RN44)', async () => {
    await montar({ ...CERRADA, idCliente: undefined });
    expect(boton('Como saldo a favor de la clienta')?.disabled).toBe(true);
  });

  it('una venta que no está CERRADA no se anula (RN12)', async () => {
    await montar({ ...CERRADA, estado: 'ANULADA' });
    expect(raiz.textContent).toContain('Solo se anula una venta cerrada');
    expect(boton('Solicitar anulación')).toBeUndefined();
  });

  it('busca otra venta por número y muestra el 404', async () => {
    await montar();
    escribir('anularIdVenta', '999');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
    http
      .expectOne('/api/v1/ventas/999')
      .flush(
        { detail: 'La venta no existe', regla: 'RF32' },
        { status: 404, statusText: 'Not Found' },
      );
    await estable();
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('La venta no existe');
    expect(raiz.querySelector('#ventaAnular')).toBeNull();
  });
});

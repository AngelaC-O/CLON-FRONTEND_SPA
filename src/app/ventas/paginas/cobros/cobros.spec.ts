import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Cobros } from './cobros';

const VENTA = {
  idVenta: 8812,
  estado: 'ABIERTA',
  subtotal: 60,
  igv: 0,
  descuento: 0,
  adelantoAplicado: 0,
  saldoFavorAplicado: 0,
  total: 60,
  pagado: 0,
  pendiente: 60,
  pagos: [],
  cobrosPendientes: [],
  detalles: [{ idDetalle: 1, idAtencion: 1532, tipoItem: 'SERVICIO', subtotal: 60 }],
};
const CERRADA = {
  idVenta: 8812,
  estado: 'CERRADA',
  total: 60,
  comprobante: {
    idComprobante: 7120,
    tipo: 'FACTURA',
    serie: 'F001',
    numero: '00000125',
    estadoSunat: 'PENDIENTE',
  },
};

describe('Cobros', () => {
  let fixture: ComponentFixture<Cobros>;
  let raiz: HTMLElement;
  let http: HttpTestingController;

  const estable = () => fixture.whenStable();
  const botones = () => [...raiz.querySelectorAll('button')];
  const boton = (texto: string) => botones().find((b) => b.textContent?.includes(texto));
  const clic = async (texto: string) => {
    boton(texto)!.click();
    await estable();
  };
  const pagoEn = async (medio: string) => {
    botones()
      .find((b) => b.getAttribute('aria-label') === `Registrar pago en ${medio}`)!
      .click();
    await estable();
  };
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const montar = async (venta: object | null = null, idAtencion?: string) => {
    sessionStorage.setItem(
      'cautiva.sesion',
      JSON.stringify({ idSede: 1, permisos: ['VENTAS:CREAR', 'VENTAS:VER'] }),
    );
    if (venta) {
      sessionStorage.setItem('cautiva.venta', JSON.stringify({ venta, enEspera: [] }));
    }
    TestBed.configureTestingModule({
      imports: [Cobros],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...(idAtencion
          ? [
              {
                provide: ActivatedRoute,
                useValue: {
                  snapshot: {
                    queryParamMap: { get: () => idAtencion },
                  },
                },
              },
            ]
          : []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Cobros);
    await estable();
    raiz = fixture.nativeElement;
  };

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    document.querySelectorAll('iframe').forEach((marco) => marco.remove());
    vi.restoreAllMocks();
  });

  it('no ofrece anulación, nota de crédito ni venta de productos', async () => {
    await montar(VENTA);
    const texto = raiz.textContent!.toLowerCase();
    expect(texto).not.toContain('anular');
    expect(texto).not.toContain('nota de crédito');
    expect(texto).not.toContain('venta de productos');
  });

  it('CUS18: crea la venta desde la atención y aplica el adelanto de la cita', async () => {
    await montar();
    escribir('cobroIdAtencion', '1532');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    const crear = http.expectOne('/api/v1/ventas');
    expect(crear.request.body).toEqual({ idAtencion: 1532 });
    crear.flush(VENTA);
    await estable();
    const aplicar = http.expectOne('/api/v1/ventas/8812/descuentos');
    expect(aplicar.request.method).toBe('PATCH');
    expect(aplicar.request.body).toEqual({});
    aplicar.flush({ ...VENTA, adelantoAplicado: 10, total: 50, pendiente: 50 });
    await estable();
    expect(raiz.textContent).toContain('Adelanto aplicado');
    expect(raiz.querySelector('.kpi')?.textContent).toContain('S/ 50.00');
  });

  it('propone la atención que llega desde IGU_Atencion, sin cobrarla sola', async () => {
    await montar(null, '1532');
    expect(raiz.querySelector<HTMLInputElement>('#cobroIdAtencion')?.value).toBe('1532');
    http.expectNone('/api/v1/ventas');
  });

  it('CUS18: aplica promoción y saldo a favor', async () => {
    await montar(VENTA);
    escribir('cobroPromocion', '3');
    escribir('cobroSaldo', '5');
    await clic('Aplicar descuentos');
    const peticion = http.expectOne('/api/v1/ventas/8812/descuentos');
    expect(peticion.request.body).toEqual({ idPromocion: 3, saldoFavorAplicado: 5 });
    peticion.flush({ ...VENTA, saldoFavorAplicado: 5, total: 55, pendiente: 55 });
    await estable();
    expect(raiz.textContent).toContain('Saldo a favor aplicado');
  });

  it('RN11: no deja pasarse del total ni cerrar mientras falte pagar', async () => {
    await montar(VENTA);
    expect(boton('Cerrar venta')?.disabled).toBe(true);
    escribir('pagoMonto1', '70');
    await pagoEn('Efectivo');
    http.expectNone('/api/v1/ventas/8812/pagos');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('RN11');

    await clic('Todo');
    expect(raiz.querySelector<HTMLInputElement>('#pagoMonto1')?.value).toBe('60');
    await pagoEn('Efectivo');
    const peticion = http.expectOne('/api/v1/ventas/8812/pagos');
    expect(peticion.request.body).toEqual({ pagos: [{ idMedioPago: 1, monto: 60 }] });
    peticion.flush({
      ...VENTA,
      pagado: 60,
      pendiente: 0,
      pagos: [{ idPago: 9902, idMedioPago: 1, monto: 60 }],
    });
    await estable();
    expect(boton('Cerrar venta')?.disabled).toBe(false);
    expect(raiz.textContent).toContain('Pagos completos');
  });

  it('RN42: muestra el QR, espera a Izipay y reenvía con el id de la transacción', async () => {
    await montar(VENTA);
    escribir('pagoMonto2', '40');
    await pagoEn('Yape');
    const cobro = http.expectOne('/api/v1/ventas/8812/pagos');
    expect(cobro.request.body).toEqual({ pagos: [{ idMedioPago: 2, monto: 40, canal: 'QR' }] });
    cobro.flush(
      {
        ...VENTA,
        cobrosPendientes: [{ idTransaccion: 5510, enlacePago: 'https://izipay.example/abc' }],
      },
      { status: 202, statusText: 'Accepted' },
    );
    await estable();
    expect(raiz.querySelector('app-qr-pago path')?.getAttribute('d')).toContain('h1v1h-1z');
    expect(raiz.textContent).toContain('Esperando a Izipay');
    expect(boton('Cerrar venta')?.disabled).toBe(true);
    // Lo que espera a Izipay no se puede cobrar dos veces (RN11).
    await clic('Todo');
    expect(raiz.querySelector<HTMLInputElement>('#pagoMonto1')?.value).toBe('20');

    await clic('Verificar aprobación');
    http
      .expectOne('/api/v1/ventas/8812/pagos')
      .flush({ detail: 'Aún no', regla: 'RF103' }, { status: 422, statusText: 'Unprocessable' });
    await estable();
    expect(raiz.textContent).toContain('Esperando a Izipay');

    await clic('Verificar aprobación');
    const reenvio = http.expectOne('/api/v1/ventas/8812/pagos');
    expect(reenvio.request.body).toEqual({
      pagos: [{ idMedioPago: 2, monto: 40, idTransaccion: 5510 }],
    });
    reenvio.flush({
      ...VENTA,
      pagado: 40,
      pendiente: 20,
      pagos: [{ idPago: 9901, idMedioPago: 2, monto: 40, referencia: 'IZ-1' }],
    });
    await estable();
    expect(raiz.textContent).not.toContain('Esperando a Izipay');
    expect(raiz.textContent).toContain('IZ-1');
  });

  it('un cobro por enlace se comparte, y conserva la espera al recargar', async () => {
    await montar(VENTA);
    escribir('pagoMonto4', '60');
    await pagoEn('Tarjeta');
    http.expectOne('/api/v1/ventas/8812/pagos').flush({
      ...VENTA,
      cobrosPendientes: [{ idTransaccion: 5511, enlacePago: 'https://izipay.example/t' }],
    });
    await estable();
    expect(raiz.querySelector('app-qr-pago')).toBeNull();
    expect(raiz.querySelector<HTMLInputElement>('app-compartir-enlace input')?.value).toBe(
      'https://izipay.example/t',
    );
    expect(JSON.parse(sessionStorage.getItem('cautiva.venta')!).enEspera[0].idTransaccion).toBe(
      5511,
    );
    await clic('Quitar');
    expect(raiz.textContent).not.toContain('Esperando a Izipay');
  });

  it('CUS19: consulta el RUC, emite la factura y muestra el estado SUNAT', async () => {
    await montar({ ...VENTA, pagado: 60, pendiente: 0 });
    await clic('Factura');
    escribir('compradorRuc', '20601234567');
    await clic('Consultar RUC');
    http
      .expectOne('/api/v1/ventas/consulta-ruc/20601234567')
      .flush({ resultado: 'ENCONTRADO', razonSocial: 'EMPRESA DEMO S.A.C.' });
    await estable();
    expect(raiz.querySelector<HTMLInputElement>('#compradorNombre')?.value).toBe(
      'EMPRESA DEMO S.A.C.',
    );
    await clic('Cerrar venta');
    const peticion = http.expectOne('/api/v1/ventas/8812/cierre');
    expect(peticion.request.body).toEqual({
      tipo: 'FACTURA',
      idTipoDocComprador: 3,
      nroDocComprador: '20601234567',
      nombreComprador: 'EMPRESA DEMO S.A.C.',
    });
    peticion.flush(CERRADA);
    await estable();
    const comprobante = raiz.querySelector('app-comprobante-emitido')!;
    expect(comprobante.textContent).toContain('Factura F001-00000125');
    expect(comprobante.textContent).toContain('SUNAT: PENDIENTE');
    expect(comprobante.textContent).toContain('RN46');
    expect(sessionStorage.getItem('cautiva.venta')).toBeNull();
    await clic('Listo');
    expect(raiz.querySelector('app-comprobante-emitido')).toBeNull();
  });

  it('CUS19: si la consulta no responde, la razón social se escribe a mano', async () => {
    await montar({ ...VENTA, pagado: 60, pendiente: 0 });
    await clic('Factura');
    escribir('compradorRuc', '20601234567');
    await clic('Consultar RUC');
    http
      .expectOne('/api/v1/ventas/consulta-ruc/20601234567')
      .flush({ resultado: 'ERROR' }, { status: 202, statusText: 'Accepted' });
    await estable();
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain('RN45');
    await clic('Cerrar venta');
    http.expectNone('/api/v1/ventas/8812/cierre');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('RN08');
  });

  it('RN08: avisa que la boleta alta lleva comprador; sin datos se envía solo el tipo', async () => {
    await montar({ ...VENTA, subtotal: 800, total: 800, pagado: 800, pendiente: 0 });
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain('RN08');
    await clic('Cerrar venta');
    const peticion = http.expectOne('/api/v1/ventas/8812/cierre');
    expect(peticion.request.body).toEqual({ tipo: 'BOLETA' });
    peticion.flush({ detail: 'Falta comprador' }, { status: 422, statusText: 'Unprocessable' });
    await estable();
    expect(raiz.querySelector('app-comprobante-emitido')).toBeNull();
  });

  it('CUS20: imprime el PDF y comparte el enlace por correo', async () => {
    await montar({ ...VENTA, pagado: 60, pendiente: 0 });
    await clic('Cerrar venta');
    http.expectOne('/api/v1/ventas/8812/cierre').flush({
      ...CERRADA,
      comprobante: { ...CERRADA.comprobante, tipo: 'BOLETA', estadoSunat: 'ACEPTADO' },
    });
    await estable();

    URL.createObjectURL = vi.fn(() => 'blob:comprobante');
    URL.revokeObjectURL = vi.fn();
    await clic('Imprimir comprobante');
    const pdf = http.expectOne('/api/v1/comprobantes/7120/representacion');
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    await estable();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(document.querySelector('iframe')).not.toBeNull();

    await clic('Correo');
    escribir('entregaCorreo', 'no-es-correo');
    await clic('Compartir comprobante');
    raiz.querySelector('app-comprobante-emitido form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectNone((p) => p.url.includes('/enlace'));
    expect(raiz.querySelector('app-comprobante-emitido .alert.bad')?.textContent).toContain(
      'correo',
    );

    escribir('entregaCorreo', 'clienta@ejemplo.com');
    raiz.querySelector('app-comprobante-emitido form')!.dispatchEvent(new Event('submit'));
    await estable();
    http
      .expectOne('/api/v1/comprobantes/7120/enlace?canal=CORREO&correo=clienta@ejemplo.com')
      .flush({ enlace: 'https://backoffice.example/publico/7120' });
    await estable();
    const correo = raiz.querySelector<HTMLAnchorElement>('app-compartir-enlace a')!;
    expect(correo.getAttribute('href')).toContain('mailto:clienta%40ejemplo.com');
    expect(correo.getAttribute('href')).toContain(
      encodeURIComponent('https://backoffice.example/publico/7120'),
    );
  });

  it('CUS21: arma la proforma, la imprime y no guarda nada', async () => {
    await montar();
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await clic('Emitir proforma');
    const modal = () => raiz.querySelector('app-proforma')!;
    modal().querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
    expect(modal().querySelector('.alert.bad')?.textContent).toContain('clienta');

    escribir('proformaNombre', 'Novia');
    escribir('proformaValidez', '2026-11-30');
    escribir('proformaCodigo0', '2');
    escribir('proformaCantidad0', '2');
    modal().querySelector('form')!.dispatchEvent(new Event('submit'));
    const peticion = http.expectOne('/api/v1/proformas');
    expect(peticion.request.body).toEqual({
      nombreCliente: 'Novia',
      fechaValidez: '2026-11-30',
      items: [{ tipoItem: 'SERVICIO', cantidad: 2, idVariante: 2 }],
    });
    peticion.flush({
      nombreCliente: 'Novia',
      fechaValidez: '2026-11-30',
      total: 70,
      items: [{ tipoItem: 'SERVICIO', cantidad: 2, idVariante: 2, subtotal: 70 }],
    });
    await estable();
    expect(modal().querySelector('.imprimible')?.textContent).toContain('S/ 70.00');
    expect(modal().textContent).toContain('RN09');
    await clic('Imprimir');
    expect(imprimir).toHaveBeenCalled();
    expect(sessionStorage.getItem('cautiva.venta')).toBeNull();
  });
});

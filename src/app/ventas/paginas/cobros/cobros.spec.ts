import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import {
  MedioPagoDTO,
  PorCobrarDTO,
  ServicioDTO,
  TipoDocumentoDTO,
  VentaDTO,
} from '../../../core/api/modelos.generados';
import { entrarComo } from '../../../../testing/sesion';
import { ComprobanteEmitido } from '../comprobante/comprobante-emitido';
import { Cobros } from './cobros';

/** Ids distintos de 1 a 4: ya no se suponen por orden de inserción (Duda 11). */
const MEDIOS: MedioPagoDTO[] = [
  { idMedioPago: 11, nombre: 'EFECTIVO', estado: 'ACTIVO', usaPasarela: false },
  { idMedioPago: 12, nombre: 'YAPE', estado: 'ACTIVO', usaPasarela: true },
  { idMedioPago: 13, nombre: 'PLIN', estado: 'INACTIVO', usaPasarela: true },
  { idMedioPago: 14, nombre: 'TARJETA', estado: 'ACTIVO', usaPasarela: true },
];
const TIPOS: TipoDocumentoDTO[] = [
  { idTipoDocumento: 1, abreviatura: 'DNI', longitudMin: 8, longitudMax: 8, soloNumeros: true },
  { idTipoDocumento: 3, abreviatura: 'RUC', longitudMin: 11, longitudMax: 11, soloNumeros: true },
];
const VENTA: VentaDTO = {
  idVenta: 8812,
  idCliente: 407,
  nombreCliente: 'Rosaura Quispe',
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
  detalles: [
    {
      idDetalle: 1,
      idAtencion: 1532,
      tipoItem: 'SERVICIO',
      subtotal: 60,
      descripcion: 'Corte de Cabello Caballero · Estándar',
      nombreEspecialista: 'Lucía Ramos',
    },
  ],
};
const PAGADA: VentaDTO = { ...VENTA, pagado: 60, pendiente: 0 };
const POR_COBRAR: PorCobrarDTO = {
  atenciones: [
    {
      idAtencion: 1531,
      idCliente: 405,
      idVariante: 3,
      adelantoMonto: 0,
      nombreCliente: 'Marisol Quispe',
      nombreServicio: 'Manicura · Clásica',
      nombreEspecialista: 'Ana Torres',
    },
    {
      idAtencion: 1532,
      idCliente: 407,
      idVariante: 2,
      adelantoMonto: 10,
      nombreCliente: 'Rosaura Quispe',
      nombreServicio: 'Corte de Cabello Caballero · Estándar',
      nombreEspecialista: 'Lucía Ramos',
    },
  ],
  ventasAbiertas: [{ ...VENTA, idVenta: 8800, total: 35, pendiente: 35 }],
};
const CERRADA: VentaDTO = {
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
  const etiquetado = (etiqueta: string) =>
    botones().find((b) => b.getAttribute('aria-label') === etiqueta)!;
  const clic = async (texto: string) => {
    boton(texto)!.click();
    await estable();
  };
  const pagoEn = async (medio: string) => {
    etiquetado(`Registrar pago en ${medio}`).click();
    await estable();
  };
  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };

  /** Sin venta, pide «Por cobrar»; con venta, la retoma por ?idVenta= (GET /ventas/{id}). */
  const montar = async (
    opciones: {
      venta?: VentaDTO;
      idAtencion?: number;
      permisos?: string[];
      porCobrar?: PorCobrarDTO;
    } = {},
  ) => {
    const permisos = opciones.permisos ?? ['VENTAS:CREAR', 'VENTAS:VER', 'CATALOGO:VER'];
    const parametros: Record<string, string> = {};
    if (opciones.venta) {
      parametros['idVenta'] = String(opciones.venta.idVenta);
    }
    if (opciones.idAtencion) {
      parametros['idAtencion'] = String(opciones.idAtencion);
    }
    TestBed.configureTestingModule({
      imports: [Cobros],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo({ idSede: 1, permisos });
    fixture = TestBed.createComponent(Cobros);
    await estable();
    raiz = fixture.nativeElement;
    http.expectOne('/api/v1/medios-pago').flush(MEDIOS);
    http.expectOne('/api/v1/tipos-documento').flush(TIPOS);
    if (permisos.includes('CATALOGO:VER')) {
      http
        .expectOne('/api/v1/promociones?vigentes=true')
        .flush([
          { idPromocion: 7, nombre: 'Noviembre feliz', tipoDescuento: 'PORCENTAJE', valor: 10 },
        ]);
    }
    if (opciones.venta) {
      http.expectOne(`/api/v1/ventas/${opciones.venta.idVenta}`).flush(opciones.venta);
    } else {
      http.expectOne('/api/v1/ventas/por-cobrar').flush(opciones.porCobrar ?? POR_COBRAR);
    }
    await estable();
  };

  afterEach(() => {
    http.verify();
    document.querySelectorAll('iframe').forEach((marco) => marco.remove());
    vi.restoreAllMocks();
  });

  it('lista «Por cobrar» con GET /ventas/por-cobrar (diferencia 31)', async () => {
    await montar();
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas[0].textContent).toContain('Atención N° 1531');
    expect(filas[1].textContent).toContain('S/ 10.00');
    expect(raiz.textContent).toContain('Venta N° 8800');
    expect(raiz.querySelector('#cobroIdAtencion')).toBeNull();
  });

  it('It. 2.1: «Por cobrar» nombra clienta, servicio y especialista, nunca sus ids', async () => {
    await montar({
      porCobrar: {
        ...POR_COBRAR,
        atenciones: [{ idAtencion: 1533, idCliente: 409, idVariante: 4 }],
      },
    });
    const texto = raiz.querySelector('tbody tr')!.textContent!;
    expect(texto).toContain('—');
    expect(texto).not.toMatch(/Clienta 409|Variante 4/);
    expect(raiz.textContent).toContain('Rosaura Quispe');
  });

  it('It. 2.1: la venta muestra la clienta y la descripción del detalle, no ids', async () => {
    await montar({ venta: VENTA });
    expect(raiz.textContent).toContain('Venta N° 8812 · Rosaura Quispe');
    const detalle = raiz.querySelector('tbody tr')!.textContent!;
    expect(detalle).toContain('Corte de Cabello Caballero · Estándar · Lucía Ramos');
    expect(raiz.textContent).not.toMatch(/Clienta 407|Atención 1532|Detalle 1\b/);
  });

  it('pone primero la atención que llega desde IGU_Atencion, sin cobrarla sola', async () => {
    await montar({ idAtencion: 1532 });
    expect(raiz.querySelector('tbody tr')?.textContent).toContain('Atención N° 1532');
    expect(raiz.querySelector('tbody tr')?.classList).toContain('resaltada');
    http.expectNone('/api/v1/ventas');
  });

  it('lleva a la venta de productos; sin VENTAS:ANULAR ni VENTAS:EDITAR, no a anulaciones', async () => {
    await montar({ venta: VENTA });
    expect(raiz.querySelector('a[href="/ventas/productos"]')?.textContent).toContain(
      'Venta de productos',
    );
    expect(raiz.querySelector('a[href="/ventas/anulaciones"]')).toBeNull();
  });

  it('con VENTAS:ANULAR lleva a anulaciones (diferencia 32 de NOTAS_IT1)', async () => {
    await montar({ venta: VENTA, permisos: ['VENTAS:CREAR', 'VENTAS:VER', 'VENTAS:ANULAR'] });
    expect(raiz.querySelector('a[href="/ventas/anulaciones"]')?.textContent).toContain(
      'Anulaciones',
    );
  });

  it('CUS18: crea la venta desde la atención y aplica el adelanto de la cita', async () => {
    await montar();
    etiquetado('Cobrar la atención 1532').click();
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

  it('retoma una venta abierta con GET /ventas/{idVenta} (Duda 10)', async () => {
    await montar();
    etiquetado('Retomar la venta 8800').click();
    http
      .expectOne('/api/v1/ventas/8800')
      .flush({ ...VENTA, idVenta: 8800, pagado: 20, pendiente: 40 });
    await estable();
    expect(raiz.textContent).toContain('Venta N° 8800');
    expect(raiz.querySelector('.kpi')?.textContent).toContain('S/ 40.00');
    await clic('Volver a');
    http.expectOne('/api/v1/ventas/por-cobrar').flush(POR_COBRAR);
    await estable();
    expect(raiz.textContent).toContain('Por cobrar');
  });

  it('CUS18: aplica la promoción elegida de GET /promociones y el saldo a favor', async () => {
    await montar({ venta: VENTA });
    const promocion = raiz.querySelector<HTMLSelectElement>('#cobroPromocion')!;
    expect(promocion.options[1].textContent).toContain('Noviembre feliz · 10 %');
    promocion.selectedIndex = 1;
    promocion.dispatchEvent(new Event('change'));
    escribir('cobroSaldo', '5');
    await clic('Aplicar descuentos');
    const peticion = http.expectOne('/api/v1/ventas/8812/descuentos');
    expect(peticion.request.body).toEqual({ idPromocion: 7, saldoFavorAplicado: 5 });
    peticion.flush({ ...VENTA, saldoFavorAplicado: 5, total: 55, pendiente: 55 });
    await estable();
    expect(raiz.textContent).toContain('Saldo a favor aplicado');
  });

  it('sin CATALOGO:VER la promoción se escribe por código', async () => {
    await montar({ venta: VENTA, permisos: ['VENTAS:CREAR', 'VENTAS:VER'] });
    expect(raiz.querySelector('input#cobroPromocion')).not.toBeNull();
  });

  it('ofrece los medios activos de GET /medios-pago con sus ids (Duda 11)', async () => {
    await montar({ venta: VENTA });
    expect(raiz.querySelector('#pagoMonto11')).not.toBeNull();
    expect(raiz.querySelector('#pagoMonto13')).toBeNull();
    expect(raiz.querySelector('#pagoCanal11')).toBeNull();
    expect(raiz.querySelector<HTMLSelectElement>('#pagoCanal12')?.value).toBe('QR');
    expect(raiz.querySelector<HTMLSelectElement>('#pagoCanal14')?.value).toBe('LINK');
  });

  it('RN11: no deja pasarse del total ni cerrar mientras falte pagar', async () => {
    await montar({ venta: VENTA });
    expect(boton('Cerrar venta')?.disabled).toBe(true);
    escribir('pagoMonto11', '70');
    await pagoEn('Efectivo');
    http.expectNone('/api/v1/ventas/8812/pagos');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('RN11');

    await clic('Todo');
    expect(raiz.querySelector<HTMLInputElement>('#pagoMonto11')?.value).toBe('60');
    await pagoEn('Efectivo');
    const peticion = http.expectOne('/api/v1/ventas/8812/pagos');
    expect(peticion.request.body).toEqual({ pagos: [{ idMedioPago: 11, monto: 60 }] });
    peticion.flush({ ...PAGADA, pagos: [{ idPago: 9902, idMedioPago: 11, monto: 60 }] });
    await estable();
    expect(boton('Cerrar venta')?.disabled).toBe(false);
    expect(raiz.textContent).toContain('Pagos completos');
  });

  const COBRO_YAPE = {
    idTransaccion: 5510,
    idMedioPago: 12,
    monto: 40,
    canal: 'QR',
    estado: 'PENDIENTE',
  };
  const cobrarConYape = async () => {
    await montar({ venta: VENTA });
    escribir('pagoMonto12', '40');
    await pagoEn('Yape');
    const cobro = http.expectOne('/api/v1/ventas/8812/pagos');
    expect(cobro.request.body).toEqual({ pagos: [{ idMedioPago: 12, monto: 40, canal: 'QR' }] });
    cobro.flush(
      {
        ...VENTA,
        cobrosPendientes: [{ ...COBRO_YAPE, enlacePago: 'https://izipay.example/abc' }],
      },
      { status: 202, statusText: 'Accepted' },
    );
    await estable();
  };

  it('RN42 y Duda 8: consulta el estado con GET /ventas/{id} y, aprobado, reenvía el cobro', async () => {
    await cobrarConYape();
    expect(raiz.querySelector('app-qr-pago path')?.getAttribute('d')).toContain('h1v1h-1z');
    expect(raiz.textContent).toContain('Esperando a Izipay');
    expect(boton('Cerrar venta')?.disabled).toBe(true);
    // Lo que espera a Izipay no se puede cobrar dos veces (RN11).
    await clic('Todo');
    expect(raiz.querySelector<HTMLInputElement>('#pagoMonto11')?.value).toBe('20');

    // Aún pendiente: sin reenviar y sin el 422 de la Iteración 1.
    await clic('Verificar aprobación');
    http.expectOne('/api/v1/ventas/8812').flush({ ...VENTA, cobrosPendientes: [COBRO_YAPE] });
    await estable();
    http.expectNone('/api/v1/ventas/8812/pagos');
    expect(raiz.textContent).toContain('Esperando a Izipay');

    await clic('Verificar aprobación');
    // Aprobado y aún sin sumar: se reenvía con el medio y el monto de cobrosPendientes (RN42).
    http.expectOne('/api/v1/ventas/8812').flush({
      ...VENTA,
      cobrosPendientes: [{ ...COBRO_YAPE, estado: 'APROBADA' }],
    });
    await estable();
    const reenvio = http.expectOne('/api/v1/ventas/8812/pagos');
    expect(reenvio.request.body).toEqual({
      pagos: [{ idMedioPago: 12, monto: 40, idTransaccion: 5510 }],
    });
    reenvio.flush({
      ...VENTA,
      pagado: 40,
      pendiente: 20,
      pagos: [
        {
          idPago: 9901,
          idMedioPago: 12,
          monto: 40,
          referencia: 'IZ-1',
          estadoTransaccion: 'APROBADA',
          idTransaccion: 5510,
        },
      ],
    });
    await estable();
    expect(raiz.textContent).not.toContain('Esperando a Izipay');
    expect(raiz.textContent).toContain('IZ-1');
  });

  it('Duda 8: un cobro rechazado deja de esperarse y se avisa', async () => {
    await cobrarConYape();
    await clic('Verificar aprobación');
    http.expectOne('/api/v1/ventas/8812').flush({
      ...VENTA,
      pagos: [
        {
          idPago: 9901,
          idMedioPago: 12,
          monto: 40,
          idTransaccion: 5510,
          estadoTransaccion: 'RECHAZADA',
        },
      ],
    });
    await estable();
    expect(raiz.textContent).not.toContain('Esperando a Izipay');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('rechazó');
    expect(raiz.textContent).toContain('Rechazado por Izipay');
  });

  it('al retomar la venta muestra los cobros digitales que siguen pendientes', async () => {
    await montar({
      venta: {
        ...VENTA,
        // Iniciado en otro equipo: medio, monto, canal y enlace llegan en cobrosPendientes (Duda 4).
        cobrosPendientes: [
          {
            idTransaccion: 5511,
            idMedioPago: 14,
            monto: 60,
            canal: 'LINK',
            estado: 'PENDIENTE',
            enlacePago: 'https://izipay.example/t',
          },
        ],
      },
    });
    expect(raiz.textContent).toContain('Esperando a Izipay');
    expect(raiz.querySelector('.espera')?.textContent).toMatch(/Tarjeta\s+· S\/ 60\.00/);
    expect(raiz.querySelector<HTMLInputElement>('app-compartir-enlace input')?.value).toBe(
      'https://izipay.example/t',
    );
    // Ya no se ofrece «Quitar»: el cobro se espera o se reenvía al aprobarse.
    expect(boton('Quitar')).toBeUndefined();
    expect(boton('Cerrar venta')?.disabled).toBe(true);
  });

  it('CUS19: consulta el RUC, emite la factura y lee el estado SUNAT (Duda 12)', async () => {
    await montar({ venta: PAGADA });
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
    http
      .expectOne('/api/v1/comprobantes/7120')
      .flush({ ...CERRADA.comprobante, estadoSunat: 'PENDIENTE' });
    await estable();
    expect(comprobante.textContent).toContain('SUNAT: PENDIENTE');
    expect(comprobante.textContent).toContain('RN46');

    await clic('Actualizar estado SUNAT');
    http
      .expectOne('/api/v1/comprobantes/7120')
      .flush({ ...CERRADA.comprobante, estadoSunat: 'ACEPTADO', codigoRespuesta: '0' });
    await estable();
    expect(comprobante.textContent).toContain('SUNAT: ACEPTADO');
    expect(boton('Actualizar estado SUNAT')).toBeUndefined();

    await clic('Listo');
    http.expectOne('/api/v1/ventas/por-cobrar').flush(POR_COBRAR);
    await estable();
    expect(raiz.querySelector('app-comprobante-emitido')).toBeNull();
  });

  it('CUS19: si la consulta no responde, la razón social se escribe a mano', async () => {
    await montar({ venta: PAGADA });
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
    await montar({ venta: { ...PAGADA, subtotal: 800, total: 800, pagado: 800 } });
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain('RN08');
    await clic('Cerrar venta');
    const peticion = http.expectOne('/api/v1/ventas/8812/cierre');
    expect(peticion.request.body).toEqual({ tipo: 'BOLETA' });
    peticion.flush({ detail: 'Falta comprador' }, { status: 422, statusText: 'Unprocessable' });
    await estable();
    expect(raiz.querySelector('app-comprobante-emitido')).toBeNull();
  });

  it('CUS20: imprime el PDF y «Enviar por correo» abre mailto con el enlace firmado', async () => {
    const abrirCorreo = vi
      .spyOn(
        ComprobanteEmitido.prototype as unknown as { abrirCorreo: (u: string) => void },
        'abrirCorreo',
      )
      .mockImplementation(() => undefined);
    await montar({ venta: PAGADA });
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
    raiz.querySelector('app-comprobante-emitido form')!.dispatchEvent(new Event('submit'));
    await estable();
    http.expectNone((p) => p.url.includes('/enlace'));
    expect(raiz.querySelector('app-comprobante-emitido .alert.bad')?.textContent).toContain(
      'correo',
    );

    // Sin correo escrito, se usa el de la ficha de la clienta que devuelve el back-end.
    escribir('entregaCorreo', '');
    await clic('Enviar por correo');
    http.expectOne('/api/v1/comprobantes/7120/enlace?canal=CORREO').flush({
      canal: 'CORREO',
      correo: 'clienta@ejemplo.com',
      enlace: 'https://backoffice.example/publico/7120?firma=ab12',
    });
    await estable();
    expect(abrirCorreo).toHaveBeenCalledTimes(1);
    const url = abrirCorreo.mock.calls[0][0] as string;
    expect(url.startsWith('mailto:clienta%40ejemplo.com?subject=')).toBe(true);
    expect(url).toContain('subject=' + encodeURIComponent('Comprobante F001-00000125'));
    expect(url).toContain(encodeURIComponent('https://backoffice.example/publico/7120?firma=ab12'));
  });

  it('CUS21: arma la proforma con el servicio de la lista y no guarda nada', async () => {
    await montar();
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await clic('Emitir proforma');
    http.expectOne('/api/v1/paquetes').flush([]);
    http.expectOne('/api/v1/promociones?vigentes=true').flush([]);
    http.expectOne('/api/v1/servicios?estado=ACTIVO').flush([
      {
        idServicio: 1,
        idArea: 1,
        nombre: 'Corte',
        duracionRefMin: 30,
        tipoRecurso: 'SILLON',
        variantes: [{ idVariante: 2, nombreVariante: 'Clásico', precio: 35 }],
      },
    ] satisfies ServicioDTO[]);
    await estable();
    const modal = () => raiz.querySelector('app-proforma')!;
    modal().querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable();
    expect(modal().querySelector('.alert.bad')?.textContent).toContain('clienta');

    escribir('proformaNombre', 'Novia');
    escribir('proformaValidez', '2026-11-30');
    const servicio = raiz.querySelector<HTMLSelectElement>('#proforma0Servicio')!;
    servicio.selectedIndex = 1;
    servicio.dispatchEvent(new Event('change'));
    escribir('proformaCantidad0', '2');
    await estable();
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
      items: [
        {
          tipoItem: 'SERVICIO',
          cantidad: 2,
          idVariante: 2,
          subtotal: 70,
          descripcion: 'Peinado de novia · Clásico',
        },
      ],
    });
    await estable();
    const proforma = modal().querySelector('.imprimible')!.textContent!;
    expect(proforma).toContain('S/ 70.00');
    // El ítem por su descripción, nunca «Variante 2» (It. 2.1).
    expect(proforma).toContain('Peinado de novia · Clásico × 2');
    expect(proforma).not.toContain('Variante 2');
    expect(modal().textContent).toContain('RN09');
    await clic('Imprimir');
    expect(imprimir).toHaveBeenCalled();
  });
});

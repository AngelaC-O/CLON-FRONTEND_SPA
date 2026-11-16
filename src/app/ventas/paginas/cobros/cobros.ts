import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { ListasService } from '../../../core/api/listas.service';
import { CanalCobro, canalPropuesto, etiquetaMedio, mediosActivos } from '../../../core/api/medios';
import { MedioPagoDTO, TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { redondear, soles } from '../../../core/api/moneda';
import { comprobanteDe, nombreO, nombreVenta, numero } from '../../../core/api/nombres';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { CompartirEnlace } from '../../../layout/compartir-enlace/compartir-enlace';
import { Modal } from '../../../layout/modal/modal';
import {
  AtencionCobrable,
  CobroPendienteDTO,
  DetalleVentaDTO,
  PagoVentaDTO,
  PorCobrarDTO,
  PromocionDTO,
  VentaDTO,
} from '../../modelos/ventas.modelos';
import { VentasService } from '../../servicios/ventas.service';
import { ComprobanteEmitido } from '../comprobante/comprobante-emitido';
import {
  crearFormularioComprador,
  DatosComprador,
  leerComprador,
} from '../comprobante/datos-comprador';
import { Proforma } from './proforma';
import { QrPago } from './qr-pago';

interface FilaPago {
  medio: MedioPagoDTO;
  monto: FormControl<number | null>;
  canal: FormControl<CanalCobro | null>;
}

const APROBADA = 'APROBADA';
const RECHAZADA = 'RECHAZADA';
const PENDIENTE = 'PENDIENTE';

/** IGU_Cobro: CUS18, CUS19, CUS20 y CUS21. Anulación y nota de crédito son de otra entrega. */
@Component({
  selector: 'app-cobros',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CompartirEnlace,
    ComprobanteEmitido,
    DatosComprador,
    Modal,
    Proforma,
    QrPago,
  ],
  templateUrl: './cobros.html',
  styles: `
    .resaltada td {
      background: var(--salon-l);
    }
  `,
})
export class Cobros implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(VentasService);
  private readonly listas = inject(ListasService);
  private readonly sesion = inject(SesionService);
  /** IGU_Anulacion: la solicitud pide VENTAS:ANULAR; la bandeja y las devoluciones, VENTAS:EDITAR. */
  protected readonly puedeVerAnulaciones = computed(() =>
    this.sesion.tienePermiso(PERMISOS.ventasAnular, PERMISOS.ventasEditar),
  );
  private readonly ruta = inject(ActivatedRoute);

  protected readonly soles = soles;
  protected readonly nombreO = nombreO;
  protected readonly numero = numero;
  protected readonly nombreVenta = nombreVenta;
  protected readonly comprobanteDe = comprobanteDe;
  protected readonly venta = signal<VentaDTO | null>(null);
  /**
   * Cobros digitales que esperan a la pasarela: los cobrosPendientes de la venta, con medio, monto,
   * canal y enlace (Duda 4, It. 2.1). También los iniciados en otro equipo; nada se recuerda aquí.
   */
  protected readonly enEspera = computed(() =>
    (this.venta()?.cobrosPendientes ?? []).filter(
      (c) => c.idTransaccion !== undefined && c.estado !== RECHAZADA,
    ),
  );
  protected readonly porCobrar = signal<PorCobrarDTO | null>(null);
  protected readonly medios = signal<MedioPagoDTO[]>([]);
  protected readonly filas = signal<FilaPago[]>([]);
  protected readonly promociones = signal<PromocionDTO[]>([]);
  private readonly tipos = signal<TipoDocumentoDTO[]>([]);
  /** La atención que llega desde «Ir a cobrar» de IGU_Atencion. */
  protected readonly idAtencionResaltada = numeroODeNulo(
    this.ruta.snapshot.queryParamMap.get('idAtencion'),
  );
  /** Promociones y paquetes salen de CATALOGO:VER; sin él, se escribe el código. */
  protected readonly conCatalogo = computed(() => this.sesion.tienePermiso(PERMISOS.catalogoVer));

  /** Lo que falta sin contar los cobros que esperan a Izipay, para no pasarse del total (RN11). */
  protected readonly disponible = computed(() =>
    redondear(
      (this.venta()?.pendiente ?? 0) -
        this.enEspera().reduce((suma, c) => suma + (c.monto ?? 0), 0),
    ),
  );
  protected readonly motivoSinCierre = computed(() => {
    if (this.enEspera().length) {
      return 'Hay un pago digital sin aprobar: verifica su aprobación (RN42).';
    }
    const pendiente = this.venta()?.pendiente ?? 0;
    return pendiente > 0
      ? `Los pagos deben sumar el total: faltan ${soles(pendiente)} (RN11).`
      : null;
  });
  protected readonly atenciones = computed(() => {
    const atenciones = this.porCobrar()?.atenciones ?? [];
    const resaltada = atenciones.filter((a) => a.idAtencion === this.idAtencionResaltada);
    return [...resaltada, ...atenciones.filter((a) => a.idAtencion !== this.idAtencionResaltada)];
  });
  protected readonly ventasAbiertas = computed(() => this.porCobrar()?.ventasAbiertas ?? []);
  protected readonly cerrada = signal<VentaDTO | null>(null);
  protected readonly proforma = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly descuentos = this.fb.group({
    idPromocion: [null as number | null, Validators.min(1)],
    saldoFavorAplicado: [null as number | null, Validators.min(0)],
  });
  protected readonly comprador = crearFormularioComprador(this.fb.nonNullable);

  ngOnInit(): void {
    this.listas.mediosPago().subscribe((medios) => {
      const activos = mediosActivos(medios);
      this.medios.set(medios);
      this.filas.set(
        activos.map((medio) => ({
          medio,
          monto: new FormControl<number | null>(null),
          canal: new FormControl<CanalCobro | null>(canalPropuesto(medio)),
        })),
      );
    });
    this.listas.tiposDocumento().subscribe((tipos) => this.tipos.set(tipos));
    if (this.conCatalogo()) {
      this.listas
        .promocionesVigentes()
        .subscribe((promociones) => this.promociones.set(promociones));
    }
    const idVenta = numeroODeNulo(this.ruta.snapshot.queryParamMap.get('idVenta'));
    if (idVenta) {
      this.retomar(idVenta);
    } else {
      this.cargarPorCobrar();
    }
  }

  protected etiqueta(idMedioPago?: number): string {
    return etiquetaMedio(this.medios().find((m) => m.idMedioPago === idMedioPago));
  }

  /** El medio del pago: el de la lista o el nombreMedioPago que trae la venta (It. 2.1). */
  protected etiquetaPago(pago: PagoVentaDTO): string {
    return etiquetaMedio(
      this.medios().find((m) => m.idMedioPago === pago.idMedioPago),
      pago.nombreMedioPago,
    );
  }

  protected esDigital(fila: FilaPago): boolean {
    return canalPropuesto(fila.medio) !== null;
  }

  /** La clienta por su nombre (It. 2.1), la de paso por el que se escribió, o «Clienta de paso». */
  protected clienta(atencion: AtencionCobrable | VentaDTO): string {
    if ('nombreClientePaso' in atencion && atencion.nombreClientePaso) {
      return atencion.nombreClientePaso;
    }
    return atencion.idCliente ? nombreO(atencion.nombreCliente) : 'Clienta de paso';
  }

  /** Servicio y variante, producto o paquete, con la especialista si la hay (It. 2.1). */
  protected descripcion(detalle: DetalleVentaDTO): string {
    const descripcion = nombreO(detalle.descripcion);
    return detalle.nombreEspecialista
      ? `${descripcion} · ${detalle.nombreEspecialista}`
      : descripcion;
  }

  protected importe(): number {
    return (this.venta()?.subtotal ?? 0) + (this.venta()?.igv ?? 0);
  }

  /** Pagos que ya suman: el efectivo y los digitales APROBADOS. */
  protected registrados(venta: VentaDTO): PagoVentaDTO[] {
    return (venta.pagos ?? []).filter(
      (p) => !p.idTransaccion || !p.estadoTransaccion || p.estadoTransaccion === APROBADA,
    );
  }

  protected rechazados(venta: VentaDTO): PagoVentaDTO[] {
    return (venta.pagos ?? []).filter((p) => p.estadoTransaccion === RECHAZADA);
  }

  /** PATCH sin datos: el adelanto de la cita solo se aplica ahí, y debe verse antes de cobrar. */
  protected cobrar(atencion: AtencionCobrable): void {
    const idAtencion = atencion.idAtencion;
    if (!idAtencion) {
      return;
    }
    this.iniciar();
    this.servicio
      .crearDesdeAtencion({ idAtencion })
      .pipe(
        switchMap((venta) =>
          this.servicio.aplicarDescuentos(venta.idVenta!, {}).pipe(catchError(() => of(venta))),
        ),
      )
      .subscribe({
        next: (venta) => this.actualizar(venta),
        error: (error: HttpErrorResponse) => this.fallar(error, 'La atención no existe.'),
      });
  }

  /** Retoma una venta ABIERTA con GET /ventas/{idVenta}, desde cualquier equipo (Duda 10). */
  protected retomar(idVenta: number): void {
    this.iniciar();
    this.servicio.obtener(idVenta).subscribe({
      next: (venta) => {
        if (venta.estado !== 'ABIERTA') {
          this.enviando.set(false);
          const nombre = nombreVenta(comprobanteDe(venta.comprobante), idVenta);
          this.error.set(`La ${nombre} ya está ${venta.estado?.toLowerCase()}.`);
          this.cargarPorCobrar();
          return;
        }
        this.actualizar(venta);
      },
      error: (error: HttpErrorResponse) => {
        this.fallar(error, 'La venta no existe.');
        this.cargarPorCobrar();
      },
    });
  }

  protected volverALista(): void {
    this.venta.set(null);
    this.error.set(null);
    this.cargarPorCobrar();
  }

  protected aplicarDescuentos(): void {
    const idVenta = this.venta()?.idVenta;
    const { idPromocion, saldoFavorAplicado } = this.descuentos.getRawValue();
    if (!idVenta || this.descuentos.invalid || (!idPromocion && !saldoFavorAplicado)) {
      this.error.set('Elige una promoción o indica el saldo a favor que se aplica.');
      return;
    }
    this.iniciar();
    this.servicio
      .aplicarDescuentos(idVenta, {
        ...(idPromocion ? { idPromocion } : {}),
        ...(saldoFavorAplicado ? { saldoFavorAplicado } : {}),
      })
      .subscribe({
        next: (venta) => {
          this.actualizar(venta);
          this.descuentos.reset();
        },
        error: (error: HttpErrorResponse) => this.fallar(error, 'La venta no existe.'),
      });
  }

  protected completar(fila: FilaPago): void {
    fila.monto.setValue(this.disponible());
  }

  protected esperando(fila: FilaPago): boolean {
    return this.enEspera().some((cobro) => cobro.idMedioPago === fila.medio.idMedioPago);
  }

  /** Un pago por envío: así el cobro pendiente que vuelva se sabe de qué medio y monto es. */
  protected registrarPago(fila: FilaPago): void {
    const idVenta = this.venta()?.idVenta;
    const idMedioPago = fila.medio.idMedioPago;
    const monto = fila.monto.value;
    if (!idVenta || idMedioPago === undefined || !monto || monto <= 0) {
      this.error.set(`Escribe el monto de ${etiquetaMedio(fila.medio)}.`);
      return;
    }
    if (monto > this.disponible()) {
      this.error.set(`El monto supera lo que falta cobrar: ${soles(this.disponible())} (RN11).`);
      return;
    }
    const canal = this.esDigital(fila) ? (fila.canal.value ?? canalPropuesto(fila.medio)) : null;
    this.iniciar();
    this.servicio
      .registrarPagos(idVenta, { pagos: [{ idMedioPago, monto, ...(canal ? { canal } : {}) }] })
      .subscribe({
        next: (venta) => {
          this.actualizar(venta);
          fila.monto.reset();
        },
        error: (error: HttpErrorResponse) => this.fallar(error, 'La venta no existe.'),
      });
  }

  /**
   * Consulta el estado del cobro con GET /ventas/{idVenta} (Duda 8): si la pasarela lo aprobó y
   * aún no suma, se reenvía con su idTransaccion, su medio y su monto (RN42); si sigue PENDIENTE,
   * se espera; si lo rechazó, deja de esperarse.
   */
  protected verificar(cobro: CobroPendienteDTO): void {
    const idVenta = this.venta()?.idVenta;
    if (!idVenta) {
      return;
    }
    this.iniciar();
    this.servicio.obtener(idVenta).subscribe({
      next: (venta) => {
        const pago = venta.pagos?.find((p) => p.idTransaccion === cobro.idTransaccion);
        const pendiente = venta.cobrosPendientes?.find(
          (c) => c.idTransaccion === cobro.idTransaccion,
        );
        const estado =
          pago?.estadoTransaccion ?? pendiente?.estado ?? (pendiente ? PENDIENTE : APROBADA);
        this.actualizar(venta);
        if (estado === RECHAZADA) {
          this.error.set(`Izipay rechazó el pago de ${this.etiqueta(cobro.idMedioPago)}.`);
        } else if (estado !== APROBADA) {
          this.notificaciones.mostrar('Izipay aún no aprueba el pago. Vuelve a verificar luego.');
        } else if (!pendiente) {
          this.notificaciones.mostrar('Izipay aprobó el pago.');
        } else {
          this.confirmar(idVenta, pendiente);
        }
      },
      error: (error: HttpErrorResponse) => this.fallar(error, 'La venta no existe.'),
    });
  }

  protected cerrar(): void {
    const idVenta = this.venta()?.idVenta;
    if (!idVenta || this.motivoSinCierre()) {
      return;
    }
    const cierre = leerComprador(this.comprador, this.tipos());
    if (typeof cierre === 'string') {
      this.error.set(cierre);
      return;
    }
    this.iniciar();
    this.servicio.cerrar(idVenta, cierre).subscribe({
      next: (venta) => {
        this.enviando.set(false);
        this.cerrada.set(venta);
        this.venta.set(null);
      },
      error: (error: HttpErrorResponse) => this.fallar(error, 'La venta no existe.'),
    });
  }

  protected terminar(): void {
    this.cerrada.set(null);
    this.comprador.reset();
    this.notificaciones.mostrar('Venta registrada en la caja.');
    this.cargarPorCobrar();
  }

  /** Reenvía el cobro aprobado con el medio y el monto que trae cobrosPendientes (RN42). */
  private confirmar(idVenta: number, cobro: CobroPendienteDTO): void {
    const { idMedioPago, monto } = cobro;
    if (idMedioPago === undefined || monto === undefined) {
      this.error.set('La venta no trae el medio o el monto de este cobro: vuelve a verificarlo.');
      return;
    }
    this.iniciar();
    this.servicio
      .registrarPagos(idVenta, {
        pagos: [{ idMedioPago, monto, idTransaccion: cobro.idTransaccion }],
      })
      .subscribe({
        next: (venta) => {
          this.actualizar(venta);
          this.notificaciones.mostrar('Izipay aprobó el pago.');
        },
        error: (error: HttpErrorResponse) => this.fallar(error, 'La venta no existe.'),
      });
  }

  private cargarPorCobrar(): void {
    this.servicio.listarPorCobrar().subscribe({
      next: (porCobrar) => this.porCobrar.set(porCobrar),
      error: () => this.porCobrar.set({ atenciones: [], ventasAbiertas: [] }),
    });
  }

  private iniciar(): void {
    this.error.set(null);
    this.enviando.set(true);
  }

  /** La venta del servidor manda: sus cobrosPendientes son los cobros en espera. */
  private actualizar(venta: VentaDTO): void {
    this.enviando.set(false);
    this.venta.set(venta);
  }

  /** Los 409 y 422 de la regla ya los muestra el interceptor. */
  private fallar(error: HttpErrorResponse, porDefecto: string): void {
    this.enviando.set(false);
    if (error.status === 400 || error.status === 404) {
      this.error.set(mensajeDelProblema(error, porDefecto));
    }
  }
}

function numeroODeNulo(texto: string | null): number | null {
  const numero = Number(texto);
  return texto && Number.isInteger(numero) && numero > 0 ? numero : null;
}

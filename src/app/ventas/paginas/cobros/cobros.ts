import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { CanalCobro, MedioPago, medioPago, MEDIOS_PAGO } from '../../../core/api/medios-pago';
import { redondear, soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { CompartirEnlace } from '../../../layout/compartir-enlace/compartir-enlace';
import { Modal } from '../../../layout/modal/modal';
import { DetalleVentaDTO, VentaDTO } from '../../modelos/ventas.modelos';
import { CobroEnEspera, VentaEnCursoService } from '../../servicios/venta-en-curso.service';
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
  medio: MedioPago;
  monto: FormControl<number | null>;
  canal: FormControl<CanalCobro | null>;
}

/** IGU_Cobro: CUS18, CUS19, CUS20 y CUS21. Anulación y nota de crédito son de otra iteración. */
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
})
export class Cobros {
  private readonly fb = inject(FormBuilder);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(VentasService);
  private readonly enCurso = inject(VentaEnCursoService);

  protected readonly soles = soles;
  protected readonly medioPago = medioPago;
  protected readonly venta = computed(() => this.enCurso.actual()?.venta ?? null);
  protected readonly enEspera = computed(() => this.enCurso.actual()?.enEspera ?? []);
  /** Lo que falta sin contar los cobros que esperan a Izipay, para no pasarse del total (RN11). */
  protected readonly disponible = computed(() =>
    redondear(
      (this.venta()?.pendiente ?? 0) - this.enEspera().reduce((suma, c) => suma + c.monto, 0),
    ),
  );
  protected readonly motivoSinCierre = computed(() => {
    if (this.enEspera().length) {
      return 'Hay un pago digital sin aprobar: verifícalo o quítalo (RN42).';
    }
    const pendiente = this.venta()?.pendiente ?? 0;
    return pendiente > 0
      ? `Los pagos deben sumar el total: faltan ${soles(pendiente)} (RN11).`
      : null;
  });
  protected readonly cerrada = signal<VentaDTO | null>(null);
  protected readonly proforma = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly idAtencion = new FormControl<number | null>(
    numeroODeNulo(inject(ActivatedRoute).snapshot.queryParamMap.get('idAtencion')),
    [Validators.required, Validators.min(1)],
  );
  protected readonly atencion = this.fb.group({ idAtencion: this.idAtencion });
  protected readonly descuentos = this.fb.group({
    idPromocion: [null as number | null, Validators.min(1)],
    saldoFavorAplicado: [null as number | null, Validators.min(0)],
  });
  protected readonly filas: FilaPago[] = MEDIOS_PAGO.map((medio) => ({
    medio,
    monto: new FormControl<number | null>(null),
    canal: new FormControl<CanalCobro | null>(medio.canal),
  }));
  protected readonly comprador = crearFormularioComprador(this.fb.nonNullable);

  protected descripcion(detalle: DetalleVentaDTO): string {
    return detalle.idAtencion ? `Atención ${detalle.idAtencion}` : `Detalle ${detalle.idDetalle}`;
  }

  protected importe(): number {
    return (this.venta()?.subtotal ?? 0) + (this.venta()?.igv ?? 0);
  }

  /** PATCH sin datos: el adelanto de la cita solo se aplica ahí, y debe verse antes de cobrar. */
  protected cobrar(): void {
    const idAtencion = this.idAtencion.value;
    if (!idAtencion || this.idAtencion.invalid) {
      this.error.set('Escribe el código de la atención.');
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
        next: (venta) => this.actualizar(venta, []),
        error: (error: HttpErrorResponse) => this.fallar(error, 'La atención no existe.'),
      });
  }

  protected aplicarDescuentos(): void {
    const idVenta = this.venta()?.idVenta;
    const { idPromocion, saldoFavorAplicado } = this.descuentos.getRawValue();
    if (!idVenta || this.descuentos.invalid || (!idPromocion && !saldoFavorAplicado)) {
      this.error.set('Indica una promoción o el saldo a favor que se aplica.');
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
    return this.enEspera().some((cobro) => cobro.idMedioPago === fila.medio.id);
  }

  /** Un pago por envío: así el cobro pendiente que vuelva se sabe de qué medio y monto es. */
  protected registrarPago(fila: FilaPago): void {
    const idVenta = this.venta()?.idVenta;
    const monto = fila.monto.value;
    if (!idVenta || !monto || monto <= 0) {
      this.error.set(`Escribe el monto de ${fila.medio.etiqueta}.`);
      return;
    }
    if (monto > this.disponible()) {
      this.error.set(`El monto supera lo que falta cobrar: ${soles(this.disponible())} (RN11).`);
      return;
    }
    const canal = fila.medio.canal ? (fila.canal.value ?? fila.medio.canal) : undefined;
    this.iniciar();
    this.servicio
      .registrarPagos(idVenta, {
        pagos: [{ idMedioPago: fila.medio.id, monto, ...(canal ? { canal } : {}) }],
      })
      .subscribe({
        next: (venta) => {
          const cobro = venta.cobrosPendientes?.[0];
          const enEspera: CobroEnEspera[] = cobro
            ? [
                ...this.enEspera(),
                {
                  idTransaccion: cobro.idTransaccion!,
                  idMedioPago: fila.medio.id,
                  monto,
                  canal: canal ?? '',
                  enlacePago: cobro.enlacePago,
                },
              ]
            : this.enEspera();
          this.actualizar(venta, enEspera);
          fila.monto.reset();
        },
        error: (error: HttpErrorResponse) => this.fallar(error, 'La venta no existe.'),
      });
  }

  /** No hay GET de la transacción: se reenvía con su id, y responde 422 mientras no esté APROBADA. */
  protected verificar(cobro: CobroEnEspera): void {
    const idVenta = this.venta()?.idVenta;
    if (!idVenta) {
      return;
    }
    this.iniciar();
    this.servicio
      .registrarPagos(idVenta, {
        pagos: [
          {
            idMedioPago: cobro.idMedioPago,
            monto: cobro.monto,
            idTransaccion: cobro.idTransaccion,
          },
        ],
      })
      .subscribe({
        next: (venta) => {
          this.actualizar(venta, this.sinCobro(cobro));
          this.notificaciones.mostrar('Izipay aprobó el pago.');
        },
        error: (error: HttpErrorResponse) => this.fallar(error, 'La venta no existe.'),
      });
  }

  /** Solo deja de esperarlo en esta pantalla: el contrato no permite anular la transacción. */
  protected quitar(cobro: CobroEnEspera): void {
    const venta = this.venta();
    if (venta) {
      this.enCurso.establecer(venta, this.sinCobro(cobro));
    }
  }

  protected cerrar(): void {
    const idVenta = this.venta()?.idVenta;
    if (!idVenta || this.motivoSinCierre()) {
      return;
    }
    const cierre = leerComprador(this.comprador);
    if (typeof cierre === 'string') {
      this.error.set(cierre);
      return;
    }
    this.iniciar();
    this.servicio.cerrar(idVenta, cierre).subscribe({
      next: (venta) => {
        this.enviando.set(false);
        this.cerrada.set(venta);
        this.enCurso.limpiar();
      },
      error: (error: HttpErrorResponse) => this.fallar(error, 'La venta no existe.'),
    });
  }

  protected terminar(): void {
    this.cerrada.set(null);
    this.idAtencion.reset();
    this.comprador.reset();
    this.notificaciones.mostrar('Venta registrada en la caja.');
  }

  private sinCobro(cobro: CobroEnEspera): CobroEnEspera[] {
    return this.enEspera().filter((c) => c.idTransaccion !== cobro.idTransaccion);
  }

  private iniciar(): void {
    this.error.set(null);
    this.enviando.set(true);
  }

  private actualizar(venta: VentaDTO, enEspera?: CobroEnEspera[]): void {
    this.enviando.set(false);
    this.enCurso.establecer(venta, enEspera);
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

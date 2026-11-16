import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ListasService } from '../../../core/api/listas.service';
import { etiquetaMedio } from '../../../core/api/medios';
import { MedioPagoDTO } from '../../../core/api/modelos.generados';
import { soles } from '../../../core/api/moneda';
import { nombreO } from '../../../core/api/nombres';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PagoVentaDTO, SolicitudAnulacionDTO, VentaDTO } from '../../modelos/ventas.modelos';
import { AnulacionesService } from '../../servicios/anulaciones.service';
import { VentasService } from '../../servicios/ventas.service';
import { fechaHora, ventaDe } from './anulacion.vista';

type TipoPago = 'TARJETA' | 'BILLETERA' | 'EFECTIVO';

/**
 * CUS24 Devolver Pago Digital, con VENTAS:EDITAR: ventas ANULADAS con nota MEDIO_ORIGINAL (las
 * solicitudes APROBADAS con esa forma). La tarjeta se devuelve por Izipay («Devolver pago»); Yape y
 * Plin los devuelve la administradora desde la app y se registran con su número de operación
 * («Registrar devolución manual»). Los pagos salen de GET /ventas/{idVenta}.
 */
@Component({
  selector: 'app-devoluciones',
  imports: [ReactiveFormsModule],
  template: `
    <div class="col" style="gap: 12px">
      <div class="mut sm">
        Ventas anuladas que se devuelven por el medio de pago original (RN44). La API de reembolsos
        de Izipay solo devuelve tarjetas; Yape y Plin se devuelven desde la app y aquí se registra
        el número de operación.
      </div>
      @for (solicitud of anuladas(); track solicitud.idSolicitud) {
        <div class="card col devolucion">
          <div class="row">
            <div class="sp">
              <div class="b">{{ ventaDe(solicitud) }}</div>
              <div class="xs mut">
                {{ nombreO(solicitud.nombreCliente) }} · anulada
                {{ fechaHora(solicitud.fechaResolucion) }}
              </div>
            </div>
            <b class="num">{{ soles(solicitud.totalVenta) }}</b>
            @if (abierta() !== solicitud.idVenta) {
              <button class="btn sec sm" type="button" (click)="verPagos(solicitud)">
                Ver pagos
              </button>
            }
          </div>

          @if (abierta() === solicitud.idVenta) {
            @if (error(); as mensaje) {
              <div class="alert bad" role="alert">{{ mensaje }}</div>
            }
            @if (venta(); as actual) {
              @for (pago of actual.pagos; track $index) {
                <div class="row nw pago">
                  <span class="sp">
                    {{ etiquetaMedio(medio(pago.idMedioPago), pago.nombreMedioPago) }} ·
                    {{ soles(pago.monto) }}
                    @if (pago.referencia) {
                      <span class="xs mut">· {{ pago.referencia }}</span>
                    }
                  </span>
                  @switch (tipo(pago)) {
                    @case ('TARJETA') {
                      @if (devueltaTarjeta()) {
                        <span class="chip ok">Devuelto · {{ devueltaTarjeta() }}</span>
                      }
                    }
                    @case ('BILLETERA') {
                      @if (devueltas()[pago.idTransaccion ?? 0]; as codigo) {
                        <span class="chip ok">Devuelto · {{ codigo }}</span>
                      } @else {
                        <input
                          class="inp"
                          style="max-width: 200px"
                          placeholder="N° de operación de la app"
                          [attr.aria-label]="'Número de operación del pago ' + pago.idTransaccion"
                          [formControl]="codigo(pago)"
                        />
                        <button
                          class="btn sm"
                          type="button"
                          [disabled]="enviando()"
                          (click)="registrarManual(actual, pago)"
                        >
                          Registrar devolución manual
                        </button>
                      }
                    }
                    @default {
                      <span class="xs mut">El efectivo se devuelve desde la caja.</span>
                    }
                  }
                </div>
              }
              @if (tieneTarjeta(actual) && !devueltaTarjeta()) {
                <button
                  class="btn"
                  type="button"
                  style="align-self: flex-start"
                  [disabled]="enviando()"
                  (click)="devolverTarjeta(actual)"
                >
                  Devolver pago
                </button>
                <div class="xs mut">Devuelve por Izipay cada pago con tarjeta de la venta.</div>
              }
            }
          }
        </div>
      } @empty {
        <div class="card vacio">
          {{ cargando() ? 'Cargando…' : 'No hay ventas anuladas por devolver.' }}
        </div>
      }
    </div>
  `,
})
export class Devoluciones implements OnInit {
  private readonly servicio = inject(AnulacionesService);
  private readonly ventas = inject(VentasService);
  private readonly listas = inject(ListasService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly soles = soles;
  protected readonly nombreO = nombreO;
  protected readonly ventaDe = ventaDe;
  protected readonly fechaHora = fechaHora;
  protected readonly etiquetaMedio = etiquetaMedio;
  protected readonly anuladas = signal<SolicitudAnulacionDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly medios = signal<MedioPagoDTO[]>([]);
  /** La venta cuyos pagos se ven. */
  protected readonly abierta = signal<number | null>(null);
  protected readonly venta = signal<VentaDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Código de la devolución por tarjeta de la venta abierta. */
  protected readonly devueltaTarjeta = signal<string | null>(null);
  /** Número de operación registrado, por idTransaccion. */
  protected readonly devueltas = signal<Record<number, string>>({});
  private readonly codigos = new Map<number, FormControl<string>>();

  ngOnInit(): void {
    this.listas.mediosPago().subscribe((medios) => this.medios.set(medios));
    this.cargar();
  }

  /** Para que una aprobación de la bandeja aparezca sin recargar la página. */
  cargar(): void {
    this.cargando.set(true);
    this.servicio.listar('APROBADA').subscribe({
      next: (solicitudes) => {
        this.anuladas.set(solicitudes.filter((s) => s.formaDevolucion === 'MEDIO_ORIGINAL'));
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected medio(idMedioPago?: number): MedioPagoDTO | undefined {
    return this.medios().find((m) => m.idMedioPago === idMedioPago);
  }

  /** La tarjeta va por la pasarela; Yape y Plin son billeteras con QR; el resto, efectivo. */
  protected tipo(pago: PagoVentaDTO): TipoPago {
    const medio = this.medio(pago.idMedioPago);
    if (medio?.nombre?.toUpperCase() === 'TARJETA') {
      return 'TARJETA';
    }
    return medio?.usaPasarela ? 'BILLETERA' : 'EFECTIVO';
  }

  protected tieneTarjeta(venta: VentaDTO): boolean {
    return (venta.pagos ?? []).some((pago) => this.tipo(pago) === 'TARJETA');
  }

  protected codigo(pago: PagoVentaDTO): FormControl<string> {
    const id = pago.idTransaccion ?? 0;
    let control = this.codigos.get(id);
    if (!control) {
      control = new FormControl('', { nonNullable: true });
      this.codigos.set(id, control);
    }
    return control;
  }

  protected verPagos(solicitud: SolicitudAnulacionDTO): void {
    const idVenta = solicitud.idVenta;
    if (idVenta === undefined) {
      return;
    }
    this.abierta.set(idVenta);
    this.venta.set(null);
    this.error.set(null);
    this.devueltaTarjeta.set(null);
    this.ventas.obtener(idVenta).subscribe({
      next: (venta) => this.venta.set(venta),
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.error.set(mensajeDelProblema(error, 'La venta no existe.'));
        }
      },
    });
  }

  protected devolverTarjeta(venta: VentaDTO): void {
    if (venta.idVenta === undefined) {
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio.devolverPago(venta.idVenta).subscribe({
      next: (devolucion) => {
        this.enviando.set(false);
        const codigos = (devolucion.devoluciones ?? [])
          .map((d) => d.codigoOperacion)
          .filter(Boolean)
          .join(', ');
        this.devueltaTarjeta.set(codigos || 'Izipay');
        this.notificaciones.mostrar('Devolución registrada en Izipay.');
      },
      // El 409 (ya devuelto) y el 422 (rechazo de la pasarela) los avisa el interceptor.
      error: (error: HttpErrorResponse) => this.fallar(error),
    });
  }

  protected registrarManual(venta: VentaDTO, pago: PagoVentaDTO): void {
    const codigo = this.codigo(pago).value.trim();
    if (venta.idVenta === undefined || pago.idTransaccion === undefined) {
      return;
    }
    if (!codigo) {
      this.error.set('Escribe el número de operación de la app.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio.registrarDevolucionManual(venta.idVenta, pago.idTransaccion, codigo).subscribe({
      next: (devolucion) => {
        this.enviando.set(false);
        const id = pago.idTransaccion!;
        this.devueltas.update((actual) => ({
          ...actual,
          [id]: devolucion.codigoOperacion ?? codigo,
        }));
        this.notificaciones.mostrar('Devolución manual registrada.');
      },
      error: (error: HttpErrorResponse) => this.fallar(error),
    });
  }

  private fallar(error: HttpErrorResponse): void {
    this.enviando.set(false);
    if (error.status === 400 || error.status === 404 || error.status === 422) {
      this.error.set(mensajeDelProblema(error, 'No se pudo registrar la devolución.'));
    }
  }
}

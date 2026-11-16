import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { nombreO, numero } from '../../../core/api/nombres';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Modal } from '../../../layout/modal/modal';
import { ComprobanteDTO, SolicitudAnulacionDTO } from '../../modelos/ventas.modelos';
import { AnulacionesService } from '../../servicios/anulaciones.service';
import { ComprobantesService } from '../../servicios/comprobantes.service';
import { FORMAS_DEVOLUCION, fechaHora, textoMotivo, ventaDe } from './anulacion.vista';

const CLASE_SUNAT: Record<string, string> = {
  ACEPTADO: 'ok',
  OBSERVADO: 'warn',
  PENDIENTE: 'warn',
  ENVIADO: 'warn',
  RECHAZADO: 'bad',
};

interface Aprobada {
  solicitud: SolicitudAnulacionDTO;
  nota: ComprobanteDTO | null;
}

/**
 * CUS23 Emitir Nota de Crédito, con VENTAS:EDITAR: bandeja de solicitudes PENDIENTES.
 * «Aprobar anulación» emite la nota de crédito y anula la venta; se muestra la nota con su estado
 * SUNAT (GET /comprobantes/{idNotaCredito}). «Rechazar» pide el motivo y la venta sigue CERRADA.
 */
@Component({
  selector: 'app-bandeja-anulaciones',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <div class="col" style="gap: 16px">
      @if (aprobada(); as resultado) {
        <div class="card col" id="notaCredito">
          <div class="row">
            <span class="chip ok">{{ ventaDe(resultado.solicitud) }} anulada</span>
            @if (resultado.nota; as nota) {
              <span class="chip" [class]="claseSunat(nota.estadoSunat)">
                SUNAT: {{ nota.estadoSunat }}
              </span>
              <button
                class="btn ghost sm"
                type="button"
                [disabled]="consultando()"
                (click)="actualizarNota()"
              >
                Actualizar estado SUNAT
              </button>
            }
          </div>
          @if (resultado.nota; as nota) {
            <h2 class="h2">Nota de crédito {{ nota.serie }}-{{ nota.numero }}</h2>
            @if (nota.estadoSunat === 'PENDIENTE' || nota.estadoSunat === 'ENVIADO') {
              <div class="alert warn">
                SUNAT no respondió. La nota queda pendiente y el sistema la reenvía sola (RN46).
              </div>
            }
          } @else if (resultado.solicitud.idNotaCredito) {
            <h2 class="h2">
              Nota de crédito {{ numero(resultado.solicitud.idNotaCredito) }} emitida
            </h2>
          } @else {
            <div class="alert info">
              SUNAT había rechazado el comprobante: la venta se anuló sin nota de crédito.
            </div>
          }
          @if (resultado.solicitud.formaDevolucion === 'MEDIO_ORIGINAL') {
            <div class="alert info">
              Falta devolver el dinero por el medio original: está en «Devoluciones».
            </div>
          } @else {
            <div class="alert ok">El total quedó como saldo a favor de la clienta.</div>
          }
          <button
            class="btn sec sm"
            type="button"
            style="align-self: flex-start"
            (click)="aprobada.set(null)"
          >
            Cerrar
          </button>
        </div>
      }

      <div class="card cp0 tw">
        <table class="tbl">
          <thead>
            <tr>
              <th>Venta</th>
              <th class="r">Total</th>
              <th>Motivo</th>
              <th>Solicitó</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (solicitud of solicitudes(); track solicitud.idSolicitud) {
              <tr>
                <td>
                  <div class="b">{{ ventaDe(solicitud) }}</div>
                  <div class="xs mut">
                    {{ nombreO(solicitud.nombreCliente) }} ·
                    {{ formas[solicitud.formaDevolucion ?? 'MEDIO_ORIGINAL'] }}
                  </div>
                </td>
                <td class="r num">{{ soles(solicitud.totalVenta) }}</td>
                <td>
                  <div>{{ solicitud.motivo }}</div>
                  <div class="xs mut">{{ textoMotivo(solicitud.codigoMotivo) }}</div>
                </td>
                <td>
                  <div>{{ nombreO(solicitud.nombreUsuarioSolicita) }}</div>
                  <div class="xs mut num">{{ fechaHora(solicitud.fechaSolicitud) }}</div>
                </td>
                <td class="r">
                  <div class="row nw" style="justify-content: flex-end">
                    <button class="btn sm" type="button" (click)="porAprobar.set(solicitud)">
                      Aprobar anulación
                    </button>
                    <button class="btn ghost sm" type="button" (click)="abrirRechazo(solicitud)">
                      Rechazar
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td class="vacio" colspan="5">
                  {{ cargando() ? 'Cargando…' : 'No hay solicitudes pendientes.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (porAprobar(); as solicitud) {
      <app-modal titulo="Aprobar anulación" [angosto]="true" (cerrar)="porAprobar.set(null)">
        <div class="mb">
          <p style="margin: 0">
            Se emitirá la nota de crédito de
            {{ ventaDe(solicitud) }} por {{ soles(solicitud.totalVenta) }} y la venta quedará
            anulada (RN12, RN32).
          </p>
        </div>
        <div class="mf">
          <button class="btn sec" type="button" (click)="porAprobar.set(null)">Volver</button>
          <button class="btn bad" type="button" [disabled]="enviando()" (click)="aprobar()">
            Aprobar anulación
          </button>
        </div>
      </app-modal>
    }

    @if (porRechazar(); as solicitud) {
      <app-modal titulo="Rechazar solicitud" [angosto]="true" (cerrar)="porRechazar.set(null)">
        <form [formGroup]="rechazo" (ngSubmit)="rechazar()">
          <div class="mb">
            <div class="mut sm">{{ ventaDe(solicitud) }} · la venta sigue cerrada.</div>
            @if (errorRechazo(); as mensaje) {
              <div class="alert bad" role="alert">{{ mensaje }}</div>
            }
            <div class="fld">
              <label class="lbl" for="motivoRechazo">MOTIVO DEL RECHAZO (OBLIGATORIO)</label>
              <input
                class="inp"
                id="motivoRechazo"
                maxlength="200"
                formControlName="motivoRechazo"
              />
            </div>
          </div>
          <div class="mf">
            <button class="btn sec" type="button" (click)="porRechazar.set(null)">Volver</button>
            <button class="btn" type="submit" [disabled]="enviando()">Rechazar</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class BandejaAnulaciones implements OnInit {
  private readonly servicio = inject(AnulacionesService);
  private readonly comprobantes = inject(ComprobantesService);
  private readonly notificaciones = inject(NotificacionesService);

  /** Una aprobación con devolución por el medio original suma una devolución pendiente. */
  readonly aprobacion = output<SolicitudAnulacionDTO>();

  protected readonly soles = soles;
  protected readonly nombreO = nombreO;
  protected readonly numero = numero;
  protected readonly ventaDe = ventaDe;
  protected readonly fechaHora = fechaHora;
  protected readonly textoMotivo = textoMotivo;
  protected readonly formas = FORMAS_DEVOLUCION;
  protected readonly solicitudes = signal<SolicitudAnulacionDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly porAprobar = signal<SolicitudAnulacionDTO | null>(null);
  protected readonly porRechazar = signal<SolicitudAnulacionDTO | null>(null);
  protected readonly aprobada = signal<Aprobada | null>(null);
  protected readonly enviando = signal(false);
  protected readonly consultando = signal(false);
  protected readonly errorRechazo = signal<string | null>(null);

  protected readonly rechazo = inject(FormBuilder).nonNullable.group({
    motivoRechazo: ['', [Validators.required, Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected claseSunat(estado?: string): string {
    return CLASE_SUNAT[estado ?? ''] ?? '';
  }

  protected abrirRechazo(solicitud: SolicitudAnulacionDTO): void {
    this.rechazo.reset();
    this.errorRechazo.set(null);
    this.porRechazar.set(solicitud);
  }

  protected aprobar(): void {
    const idSolicitud = this.porAprobar()?.idSolicitud;
    if (idSolicitud === undefined) {
      return;
    }
    this.enviando.set(true);
    this.servicio.aprobar(idSolicitud).subscribe({
      next: (solicitud) => {
        this.enviando.set(false);
        this.porAprobar.set(null);
        this.quitar(idSolicitud);
        this.aprobada.set({ solicitud, nota: null });
        this.aprobacion.emit(solicitud);
        this.leerNota(solicitud.idNotaCredito);
      },
      // El 409 (ya resuelta o SUNAT aún no acepta) lo avisa el interceptor: se vuelve a leer.
      error: () => {
        this.enviando.set(false);
        this.porAprobar.set(null);
        this.cargar();
      },
    });
  }

  protected actualizarNota(): void {
    this.leerNota(this.aprobada()?.nota?.idComprobante);
  }

  protected rechazar(): void {
    const idSolicitud = this.porRechazar()?.idSolicitud;
    const motivo = this.rechazo.getRawValue().motivoRechazo.trim();
    if (idSolicitud === undefined || !motivo) {
      this.errorRechazo.set('Escribe el motivo del rechazo.');
      return;
    }
    this.errorRechazo.set(null);
    this.enviando.set(true);
    this.servicio.rechazar(idSolicitud, motivo).subscribe({
      next: () => {
        this.enviando.set(false);
        this.porRechazar.set(null);
        this.quitar(idSolicitud);
        this.notificaciones.mostrar('Solicitud rechazada: la venta sigue cerrada.');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (error.status === 409) {
          this.porRechazar.set(null);
          this.cargar();
        } else if (error.status === 404 || error.status === 422) {
          this.errorRechazo.set(mensajeDelProblema(error, 'No se pudo rechazar la solicitud.'));
        }
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.listar('PENDIENTE').subscribe({
      next: (solicitudes) => {
        this.solicitudes.set(solicitudes);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  private quitar(idSolicitud: number): void {
    this.solicitudes.update((lista) => lista.filter((s) => s.idSolicitud !== idSolicitud));
  }

  private leerNota(idNotaCredito?: number): void {
    if (!idNotaCredito) {
      return;
    }
    this.consultando.set(true);
    this.comprobantes.obtener(idNotaCredito).subscribe({
      next: (nota) => {
        this.consultando.set(false);
        this.aprobada.update((actual) => (actual ? { ...actual, nota } : actual));
      },
      error: () => this.consultando.set(false),
    });
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { nombreO, numero } from '../../../core/api/nombres';
import { leerProblema, mensajeDelProblema } from '../../../core/api/problema';
import { VentaDTO } from '../../modelos/ventas.modelos';
import { AnulacionesService } from '../../servicios/anulaciones.service';
import { VentasService } from '../../servicios/ventas.service';
import {
  comprobanteDe,
  FORMAS_DEVOLUCION,
  FormaDevolucion,
  MOTIVOS_SUNAT,
} from './anulacion.vista';

const ESTADO_VENTA: Record<string, { texto: string; clase: string }> = {
  ABIERTA: { texto: 'Abierta', clase: 'warn' },
  CERRADA: { texto: 'Cerrada', clase: 'ok' },
  ANULADA: { texto: 'Anulada', clase: 'bad' },
};

/**
 * CUS22 Anular Venta (solicitud), con VENTAS:ANULAR: desde una venta CERRADA, «Solicitar
 * anulación» con motivo, código SUNAT (01, 02 o 06) y forma de devolución. Ya no se pide usuario
 * ni clave de la administradora: la solicitud queda PENDIENTE en su bandeja (CUS23).
 */
@Component({
  selector: 'app-solicitud-anulacion',
  imports: [ReactiveFormsModule],
  template: `
    <div class="col" style="gap: 16px; max-width: 640px">
      <form
        class="card row"
        style="align-items: flex-end"
        [formGroup]="busqueda"
        (ngSubmit)="buscar()"
      >
        <div class="fld sp">
          <label class="lbl" for="anularIdVenta">NÚMERO DE VENTA</label>
          <input class="inp" id="anularIdVenta" type="number" min="1" formControlName="idVenta" />
        </div>
        <button class="btn sec" type="submit">Buscar venta</button>
      </form>

      @if (errorBusqueda(); as mensaje) {
        <div class="alert bad" role="alert">{{ mensaje }}</div>
      }

      @if (venta(); as actual) {
        <div class="card col" id="ventaAnular">
          <div class="row">
            <div class="sp">
              <div class="h3">{{ comprobanteDe(actual) }}</div>
              <div class="xs mut">
                Venta {{ numero(actual.idVenta) }} ·
                {{ actual.idCliente ? nombreO(actual.nombreCliente) : 'Cliente de paso' }}
              </div>
            </div>
            <b class="num">{{ soles(actual.total) }}</b>
            <span class="chip" [class]="estado(actual).clase">{{ estado(actual).texto }}</span>
            @if (pendiente()) {
              <span class="chip warn">Anulación pendiente</span>
            }
          </div>

          @if (enviada()) {
            <div class="alert ok" role="status">Solicitud enviada a la administradora.</div>
          } @else if (pendiente()) {
            <div class="alert info">
              La venta ya tiene una solicitud de anulación pendiente en la bandeja de la
              administradora.
            </div>
          } @else if (actual.estado !== 'CERRADA') {
            <div class="alert info">Solo se anula una venta cerrada (RN12).</div>
          } @else {
            <form class="col" [formGroup]="formulario" (ngSubmit)="solicitar()">
              @if (error(); as mensaje) {
                <div class="alert bad" role="alert">{{ mensaje }}</div>
              }
              <div class="fld">
                <label class="lbl" for="anularMotivo">MOTIVO (OBLIGATORIO)</label>
                <input
                  class="inp"
                  id="anularMotivo"
                  maxlength="200"
                  placeholder="Ej. La clienta desistió"
                  formControlName="motivo"
                />
              </div>
              <div class="fld">
                <label class="lbl" for="anularCodigo">CÓDIGO DE MOTIVO SUNAT</label>
                <select class="inp" id="anularCodigo" formControlName="codigoMotivo">
                  @for (motivo of motivos; track motivo.codigo) {
                    <option [value]="motivo.codigo">{{ motivo.texto }}</option>
                  }
                </select>
              </div>
              <div class="fld">
                <span class="lbl">DEVOLUCIÓN DEL DINERO (RN44)</span>
                <div class="seg" role="group" aria-label="Forma de devolución">
                  @for (forma of formas; track forma) {
                    <button
                      type="button"
                      [class.on]="formulario.controls.formaDevolucion.value === forma"
                      [attr.aria-pressed]="formulario.controls.formaDevolucion.value === forma"
                      [disabled]="forma === 'SALDO_FAVOR' && !actual.idCliente"
                      (click)="formulario.controls.formaDevolucion.setValue(forma)"
                    >
                      {{ textoForma[forma] }}
                    </button>
                  }
                </div>
                @if (!actual.idCliente) {
                  <div class="xs mut">Un cliente de paso no tiene saldo a favor (RN44).</div>
                }
              </div>
              <div class="xs mut">
                Al aprobarla, la administradora emite la nota de crédito y la venta queda anulada.
              </div>
              <button
                class="btn bad"
                type="submit"
                style="align-self: flex-start"
                [disabled]="enviando()"
              >
                Solicitar anulación
              </button>
            </form>
          }
        </div>
      }
    </div>
  `,
})
export class SolicitudAnulacion implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly ventas = inject(VentasService);
  private readonly anulaciones = inject(AnulacionesService);

  /** La venta que llega desde el comprobante (?idVenta=). */
  readonly idVentaInicial = input<number | null>(null);

  protected readonly soles = soles;
  protected readonly nombreO = nombreO;
  protected readonly numero = numero;
  protected readonly comprobanteDe = comprobanteDe;
  protected readonly motivos = MOTIVOS_SUNAT;
  protected readonly textoForma = FORMAS_DEVOLUCION;
  protected readonly formas = Object.keys(FORMAS_DEVOLUCION) as FormaDevolucion[];
  protected readonly venta = signal<VentaDTO | null>(null);
  protected readonly errorBusqueda = signal<string | null>(null);
  /** VentaDTO no dice si hay una solicitud PENDIENTE: se sabe al enviarla o por su 409. */
  protected readonly pendiente = signal(false);
  protected readonly enviada = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly busqueda = this.fb.group({
    idVenta: [null as number | null, [Validators.required, Validators.min(1)]],
  });
  protected readonly formulario = this.fb.group({
    motivo: ['', [Validators.required, Validators.maxLength(200)]],
    codigoMotivo: ['01', Validators.required],
    formaDevolucion: ['MEDIO_ORIGINAL' as FormaDevolucion],
  });

  ngOnInit(): void {
    const idVenta = this.idVentaInicial();
    if (idVenta) {
      this.busqueda.controls.idVenta.setValue(idVenta);
      this.buscar();
    }
  }

  protected estado(venta: VentaDTO): { texto: string; clase: string } {
    return ESTADO_VENTA[venta.estado ?? ''] ?? { texto: venta.estado ?? '', clase: '' };
  }

  protected buscar(): void {
    const { idVenta } = this.busqueda.getRawValue();
    if (!idVenta || idVenta < 1) {
      this.errorBusqueda.set('Escribe el número de la venta.');
      return;
    }
    this.errorBusqueda.set(null);
    this.venta.set(null);
    this.pendiente.set(false);
    this.enviada.set(false);
    this.error.set(null);
    this.formulario.reset();
    this.ventas.obtener(idVenta).subscribe({
      next: (venta) => this.venta.set(venta),
      error: (error: HttpErrorResponse) => {
        if (error.status === 404 || error.status === 400) {
          this.errorBusqueda.set(mensajeDelProblema(error, 'La venta no existe.'));
        }
      },
    });
  }

  protected solicitar(): void {
    const idVenta = this.venta()?.idVenta;
    const { motivo, codigoMotivo, formaDevolucion } = this.formulario.getRawValue();
    if (idVenta === undefined || !motivo.trim()) {
      this.error.set('Escribe el motivo de la anulación.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.anulaciones
      .solicitar(idVenta, { motivo: motivo.trim(), codigoMotivo, formaDevolucion })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.pendiente.set(true);
          this.enviada.set(true);
        },
        // El 409 y el 422 los avisa el interceptor; el 409 es otra solicitud PENDIENTE.
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          if (leerProblema(error)?.regla === 'UQ_SOL_ANUL_PENDIENTE') {
            this.pendiente.set(true);
          } else if (error.status === 400 || error.status === 404 || error.status === 422) {
            this.error.set(mensajeDelProblema(error, 'Revisa los datos de la solicitud.'));
          }
        },
      });
  }
}

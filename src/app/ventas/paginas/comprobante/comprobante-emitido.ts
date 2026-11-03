import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { CompartirEnlace } from '../../../layout/compartir-enlace/compartir-enlace';
import { VentaDTO } from '../../modelos/ventas.modelos';
import { ComprobantesService } from '../../servicios/comprobantes.service';

type Canal = 'WHATSAPP' | 'CORREO';

const CLASE_SUNAT: Record<string, string> = {
  ACEPTADO: 'ok',
  OBSERVADO: 'warn',
  PENDIENTE: 'warn',
  ENVIADO: 'warn',
  RECHAZADO: 'bad',
};

/** Resultado de CUS19 con la entrega de CUS20. La usan IGU_Cobro e IGU_VentaRapida. */
@Component({
  selector: 'app-comprobante-emitido',
  imports: [ReactiveFormsModule, CompartirEnlace],
  template: `
    <div class="col comprobante">
      <div class="row" style="gap: 6px">
        <span class="chip ok">Venta cerrada</span>
        <span class="chip" [class]="claseSunat()">SUNAT: {{ comprobante()?.estadoSunat }}</span>
      </div>
      <h2 class="h2">
        {{ comprobante()?.tipo === 'FACTURA' ? 'Factura' : 'Boleta' }}
        {{ comprobante()?.serie }}-{{ comprobante()?.numero }}
      </h2>
      <div class="row">
        <span class="sp mut">Total del comprobante</span>
        <b class="kpi num" style="font-size: 28px">{{ soles(venta().total) }}</b>
      </div>

      @switch (comprobante()?.estadoSunat) {
        @case ('ACEPTADO') {
          <div class="alert ok">SUNAT aceptó el comprobante.</div>
        }
        @case ('RECHAZADO') {
          <div class="alert bad">
            SUNAT rechazó el comprobante (código {{ comprobante()?.codigoRespuesta }}).
          </div>
        }
        @case ('OBSERVADO') {
          <div class="alert warn">
            SUNAT aceptó el comprobante con observaciones (código
            {{ comprobante()?.codigoRespuesta }}).
          </div>
        }
        @default {
          <div class="alert warn">
            SUNAT no respondió. El comprobante queda pendiente y el sistema lo reenvía solo (RN46).
          </div>
        }
      }

      @if (error(); as mensaje) {
        <div class="alert bad" role="alert">{{ mensaje }}</div>
      }

      @if (puedeEntregar()) {
        <div class="h3">Entregar comprobante</div>
        <button
          class="btn sec"
          type="button"
          style="align-self: flex-start"
          [disabled]="imprimiendo()"
          (click)="imprimir()"
        >
          Imprimir comprobante
        </button>
        <form class="col" style="gap: 8px" [formGroup]="entrega" (ngSubmit)="compartir()">
          <div class="seg" role="group" aria-label="Canal de entrega">
            <button
              type="button"
              [class.on]="entrega.controls.canal.value === 'WHATSAPP'"
              (click)="elegirCanal('WHATSAPP')"
            >
              WhatsApp
            </button>
            <button
              type="button"
              [class.on]="entrega.controls.canal.value === 'CORREO'"
              (click)="elegirCanal('CORREO')"
            >
              Correo
            </button>
          </div>
          @if (entrega.controls.canal.value === 'CORREO') {
            <div class="fld">
              <label class="lbl" for="entregaCorreo">CORREO</label>
              <input class="inp" id="entregaCorreo" type="email" formControlName="correo" />
            </div>
          }
          <button class="btn sec" type="submit" style="align-self: flex-start">
            Compartir comprobante
          </button>
        </form>
        @if (enlace(); as generado) {
          <app-compartir-enlace
            [enlace]="generado"
            [asunto]="'Comprobante ' + comprobante()?.serie + '-' + comprobante()?.numero"
            [canal]="entrega.controls.canal.value"
            [correo]="entrega.controls.correo.value"
          />
        }
      }
    </div>
  `,
})
export class ComprobanteEmitido {
  private readonly servicio = inject(ComprobantesService);
  private readonly sesion = inject(SesionService);
  private marco?: { iframe: HTMLIFrameElement; url: string };

  readonly venta = input.required<VentaDTO>();

  protected readonly soles = soles;
  protected readonly comprobante = computed(() => this.venta().comprobante);
  protected readonly claseSunat = computed(
    () => CLASE_SUNAT[this.comprobante()?.estadoSunat ?? ''] ?? 'warn',
  );
  /** Las dos lecturas del comprobante piden VENTAS:VER; cobrar pide VENTAS:CREAR. */
  protected readonly puedeEntregar = computed(() => this.sesion.tienePermiso(PERMISOS.ventasVer));
  protected readonly imprimiendo = signal(false);
  protected readonly enlace = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly entrega = inject(FormBuilder).nonNullable.group({
    canal: ['WHATSAPP' as Canal],
    correo: ['', Validators.email],
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.quitarMarco());
  }

  protected elegirCanal(canal: Canal): void {
    this.entrega.controls.canal.setValue(canal);
    this.enlace.set(null);
  }

  protected imprimir(): void {
    const idComprobante = this.comprobante()?.idComprobante;
    if (idComprobante === undefined) {
      return;
    }
    this.error.set(null);
    this.imprimiendo.set(true);
    this.servicio.obtenerRepresentacion(idComprobante).subscribe({
      next: (pdf) => {
        this.imprimiendo.set(false);
        this.imprimirPdf(pdf);
      },
      error: (error: HttpErrorResponse) => {
        this.imprimiendo.set(false);
        this.atender(error);
      },
    });
  }

  protected compartir(): void {
    const idComprobante = this.comprobante()?.idComprobante;
    const { canal, correo } = this.entrega.getRawValue();
    if (idComprobante === undefined) {
      return;
    }
    if (canal === 'CORREO' && (!correo.trim() || this.entrega.controls.correo.invalid)) {
      this.error.set('Escribe un correo válido.');
      return;
    }
    this.error.set(null);
    const destino = canal === 'CORREO' ? correo.trim() : undefined;
    this.servicio.obtenerEnlace(idComprobante, canal, destino).subscribe({
      next: ({ enlace }) => this.enlace.set(enlace ?? null),
      error: (error: HttpErrorResponse) => this.atender(error),
    });
  }

  private atender(error: HttpErrorResponse): void {
    if (error.status === 404) {
      this.error.set(mensajeDelProblema(error, 'El comprobante no existe.'));
    }
  }

  /** Un iframe invisible evita el bloqueo de ventanas emergentes tras la espera del PDF. */
  private imprimirPdf(pdf: Blob): void {
    this.quitarMarco();
    const url = URL.createObjectURL(pdf);
    const iframe = document.createElement('iframe');
    iframe.title = 'Comprobante para imprimir';
    iframe.style.cssText = 'position: fixed; width: 0; height: 0; border: 0';
    iframe.onload = () => iframe.contentWindow?.print();
    iframe.src = url;
    document.body.append(iframe);
    this.marco = { iframe, url };
  }

  private quitarMarco(): void {
    if (this.marco) {
      this.marco.iframe.remove();
      URL.revokeObjectURL(this.marco.url);
      this.marco = undefined;
    }
  }
}

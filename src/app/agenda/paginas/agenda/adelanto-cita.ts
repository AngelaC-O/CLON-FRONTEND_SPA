import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ListasService } from '../../../core/api/listas.service';
import { canalPropuesto, etiquetaMedio, mediosActivos } from '../../../core/api/medios';
import { MedioPagoDTO } from '../../../core/api/modelos.generados';
import { mensajeDelProblema } from '../../../core/api/problema';
import { CompartirEnlace } from '../../../layout/compartir-enlace/compartir-enlace';
import { Modal } from '../../../layout/modal/modal';
import { EnlacePagoDTO } from '../../../pagos/modelos/pagos.modelos';
import { PagosService } from '../../../pagos/servicios/pagos.service';
import { CitaDTO } from '../../modelos/agenda.modelos';
import { horaDe } from '../../modelos/agenda.vista';
import { CitasService } from '../../servicios/citas.service';

/** CUS07: en efectivo entra a la caja abierta; por enlace cuenta cuando Izipay lo aprueba (RN04). */
@Component({
  selector: 'app-adelanto-cita',
  imports: [ReactiveFormsModule, CompartirEnlace, Modal],
  template: `
    <app-modal titulo="Adelanto de la reserva" [angosto]="true" (cerrar)="cerrar.emit()">
      @if (enlace(); as generado) {
        <div class="mb">
          <div class="alert warn" role="status">
            <span>
              Enlace creado. El adelanto se registra solo cuando Izipay aprueba el pago (RN04).
            </span>
          </div>
          @if (generado.enlacePago; as url) {
            <app-compartir-enlace [enlace]="url" asunto="Adelanto de tu cita en Cautiva Spa" />
          }
          @if (generado.fechaExpiracion) {
            <div class="xs mut">
              Vence el {{ generado.fechaExpiracion.slice(0, 10) }} a las
              {{ horaDe(generado.fechaExpiracion) }}.
            </div>
          }
        </div>
        <div class="mf">
          <button class="btn" type="button" (click)="cerrar.emit()">Listo</button>
        </div>
      } @else {
        <form [formGroup]="formulario" (ngSubmit)="enviar()">
          <div class="mb">
            @if (error(); as mensaje) {
              <div class="alert bad" role="alert">{{ mensaje }}</div>
            }
            <div class="fld">
              <label class="lbl" for="adelantoIdCita">CÓDIGO DE LA CITA</label>
              <input
                class="inp"
                id="adelantoIdCita"
                type="number"
                min="1"
                formControlName="idCita"
              />
            </div>
            <div class="fld">
              <label class="lbl" for="adelantoMonto">ADELANTO (S/)</label>
              <input
                class="inp"
                id="adelantoMonto"
                type="number"
                min="0"
                step="0.01"
                formControlName="adelantoMonto"
              />
            </div>
            <div class="fld">
              <span class="lbl">CÓMO PAGA EL ADELANTO</span>
              <div class="seg" role="group" aria-label="Medio del adelanto">
                @for (medio of medios(); track medio.idMedioPago) {
                  <button
                    type="button"
                    style="flex: 1; padding: 0 6px"
                    [class.on]="formulario.controls.idMedioPago.value === medio.idMedioPago"
                    [attr.aria-pressed]="
                      formulario.controls.idMedioPago.value === medio.idMedioPago
                    "
                    (click)="formulario.controls.idMedioPago.setValue(medio.idMedioPago ?? null)"
                  >
                    {{ etiquetaMedio(medio) }}
                  </button>
                }
              </div>
            </div>
            @if (esDigital()) {
              <div class="xs mut">La clienta paga desde el enlace que le compartes.</div>
            } @else {
              <div class="xs mut">Se registra en la caja abierta del día.</div>
            }
          </div>
          <div class="mf">
            <button class="btn sec" type="button" (click)="cerrar.emit()">Cancelar</button>
            <button class="btn" type="submit" [disabled]="enviando()">
              {{ esDigital() ? 'Generar enlace de pago' : 'Registrar adelanto en efectivo' }}
            </button>
          </div>
        </form>
      }
    </app-modal>
  `,
})
export class AdelantoCita implements OnInit {
  private readonly citas = inject(CitasService);
  private readonly pagos = inject(PagosService);
  private readonly listas = inject(ListasService);

  readonly idCita = input<number | null>(null);
  readonly cerrar = output<void>();
  readonly registrado = output<CitaDTO>();

  protected readonly horaDe = horaDe;
  protected readonly etiquetaMedio = etiquetaMedio;
  /** GET /medios-pago (CUS62), en lugar de la copia fija (Duda 11 de NOTAS_IT1). */
  protected readonly medios = signal<MedioPagoDTO[]>([]);
  protected readonly enlace = signal<EnlacePagoDTO | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    idCita: [null as number | null, [Validators.required, Validators.min(1)]],
    adelantoMonto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    idMedioPago: [null as number | null, Validators.required],
  });

  ngOnInit(): void {
    this.formulario.controls.idCita.setValue(this.idCita());
    this.listas.mediosPago().subscribe((medios) => {
      const activos = mediosActivos(medios);
      this.medios.set(activos);
      // Se propone el efectivo: el primero que no pasa por la pasarela.
      const propuesto = activos.find((m) => !m.usaPasarela) ?? activos[0];
      if (this.formulario.controls.idMedioPago.value === null && propuesto) {
        this.formulario.controls.idMedioPago.setValue(propuesto.idMedioPago ?? null);
      }
    });
  }

  protected esDigital(): boolean {
    const id = this.formulario.controls.idMedioPago.value;
    return !!canalPropuesto(this.medios().find((m) => m.idMedioPago === id));
  }

  protected enviar(): void {
    const { idCita, adelantoMonto, idMedioPago } = this.formulario.getRawValue();
    if (this.formulario.invalid || !idCita || !adelantoMonto || idMedioPago === null) {
      this.error.set('Indica la cita, un adelanto mayor que cero y cómo lo paga.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    const adelanto = { adelantoMonto, idMedioPago };
    if (this.esDigital()) {
      this.pagos.generarEnlaceAdelanto(idCita, adelanto).subscribe({
        next: (enlace) => {
          this.enviando.set(false);
          this.enlace.set(enlace);
        },
        error: (error: HttpErrorResponse) => this.fallar(error),
      });
    } else {
      this.citas.registrarAdelantoEfectivo(idCita, adelanto).subscribe({
        next: (cita) => {
          this.enviando.set(false);
          this.registrado.emit(cita);
        },
        error: (error: HttpErrorResponse) => this.fallar(error),
      });
    }
  }

  /** Los 422 y 503 de la regla ya los muestra el interceptor; el modal queda abierto. */
  private fallar(error: HttpErrorResponse): void {
    this.enviando.set(false);
    if (error.status === 404) {
      this.error.set(mensajeDelProblema(error, 'La cita no existe.'));
    }
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import { CitaDTO, FranjaAgendaDTO } from '../../modelos/agenda.modelos';
import { fechaCorta, MOTIVO_NO_SE_PRESENTO, tituloBloque } from '../../modelos/agenda.vista';
import { CitasService } from '../../servicios/citas.service';

/**
 * CUS10 Cancelar Cita, con el motivo obligatorio. «No se presentó» es la inasistencia: CITA no tiene
 * estado NO_ASISTIO. Si la cita tenía adelanto, pasa a saldo a favor de la clienta (RN05).
 */
@Component({
  selector: 'app-cancelar-cita',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal titulo="Cancelar cita" [angosto]="true" (cerrar)="cerrar.emit()">
      @if (cancelada(); as cita) {
        <div class="mb">
          @if (cita.adelantoMonto) {
            <div class="alert ok" role="status" id="saldoQuedo">
              Cita cancelada. El adelanto de {{ soles(cita.adelantoMonto) }} quedó como saldo a
              favor de {{ tituloBloque(franja()) }}. No vence.
            </div>
          } @else {
            <div class="alert info" role="status">
              Cita cancelada. La clienta no dejó adelanto: solo se liberó el horario.
            </div>
          }
        </div>
        <div class="mf">
          <button class="btn" type="button" (click)="cerrar.emit()">Cerrar</button>
        </div>
      } @else {
        <form [formGroup]="formulario" (ngSubmit)="cancelar()">
          <div class="mb">
            <div class="mut sm">
              {{ tituloBloque(franja()) }} ·
              {{ franja().nombreServicio || 'Variante ' + franja().idVariante }} ·
              {{ fechaCorta(franja().inicio, true) }}
            </div>
            @if (error(); as mensaje) {
              <div class="alert bad" role="alert">{{ mensaje }}</div>
            }
            <div class="fld">
              <label class="lbl" for="motivoCancelacion">MOTIVO (OBLIGATORIO)</label>
              <input
                class="inp"
                id="motivoCancelacion"
                maxlength="200"
                placeholder="Ej. La clienta no puede asistir"
                formControlName="motivoCancelacion"
              />
            </div>
            <button
              class="btn sec sm"
              type="button"
              style="align-self: flex-start"
              (click)="noSePresento()"
            >
              {{ motivoNoSePresento }}
            </button>
            <div class="alert info">
              Si la clienta dejó adelanto, pasará a saldo a favor (RN05).
            </div>
          </div>
          <div class="mf">
            <button class="btn sec" type="button" (click)="cerrar.emit()">Volver</button>
            <button class="btn bad" type="submit" [disabled]="enviando()">Cancelar cita</button>
          </div>
        </form>
      }
    </app-modal>
  `,
})
export class CancelarCita {
  private readonly servicio = inject(CitasService);

  readonly franja = input.required<FranjaAgendaDTO>();
  readonly cerrar = output<void>();
  /** Se avisa al cancelar; el modal sigue abierto para mostrar el saldo a favor. */
  readonly cancelacion = output<CitaDTO>();

  protected readonly soles = soles;
  protected readonly fechaCorta = fechaCorta;
  protected readonly tituloBloque = tituloBloque;
  protected readonly motivoNoSePresento = MOTIVO_NO_SE_PRESENTO;
  protected readonly cancelada = signal<CitaDTO | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    motivoCancelacion: ['', [Validators.required, Validators.maxLength(200)]],
  });

  protected noSePresento(): void {
    this.formulario.controls.motivoCancelacion.setValue(MOTIVO_NO_SE_PRESENTO);
  }

  protected cancelar(): void {
    const motivo = this.formulario.getRawValue().motivoCancelacion.trim();
    const idCita = this.franja().idOrigen;
    if (!motivo || idCita === undefined) {
      this.error.set('Escribe el motivo de la cancelación.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio.cancelar(idCita, motivo).subscribe({
      next: (cita) => {
        this.enviando.set(false);
        this.cancelada.set(cita);
        this.cancelacion.emit(cita);
      },
      // El 422 (sin motivo o cita no PENDIENTE) lo muestra el interceptor.
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (error.status === 404) {
          this.error.set(mensajeDelProblema(error, 'La cita no existe.'));
        }
      },
    });
  }
}

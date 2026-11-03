import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import { CitaDTO, HoraLibre } from '../../modelos/agenda.modelos';
import { horaDe } from '../../modelos/agenda.vista';
import { CitasService } from '../../servicios/citas.service';
import { ClientaElegida, SelectorClienta } from './selector-clienta';

export interface PedidoEspera {
  clienta: ClientaElegida | null;
  idVariante: number | null;
  fecha: string;
}

/** CUS05 Programar Cita; sin hora libre, ofrece el «extend» a CUS06. */
@Component({
  selector: 'app-nueva-cita',
  imports: [ReactiveFormsModule, Modal, SelectorClienta],
  template: `
    <app-modal titulo="Nueva cita" (cerrar)="cerrar.emit()">
      <form [formGroup]="formulario" (ngSubmit)="agendar()">
        <div class="mb">
          @if (error(); as mensaje) {
            <div class="alert bad" role="alert">{{ mensaje }}</div>
          }
          <app-selector-clienta (cambio)="clienta.set($event)" />
          <div class="g2">
            <div class="fld">
              <label class="lbl" for="citaIdVariante">CÓDIGO DE LA VARIANTE</label>
              <input
                class="inp"
                id="citaIdVariante"
                type="number"
                min="1"
                formControlName="idVariante"
                (input)="horas.set(null)"
              />
            </div>
            <div class="fld">
              <label class="lbl" for="citaFecha">FECHA</label>
              <input
                class="inp"
                id="citaFecha"
                type="date"
                formControlName="fecha"
                (input)="horas.set(null)"
              />
            </div>
          </div>
          <button
            class="btn sec"
            type="button"
            style="align-self: flex-start"
            (click)="verDisponibilidad()"
          >
            Ver disponibilidad
          </button>

          @if (horas(); as libres) {
            @if (libres.length) {
              <div class="fld">
                <span class="lbl">HORAS LIBRES</span>
                <div class="row" style="gap: 6px">
                  @for (hora of libres; track hora.inicio) {
                    <button
                      class="btn sm"
                      type="button"
                      [class.sec]="hora !== elegida()"
                      (click)="elegirHora(hora)"
                    >
                      {{ horaDe(hora.inicio) }}
                    </button>
                  }
                </div>
              </div>
            } @else {
              <div class="alert warn" role="status">
                <span class="sp">No hay horas libres ese día. Anota a la clienta en la lista.</span>
                <button
                  class="btn sm"
                  type="button"
                  (click)="
                    irAEspera.emit({
                      clienta: clienta(),
                      idVariante: formulario.controls.idVariante.value,
                      fecha: formulario.controls.fecha.value,
                    })
                  "
                >
                  Anotar en lista de espera
                </button>
              </div>
            }
          }

          @if (elegida(); as hora) {
            <div class="g2">
              <div class="fld">
                <label class="lbl" for="citaIdPersonal">ESPECIALISTA</label>
                <select class="inp" id="citaIdPersonal" formControlName="idPersonal">
                  @for (id of hora.idsPersonal; track id) {
                    <option [ngValue]="id">Especialista {{ id }}</option>
                  }
                </select>
              </div>
              <div class="fld">
                <label class="lbl" for="citaIdRecurso">RECURSO</label>
                <select class="inp" id="citaIdRecurso" formControlName="idRecurso">
                  @for (id of hora.idsRecurso; track id) {
                    <option [ngValue]="id">Recurso {{ id }}</option>
                  }
                </select>
              </div>
              <div class="fld">
                <label class="lbl" for="citaDuracionMin">DURACIÓN (MIN)</label>
                <input
                  class="inp"
                  id="citaDuracionMin"
                  type="number"
                  min="1"
                  formControlName="duracionMin"
                />
              </div>
            </div>
          }
        </div>
        <div class="mf">
          <button class="btn sec" type="button" (click)="cerrar.emit()">Cancelar</button>
          <button class="btn" type="submit" [disabled]="enviando() || !elegida()">Agendar</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class NuevaCita implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(CitasService);

  readonly fechaInicial = input.required<string>();
  readonly cerrar = output<void>();
  readonly agendada = output<CitaDTO>();
  readonly irAEspera = output<PedidoEspera>();

  protected readonly horaDe = horaDe;
  protected readonly clienta = signal<ClientaElegida | null>(null);
  protected readonly horas = signal<HoraLibre[] | null>(null);
  protected readonly elegida = signal<HoraLibre | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    idVariante: [null as number | null, [Validators.required, Validators.min(1)]],
    fecha: ['', Validators.required],
    idPersonal: [null as number | null, Validators.required],
    idRecurso: [null as number | null, Validators.required],
    duracionMin: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.formulario.controls.fecha.setValue(this.fechaInicial());
  }

  protected verDisponibilidad(): void {
    const { idVariante, fecha } = this.formulario.getRawValue();
    if (!idVariante || idVariante < 1 || !fecha) {
      this.error.set('Indica la variante y la fecha.');
      return;
    }
    this.error.set(null);
    this.elegida.set(null);
    this.servicio.consultarDisponibilidad(idVariante, fecha).subscribe({
      next: (horas) => this.horas.set(horas),
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.error.set(mensajeDelProblema(error, 'La variante no existe.'));
        }
      },
    });
  }

  protected elegirHora(hora: HoraLibre): void {
    this.elegida.set(hora);
    this.formulario.patchValue({
      idPersonal: hora.idsPersonal?.[0] ?? null,
      idRecurso: hora.idsRecurso?.[0] ?? null,
      duracionMin: hora.duracionMin ?? null,
    });
  }

  protected agendar(): void {
    const { idVariante, idPersonal, idRecurso, duracionMin } = this.formulario.getRawValue();
    const clienta = this.clienta();
    const inicio = this.elegida()?.inicio;
    if (!clienta || !inicio || !idVariante || !idPersonal || !idRecurso || !duracionMin) {
      this.error.set('Elige la clienta, la hora, la especialista, el recurso y la duración.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .agendar({
        idCliente: clienta.idCliente,
        idVariante,
        idPersonal,
        idRecurso,
        fechaHoraInicio: inicio,
        duracionMin,
      })
      .subscribe({
        next: (cita) => {
          this.enviando.set(false);
          this.agendada.emit(cita);
        },
        // Los 409 y 422 de la regla los muestra el interceptor; el modal queda abierto.
        error: () => this.enviando.set(false),
      });
  }
}

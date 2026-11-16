import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { especialistaLibre, nombreO, recursoLibre } from '../../../core/api/nombres';
import { leerProblema, mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import { SelectorVariante } from '../../../layout/selector-variante/selector-variante';
import { CitaDTO, FiltrosAgendaDTO, HoraLibre, ListaEsperaDTO } from '../../modelos/agenda.modelos';
import {
  horaDe,
  hoyIso,
  MENSAJE_RN49,
  nombreEspecialista as nombreDe,
} from '../../modelos/agenda.vista';
import { CitasService } from '../../servicios/citas.service';
import { ClientaElegida, SelectorClienta } from './selector-clienta';

export interface PedidoEspera {
  clienta: ClientaElegida | null;
  idVariante: number | null;
  fecha: string;
}

/**
 * CUS05 Programar Cita; sin hora libre, ofrece el «extend» a CUS06. Las horas libres se muestran tal
 * como llegan, cada AGENDA_PASO_MIN minutos (RN51): el paso lo decide el back-end. Con una espera
 * («Programar» en la lista de espera), parte de sus datos y envía su idEspera (RF09).
 */
@Component({
  selector: 'app-nueva-cita',
  imports: [ReactiveFormsModule, Modal, SelectorClienta, SelectorVariante],
  template: `
    <app-modal titulo="Nueva cita" (cerrar)="cerrar.emit()">
      <form [formGroup]="formulario" (ngSubmit)="agendar()">
        <div class="mb">
          @if (error(); as mensaje) {
            <div class="alert bad" role="alert">{{ mensaje }}</div>
          }
          @if (espera(); as pendiente) {
            <div class="alert info" role="status">{{ textoEspera(pendiente) }}</div>
          }
          <app-selector-clienta [inicial]="clientaInicial" (cambio)="clienta.set($event)" />
          <app-selector-variante prefijo="cita" [control]="formulario.controls.idVariante" />
          <div class="fld">
            <label class="lbl" for="citaFecha">FECHA</label>
            <input
              class="inp"
              id="citaFecha"
              type="date"
              [min]="hoy"
              formControlName="fecha"
              (input)="horas.set(null)"
            />
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
                    <option [ngValue]="id">{{ nombreEspecialista(hora, id) }}</option>
                  }
                </select>
              </div>
              <div class="fld">
                <label class="lbl" for="citaIdRecurso">RECURSO</label>
                <select class="inp" id="citaIdRecurso" formControlName="idRecurso">
                  @for (id of hora.idsRecurso; track id) {
                    <option [ngValue]="id">{{ nombreRecurso(hora, id) }}</option>
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
  private readonly destruir = inject(DestroyRef);

  readonly fechaInicial = input.required<string>();
  /** Nombres de GET /citas/filtros, para no mostrar códigos en los selectores. */
  readonly filtros = input<FiltrosAgendaDTO | null>(null);
  readonly cerrar = output<void>();
  /** La espera PENDIENTE que se convierte en cita. */
  readonly espera = input<ListaEsperaDTO | null>(null);
  readonly agendada = output<CitaDTO>();
  readonly irAEspera = output<PedidoEspera>();

  protected readonly horaDe = horaDe;
  protected readonly hoy = hoyIso();
  protected readonly clienta = signal<ClientaElegida | null>(null);
  protected clientaInicial: ClientaElegida | null = null;
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
    const espera = this.espera();
    if (espera) {
      this.clientaInicial = {
        idCliente: espera.idCliente,
        nombre: nombreO(espera.nombreCliente),
      };
      this.clienta.set(this.clientaInicial);
      this.formulario.patchValue({
        idVariante: espera.idVariante,
        fecha: espera.fechaDeseada < this.hoy ? this.hoy : espera.fechaDeseada,
      });
    } else {
      this.formulario.controls.fecha.setValue(this.fechaInicial());
    }
    this.formulario.controls.idVariante.valueChanges
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe(() => {
        this.horas.set(null);
        this.elegida.set(null);
      });
  }

  protected textoEspera(espera: ListaEsperaDTO): string {
    const rango = espera.horaDesde ? `, de ${espera.horaDesde} a ${espera.horaHasta ?? ''}` : '';
    const servicio = espera.nombreServicio || 'el servicio pedido';
    return `Desde la lista de espera: ${servicio}${rango}. Al agendar, la espera queda asignada.`;
  }

  protected verDisponibilidad(): void {
    const { idVariante, fecha } = this.formulario.getRawValue();
    if (!idVariante || idVariante < 1 || !fecha) {
      this.error.set('Elige el servicio, la variante y la fecha.');
      return;
    }
    if (fecha < this.hoy) {
      this.error.set(MENSAJE_RN49);
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

  /** El nombre llega en la hora libre (It. 2.1); si no, el de los filtros de la agenda, o «—». */
  protected nombreEspecialista(hora: HoraLibre, id: number): string {
    const especialista = this.filtros()?.especialistas?.find((e) => e.idPersonal === id);
    return especialistaLibre(hora, id, especialista && nombreDe(especialista));
  }

  protected nombreRecurso(hora: HoraLibre, id: number): string {
    return recursoLibre(
      hora,
      id,
      this.filtros()?.recursos?.find((r) => r.idRecurso === id)?.nombre,
    );
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
        ...(this.espera()?.idEspera ? { idEspera: this.espera()?.idEspera } : {}),
      })
      .subscribe({
        next: (cita) => {
          this.enviando.set(false);
          this.agendada.emit(cita);
        },
        // Los 409 y 422 de la regla los muestra el interceptor; el modal queda abierto.
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          if (leerProblema(error)?.regla === 'RN49') {
            this.error.set(mensajeDelProblema(error, MENSAJE_RN49));
          }
        },
      });
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { especialistaLibre, nombreO, recursoLibre } from '../../../core/api/nombres';
import { leerProblema, mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import {
  CitaDTO,
  FiltrosAgendaDTO,
  FranjaAgendaDTO,
  HoraLibre,
} from '../../modelos/agenda.modelos';
import {
  fechaCorta,
  horaDe,
  hoyIso,
  MENSAJE_RN49,
  nombreEspecialista as nombreDe,
  tituloBloque,
} from '../../modelos/agenda.vista';
import { CitasService } from '../../servicios/citas.service';

/**
 * CUS09 Reprogramar Cita: nueva hora, especialista y recurso, elegidos entre las mismas horas libres
 * de CUS05 (GET /citas/disponibilidad con la variante de la cita). La nueva cita hereda el adelanto.
 */
@Component({
  selector: 'app-reprogramar-cita',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal titulo="Reprogramar cita" [angosto]="true" (cerrar)="cerrar.emit()">
      <form [formGroup]="formulario" (ngSubmit)="reprogramar()">
        <div class="mb">
          <div class="mut sm">
            {{ tituloBloque(cita()) }} · {{ nombreO(cita().nombreServicio) }} ·
            {{ fechaCorta(cita().inicio, true) }}
          </div>
          <div class="alert info">Si la cita tiene adelanto, se mantiene en la nueva cita.</div>
          @if (error(); as mensaje) {
            <div class="alert bad" role="alert">{{ mensaje }}</div>
          }
          <div class="row nw" style="align-items: flex-end">
            <div class="fld sp">
              <label class="lbl" for="reprogramarFecha">NUEVA FECHA</label>
              <input
                class="inp"
                id="reprogramarFecha"
                type="date"
                [min]="hoy"
                formControlName="fecha"
                (input)="limpiarHoras()"
              />
            </div>
            <button class="btn sec" type="button" (click)="verDisponibilidad()">
              Ver disponibilidad
            </button>
          </div>

          @if (horas(); as libres) {
            @if (libres.length) {
              <div class="fld">
                <span class="lbl">NUEVO HORARIO LIBRE</span>
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
                No hay horario libre en esta fecha. Prueba otra fecha o cancela la cita.
              </div>
            }
          }

          @if (elegida(); as hora) {
            <div class="g2">
              <div class="fld">
                <label class="lbl" for="reprogramarIdPersonal">ESPECIALISTA</label>
                <select class="inp" id="reprogramarIdPersonal" formControlName="idPersonal">
                  @for (id of hora.idsPersonal; track id) {
                    <option [ngValue]="id">{{ nombreEspecialista(hora, id) }}</option>
                  }
                </select>
              </div>
              <div class="fld">
                <label class="lbl" for="reprogramarIdRecurso">RECURSO</label>
                <select class="inp" id="reprogramarIdRecurso" formControlName="idRecurso">
                  @for (id of hora.idsRecurso; track id) {
                    <option [ngValue]="id">{{ nombreRecurso(hora, id) }}</option>
                  }
                </select>
              </div>
            </div>
          }
        </div>
        <div class="mf">
          <button class="btn sec" type="button" (click)="cerrar.emit()">Volver</button>
          <button class="btn" type="submit" [disabled]="enviando() || !elegida()">
            Reprogramar
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ReprogramarCita implements OnInit {
  private readonly servicio = inject(CitasService);

  readonly cita = input.required<FranjaAgendaDTO>();
  /** Nombres de GET /citas/filtros, para no mostrar códigos. */
  readonly filtros = input<FiltrosAgendaDTO | null>(null);
  readonly cerrar = output<void>();
  readonly reprogramada = output<CitaDTO>();

  protected readonly horaDe = horaDe;
  protected readonly nombreO = nombreO;
  protected readonly tituloBloque = tituloBloque;
  protected readonly fechaCorta = fechaCorta;
  protected readonly hoy = hoyIso();
  protected readonly horas = signal<HoraLibre[] | null>(null);
  protected readonly elegida = signal<HoraLibre | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    fecha: ['', Validators.required],
    idPersonal: [null as number | null, Validators.required],
    idRecurso: [null as number | null, Validators.required],
  });

  ngOnInit(): void {
    const dia = this.cita().inicio?.slice(0, 10) ?? this.hoy;
    this.formulario.controls.fecha.setValue(dia < this.hoy ? this.hoy : dia);
  }

  protected limpiarHoras(): void {
    this.horas.set(null);
    this.elegida.set(null);
  }

  protected verDisponibilidad(): void {
    const { fecha } = this.formulario.getRawValue();
    const idVariante = this.cita().idVariante;
    if (!fecha || !idVariante) {
      this.error.set('Elige la nueva fecha.');
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

  /** Propone la especialista y el recurso de la cita si siguen libres a esa hora. */
  protected elegirHora(hora: HoraLibre): void {
    const { idPersonal, idRecurso } = this.cita();
    this.elegida.set(hora);
    this.formulario.patchValue({
      idPersonal: proponer(hora.idsPersonal, idPersonal),
      idRecurso: proponer(hora.idsRecurso, idRecurso),
    });
  }

  protected reprogramar(): void {
    const { idPersonal, idRecurso } = this.formulario.getRawValue();
    const idCita = this.cita().idOrigen;
    const fechaHoraInicio = this.elegida()?.inicio;
    if (!idCita || !fechaHoraInicio || !idPersonal || !idRecurso) {
      this.error.set('Elige el nuevo horario, la especialista y el recurso.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio.reprogramar(idCita, { fechaHoraInicio, idPersonal, idRecurso }).subscribe({
      next: (cita) => {
        this.enviando.set(false);
        this.reprogramada.emit(cita);
      },
      // Los 409 (RN02) y 422 los muestra el interceptor; el RN49 queda junto al formulario.
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (leerProblema(error)?.regla === 'RN49') {
          this.error.set(mensajeDelProblema(error, MENSAJE_RN49));
        } else if (error.status === 404) {
          this.error.set(mensajeDelProblema(error, 'La cita no existe.'));
        }
      },
    });
  }
}

function proponer(ids: number[] | undefined, actual: number | undefined): number | null {
  if (actual !== undefined && ids?.includes(actual)) {
    return actual;
  }
  return ids?.[0] ?? null;
}

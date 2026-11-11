import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { leerProblema, mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import { CitaAtencionDTO } from '../../modelos/agenda.modelos';
import { claseEstado, etiquetaEstado, horaDe, MENSAJE_RN50 } from '../../modelos/agenda.vista';
import { AtencionesService } from '../../servicios/atenciones.service';

/**
 * IGU_Atencion, nodo 4:125: las citas del día de la especialista de la sesión, con
 * GET /atenciones/mi-agenda (sin selector de especialista; Duda 6 de NOTAS_IT1), y el inicio de
 * CUS11.
 */
@Component({
  selector: 'app-mi-agenda',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './mi-agenda.html',
})
export class MiAgenda implements OnInit {
  private readonly atenciones = inject(AtencionesService);
  private readonly router = inject(Router);

  protected readonly horaDe = horaDe;
  protected readonly etiquetaEstado = etiquetaEstado;
  protected readonly claseEstado = claseEstado;

  protected readonly citas = signal<CitaAtencionDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly citaPorIniciar = signal<CitaAtencionDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorInicio = signal<string | null>(null);

  protected readonly formInicio = inject(FormBuilder).nonNullable.group({
    tiempoDeclaradoMin: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.atenciones.listarMiAgenda().subscribe({
      next: (citas) => {
        this.citas.set(
          [...citas].sort((a, b) =>
            (a.fechaHoraInicio ?? '').localeCompare(b.fechaHoraInicio ?? ''),
          ),
        );
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected abrirInicio(cita: CitaAtencionDTO): void {
    this.formInicio.reset({ tiempoDeclaradoMin: cita.duracionMin ?? null });
    this.errorInicio.set(null);
    this.citaPorIniciar.set(cita);
  }

  protected iniciar(): void {
    const idCita = this.citaPorIniciar()?.idCita;
    const { tiempoDeclaradoMin } = this.formInicio.getRawValue();
    if (idCita === undefined || this.formInicio.invalid || tiempoDeclaradoMin === null) {
      this.errorInicio.set('Indica el tiempo exacto en minutos.');
      return;
    }
    this.errorInicio.set(null);
    this.enviando.set(true);
    this.atenciones.iniciar({ idCita, tiempoDeclaradoMin }).subscribe({
      next: (atencion) => {
        this.enviando.set(false);
        void this.router.navigate(['/agenda/atencion'], {
          queryParams: { idCita: atencion.idCita ?? idCita },
        });
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // Los 409 y 422 de la regla los muestra el interceptor; el modal queda abierto.
        if (leerProblema(error)?.regla === 'RN50') {
          this.errorInicio.set(mensajeDelProblema(error, MENSAJE_RN50));
        } else if (error.status === 404) {
          this.errorInicio.set(mensajeDelProblema(error, 'La cita no existe.'));
        }
      },
    });
  }

  protected continuar(cita: CitaAtencionDTO): void {
    void this.router.navigate(['/agenda/atencion'], { queryParams: { idCita: cita.idCita } });
  }
}

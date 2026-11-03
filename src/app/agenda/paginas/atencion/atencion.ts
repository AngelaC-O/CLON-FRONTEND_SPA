import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { AtencionDTO } from '../../modelos/agenda.modelos';
import { horaDe } from '../../modelos/agenda.vista';
import { AtencionEnCursoService } from '../../servicios/atencion-en-curso.service';
import { AtencionesService } from '../../servicios/atenciones.service';

/** IGU_Atencion, nodo 4:137: cronómetro y fin de CUS11. Las recomendaciones son CUS12 (It. 2). */
@Component({
  selector: 'app-atencion',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './atencion.html',
})
export class Atencion {
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(AtencionesService);
  protected readonly enCurso = inject(AtencionEnCursoService);

  protected readonly horaDe = horaDe;
  protected readonly ahora = signal(Date.now());
  protected readonly finalizada = signal<AtencionDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reloj = computed(() => {
    const inicio = this.enCurso.actual()?.horaInicio;
    return inicio ? formatoReloj(this.ahora() - new Date(inicio).getTime()) : '00:00:00';
  });

  protected readonly observaciones = inject(FormBuilder).nonNullable.control(
    '',
    Validators.maxLength(300),
  );

  constructor() {
    const temporizador = setInterval(() => this.ahora.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(temporizador));
  }

  protected finalizar(): void {
    const idAtencion = this.enCurso.actual()?.idAtencion;
    if (idAtencion === undefined) {
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    const observaciones = this.observaciones.value.trim();
    this.servicio.finalizar(idAtencion, observaciones ? { observaciones } : {}).subscribe({
      next: (atencion) => {
        this.enviando.set(false);
        this.finalizada.set(atencion);
        this.enCurso.limpiar();
        this.notificaciones.mostrar('Atención finalizada: lista para cobrar.');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // El 422 de la regla ya lo muestra el interceptor.
        if (error.status === 404) {
          this.error.set(mensajeDelProblema(error, 'La atención no existe.'));
        }
      },
    });
  }
}

function formatoReloj(milisegundos: number): string {
  const total = Math.max(0, Math.floor(milisegundos / 1000));
  return [total / 3600, (total % 3600) / 60, total % 60]
    .map((parte) => String(Math.floor(parte)).padStart(2, '0'))
    .join(':');
}

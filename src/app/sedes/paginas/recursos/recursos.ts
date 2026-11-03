import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { etiquetaTipoRecurso, TIPOS_RECURSO } from '../../../core/api/tipos-recurso';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { Modal } from '../../../layout/modal/modal';
import { RecursoDTO } from '../../modelos/sedes.modelos';
import { RecursosService } from '../../servicios/recursos.service';

/** IGU_Recursos: CUS61 Registrar Recurso. */
@Component({
  selector: 'app-recursos',
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive, Modal],
  templateUrl: './recursos.html',
})
export class Recursos {
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(RecursosService);
  private readonly sesion = inject(SesionService);

  protected readonly tipos = TIPOS_RECURSO;
  protected readonly etiquetaTipo = etiquetaTipoRecurso;
  protected readonly verServicios = computed(() => this.sesion.tienePermiso(PERMISOS.catalogoVer));

  /** El contrato no tiene lista de recursos: solo se ven los registrados en esta pantalla. */
  protected readonly recursos = signal<RecursoDTO[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    idSede: [null as number | null, [Validators.required, Validators.min(1)]],
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    tipo: ['SILLON' as RecursoDTO['tipo'], Validators.required],
    // De 0 a 30 minutos (RN03).
    minutosLimpieza: [
      null as number | null,
      [Validators.required, Validators.min(0), Validators.max(30)],
    ],
  });

  protected abrir(): void {
    this.formulario.reset({ idSede: this.sesion.sesion()?.idSede ?? null, tipo: 'SILLON' });
    this.errorFormulario.set(null);
    this.modalAbierto.set(true);
  }

  protected guardar(): void {
    if (this.formulario.invalid) {
      this.errorFormulario.set(
        'Completa sede, nombre y tipo. La limpieza va de 0 a 30 minutos (RN03).',
      );
      return;
    }
    this.errorFormulario.set(null);
    this.enviando.set(true);
    // El 422 de la regla lo muestra el interceptor; el modal queda abierto para corregir.
    this.servicio.registrar(this.formulario.getRawValue() as RecursoDTO).subscribe({
      next: (recurso) => {
        this.enviando.set(false);
        this.recursos.update((recursos) => [recurso, ...recursos]);
        this.modalAbierto.set(false);
        this.notificaciones.mostrar('Recurso registrado.');
      },
      error: () => this.enviando.set(false),
    });
  }
}

import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
export class Recursos implements OnInit {
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(RecursosService);
  private readonly sesion = inject(SesionService);

  protected readonly tipos = TIPOS_RECURSO;
  protected readonly etiquetaTipo = etiquetaTipoRecurso;
  protected readonly verServicios = computed(() => this.sesion.tienePermiso(PERMISOS.catalogoVer));
  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.sedesCrear));
  protected readonly idSede = computed(() => this.sesion.sesion()?.idSede ?? null);
  protected readonly nombreSede = computed(() => this.sesion.sesion()?.nombreSede || '—');

  protected readonly recursos = signal<RecursoDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly modalAbierto = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    idSede: [null as number | null, [Validators.required, Validators.min(1)]],
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    tipo: ['SILLON' as RecursoDTO['tipo'], Validators.required],
  });

  ngOnInit(): void {
    const idSede = this.idSede();
    if (idSede === null) {
      this.cargando.set(false);
      return;
    }
    this.servicio.listar(idSede).subscribe({
      next: (recursos) => {
        this.recursos.set(recursos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected abrir(): void {
    this.formulario.reset({ idSede: this.idSede(), tipo: 'SILLON' });
    this.errorFormulario.set(null);
    this.modalAbierto.set(true);
  }

  protected guardar(): void {
    if (this.formulario.invalid) {
      this.errorFormulario.set('Completa sede, nombre y tipo.');
      return;
    }
    this.errorFormulario.set(null);
    this.enviando.set(true);
    // El 422 de la regla lo muestra el interceptor; el modal queda abierto para corregir.
    this.servicio.registrar(this.formulario.getRawValue() as RecursoDTO).subscribe({
      next: (recurso) => {
        this.enviando.set(false);
        this.modalAbierto.set(false);
        if (recurso.idSede === this.idSede()) {
          this.recursos.update((recursos) => [...recursos, recurso]);
          this.notificaciones.mostrar('Recurso registrado.');
        } else {
          this.notificaciones.mostrar('Recurso registrado en otra sede.');
        }
      },
      error: () => this.enviando.set(false),
    });
  }
}

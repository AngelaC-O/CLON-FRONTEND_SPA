import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { leerProblema, mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { AtencionDTO, ConsumoPendienteDTO } from '../../modelos/agenda.modelos';
import { horaDe, MENSAJE_RN50 } from '../../modelos/agenda.vista';
import { AtencionesService } from '../../servicios/atenciones.service';

/**
 * IGU_Atencion, nodo 4:137: cronómetro y fin de CUS11. La atención se retoma con
 * GET /atenciones/en-curso?idCita= (Duda 7 de NOTAS_IT1): sin idCita en la ruta, se busca la cita
 * EN_CURSO de Mi agenda. Las recomendaciones son CUS12, de otra entrega.
 */
@Component({
  selector: 'app-atencion',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './atencion.html',
})
export class Atencion implements OnInit {
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(AtencionesService);
  private readonly sesion = inject(SesionService);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly horaDe = horaDe;
  protected readonly ahora = signal(Date.now());
  protected readonly actual = signal<AtencionDTO | null>(null);
  protected readonly cargando = signal(true);
  protected readonly finalizada = signal<AtencionDTO | null>(null);
  protected readonly puedeCobrar = computed(() => this.sesion.tienePermiso(PERMISOS.ventasCrear));
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reloj = computed(() => {
    const inicio = this.actual()?.horaInicio;
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

  ngOnInit(): void {
    const idCita = Number(this.ruta.snapshot.queryParamMap.get('idCita'));
    if (idCita > 0) {
      this.retomar(idCita);
      return;
    }
    this.servicio.listarMiAgenda().subscribe({
      next: (citas) => {
        const enCurso = citas.find((c) => c.estadoAtencion === 'EN_CURSO' && c.idCita);
        if (enCurso?.idCita) {
          this.retomar(enCurso.idCita);
        } else {
          this.cargando.set(false);
        }
      },
      error: () => this.cargando.set(false),
    });
  }

  /** «Faltó stock de: Keratina, Tinte; almacén lo regularizará» (RN53, RN54). */
  protected faltantes(consumos: ConsumoPendienteDTO[]): string {
    const productos = consumos.map((c) => c.producto || c.codigo || `producto ${c.idProducto}`);
    return `Faltó stock de: ${productos.join(', ')}; almacén lo regularizará.`;
  }

  protected finalizar(): void {
    const idAtencion = this.actual()?.idAtencion;
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
        this.actual.set(null);
        this.notificaciones.mostrar('Atención finalizada: lista para cobrar.');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // El 422 de la regla ya lo muestra el interceptor.
        if (leerProblema(error)?.regla === 'RN50') {
          this.error.set(mensajeDelProblema(error, MENSAJE_RN50));
        } else if (error.status === 404) {
          this.error.set(mensajeDelProblema(error, 'La atención no existe.'));
        }
      },
    });
  }

  private retomar(idCita: number): void {
    this.servicio.obtenerEnCurso(idCita).subscribe({
      next: (atencion) => {
        this.actual.set(atencion);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        if (error.status === 404 || error.status === 400) {
          this.error.set(
            mensajeDelProblema(error, `La cita ${idCita} no tiene una atención en curso.`),
          );
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

import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ListasService } from '../../../core/api/listas.service';
import { etiquetaMedio } from '../../../core/api/medios';
import { MedioPagoDTO } from '../../../core/api/modelos.generados';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { CajaAbiertaService } from '../../../core/sesion/caja-abierta.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { Modal } from '../../../layout/modal/modal';
import { CajaDTO } from '../../modelos/caja.modelos';
import { CajaService } from '../../servicios/caja.service';

/**
 * IGU_Caja, nodo 4:89, para la administradora (CUS46, CONCILIACION:VER): los cierres con diferencia
 * con «Aprobar cierre» (RF67) y las cajas de hoy con «Reabrir caja» (RF66), que pide el motivo.
 * Aprobar y reabrir piden CONCILIACION:EDITAR.
 */
@Component({
  selector: 'app-revision-caja',
  imports: [ReactiveFormsModule, RouterLink, Modal],
  templateUrl: './revision-caja.html',
})
export class RevisionCaja implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly listas = inject(ListasService);
  private readonly sesion = inject(SesionService);
  private readonly abierta = inject(CajaAbiertaService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly soles = soles;
  protected readonly puedeEditar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.conciliacionEditar),
  );
  protected readonly conDiferencia = signal<CajaDTO[] | null>(null);
  protected readonly delDia = signal<CajaDTO[] | null>(null);
  protected readonly medios = signal<MedioPagoDTO[]>([]);
  protected readonly porReabrir = signal<CajaDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorReapertura = signal<string | null>(null);

  protected readonly reapertura = inject(FormBuilder).nonNullable.group({
    motivoReapertura: ['', [Validators.required, Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    this.listas.mediosPago().subscribe((medios) => this.medios.set(medios));
    this.cargarConDiferencia();
    this.cargarDelDia();
  }

  protected medio(idMedioPago?: number): string {
    return etiquetaMedio(
      this.medios().find((m) => m.idMedioPago === idMedioPago),
      idMedioPago,
    );
  }

  /** 09/11/2026 20:05 de una fecha-hora del back-end. */
  protected fechaHora(valor?: string): string {
    if (!valor) {
      return '—';
    }
    const [anio, mes, dia] = valor.slice(0, 10).split('-');
    return `${dia}/${mes}/${anio} ${valor.slice(11, 16)}`;
  }

  protected hora(valor?: string): string {
    return valor ? valor.slice(11, 16) : '—';
  }

  /** Solo los medios con diferencia: el resto cuadró. */
  protected conDescuadre(caja: CajaDTO) {
    return (caja.arqueos ?? []).filter((a) => (a.diferencia ?? 0) !== 0);
  }

  protected aprobar(caja: CajaDTO): void {
    if (caja.idCaja === undefined) {
      return;
    }
    this.enviando.set(true);
    this.servicio.aprobarCierre(caja.idCaja).subscribe({
      next: () => {
        this.enviando.set(false);
        this.conDiferencia.update((lista) => (lista ?? []).filter((c) => c.idCaja !== caja.idCaja));
        this.notificaciones.mostrar(`Cierre de la caja ${caja.idCaja} aprobado.`);
      },
      // El 422 (ya aprobada o sin diferencias) lo avisa el interceptor: se vuelve a leer.
      error: () => {
        this.enviando.set(false);
        this.cargarConDiferencia();
      },
    });
  }

  protected abrirReapertura(caja: CajaDTO): void {
    this.reapertura.reset();
    this.errorReapertura.set(null);
    this.porReabrir.set(caja);
  }

  protected reabrir(): void {
    const idCaja = this.porReabrir()?.idCaja;
    const motivo = this.reapertura.getRawValue().motivoReapertura.trim();
    if (idCaja === undefined || !motivo) {
      this.errorReapertura.set('Escribe el motivo de la reapertura.');
      return;
    }
    this.errorReapertura.set(null);
    this.enviando.set(true);
    this.servicio.reabrir(idCaja, motivo).subscribe({
      next: (caja) => {
        this.enviando.set(false);
        this.porReabrir.set(null);
        this.delDia.update((lista) =>
          (lista ?? []).map((c) => (c.idCaja === idCaja ? { ...c, ...caja } : c)),
        );
        // La cabecera vuelve a mostrar la caja abierta.
        this.abierta.establecer(caja);
        this.notificaciones.mostrar(
          'Caja reabierta. Registra lo pendiente y luego arquea y cierra otra vez la caja.',
        );
      },
      // El 409 (otra caja ABIERTA) y el 422 también los avisa el interceptor.
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if ([400, 404, 409, 422].includes(error.status)) {
          this.errorReapertura.set(mensajeDelProblema(error, 'No se pudo reabrir la caja.'));
        }
      },
    });
  }

  private cargarConDiferencia(): void {
    this.servicio.listarConDiferencia().subscribe({
      next: (cajas) => this.conDiferencia.set(cajas),
      error: () => this.conDiferencia.set([]),
    });
  }

  private cargarDelDia(): void {
    this.servicio.listarDelDia().subscribe({
      next: (cajas) => this.delDia.set(cajas),
      error: () => this.delDia.set([]),
    });
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { ItemConciliacion, ResumenImportacionDTO } from '../../modelos/caja.modelos';
import { Conciliacion, ConciliacionService } from '../../servicios/conciliacion.service';

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Por qué no coincide una venta, un comprobante o una transacción (RN31). */
export function origenDiferencia(item: ItemConciliacion): string {
  if (item.idTransaccion !== undefined && item.idVenta === undefined) {
    return 'Cobro de Izipay sin venta';
  }
  if (item.pagoRespaldado === false) {
    return 'Pago sin respaldo en Izipay';
  }
  if (item.aceptadoSunat === false) {
    return 'Comprobante no aceptado por SUNAT';
  }
  return 'Otra diferencia';
}

/**
 * IGU_Conciliacion, nodo 4:233 «19 · Conciliación» (CUS47), en el orden del draw.io: subir el
 * reporte de liquidación de Izipay («Importar liquidación»), elegir año y mes («Conciliar»),
 * justificar o excluir cada diferencia y «Cerrar conciliación» cuando no queda ninguna sin
 * justificar. Importar y conciliar piden CONCILIACION:CREAR; justificar y cerrar, CONCILIACION:EDITAR.
 */
@Component({
  selector: 'app-conciliacion',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './conciliacion.html',
})
export class ConciliacionMes {
  private readonly servicio = inject(ConciliacionService);
  private readonly sesion = inject(SesionService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly meses = MESES;
  protected readonly origenDiferencia = origenDiferencia;
  protected readonly puedeCrear = computed(() =>
    this.sesion.tienePermiso(PERMISOS.conciliacionCrear),
  );
  protected readonly puedeEditar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.conciliacionEditar),
  );

  protected readonly archivo = signal<File | null>(null);
  protected readonly resumen = signal<ResumenImportacionDTO | null>(null);
  protected readonly importando = signal(false);
  protected readonly errorImportacion = signal<string | null>(null);

  protected readonly conciliacion = signal<Conciliacion | null>(null);
  protected readonly conciliando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** El ítem que se está justificando y su texto. */
  protected readonly justificando = signal<number | null>(null);
  protected readonly justificacion = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });
  protected readonly guardando = signal(false);

  protected readonly periodo = inject(FormBuilder).nonNullable.group({
    anio: [new Date().getFullYear(), [Validators.required, Validators.min(2026)]],
    mes: [new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]],
  });

  /** Las que no coinciden, agrupadas por origen. */
  protected readonly grupos = computed(() => {
    const grupos = new Map<string, ItemConciliacion[]>();
    for (const item of this.conciliacion()?.items ?? []) {
      if (item.estado === 'COINCIDE') {
        continue;
      }
      const origen = origenDiferencia(item);
      grupos.set(origen, [...(grupos.get(origen) ?? []), item]);
    }
    return [...grupos.entries()].map(([origen, items]) => ({ origen, items }));
  });
  protected readonly coinciden = computed(
    () => (this.conciliacion()?.items ?? []).filter((i) => i.estado === 'COINCIDE').length,
  );
  protected readonly sinJustificar = computed(() => {
    const conciliacion = this.conciliacion();
    return (
      conciliacion?.sinJustificar ??
      (conciliacion?.items ?? []).filter((i) => i.estado === 'SIN_JUSTIFICAR').length
    );
  });
  protected readonly cerrada = computed(() => this.conciliacion()?.estado === 'CERRADA');

  protected elegirArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.archivo.set(entrada.files?.[0] ?? null);
    this.resumen.set(null);
    this.errorImportacion.set(null);
  }

  protected importar(): void {
    const archivo = this.archivo();
    if (!archivo) {
      this.errorImportacion.set('Elige el reporte de liquidación (CSV o Excel).');
      return;
    }
    if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) {
      this.errorImportacion.set('El reporte debe ser CSV o Excel (.csv, .xlsx o .xls).');
      return;
    }
    this.errorImportacion.set(null);
    this.importando.set(true);
    this.servicio.importarLiquidacion(archivo).subscribe({
      next: (resumen) => {
        this.importando.set(false);
        this.resumen.set(resumen);
      },
      error: (error: HttpErrorResponse) => {
        this.importando.set(false);
        if (error.status === 400 || error.status === 422) {
          this.errorImportacion.set(mensajeDelProblema(error, 'No se pudo leer el reporte.'));
        }
      },
    });
  }

  protected conciliar(): void {
    const { anio, mes } = this.periodo.getRawValue();
    if (this.periodo.invalid) {
      this.error.set('Indica un mes válido desde 2026.');
      return;
    }
    this.error.set(null);
    this.conciliando.set(true);
    this.servicio.conciliar(anio, mes).subscribe({
      next: (conciliacion) => {
        this.conciliando.set(false);
        this.conciliacion.set(conciliacion);
      },
      // El 409 (ya existe la de ese mes) también lo avisa el interceptor.
      error: (error: HttpErrorResponse) => {
        this.conciliando.set(false);
        if ([400, 409, 422].includes(error.status)) {
          this.error.set(mensajeDelProblema(error, 'No se pudo conciliar ese mes.'));
        }
      },
    });
  }

  protected abrirJustificacion(item: ItemConciliacion): void {
    this.justificacion.reset(item.justificacion ?? '');
    this.justificando.set(item.idItem ?? null);
  }

  protected guardarJustificacion(item: ItemConciliacion): void {
    const texto = this.justificacion.value.trim();
    if (!texto) {
      this.error.set('Escribe la justificación de la diferencia.');
      return;
    }
    this.marcar(item, { estado: 'JUSTIFICADA', justificacion: texto });
  }

  protected excluir(item: ItemConciliacion): void {
    this.marcar(item, { estado: 'EXCLUIDA' });
  }

  protected cerrar(): void {
    const idConciliacion = this.conciliacion()?.idConciliacion;
    if (idConciliacion === undefined || this.sinJustificar() > 0) {
      return;
    }
    this.guardando.set(true);
    this.servicio.cerrar(idConciliacion).subscribe({
      next: (conciliacion) => {
        this.guardando.set(false);
        this.conciliacion.update((actual) => ({
          ...conciliacion,
          items: conciliacion.items?.length ? conciliacion.items : actual?.items,
        }));
        this.notificaciones.mostrar('Conciliación cerrada: ya no cambia.');
      },
      error: () => this.guardando.set(false),
    });
  }

  protected referencia(item: ItemConciliacion): string {
    return [
      item.idVenta !== undefined ? `Venta ${item.idVenta}` : '',
      item.referenciaSunat ?? '',
      item.idTransaccion !== undefined ? `Transacción ${item.idTransaccion}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  private marcar(
    item: ItemConciliacion,
    cambio: { estado: 'JUSTIFICADA' | 'EXCLUIDA'; justificacion?: string },
  ): void {
    const idConciliacion = this.conciliacion()?.idConciliacion;
    if (idConciliacion === undefined || item.idItem === undefined) {
      return;
    }
    this.error.set(null);
    this.guardando.set(true);
    this.servicio.justificar(idConciliacion, item.idItem, cambio).subscribe({
      next: (conciliacion) => {
        this.guardando.set(false);
        this.justificando.set(null);
        // La respuesta puede traer solo el ítem cambiado: se mezcla con lo que ya se ve.
        this.conciliacion.update((actual) => mezclar(actual, conciliacion));
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        if (error.status === 400 || error.status === 422) {
          this.error.set(mensajeDelProblema(error, 'No se pudo guardar la justificación.'));
        }
      },
    });
  }
}

function mezclar(actual: Conciliacion | null, nueva: Conciliacion): Conciliacion {
  const cambiados = new Map((nueva.items ?? []).map((i) => [i.idItem, i]));
  const items = (actual?.items ?? []).map((i) => cambiados.get(i.idItem) ?? i);
  return { ...actual, ...nueva, items: items.length ? items : nueva.items };
}

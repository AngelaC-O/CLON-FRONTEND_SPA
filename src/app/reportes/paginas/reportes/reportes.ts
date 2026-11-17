import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { nombreO } from '../../../core/api/nombres';
import { mensajeDelProblema } from '../../../core/api/problema';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import {
  FiltroReporte,
  FormatoExportacion,
  ReporteDTO,
  TipoReporte,
} from '../../modelos/reportes.modelos';
import {
  AGRUPACIONES_VENTAS,
  celda,
  columnaDelGrafico,
  fechaIso,
  inicioDeMes,
  nombreDeArchivo,
  REPORTES,
  ROL_ADMINISTRADORA,
} from '../../modelos/reportes.vista';
import { ReportesService } from '../../servicios/reportes.service';

/** El back-end no acepta más de un año de rango (RF68). */
const RANGO_MAXIMO_DIAS = 366;

/**
 * IGU_Reportes, nodo 4:221 «18 · Reportes» (pestaña «Reportes»): CUS48 Generar Reporte Gerencial
 * («Generar») y CUS49 Exportar Reporte («Exportar a Excel» y «Exportar a PDF», con
 * REPORTES:EXPORTAR). Tipo, fechas, agrupación (solo ventas) y sede o «Todas» (RF93). Los reportes
 * con costos o márgenes solo se ofrecen a la administradora (RN24); las ventas anuladas no cuentan
 * (RN33). El «Panel de indicadores» de Figma no tiene operación en el contrato.
 */
@Component({
  selector: 'app-reportes',
  imports: [ReactiveFormsModule],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes {
  private readonly servicio = inject(ReportesService);
  private readonly sesion = inject(SesionService);

  protected readonly celda = celda;
  protected readonly agrupaciones = AGRUPACIONES_VENTAS;
  protected readonly idSedeSesion = this.sesion.sesion()?.idSede ?? null;
  protected readonly nombreSede = nombreO(this.sesion.sesion()?.nombreSede);

  /** Solo se conoce el nombre de la sede de la sesión: no hay GET /sedes (Duda 29). */
  protected nombreSedeDe(idSede: number): string {
    return idSede === this.idSedeSesion ? this.nombreSede : nombreO();
  }
  protected readonly esAdministradora = computed(
    () => (this.sesion.sesion()?.rol ?? '').toUpperCase() === ROL_ADMINISTRADORA,
  );
  protected readonly puedeExportar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.reportesExportar),
  );
  /** RN24: productos y margen muestran costos; solo para la administradora. */
  protected readonly tipos = computed(() =>
    REPORTES.filter((r) => !r.conCostos || this.esAdministradora()),
  );

  protected readonly filtro = inject(FormBuilder).nonNullable.group({
    tipo: ['ventas' as TipoReporte, Validators.required],
    fechaInicio: [inicioDeMes(), Validators.required],
    fechaFin: [fechaIso(), Validators.required],
    agrupacion: ['LINEA'],
    idSede: [this.idSedeSesion as number | null],
  });
  private readonly tipoElegido = toSignal(this.filtro.controls.tipo.valueChanges, {
    initialValue: this.filtro.controls.tipo.value,
  });
  protected readonly conAgrupacion = computed(() => this.tipoElegido() === 'ventas');

  protected readonly reporte = signal<ReporteDTO | null>(null);
  /** El tipo y los filtros con que se generó lo que se ve: se exporta eso mismo. */
  private generado: { tipo: TipoReporte; filtro: FiltroReporte } | null = null;
  protected readonly generando = signal(false);
  protected readonly exportando = signal<FormatoExportacion | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly grafico = computed(() => {
    const reporte = this.reporte();
    const columna = columnaDelGrafico(reporte?.columnas ?? [], reporte?.filas ?? []);
    if (!reporte || !columna?.campo) {
      return null;
    }
    const campo = columna.campo;
    const valores = (reporte.filas ?? []).map((f) => {
      const valor = (f as Record<string, unknown>)[campo];
      return typeof valor === 'number' ? valor : 0;
    });
    const maximo = Math.max(...valores.map(Math.abs), 0);
    return {
      titulo: columna.titulo ?? campo,
      barras: (reporte.filas ?? []).map((fila, i) => ({
        grupo: fila.grupo ?? '',
        texto: celda(fila, campo),
        ancho: maximo > 0 ? Math.round((Math.abs(valores[i]) / maximo) * 100) : 0,
      })),
    };
  });

  constructor() {
    // Otro tipo cambia lo que se puede agrupar y deja de valer lo generado.
    this.filtro.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.error.set(null));
  }

  protected generar(): void {
    const pedido = this.leerFiltro();
    if (typeof pedido === 'string') {
      this.error.set(pedido);
      return;
    }
    this.error.set(null);
    this.generando.set(true);
    this.servicio.generar(pedido.tipo, pedido.filtro).subscribe({
      next: (reporte) => {
        this.generando.set(false);
        this.reporte.set(reporte);
        this.generado = pedido;
      },
      // El 403 de RN24 lo atiende el interceptor; el 422 de fechas o agrupación queda aquí.
      error: (error: HttpErrorResponse) => {
        this.generando.set(false);
        if ([400, 404, 422].includes(error.status)) {
          this.error.set(mensajeDelProblema(error, 'No se pudo generar el reporte.'));
        }
      },
    });
  }

  protected async exportar(formato: FormatoExportacion): Promise<void> {
    const pedido = this.generado;
    if (!pedido) {
      return;
    }
    this.exportando.set(formato);
    try {
      const respuesta = await firstValueFrom(
        this.servicio.exportar(pedido.tipo, pedido.filtro, formato),
      );
      const extension = formato === 'EXCEL' ? 'xlsx' : 'pdf';
      const porDefecto = `reporte_${pedido.tipo}_${pedido.filtro.fechaInicio}_${pedido.filtro.fechaFin}.${extension}`;
      descargar(
        respuesta.body,
        nombreDeArchivo(respuesta.headers.get('Content-Disposition'), porDefecto),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && [400, 404, 422].includes(error.status)) {
        this.error.set('No se pudo exportar el reporte.');
      }
    } finally {
      this.exportando.set(null);
    }
  }

  private leerFiltro(): { tipo: TipoReporte; filtro: FiltroReporte } | string {
    const { tipo, fechaInicio, fechaFin, agrupacion, idSede } = this.filtro.getRawValue();
    if (!fechaInicio || !fechaFin) {
      return 'Indica el rango de fechas.';
    }
    if (fechaInicio > fechaFin) {
      return 'La fecha de inicio es posterior a la de fin.';
    }
    const dias = (Date.parse(fechaFin) - Date.parse(fechaInicio)) / 86_400_000 + 1;
    if (dias > RANGO_MAXIMO_DIAS) {
      return `El rango pasa de ${RANGO_MAXIMO_DIAS} días.`;
    }
    if (!this.tipos().some((t) => t.tipo === tipo)) {
      return 'Elige el tipo de reporte.';
    }
    return {
      tipo,
      filtro: {
        fechaInicio,
        fechaFin,
        ...(tipo === 'ventas' && agrupacion ? { agrupacion } : {}),
        ...(idSede ? { idSede } : {}),
      },
    };
  }
}

/** Guarda el archivo con su nombre, como lo hace el navegador con un enlace de descarga. */
function descargar(contenido: Blob | null, nombre: string): void {
  if (!contenido) {
    return;
  }
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

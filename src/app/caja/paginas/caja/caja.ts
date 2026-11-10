import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ListasService } from '../../../core/api/listas.service';
import { etiquetaMedio } from '../../../core/api/medios';
import { MedioPagoDTO } from '../../../core/api/modelos.generados';
import { redondear, soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { CajaAbiertaService } from '../../../core/sesion/caja-abierta.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { Modal } from '../../../layout/modal/modal';
import {
  CajaDTO,
  ComprobantePendiente,
  EsperadoDTO,
  EsperadoMedioDTO,
} from '../../modelos/caja.modelos';
import { CajaService } from '../../servicios/caja.service';

const MEDIO_EFECTIVO = 'EFECTIVO';

interface FilaArqueo {
  medio: EsperadoMedioDTO;
  efectivo: boolean;
  contado: FormControl<number | null>;
  observacion: FormControl<string>;
}

/**
 * IGU_Caja, nodo 4:89: CUS44 y CUS45. La caja abierta sale de GET /cajas/abierta (Duda 10 de
 * NOTAS_IT1), la misma que muestra la cabecera. La revisión y la reapertura son CUS46.
 */
@Component({
  selector: 'app-caja',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './caja.html',
})
export class Caja implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(CajaService);
  private readonly sesion = inject(SesionService);
  private readonly listas = inject(ListasService);
  private readonly abierta = inject(CajaAbiertaService);
  /** null mientras se consulta o si la sede no tiene caja abierta. */
  protected readonly caja = computed(() => this.abierta.actual() ?? null);
  protected readonly consultando = computed(() => this.abierta.actual() === undefined);
  private readonly medios = signal<MedioPagoDTO[]>([]);

  protected readonly soles = soles;
  protected readonly horaApertura = computed(() => this.caja()?.fechaApertura?.slice(11, 16) ?? '');
  protected readonly idSede = computed(() => this.sesion.sesion()?.idSede);
  protected readonly puedeAbrir = computed(() => this.sesion.tienePermiso(PERMISOS.cajaCrear));
  protected readonly puedeVer = computed(() => this.sesion.tienePermiso(PERMISOS.cajaVer));
  /** Cerrar pide CAJA:EDITAR, y lo esperado que se muestra antes pide CAJA:VER. */
  protected readonly puedeCerrar = computed(
    () => this.puedeVer() && this.sesion.tienePermiso(PERMISOS.cajaEditar),
  );

  protected readonly esperado = signal<EsperadoDTO | null>(null);
  protected readonly cerrada = signal<CajaDTO | null>(null);
  protected readonly filas = signal<FilaArqueo[] | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorCierre = signal<string | null>(null);

  protected readonly apertura = this.fb.control<number | null>(null, [
    Validators.required,
    Validators.min(0),
  ]);
  protected readonly formApertura = this.fb.group({ montoInicial: this.apertura });
  protected readonly egresos = this.fb.array<ReturnType<Caja['nuevoEgreso']>>([]);

  ngOnInit(): void {
    this.listas.mediosPago().subscribe((medios) => this.medios.set(medios));
    this.consultarAbierta();
  }

  protected fechaLarga(): string {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'full' }).format(new Date());
  }

  protected nombreMedio(idMedioPago?: number): string {
    return etiquetaMedio(
      this.medios().find((m) => m.idMedioPago === idMedioPago),
      idMedioPago,
    );
  }

  protected esEfectivo(medio: EsperadoMedioDTO): boolean {
    return medio.medioPago === MEDIO_EFECTIVO;
  }

  protected abrir(): void {
    const montoInicial = this.apertura.value;
    if (montoInicial === null || this.apertura.invalid) {
      this.error.set('Escribe el monto inicial en efectivo.');
      return;
    }
    this.iniciar();
    this.servicio.abrir({ montoInicial }).subscribe({
      next: (caja) => {
        this.enviando.set(false);
        this.abierta.establecer(caja);
        this.cerrada.set(null);
        this.apertura.reset();
        this.notificaciones.mostrar(`Caja abierta con ${soles(montoInicial)}.`);
        if (caja.idCaja && this.puedeVer()) {
          this.cargarEsperado(caja.idCaja);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // El mensaje de la regla ya lo muestra el interceptor. Si otra persona la abrió, se lee.
        if (error.status === 409) {
          this.consultarAbierta();
        }
      },
    });
  }

  /** Vuelve a leer lo esperado: desde que se abrió la pantalla pudo haber más ventas. */
  protected cerrarCaja(): void {
    const idCaja = this.caja()?.idCaja;
    if (!idCaja) {
      return;
    }
    this.iniciar();
    this.servicio.calcularEsperado(idCaja).subscribe({
      next: (esperado) => {
        this.enviando.set(false);
        this.esperado.set(esperado);
        this.egresos.clear();
        this.errorCierre.set(null);
        this.filas.set((esperado.medios ?? []).map((medio) => this.nuevaFila(medio)));
      },
      error: (error: HttpErrorResponse) => this.fallar(error, this.error),
    });
  }

  protected agregarEgreso(): void {
    this.egresos.push(this.nuevoEgreso());
  }

  protected quitarEgreso(indice: number): void {
    this.egresos.removeAt(indice);
  }

  /** Lo que Oracle comparará: los egresos del cierre se restan del efectivo. */
  protected esperadoDe(fila: FilaArqueo): number {
    const esperado = fila.medio.esperado ?? 0;
    return fila.efectivo ? redondear(esperado - this.totalEgresos()) : esperado;
  }

  protected diferenciaDe(fila: FilaArqueo): number | null {
    return fila.contado.value === null
      ? null
      : redondear(fila.contado.value - this.esperadoDe(fila));
  }

  protected conDiferencia(fila: FilaArqueo): boolean {
    return (this.diferenciaDe(fila) ?? 0) !== 0;
  }

  protected claseDiferencia(diferencia: number | null | undefined): string {
    return !diferencia ? '' : diferencia < 0 ? 'bad' : 'warn';
  }

  protected textoDiferencia(diferencia: number | null | undefined): string {
    if (diferencia === null || diferencia === undefined) {
      return '—';
    }
    return `${diferencia > 0 ? '+' : ''}${diferencia.toFixed(2)}`;
  }

  protected pendientes(): ComprobantePendiente[] {
    return this.esperado()?.comprobantesPendientes ?? [];
  }

  protected confirmarCierre(): void {
    const idCaja = this.caja()?.idCaja;
    const filas = this.filas();
    if (!idCaja || !filas) {
      return;
    }
    if (filas.some((fila) => fila.contado.invalid || fila.contado.value === null)) {
      this.errorCierre.set('Escribe lo contado en cada medio.');
      return;
    }
    if (this.egresos.invalid) {
      this.errorCierre.set('Cada egreso lleva concepto y un monto mayor que cero.');
      return;
    }
    if (filas.some((fila) => this.conDiferencia(fila) && !fila.observacion.value.trim())) {
      this.errorCierre.set('Hay diferencia: escribe la observación de ese medio (RN30).');
      return;
    }
    this.errorCierre.set(null);
    this.enviando.set(true);
    this.servicio
      .cerrar(idCaja, {
        arqueos: filas.map((fila) => {
          const observacion = fila.observacion.value.trim();
          return {
            idMedioPago: fila.medio.idMedioPago!,
            montoContado: fila.contado.value!,
            ...(observacion ? { observacion } : {}),
          };
        }),
        ...(this.egresos.length
          ? {
              egresos: this.egresos.getRawValue().map(({ concepto, monto }) => ({
                concepto: concepto.trim(),
                monto: monto!,
              })),
            }
          : {}),
      })
      .subscribe({
        next: (caja) => {
          this.enviando.set(false);
          this.filas.set(null);
          this.esperado.set(null);
          this.abierta.establecer(null);
          this.cerrada.set(caja);
          this.notificaciones.mostrar('Caja cerrada.');
        },
        error: (error: HttpErrorResponse) => this.fallar(error, this.errorCierre),
      });
  }

  private totalEgresos(): number {
    return this.egresos.getRawValue().reduce((suma, egreso) => suma + (egreso.monto ?? 0), 0);
  }

  private nuevaFila(medio: EsperadoMedioDTO): FilaArqueo {
    const efectivo = this.esEfectivo(medio);
    // El efectivo se cuenta a mano; lo digital se toma de lo aprobado en Izipay (RF64).
    const contado = this.fb.control<number | null>(
      efectivo ? null : (medio.aprobadoPasarela ?? 0),
      [Validators.required, Validators.min(0)],
    );
    return {
      medio,
      efectivo,
      contado,
      observacion: this.fb.control('', Validators.maxLength(300)),
    };
  }

  private nuevoEgreso() {
    return this.fb.group({
      concepto: ['', [Validators.required, Validators.pattern(/\S/)]],
      monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    });
  }

  /** GET /cajas/abierta: 200 con la caja de la sede o 204 si no hay. */
  private consultarAbierta(): void {
    this.abierta.cargar().subscribe({
      next: (caja) => {
        if (caja?.idCaja) {
          this.cargarEsperado(caja.idCaja);
        }
      },
      error: () => this.abierta.establecer(null),
    });
  }

  private cargarEsperado(idCaja: number): void {
    this.servicio.calcularEsperado(idCaja).subscribe({
      next: (esperado) => {
        if (esperado.estado === 'CERRADA') {
          this.abierta.establecer(null);
        } else {
          this.esperado.set(esperado);
        }
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.error.set(mensajeDelProblema(error, 'La caja no existe.'));
        }
      },
    });
  }

  private iniciar(): void {
    this.error.set(null);
    this.enviando.set(true);
  }

  /** Los 422 de la regla ya los muestra el interceptor. */
  private fallar(error: HttpErrorResponse, destino: { set(mensaje: string): void }): void {
    this.enviando.set(false);
    if (error.status === 404) {
      destino.set(mensajeDelProblema(error, 'La caja no existe.'));
    }
  }
}

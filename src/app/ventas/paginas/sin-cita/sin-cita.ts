import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientaElegida, SelectorClienta } from '../../../agenda/paginas/agenda/selector-clienta';
import { Router } from '@angular/router';
import { ListasService } from '../../../core/api/listas.service';
import {
  CanalCobro,
  canalPropuesto,
  etiquetaMedio,
  mediosActivos,
} from '../../../core/api/medios';
import { MedioPagoDTO, TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import {
  SelectorVariante,
  VarianteElegida,
} from '../../../layout/selector-variante/selector-variante';
import { HoraLibre, VentaDTO } from '../../modelos/ventas.modelos';
import { VentasService } from '../../servicios/ventas.service';
import { ComprobanteEmitido } from '../comprobante/comprobante-emitido';
import {
  crearFormularioComprador,
  DatosComprador,
  leerComprador,
} from '../comprobante/datos-comprador';

/**
 * IGU_VentaRapida (CUS13): atención, cobro y comprobante en una pantalla y una transacción.
 * RNF29: con los valores propuestos bastan 5 clics; ver el recorrido en sin-cita.spec.ts. Con un
 * pago digital que la pasarela no aprueba al instante, el back-end responde 202 con la venta
 * ABIERTA, y se cierra en IGU_Cobro cuando se apruebe (RN52; Duda 13 de NOTAS_IT1).
 */
@Component({
  selector: 'app-sin-cita',
  imports: [
    ReactiveFormsModule,
    ComprobanteEmitido,
    DatosComprador,
    SelectorClienta,
    SelectorVariante,
  ],
  templateUrl: './sin-cita.html',
})
export class SinCita implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(VentasService);
  private readonly listas = inject(ListasService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly soles = soles;
  protected readonly etiquetaMedio = etiquetaMedio;
  /** GET /medios-pago (CUS62), en lugar de la copia fija (Duda 11 de NOTAS_IT1). */
  protected readonly medios = signal<MedioPagoDTO[]>([]);
  protected readonly activos = computed(() => mediosActivos(this.medios()));
  private readonly tipos = signal<TipoDocumentoDTO[]>([]);
  protected readonly registrada = signal(false);
  protected readonly clienta = signal<ClientaElegida | null>(null);
  /** null: aún no se consulta; vacío: nadie libre ahora. */
  protected readonly libres = signal<HoraLibre[] | null>(null);
  protected readonly venta = signal<VentaDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = this.fb.group({
    nombreClientePaso: [''],
    idVariante: [null as number | null, [Validators.required, Validators.min(1)]],
    idPersonal: [null as number | null, Validators.required],
    idRecurso: [null as number | null, Validators.required],
    tiempoDeclaradoMin: [null as number | null, [Validators.required, Validators.min(1)]],
    monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    idMedioPago: [null as number | null, Validators.required],
    canal: [null as CanalCobro | null],
  });
  protected readonly comprador = crearFormularioComprador(this.fb);

  ngOnInit(): void {
    this.listas.tiposDocumento().subscribe((tipos) => this.tipos.set(tipos));
    this.listas.mediosPago().subscribe((medios) => {
      this.medios.set(medios);
      this.proponerEfectivo();
    });
  }

  protected libre(): HoraLibre | null {
    return this.libres()?.[0] ?? null;
  }

  protected esDigital(): boolean {
    return canalPropuesto(this.medio(this.formulario.controls.idMedioPago.value)) !== null;
  }

  protected elegirClienta(registrada: boolean): void {
    this.registrada.set(registrada);
    this.clienta.set(null);
  }

  protected elegirMedio(id: number | undefined): void {
    this.formulario.patchValue({
      idMedioPago: id ?? null,
      canal: canalPropuesto(this.medio(id)),
    });
  }

  /**
   * Al elegir la variante se consultan los libres y se propone su precio como monto: sin botón,
   * como el draw.io, y un clic menos (RNF29). El back-end igual compara el monto (RN11).
   */
  protected alElegirVariante(elegida: VarianteElegida | null): void {
    if (elegida) {
      this.formulario.controls.monto.setValue(elegida.variante.precio ?? null);
    }
    this.verLibres();
  }

  protected verLibres(): void {
    const { idVariante } = this.formulario.getRawValue();
    this.libres.set(null);
    this.formulario.patchValue({ idPersonal: null, idRecurso: null, tiempoDeclaradoMin: null });
    if (!idVariante || idVariante < 1) {
      return;
    }
    this.error.set(null);
    this.servicio.libresAhora(idVariante).subscribe({
      next: (libres) => {
        this.libres.set(libres);
        this.formulario.patchValue({
          idPersonal: libres[0]?.idsPersonal?.[0] ?? null,
          idRecurso: libres[0]?.idsRecurso?.[0] ?? null,
          tiempoDeclaradoMin: libres[0]?.duracionMin ?? null,
        });
      },
      error: (error: HttpErrorResponse) => this.fallar(error, 'La variante no existe.'),
    });
  }

  protected cobrar(): void {
    const datos = this.formulario.getRawValue();
    const nombre = datos.nombreClientePaso.trim();
    const clienta = this.clienta();
    if (this.registrada() ? !clienta : !nombre) {
      this.error.set(
        this.registrada() ? 'Elige a la clienta.' : 'Escribe el nombre del cliente de paso (RN35).',
      );
      return;
    }
    if (this.formulario.invalid) {
      this.error.set('Indica la variante, la especialista, el recurso, la duración y el monto.');
      return;
    }
    const cierre = leerComprador(this.comprador, this.tipos());
    if (typeof cierre === 'string') {
      this.error.set(cierre);
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .registrarYCobrar({
        ...cierre,
        ...(this.registrada() ? { idCliente: clienta!.idCliente } : { nombreClientePaso: nombre }),
        idVariante: datos.idVariante!,
        idPersonal: datos.idPersonal!,
        idRecurso: datos.idRecurso!,
        tiempoDeclaradoMin: datos.tiempoDeclaradoMin!,
        idMedioPago: datos.idMedioPago!,
        monto: datos.monto!,
        ...(datos.canal ? { canal: datos.canal } : {}),
      })
      .subscribe({
        next: (venta) => {
          this.enviando.set(false);
          if (venta.estado === 'ABIERTA') {
            // 202: el cobro digital espera a la pasarela; la venta se cierra en IGU_Cobro (RN52).
            this.notificaciones.mostrar(
              'El pago digital espera la aprobación de Izipay: la venta quedó abierta en Cobros.',
            );
            void this.router.navigate(['/ventas/cobros'], {
              queryParams: { idVenta: venta.idVenta },
            });
            return;
          }
          this.venta.set(venta);
        },
        error: (error: HttpErrorResponse) => this.fallar(error, 'No se pudo registrar la venta.'),
      });
  }

  protected nueva(): void {
    this.venta.set(null);
    this.libres.set(null);
    this.clienta.set(null);
    this.registrada.set(false);
    this.formulario.reset();
    this.comprador.reset();
    this.proponerEfectivo();
  }

  /** Se propone el efectivo: el primer medio activo que no pasa por la pasarela. */
  private proponerEfectivo(): void {
    const activos = this.activos();
    const efectivo = activos.find((m) => !m.usaPasarela) ?? activos[0];
    this.elegirMedio(efectivo?.idMedioPago);
  }

  private medio(id: number | null | undefined): MedioPagoDTO | undefined {
    return this.medios().find((m) => m.idMedioPago === id);
  }

  /** Los 409 y 422 de la regla ya los muestra el interceptor; no queda atención huérfana. */
  private fallar(error: HttpErrorResponse, porDefecto: string): void {
    this.enviando.set(false);
    if (error.status === 400 || error.status === 404) {
      this.error.set(mensajeDelProblema(error, porDefecto));
    }
  }
}

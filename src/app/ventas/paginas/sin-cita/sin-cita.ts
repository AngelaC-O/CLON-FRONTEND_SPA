import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientaElegida, SelectorClienta } from '../../../agenda/paginas/agenda/selector-clienta';
import { CanalCobro, medioPago, MEDIOS_PAGO } from '../../../core/api/medios-pago';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { HoraLibre, VentaDTO } from '../../modelos/ventas.modelos';
import { VentasService } from '../../servicios/ventas.service';
import { ComprobanteEmitido } from '../comprobante/comprobante-emitido';
import {
  crearFormularioComprador,
  DatosComprador,
  leerComprador,
} from '../comprobante/datos-comprador';

const ID_EFECTIVO = MEDIOS_PAGO[0].id;

/**
 * IGU_VentaRapida (CUS13): atención, cobro y comprobante en una pantalla y una transacción.
 * RNF29: con los valores propuestos bastan 5 clics; ver el recorrido en sin-cita.spec.ts.
 */
@Component({
  selector: 'app-sin-cita',
  imports: [ReactiveFormsModule, ComprobanteEmitido, DatosComprador, SelectorClienta],
  templateUrl: './sin-cita.html',
})
export class SinCita {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(VentasService);

  protected readonly soles = soles;
  protected readonly medios = MEDIOS_PAGO;
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
    idMedioPago: [ID_EFECTIVO],
    canal: [null as CanalCobro | null],
  });
  protected readonly comprador = crearFormularioComprador(this.fb);

  protected libre(): HoraLibre | null {
    return this.libres()?.[0] ?? null;
  }

  protected esDigital(): boolean {
    return !!medioPago(this.formulario.controls.idMedioPago.value)?.canal;
  }

  protected elegirClienta(registrada: boolean): void {
    this.registrada.set(registrada);
    this.clienta.set(null);
  }

  protected elegirMedio(id: number): void {
    this.formulario.patchValue({ idMedioPago: id, canal: medioPago(id)?.canal ?? null });
  }

  /** Sin botón, como el draw.io: la consulta sale al escribir la variante y ahorra un clic. */
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
    const cierre = leerComprador(this.comprador);
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
        idMedioPago: datos.idMedioPago,
        monto: datos.monto!,
        ...(datos.canal ? { canal: datos.canal } : {}),
      })
      .subscribe({
        next: (venta) => {
          this.enviando.set(false);
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
  }

  /** Los 409 y 422 de la regla ya los muestra el interceptor; no queda atención huérfana. */
  private fallar(error: HttpErrorResponse, porDefecto: string): void {
    this.enviando.set(false);
    if (error.status === 400 || error.status === 404) {
      this.error.set(mensajeDelProblema(error, porDefecto));
    }
  }
}

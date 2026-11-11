import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Modal } from '../../../layout/modal/modal';
import { ConsumoPendienteDTO } from '../../modelos/inventario.modelos';
import { fechaHora } from '../../modelos/inventario.vista';
import { KardexService } from '../../servicios/kardex.service';

/**
 * Consumos pendientes de CUS33 (RN53): lo que faltó descontar al finalizar una atención.
 * «Regularizar» registra la salida ligada a la misma atención cuando ya hay stock; «Descartar» pide
 * el motivo (por ejemplo, se usó menos de lo estimado).
 */
@Component({
  selector: 'app-consumos-pendientes',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <div class="card cp0 tw">
      <table class="tbl">
        <thead>
          <tr>
            <th>Insumo</th>
            <th>Atención</th>
            <th class="r">Estimado</th>
            <th class="r">Descontado</th>
            <th class="r">Pendiente</th>
            <th>Registrado</th>
            @if (puedeResolver()) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (consumo of consumos(); track consumo.idConsumo) {
            <tr>
              <td>
                <div class="b">{{ consumo.producto }}</div>
                <div class="xs mut">{{ consumo.codigo }}</div>
              </td>
              <td class="num">N° {{ consumo.idAtencion }}</td>
              <td class="r num">{{ consumo.cantidadEstimada }} {{ consumo.unidad }}</td>
              <td class="r num">{{ consumo.cantidadDescontada }} {{ consumo.unidad }}</td>
              <td class="r num b">{{ consumo.cantidadPendiente }} {{ consumo.unidad }}</td>
              <td class="num">{{ fechaHora(consumo.fechaRegistro) }}</td>
              @if (puedeResolver()) {
                <td class="r">
                  <div class="row nw" style="justify-content: flex-end">
                    <button
                      class="btn sm"
                      type="button"
                      [disabled]="enviando()"
                      (click)="regularizar(consumo)"
                    >
                      Regularizar
                    </button>
                    <button class="btn ghost sm" type="button" (click)="abrirDescarte(consumo)">
                      Descartar
                    </button>
                  </div>
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="vacio" [attr.colspan]="puedeResolver() ? 7 : 6">
                {{ cargando() ? 'Cargando…' : 'No hay consumos pendientes.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (porDescartar(); as consumo) {
      <app-modal
        titulo="Descartar consumo pendiente"
        [angosto]="true"
        (cerrar)="porDescartar.set(null)"
      >
        <form [formGroup]="descarte" (ngSubmit)="descartar()">
          <div class="mb">
            <div class="mut sm">
              {{ consumo.producto }} · {{ consumo.cantidadPendiente }} {{ consumo.unidad }} de la
              atención N° {{ consumo.idAtencion }}. No se descuenta del stock.
            </div>
            @if (error(); as mensaje) {
              <div class="alert bad" role="alert">{{ mensaje }}</div>
            }
            <div class="fld">
              <label class="lbl" for="observacionDescarte">MOTIVO (OBLIGATORIO)</label>
              <input
                class="inp"
                id="observacionDescarte"
                maxlength="200"
                placeholder="Ej. Se usó menos de lo estimado"
                formControlName="observacion"
              />
            </div>
          </div>
          <div class="mf">
            <button class="btn sec" type="button" (click)="porDescartar.set(null)">Volver</button>
            <button class="btn bad" type="submit" [disabled]="enviando()">Descartar</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class ConsumosPendientes implements OnInit {
  private readonly servicio = inject(KardexService);
  private readonly notificaciones = inject(NotificacionesService);

  /** KARDEX:CREAR: regularizar y descartar. */
  readonly puedeResolver = input(false);
  /** Avisa la cantidad, para el contador de la pestaña. */
  readonly cantidad = output<number>();
  /** Una regularización saca stock: la página vuelve a leer los productos. */
  readonly regularizado = output<ConsumoPendienteDTO>();

  protected readonly fechaHora = fechaHora;
  protected readonly consumos = signal<ConsumoPendienteDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly porDescartar = signal<ConsumoPendienteDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly descarte = inject(FormBuilder).nonNullable.group({
    observacion: ['', [Validators.required, Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected abrirDescarte(consumo: ConsumoPendienteDTO): void {
    this.descarte.reset();
    this.error.set(null);
    this.porDescartar.set(consumo);
  }

  protected regularizar(consumo: ConsumoPendienteDTO): void {
    if (consumo.idConsumo === undefined) {
      return;
    }
    this.enviando.set(true);
    this.servicio.regularizar(consumo.idConsumo).subscribe({
      next: (regularizado) => {
        this.enviando.set(false);
        this.quitar(consumo.idConsumo!);
        this.regularizado.emit(regularizado);
        this.notificaciones.mostrar(`Consumo de ${consumo.producto} regularizado.`);
      },
      // El 409 (aún sin stock, RN15, o ya resuelto) lo avisa el interceptor.
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (error.status === 404) {
          this.cargar();
        }
      },
    });
  }

  protected descartar(): void {
    const idConsumo = this.porDescartar()?.idConsumo;
    const observacion = this.descarte.getRawValue().observacion.trim();
    if (idConsumo === undefined || !observacion) {
      this.error.set('Escribe el motivo del descarte.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio.descartar(idConsumo, observacion).subscribe({
      next: () => {
        this.enviando.set(false);
        this.porDescartar.set(null);
        this.quitar(idConsumo);
        this.notificaciones.mostrar('Consumo pendiente descartado.');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (error.status === 409 || error.status === 404) {
          this.porDescartar.set(null);
          this.cargar();
        } else if (error.status === 422 || error.status === 400) {
          this.error.set(mensajeDelProblema(error, 'Falta el motivo.'));
        }
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.listarConsumosPendientes().subscribe({
      next: (consumos) => {
        this.consumos.set(consumos);
        this.cargando.set(false);
        this.cantidad.emit(consumos.length);
      },
      error: () => this.cargando.set(false),
    });
  }

  private quitar(idConsumo: number): void {
    this.consumos.update((lista) => lista.filter((c) => c.idConsumo !== idConsumo));
    this.cantidad.emit(this.consumos().length);
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { etiquetaMedio } from '../../../core/api/medios';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { MedioPagoDTO } from '../../modelos/pagos.modelos';
import { PagosService } from '../../servicios/pagos.service';

type FormMedio = FormGroup<{ activo: FormControl<boolean>; usaPasarela: FormControl<boolean> }>;

/** El efectivo no se cobra por la pasarela (RN42, CK_MEDIO_PAGO_EFECTIVO). */
export function esEfectivo(medio: MedioPagoDTO): boolean {
  return (medio.nombre ?? '').toUpperCase() === 'EFECTIVO';
}

/**
 * IGU_MediosPago (CUS62 Configurar Medio de Pago), como pestaña de «Catálogo y configuración»:
 * estado y uso de la pasarela de cada medio, con «Guardar medio de pago». Cambiar pide
 * CATALOGO:EDITAR. Las demás pantallas ven el cambio al recargar la aplicación (ListasService).
 */
@Component({
  selector: 'app-medios-pago',
  imports: [ReactiveFormsModule],
  template: `
    @if (error(); as mensaje) {
      <div class="alert bad" role="alert">{{ mensaje }}</div>
    }
    <div class="card cp0 tw" style="max-width: 760px">
      <table class="tbl" id="tablaMedios">
        <thead>
          <tr>
            <th>Medio</th>
            <th>Activo</th>
            <th>Cobra por Izipay</th>
            @if (puedeEditar()) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (medio of medios(); track medio.idMedioPago) {
            <tr [formGroup]="formMedio(medio)">
              <td class="b">{{ etiquetaMedio(medio) }}</td>
              <td>
                <input
                  type="checkbox"
                  [attr.aria-label]="etiquetaMedio(medio) + ' activo'"
                  formControlName="activo"
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  [attr.aria-label]="etiquetaMedio(medio) + ' por la pasarela'"
                  formControlName="usaPasarela"
                />
                @if (esEfectivo(medio)) {
                  <span class="xs mut">Se cobra en caja (RN42)</span>
                }
              </td>
              @if (puedeEditar()) {
                <td class="r">
                  <button
                    class="btn sm"
                    type="button"
                    [disabled]="enviando()"
                    (click)="guardar(medio)"
                  >
                    Guardar medio de pago
                  </button>
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="vacio" colspan="4">No hay medios de pago.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class MediosPago implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(PagosService);
  private readonly sesion = inject(SesionService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly etiquetaMedio = etiquetaMedio;
  protected readonly esEfectivo = esEfectivo;
  protected readonly puedeEditar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.catalogoEditar),
  );
  protected readonly medios = signal<MedioPagoDTO[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly formularios = new Map<number, FormMedio>();

  ngOnInit(): void {
    this.servicio.listarMedios().subscribe((medios) => this.medios.set(medios));
  }

  protected formMedio(medio: MedioPagoDTO): FormMedio {
    const id = medio.idMedioPago ?? 0;
    let form = this.formularios.get(id);
    if (!form) {
      form = this.fb.group({
        activo: [medio.estado !== 'INACTIVO'],
        usaPasarela: [medio.usaPasarela ?? false],
      });
      if (esEfectivo(medio)) {
        form.controls.usaPasarela.disable();
      }
      if (!this.puedeEditar()) {
        form.disable();
      }
      this.formularios.set(id, form);
    }
    return form;
  }

  protected guardar(medio: MedioPagoDTO): void {
    const id = medio.idMedioPago;
    if (id === undefined) {
      return;
    }
    const { activo, usaPasarela } = this.formMedio(medio).getRawValue();
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .configurarMedio(id, {
        estado: activo ? 'ACTIVO' : 'INACTIVO',
        usaPasarela: esEfectivo(medio) ? false : usaPasarela,
      })
      .subscribe({
        next: (cambiado) => {
          this.enviando.set(false);
          this.medios.update((lista) =>
            lista.map((m) => (m.idMedioPago === id ? { ...m, ...cambiado } : m)),
          );
          this.notificaciones.mostrar(`${etiquetaMedio(medio)} guardado.`);
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          if ([400, 404, 422].includes(error.status)) {
            this.error.set(mensajeDelProblema(error, 'No se pudo guardar el medio de pago.'));
          }
        },
      });
  }
}

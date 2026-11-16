import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { nombreO } from '../../../core/api/nombres';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { PromocionDTO, ServicioDTO } from '../../modelos/catalogo.modelos';
import { CatalogoService } from '../../servicios/catalogo.service';
import { SelectorServicios } from './selector-servicios';

type TipoDescuento = PromocionDTO['tipoDescuento'];

/** 2026-11-01 → 01/11/2026. */
function fecha(valor?: string): string {
  if (!valor) {
    return '';
  }
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * CUS60 Registrar Promoción («Guardar promoción»): descuento en porcentaje (hasta 100) o en monto,
 * con su vigencia y sus servicios. Cobros y proforma solo ofrecen las vigentes.
 */
@Component({
  selector: 'app-promociones',
  imports: [ReactiveFormsModule, SelectorServicios],
  template: `
    <div class="card cp0 tw">
      <table class="tbl" id="tablaPromociones">
        <thead>
          <tr>
            <th>Promoción</th>
            <th class="r">Descuento</th>
            <th>Vigencia</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (promocion of promociones(); track promocion.idPromocion) {
            <tr>
              <td>
                <div class="b">{{ promocion.nombre }}</div>
                <div class="xs mut">{{ nombresServicios(promocion) }}</div>
              </td>
              <td class="r num">{{ descuento(promocion) }}</td>
              <td class="num">
                {{ fecha(promocion.fechaInicio) }} a {{ fecha(promocion.fechaFin) }}
              </td>
              <td>
                <span class="chip" [class.ok]="promocion.estado === 'ACTIVA'">
                  {{ promocion.estado === 'ACTIVA' ? 'Activa' : 'Inactiva' }}
                </span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td class="vacio" colspan="4">Aún no hay promociones.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (puedeCrear()) {
      <form
        class="card col"
        style="max-width: 760px"
        [formGroup]="formulario"
        (ngSubmit)="guardar()"
      >
        <h2 class="h3">Nueva promoción</h2>
        @if (error(); as mensaje) {
          <div class="alert bad" role="alert">{{ mensaje }}</div>
        }
        <div class="g2">
          <div class="fld">
            <label class="lbl" for="promocionNombre">NOMBRE</label>
            <input class="inp" id="promocionNombre" maxlength="80" formControlName="nombre" />
          </div>
          <div class="fld">
            <span class="lbl">TIPO DE DESCUENTO</span>
            <div class="seg" role="group" aria-label="Tipo de descuento">
              @for (opcion of tipos; track opcion.valor) {
                <button
                  type="button"
                  [class.on]="formulario.controls.tipoDescuento.value === opcion.valor"
                  [attr.aria-pressed]="formulario.controls.tipoDescuento.value === opcion.valor"
                  (click)="formulario.controls.tipoDescuento.setValue(opcion.valor)"
                >
                  {{ opcion.texto }}
                </button>
              }
            </div>
          </div>
          <div class="fld">
            <label class="lbl" for="promocionValor">
              {{
                formulario.controls.tipoDescuento.value === 'PORCENTAJE'
                  ? 'DESCUENTO (%)'
                  : 'DESCUENTO (S/)'
              }}
            </label>
            <input
              class="inp"
              id="promocionValor"
              type="number"
              min="0"
              step="0.01"
              formControlName="valor"
            />
          </div>
          <div class="fld">
            <label class="lbl" for="promocionInicio">DESDE</label>
            <input class="inp" id="promocionInicio" type="date" formControlName="fechaInicio" />
          </div>
          <div class="fld">
            <label class="lbl" for="promocionFin">HASTA</label>
            <input class="inp" id="promocionFin" type="date" formControlName="fechaFin" />
          </div>
        </div>
        <app-selector-servicios [servicios]="servicios()" [control]="idsServicio" />
        <button class="btn" type="submit" style="align-self: flex-start" [disabled]="enviando()">
          Guardar promoción
        </button>
      </form>
    }
  `,
})
export class Promociones implements OnInit {
  private readonly servicio = inject(CatalogoService);
  private readonly sesion = inject(SesionService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly servicios = input<ServicioDTO[]>([]);

  protected readonly fecha = fecha;
  protected readonly tipos: { valor: TipoDescuento; texto: string }[] = [
    { valor: 'PORCENTAJE', texto: 'Porcentaje' },
    { valor: 'MONTO', texto: 'Monto fijo' },
  ];
  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.catalogoCrear));
  protected readonly promociones = signal<PromocionDTO[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly idsServicio = new FormControl<number[]>([], { nonNullable: true });
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    tipoDescuento: ['PORCENTAJE' as TipoDescuento],
    valor: [null as number | null, Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
  });

  ngOnInit(): void {
    this.servicio.listarPromociones().subscribe((promociones) => this.promociones.set(promociones));
  }

  protected descuento(promocion: PromocionDTO): string {
    return promocion.tipoDescuento === 'PORCENTAJE'
      ? `${promocion.valor} %`
      : soles(promocion.valor);
  }

  /** Los servicios que trae la respuesta (It. 2.1); si no, los de la lista, o «—». */
  protected nombresServicios(promocion: PromocionDTO): string {
    if (promocion.servicios?.length) {
      return promocion.servicios.map((s) => nombreO(s.nombre)).join(', ');
    }
    return (promocion.idsServicio ?? [])
      .map((id) => nombreO(this.servicios().find((s) => s.idServicio === id)?.nombre))
      .join(', ');
  }

  protected guardar(): void {
    const valor = this.formulario.getRawValue();
    const mensaje = validarPromocion(valor);
    if (mensaje) {
      this.error.set(mensaje);
      return;
    }
    if (this.idsServicio.value.length === 0) {
      this.error.set('Elige al menos un servicio.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .registrarPromocion({
        nombre: valor.nombre.trim(),
        tipoDescuento: valor.tipoDescuento,
        valor: valor.valor!,
        fechaInicio: valor.fechaInicio,
        fechaFin: valor.fechaFin,
        idsServicio: this.idsServicio.value,
      })
      .subscribe({
        next: (promocion) => {
          this.enviando.set(false);
          this.formulario.reset();
          this.idsServicio.setValue([]);
          this.promociones.update((lista) => [promocion, ...lista]);
          this.notificaciones.mostrar(`${promocion.nombre} registrada.`);
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          if (error.status === 400 || error.status === 422) {
            this.error.set(mensajeDelProblema(error, 'Revisa los datos de la promoción.'));
          }
        },
      });
  }
}

/** Lo que el back-end rechazaría con 422 (RF84). */
function validarPromocion(valor: {
  nombre: string;
  tipoDescuento: TipoDescuento;
  valor: number | null;
  fechaInicio: string;
  fechaFin: string;
}): string | null {
  if (!valor.nombre.trim() || !valor.fechaInicio || !valor.fechaFin || valor.valor === null) {
    return 'Completa el nombre, el descuento y la vigencia.';
  }
  if (valor.valor <= 0 || (valor.tipoDescuento === 'PORCENTAJE' && valor.valor > 100)) {
    return 'El descuento es mayor que 0, y hasta 100 si es porcentaje (RF84).';
  }
  if (valor.fechaFin < valor.fechaInicio) {
    return 'La vigencia termina el mismo día o después de empezar (RF84).';
  }
  return null;
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { SerieDTO } from '../../modelos/ventas.modelos';
import { SeriesService } from '../../servicios/series.service';

type TipoSerie = SerieDTO['tipo'];

const TIPOS: { tipo: TipoSerie; texto: string; letra: 'B' | 'F' }[] = [
  { tipo: 'BOLETA', texto: 'Boleta', letra: 'B' },
  { tipo: 'FACTURA', texto: 'Factura', letra: 'F' },
  { tipo: 'NC_BOLETA', texto: 'Nota de crédito de boleta', letra: 'B' },
  { tipo: 'NC_FACTURA', texto: 'Nota de crédito de factura', letra: 'F' },
];

/** La serie tiene 4 caracteres y empieza con B o F según el tipo (RF107). */
export function serieValida(tipo: TipoSerie, serie: string): boolean {
  const letra = TIPOS.find((t) => t.tipo === tipo)?.letra ?? 'B';
  return new RegExp(`^${letra}[A-Z0-9]{3}$`).test(serie);
}

/**
 * IGU_SeriesComprobante (CUS63 Configurar Serie de Comprobante), como pestaña de «Catálogo y
 * configuración»: las series de la sede con su último número, que lleva Oracle (RN47), y «Guardar
 * serie». Registrar pide CATALOGO:CREAR. Una sede tiene una sola serie ACTIVA por tipo.
 */
@Component({
  selector: 'app-series-comprobante',
  imports: [ReactiveFormsModule],
  template: `
    <div class="card cp0 tw" style="max-width: 760px">
      <table class="tbl" id="tablaSeries">
        <thead>
          <tr>
            <th>Serie</th>
            <th>Tipo</th>
            <th class="r">Último número</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (serie of series(); track serie.idSerie) {
            <tr>
              <td class="b num">{{ serie.serie }}</td>
              <td>{{ textoTipo(serie.tipo) }}</td>
              <td class="r num">{{ serie.ultimoNumero }}</td>
              <td>
                <span class="chip" [class.ok]="serie.estado === 'ACTIVA'">
                  {{ serie.estado === 'ACTIVA' ? 'Activa' : 'Inactiva' }}
                </span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td class="vacio" colspan="4">La sede no tiene series.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (puedeCrear()) {
      <form
        class="card row"
        style="align-items: flex-end; max-width: 760px"
        [formGroup]="formulario"
        (ngSubmit)="guardar()"
      >
        <div class="fld sp">
          <label class="lbl" for="serieTipo">TIPO DE COMPROBANTE</label>
          <select class="inp" id="serieTipo" formControlName="tipo">
            @for (opcion of tipos; track opcion.tipo) {
              <option [value]="opcion.tipo">{{ opcion.texto }}</option>
            }
          </select>
        </div>
        <div class="fld">
          <label class="lbl" for="serieCodigo">SERIE</label>
          <input
            class="inp"
            id="serieCodigo"
            maxlength="4"
            placeholder="Ej. B002"
            style="text-transform: uppercase"
            formControlName="serie"
          />
        </div>
        <button class="btn" type="submit" [disabled]="enviando()">Guardar serie</button>
      </form>
      @if (error(); as mensaje) {
        <div class="alert bad" role="alert">{{ mensaje }}</div>
      }
      <div class="xs mut">
        La serie tiene 4 caracteres: empieza con B para boletas y sus notas, y con F para facturas y
        sus notas. Nace con el correlativo en 0.
      </div>
    }
  `,
})
export class SeriesComprobante implements OnInit {
  private readonly servicio = inject(SeriesService);
  private readonly sesion = inject(SesionService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly tipos = TIPOS;
  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.catalogoCrear));
  protected readonly series = signal<SerieDTO[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    tipo: ['BOLETA' as TipoSerie, Validators.required],
    serie: ['', [Validators.required, Validators.maxLength(4)]],
  });

  ngOnInit(): void {
    this.servicio.listar().subscribe((series) => this.series.set(series));
  }

  protected textoTipo(tipo: TipoSerie): string {
    return TIPOS.find((t) => t.tipo === tipo)?.texto ?? tipo;
  }

  protected guardar(): void {
    const { tipo } = this.formulario.getRawValue();
    const serie = this.formulario.getRawValue().serie.trim().toUpperCase();
    if (!serieValida(tipo, serie)) {
      const letra = TIPOS.find((t) => t.tipo === tipo)?.letra;
      this.error.set(`La serie tiene 4 caracteres y empieza con ${letra} (RF107).`);
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    const idSede = this.sesion.sesion()?.idSede;
    this.servicio.registrar({ tipo, serie, ...(idSede ? { idSede } : {}) }).subscribe({
      next: (registrada) => {
        this.enviando.set(false);
        this.formulario.reset();
        this.series.update((lista) => [...lista, registrada]);
        this.notificaciones.mostrar(`Serie ${registrada.serie} registrada.`);
      },
      // El 409 (ya hay una ACTIVA de ese tipo o la serie existe) también lo avisa el interceptor.
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if ([400, 409, 422].includes(error.status)) {
          this.error.set(mensajeDelProblema(error, 'No se pudo registrar la serie.'));
        }
      },
    });
  }
}

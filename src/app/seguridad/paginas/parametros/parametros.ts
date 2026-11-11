import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { ParametroDTO, TipoDocumentoDTO } from '../../modelos/seguridad.modelos';
import { ParametrosService } from '../../servicios/parametros.service';

/** Topes de los parámetros que el back-end valida (RN03, RN51). */
export const LIMPIEZA_MAX_TOPE = 10;
/** Solo el DNI y el RUC se consultan en APISPERU (RN45). */
const CONSULTABLES = ['DNI', 'RUC'];

type FormParametro = FormGroup<{
  valor: FormControl<string>;
  fechaVigencia: FormControl<string>;
}>;
type FormTipo = FormGroup<{
  activo: FormControl<boolean>;
  consultaApi: FormControl<boolean>;
}>;

function hoyIso(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/**
 * IGU_Parametros (CUS65 Configurar Parámetro del Negocio), como pestaña de «Catálogo y
 * configuración»: los parámetros con «Guardar parámetro» y los tipos de documento con «Guardar tipo
 * de documento». Leer pide SEGURIDAD:VER; cambiar, SEGURIDAD:EDITAR. Los códigos no se crean.
 */
@Component({
  selector: 'app-parametros',
  imports: [ReactiveFormsModule],
  template: `
    @if (error(); as mensaje) {
      <div class="alert bad" role="alert">{{ mensaje }}</div>
    }
    <div class="card cp0 tw">
      <table class="tbl" id="tablaParametros">
        <thead>
          <tr>
            <th>Parámetro</th>
            <th>Valor</th>
            <th>Vigente desde</th>
            @if (puedeEditar()) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (parametro of parametros(); track parametro.codigo) {
            <tr [formGroup]="formParametro(parametro)">
              <td>
                <div class="b num">{{ parametro.codigo }}</div>
                <div class="xs mut">{{ parametro.descripcion }}</div>
              </td>
              <td>
                @if (puedeEditar()) {
                  <input
                    class="inp"
                    style="max-width: 160px"
                    [type]="esNumero(parametro) ? 'number' : 'text'"
                    [attr.min]="esNumero(parametro) ? 0 : null"
                    [attr.max]="parametro.codigo === 'LIMPIEZA_MAX_MIN' ? topeLimpieza : null"
                    [attr.aria-label]="'Valor de ' + parametro.codigo"
                    formControlName="valor"
                  />
                } @else {
                  <span class="num">{{ parametro.valorNumero ?? parametro.valorTexto }}</span>
                }
              </td>
              <td>
                @if (puedeEditar()) {
                  <input
                    class="inp"
                    type="date"
                    [attr.aria-label]="'Vigencia de ' + parametro.codigo"
                    formControlName="fechaVigencia"
                  />
                } @else {
                  <span class="num">{{ parametro.fechaVigencia }}</span>
                }
              </td>
              @if (puedeEditar()) {
                <td class="r">
                  <button
                    class="btn sm"
                    type="button"
                    [disabled]="enviando()"
                    (click)="guardarParametro(parametro)"
                  >
                    Guardar parámetro
                  </button>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>

    <h2 class="h3">Tipos de documento</h2>
    <div class="card cp0 tw">
      <table class="tbl" id="tablaTipos">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Formato</th>
            <th>Activo</th>
            <th>Consulta APISPERU</th>
            @if (puedeEditar()) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (tipo of tipos(); track tipo.idTipoDocumento) {
            <tr [formGroup]="formTipo(tipo)">
              <td>
                <div class="b">{{ tipo.abreviatura }}</div>
                <div class="xs mut">{{ tipo.nombre }} · SUNAT {{ tipo.codigoSunat }}</div>
              </td>
              <td class="sm">
                {{
                  tipo.longitudMin === tipo.longitudMax
                    ? tipo.longitudMin
                    : tipo.longitudMin + ' a ' + tipo.longitudMax
                }}
                caracteres{{ tipo.soloNumeros ? ', solo números' : '' }}
              </td>
              <td>
                <input
                  type="checkbox"
                  [attr.aria-label]="tipo.abreviatura + ' activo'"
                  formControlName="activo"
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  [attr.aria-label]="'Consultar ' + tipo.abreviatura + ' en APISPERU'"
                  formControlName="consultaApi"
                />
              </td>
              @if (puedeEditar()) {
                <td class="r">
                  <button
                    class="btn sm"
                    type="button"
                    [disabled]="enviando()"
                    (click)="guardarTipo(tipo)"
                  >
                    Guardar tipo de documento
                  </button>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
    <div class="xs mut">Solo el DNI y el RUC se consultan en APISPERU (RN45).</div>
  `,
})
export class Parametros implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(ParametrosService);
  private readonly sesion = inject(SesionService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly topeLimpieza = LIMPIEZA_MAX_TOPE;
  protected readonly puedeEditar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.seguridadEditar),
  );
  protected readonly parametros = signal<ParametroDTO[]>([]);
  protected readonly tipos = signal<TipoDocumentoDTO[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly formsParametro = new Map<string, FormParametro>();
  private readonly formsTipo = new Map<number, FormTipo>();

  ngOnInit(): void {
    this.servicio.listar().subscribe((parametros) => this.parametros.set(parametros));
    this.servicio.listarTiposDocumento().subscribe((tipos) => this.tipos.set(tipos));
  }

  protected esNumero(parametro: ParametroDTO): boolean {
    return parametro.valorTexto === undefined || parametro.valorTexto === null;
  }

  protected formParametro(parametro: ParametroDTO): FormParametro {
    const codigo = parametro.codigo ?? '';
    let form = this.formsParametro.get(codigo);
    if (!form) {
      form = this.fb.group({
        valor: [String(parametro.valorNumero ?? parametro.valorTexto ?? '')],
        fechaVigencia: [hoyIso()],
      });
      this.formsParametro.set(codigo, form);
    }
    return form;
  }

  protected formTipo(tipo: TipoDocumentoDTO): FormTipo {
    const id = tipo.idTipoDocumento ?? 0;
    let form = this.formsTipo.get(id);
    if (!form) {
      form = this.fb.group({
        activo: [tipo.estado !== 'INACTIVO'],
        consultaApi: [tipo.consultaApi ?? false],
      });
      if (!CONSULTABLES.includes((tipo.abreviatura ?? '').toUpperCase())) {
        form.controls.consultaApi.disable();
      }
      if (!this.puedeEditar()) {
        form.disable();
      }
      this.formsTipo.set(id, form);
    }
    return form;
  }

  protected guardarParametro(parametro: ParametroDTO): void {
    const codigo = parametro.codigo;
    const { valor, fechaVigencia } = this.formParametro(parametro).getRawValue();
    if (!codigo) {
      return;
    }
    const mensaje = validarParametro(codigo, valor, this.esNumero(parametro));
    if (mensaje) {
      this.error.set(mensaje);
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    const cambio = this.esNumero(parametro)
      ? { valorNumero: Number(valor), ...(fechaVigencia ? { fechaVigencia } : {}) }
      : { valorTexto: valor.trim(), ...(fechaVigencia ? { fechaVigencia } : {}) };
    this.servicio.cambiarValor(codigo, cambio).subscribe({
      next: (cambiado) => {
        this.enviando.set(false);
        this.parametros.update((lista) =>
          lista.map((p) => (p.codigo === codigo ? { ...p, ...cambiado } : p)),
        );
        this.notificaciones.mostrar(`${codigo} guardado.`);
      },
      error: (error: HttpErrorResponse) => this.fallar(error, 'No se pudo guardar el parámetro.'),
    });
  }

  protected guardarTipo(tipo: TipoDocumentoDTO): void {
    const id = tipo.idTipoDocumento;
    if (id === undefined) {
      return;
    }
    const { activo, consultaApi } = this.formTipo(tipo).getRawValue();
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .configurarTipoDocumento(id, { estado: activo ? 'ACTIVO' : 'INACTIVO', consultaApi })
      .subscribe({
        next: (cambiado) => {
          this.enviando.set(false);
          this.tipos.update((lista) =>
            lista.map((t) => (t.idTipoDocumento === id ? { ...t, ...cambiado } : t)),
          );
          this.notificaciones.mostrar(`${tipo.abreviatura} guardado.`);
        },
        error: (error: HttpErrorResponse) =>
          this.fallar(error, 'No se pudo guardar el tipo de documento.'),
      });
  }

  private fallar(error: HttpErrorResponse, porDefecto: string): void {
    this.enviando.set(false);
    if ([400, 404, 422].includes(error.status)) {
      this.error.set(mensajeDelProblema(error, porDefecto));
    }
  }
}

/** Lo que el back-end rechazaría con 422: se avisa antes de enviar. */
export function validarParametro(codigo: string, valor: string, numerico: boolean): string | null {
  if (!valor.trim()) {
    return `Falta el valor de ${codigo}.`;
  }
  if (!numerico) {
    return null;
  }
  const numero = Number(valor);
  if (Number.isNaN(numero)) {
    return `El valor de ${codigo} es un número.`;
  }
  if (
    codigo === 'LIMPIEZA_MAX_MIN' &&
    (!Number.isInteger(numero) || numero < 0 || numero > LIMPIEZA_MAX_TOPE)
  ) {
    return `LIMPIEZA_MAX_MIN es un entero de 0 a ${LIMPIEZA_MAX_TOPE} minutos (RN03).`;
  }
  if (codigo === 'AGENDA_PASO_MIN' && (!Number.isInteger(numero) || numero <= 0)) {
    return 'AGENDA_PASO_MIN es un entero mayor que 0 (RN51).';
  }
  return null;
}

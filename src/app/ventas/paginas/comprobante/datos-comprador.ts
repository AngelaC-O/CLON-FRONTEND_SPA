import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ListasService } from '../../../core/api/listas.service';
import { TipoDocumentoDTO } from '../../../core/api/modelos.generados';
import { numeroDocumentoValido, tiposActivos } from '../../../core/api/documentos';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { CierreVentaDTO } from '../../modelos/ventas.modelos';
import { VentasService } from '../../servicios/ventas.service';

type TipoComprobante = 'BOLETA' | 'FACTURA';

/** Referencia para avisar (RN08); quien decide es UMBRAL_BOLETA_DOC en el back-end. */
const UMBRAL_BOLETA = 700;

export function crearFormularioComprador(fb: NonNullableFormBuilder) {
  return fb.group({
    tipo: ['BOLETA' as TipoComprobante],
    idTipoDocComprador: [null as number | null],
    nroDocComprador: [''],
    nombreComprador: [''],
  });
}

export type FormularioComprador = ReturnType<typeof crearFormularioComprador>;

/**
 * Valida lo que se puede validar aquí y arma los datos del cierre, o dice qué falta. Los tipos de
 * documento son los de GET /tipos-documento (Duda 5 de NOTAS_IT1).
 */
export function leerComprador(
  formulario: FormularioComprador,
  tipos: TipoDocumentoDTO[],
): CierreVentaDTO | string {
  const { tipo, idTipoDocComprador } = formulario.getRawValue();
  const numero = formulario.controls.nroDocComprador.value.trim();
  const nombre = formulario.controls.nombreComprador.value.trim();
  if (tipo === 'FACTURA' && (!numero || !nombre)) {
    return 'La factura lleva el RUC y la razón social del comprador (RN08).';
  }
  const documento = tipos.find((t) => t.idTipoDocumento === idTipoDocComprador);
  if (numero && (!documento || !numeroDocumentoValido(documento, numero))) {
    return documento
      ? `El número no cumple el formato de ${documento.abreviatura}.`
      : 'Elige el tipo de documento del comprador.';
  }
  if (numero && !nombre) {
    return 'Escribe el nombre del comprador.';
  }
  return {
    tipo,
    ...(numero ? { idTipoDocComprador: documento?.idTipoDocumento, nroDocComprador: numero } : {}),
    ...(nombre ? { nombreComprador: nombre } : {}),
  };
}

/** Comprobante y comprador de CUS19, con la consulta de RUC. Boleta por defecto. */
@Component({
  selector: 'app-datos-comprador',
  imports: [ReactiveFormsModule],
  template: `
    <div class="col" [formGroup]="formulario()">
      <div class="seg" role="group" aria-label="Tipo de comprobante">
        <button type="button" [class.on]="esBoleta()" (click)="elegirTipo('BOLETA')">Boleta</button>
        <button type="button" [class.on]="!esBoleta()" (click)="elegirTipo('FACTURA')">
          Factura
        </button>
      </div>

      @if (esBoleta()) {
        <div class="g2">
          <div class="fld">
            <label class="lbl" for="compradorTipoDoc">TIPO DE DOCUMENTO</label>
            <select class="inp" id="compradorTipoDoc" formControlName="idTipoDocComprador">
              <option [ngValue]="null">Sin documento</option>
              @for (tipo of ofrecidos(); track tipo.idTipoDocumento) {
                <option [ngValue]="tipo.idTipoDocumento">{{ tipo.abreviatura }}</option>
              }
            </select>
          </div>
          <div class="fld">
            <label class="lbl" for="compradorNumero">NÚMERO</label>
            <input class="inp" id="compradorNumero" formControlName="nroDocComprador" />
          </div>
        </div>
        @if (importe() > umbral) {
          <div class="alert warn">
            El total supera S/ {{ umbral }}: la boleta lleva el nombre y el documento del comprador
            (RN08).
          </div>
        }
      } @else {
        <div class="row nw" style="align-items: flex-end; gap: 8px">
          <div class="fld sp">
            <label class="lbl" for="compradorRuc">RUC (11 DÍGITOS)</label>
            <input
              class="inp"
              id="compradorRuc"
              inputmode="numeric"
              maxlength="11"
              formControlName="nroDocComprador"
            />
          </div>
          @if (puedeConsultar()) {
            <button class="btn sec" type="button" style="min-height: 44px" (click)="consultar()">
              Consultar RUC
            </button>
          }
        </div>
      }

      <div class="fld">
        <label class="lbl" for="compradorNombre">
          {{ esBoleta() ? 'NOMBRE DEL COMPRADOR' : 'RAZÓN SOCIAL' }}
        </label>
        <input class="inp" id="compradorNombre" formControlName="nombreComprador" />
      </div>

      @if (mensaje(); as aviso) {
        <div class="alert" [class]="aviso.clase" role="status">{{ aviso.texto }}</div>
      }
    </div>
  `,
})
export class DatosComprador implements OnInit {
  private readonly servicio = inject(VentasService);
  private readonly sesion = inject(SesionService);
  private readonly listas = inject(ListasService);

  readonly formulario = input.required<FormularioComprador>();
  /** Subtotal más IGV, la cifra que compara el back-end con el umbral. */
  readonly importe = input(0);

  protected readonly tipos = signal<TipoDocumentoDTO[]>([]);
  protected readonly ofrecidos = computed(() => tiposActivos(this.tipos()));
  protected readonly umbral = UMBRAL_BOLETA;
  protected readonly puedeConsultar = computed(() => this.sesion.tienePermiso(PERMISOS.ventasVer));
  protected readonly mensaje = signal<{ texto: string; clase: string } | null>(null);

  ngOnInit(): void {
    this.listas.tiposDocumento().subscribe((tipos) => this.tipos.set(tipos));
  }

  protected esBoleta(): boolean {
    return this.formulario().controls.tipo.value === 'BOLETA';
  }

  protected elegirTipo(tipo: TipoComprobante): void {
    this.formulario().reset({
      tipo,
      idTipoDocComprador:
        tipo === 'FACTURA'
          ? (this.tipos().find((t) => t.abreviatura === 'RUC')?.idTipoDocumento ?? null)
          : null,
      nroDocComprador: '',
      nombreComprador: '',
    });
    this.mensaje.set(null);
  }

  protected consultar(): void {
    const { nroDocComprador, nombreComprador } = this.formulario().controls;
    const ruc = nroDocComprador.value.trim();
    if (!/^\d{11}$/.test(ruc)) {
      this.mensaje.set({ texto: 'El RUC tiene 11 dígitos.', clase: 'bad' });
      return;
    }
    this.mensaje.set(null);
    this.servicio.consultarRuc(ruc).subscribe((consulta) => {
      if (consulta.resultado === 'ENCONTRADO') {
        nombreComprador.setValue(
          consulta.razonSocial ?? `${consulta.nombres ?? ''} ${consulta.apellidos ?? ''}`.trim(),
        );
        this.mensaje.set({ texto: 'RUC encontrado: razón social completada.', clase: 'ok' });
      } else {
        this.mensaje.set({
          texto: 'La consulta no devolvió datos. Escribe la razón social a mano (RN45).',
          clase: 'warn',
        });
      }
    });
  }
}

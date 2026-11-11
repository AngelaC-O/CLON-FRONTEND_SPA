import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { PaqueteDTO, ServicioDTO } from '../../modelos/catalogo.modelos';
import { CatalogoService } from '../../servicios/catalogo.service';
import { SelectorServicios } from './selector-servicios';

type TipoPaquete = PaqueteDTO['tipo'];

/**
 * CUS59 Registrar Paquete («Guardar paquete»): paquetes y membresías con sus servicios, sesiones,
 * precio y vigencia. La atención descuenta una sesión del paquete de la clienta (RN36).
 */
@Component({
  selector: 'app-paquetes',
  imports: [ReactiveFormsModule, SelectorServicios],
  template: `
    <div class="gf2">
      @for (paquete of paquetes(); track paquete.idPaquete) {
        <div class="card col paquete" style="gap: 6px">
          <div class="row">
            <div class="h3 sp" style="font-size: 17px">{{ paquete.nombre }}</div>
            <span class="chip" [class.info]="paquete.tipo === 'MEMBRESIA'">
              {{ paquete.tipo === 'MEMBRESIA' ? 'Membresía' : 'Paquete' }}
            </span>
            @if (paquete.estado === 'INACTIVO') {
              <span class="chip">Inactivo</span>
            }
          </div>
          <div class="sm">
            {{ paquete.numSesiones }} sesiones · {{ soles(paquete.precio) }} · vigencia
            {{ paquete.vigenciaDias }} días
          </div>
          <div class="xs mut">{{ nombresServicios(paquete.idsServicio) }}</div>
        </div>
      } @empty {
        <div class="card vacio">Aún no hay paquetes ni membresías.</div>
      }
    </div>

    @if (puedeCrear()) {
      <form
        class="card col"
        style="max-width: 760px"
        [formGroup]="formulario"
        (ngSubmit)="guardar()"
      >
        <h2 class="h3">Nuevo paquete o membresía</h2>
        @if (error(); as mensaje) {
          <div class="alert bad" role="alert">{{ mensaje }}</div>
        }
        <div class="seg" role="group" aria-label="Tipo">
          @for (opcion of tipos; track opcion.valor) {
            <button
              type="button"
              [class.on]="formulario.controls.tipo.value === opcion.valor"
              [attr.aria-pressed]="formulario.controls.tipo.value === opcion.valor"
              (click)="formulario.controls.tipo.setValue(opcion.valor)"
            >
              {{ opcion.texto }}
            </button>
          }
        </div>
        <div class="g2">
          <div class="fld">
            <label class="lbl" for="paqueteNombre">NOMBRE</label>
            <input class="inp" id="paqueteNombre" maxlength="80" formControlName="nombre" />
          </div>
          <div class="fld">
            <label class="lbl" for="paqueteSesiones">SESIONES</label>
            <input
              class="inp"
              id="paqueteSesiones"
              type="number"
              min="1"
              formControlName="numSesiones"
            />
          </div>
          <div class="fld">
            <label class="lbl" for="paquetePrecio">PRECIO (S/)</label>
            <input
              class="inp"
              id="paquetePrecio"
              type="number"
              min="0"
              step="0.01"
              formControlName="precio"
            />
          </div>
          <div class="fld">
            <label class="lbl" for="paqueteVigencia">VIGENCIA (DÍAS)</label>
            <input
              class="inp"
              id="paqueteVigencia"
              type="number"
              min="1"
              formControlName="vigenciaDias"
            />
          </div>
        </div>
        <app-selector-servicios [servicios]="servicios()" [control]="idsServicio" />
        <button class="btn" type="submit" style="align-self: flex-start" [disabled]="enviando()">
          Guardar paquete
        </button>
      </form>
    }
  `,
})
export class Paquetes implements OnInit {
  private readonly servicio = inject(CatalogoService);
  private readonly sesion = inject(SesionService);
  private readonly notificaciones = inject(NotificacionesService);

  /** Servicios activos del catálogo, para elegir los del paquete. */
  readonly servicios = input<ServicioDTO[]>([]);

  protected readonly soles = soles;
  protected readonly tipos: { valor: TipoPaquete; texto: string }[] = [
    { valor: 'PAQUETE', texto: 'Paquete' },
    { valor: 'MEMBRESIA', texto: 'Membresía' },
  ];
  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.catalogoCrear));
  protected readonly paquetes = signal<PaqueteDTO[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly idsServicio = new FormControl<number[]>([], { nonNullable: true });
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    tipo: ['PAQUETE' as TipoPaquete],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    numSesiones: [null as number | null, [Validators.required, Validators.min(1)]],
    precio: [null as number | null, [Validators.required, Validators.min(0)]],
    vigenciaDias: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.servicio.listarPaquetes().subscribe((paquetes) => this.paquetes.set(paquetes));
  }

  protected nombresServicios(ids?: number[]): string {
    return (ids ?? [])
      .map((id) => this.servicios().find((s) => s.idServicio === id)?.nombre ?? `Servicio ${id}`)
      .join(', ');
  }

  protected guardar(): void {
    const valor = this.formulario.getRawValue();
    if (this.formulario.invalid) {
      this.error.set(
        'Completa el nombre, al menos una sesión, el precio y una vigencia de al menos un día.',
      );
      return;
    }
    if (this.idsServicio.value.length === 0) {
      this.error.set('Elige al menos un servicio.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .registrarPaquete({
        tipo: valor.tipo,
        nombre: valor.nombre.trim(),
        numSesiones: valor.numSesiones!,
        precio: valor.precio!,
        vigenciaDias: valor.vigenciaDias!,
        idsServicio: this.idsServicio.value,
      })
      .subscribe({
        next: (paquete) => {
          this.enviando.set(false);
          this.formulario.reset();
          this.idsServicio.setValue([]);
          this.paquetes.update((lista) => [paquete, ...lista]);
          this.notificaciones.mostrar(`${paquete.nombre} registrado.`);
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          if (error.status === 400 || error.status === 422) {
            this.error.set(mensajeDelProblema(error, 'Revisa los datos del paquete.'));
          }
        },
      });
  }
}

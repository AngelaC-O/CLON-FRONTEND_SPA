import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { ClienteDTO } from '../../modelos/agenda.modelos';
import { ClientesService } from '../../servicios/clientes.service';

export interface ClientaElegida {
  idCliente: number;
  nombre: string;
}

/** «include» CUS01: elige la clienta de una cita. Sin CLIENTAS:VER, se escribe su código. */
@Component({
  selector: 'app-selector-clienta',
  imports: [ReactiveFormsModule],
  template: `
    <div class="fld">
      @if (elegida(); as clienta) {
        <span class="lbl">CLIENTA</span>
        <div class="row">
          <span class="chip salon alto">{{ clienta.nombre }}</span>
          <button class="btn ghost sm" type="button" (click)="cambiar()">Cambiar</button>
        </div>
      } @else if (puedeBuscar()) {
        <label class="lbl" for="buscarClientaCita">CLIENTA</label>
        <div class="row nw">
          <input
            class="inp"
            id="buscarClientaCita"
            placeholder="Nombre o teléfono"
            [formControl]="texto"
            (keydown.enter)="$event.preventDefault(); buscar()"
          />
          <button class="btn sec" type="button" (click)="buscar()">Buscar</button>
        </div>
        @if (resultados(); as lista) {
          <div class="col" style="gap: 4px; margin-top: 8px">
            @for (clienta of lista; track clienta.idCliente) {
              <button class="btn sec sm" type="button" (click)="elegir(clienta)">
                {{ clienta.nombres }} {{ clienta.apellidos }} · {{ clienta.telefono }}
              </button>
            } @empty {
              <div class="xs mut">No se encontraron clientas.</div>
            }
          </div>
        }
      } @else {
        <label class="lbl" for="codigoClienta">CÓDIGO DE LA CLIENTA</label>
        <input
          class="inp"
          id="codigoClienta"
          type="number"
          min="1"
          (change)="escribir($any($event.target).valueAsNumber)"
        />
      }
    </div>
  `,
})
export class SelectorClienta implements OnInit {
  private readonly servicio = inject(ClientesService);
  private readonly sesion = inject(SesionService);

  readonly inicial = input<ClientaElegida | null>(null);
  readonly cambio = output<ClientaElegida | null>();

  protected readonly puedeBuscar = computed(() => this.sesion.tienePermiso(PERMISOS.clientasVer));
  protected readonly texto = new FormControl('', { nonNullable: true });
  protected readonly resultados = signal<ClienteDTO[] | null>(null);
  protected readonly elegida = signal<ClientaElegida | null>(null);

  ngOnInit(): void {
    this.elegida.set(this.inicial());
  }

  protected buscar(): void {
    const texto = this.texto.value.trim();
    const filtro = /^[\d\s+-]+$/.test(texto)
      ? { telefono: texto.replace(/\s/g, '') }
      : { nombres: texto };
    this.servicio.buscar(filtro).subscribe((clientas) => this.resultados.set(clientas));
  }

  protected elegir(clienta: ClienteDTO): void {
    const elegida = {
      idCliente: clienta.idCliente as number,
      nombre: `${clienta.nombres} ${clienta.apellidos ?? ''}`.trim(),
    };
    this.elegida.set(elegida);
    this.cambio.emit(elegida);
  }

  protected escribir(codigo: number): void {
    this.cambio.emit(codigo > 0 ? { idCliente: codigo, nombre: `Clienta ${codigo}` } : null);
  }

  protected cambiar(): void {
    this.elegida.set(null);
    this.resultados.set(null);
    this.cambio.emit(null);
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import { ListaEsperaDTO } from '../../modelos/agenda.modelos';
import { CitasService } from '../../servicios/citas.service';
import { PedidoEspera } from './nueva-cita';
import { ClientaElegida, SelectorClienta } from './selector-clienta';

/** CUS06 Registrar Lista de Espera. */
@Component({
  selector: 'app-lista-espera',
  imports: [ReactiveFormsModule, Modal, SelectorClienta],
  template: `
    <app-modal titulo="Lista de espera" [angosto]="true" (cerrar)="cerrar.emit()">
      <form [formGroup]="formulario" (ngSubmit)="anotar()">
        <div class="mb">
          <div class="mut sm">Clientas que pidieron una hora sin capacidad.</div>
          @if (error(); as mensaje) {
            <div class="alert bad" role="alert">{{ mensaje }}</div>
          }
          <app-selector-clienta [inicial]="pedido().clienta" (cambio)="clienta.set($event)" />
          <div class="fld">
            <label class="lbl" for="esperaIdVariante">CÓDIGO DE LA VARIANTE</label>
            <input
              class="inp"
              id="esperaIdVariante"
              type="number"
              min="1"
              formControlName="idVariante"
            />
          </div>
          <div class="fld">
            <label class="lbl" for="esperaFecha">FECHA DESEADA</label>
            <input class="inp" id="esperaFecha" type="date" formControlName="fechaDeseada" />
          </div>
          <div class="g2">
            <div class="fld">
              <label class="lbl" for="esperaDesde">DESDE (OPCIONAL)</label>
              <input class="inp" id="esperaDesde" type="time" formControlName="horaDesde" />
            </div>
            <div class="fld">
              <label class="lbl" for="esperaHasta">HASTA (OPCIONAL)</label>
              <input class="inp" id="esperaHasta" type="time" formControlName="horaHasta" />
            </div>
          </div>
        </div>
        <div class="mf">
          <button class="btn sec" type="button" (click)="cerrar.emit()">Cancelar</button>
          <button class="btn" type="submit" [disabled]="enviando()">
            Anotar en lista de espera
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ListaEspera implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(CitasService);

  readonly pedido = input.required<PedidoEspera>();
  readonly cerrar = output<void>();
  readonly anotada = output<ListaEsperaDTO>();

  protected readonly clienta = signal<ClientaElegida | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    idVariante: [null as number | null, [Validators.required, Validators.min(1)]],
    fechaDeseada: ['', Validators.required],
    horaDesde: [''],
    horaHasta: [''],
  });

  ngOnInit(): void {
    const { clienta, idVariante, fecha } = this.pedido();
    this.clienta.set(clienta);
    this.formulario.patchValue({ idVariante, fechaDeseada: fecha });
  }

  protected anotar(): void {
    const { idVariante, fechaDeseada, horaDesde, horaHasta } = this.formulario.getRawValue();
    const clienta = this.clienta();
    if (!clienta || !idVariante || this.formulario.invalid) {
      this.error.set('Elige la clienta e indica la variante y la fecha deseada.');
      return;
    }
    if (horaDesde && horaHasta && horaDesde >= horaHasta) {
      this.error.set('La hora «desde» debe ser anterior a la hora «hasta».');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .registrarEspera({
        idCliente: clienta.idCliente,
        idVariante,
        fechaDeseada,
        ...(horaDesde ? { horaDesde } : {}),
        ...(horaHasta ? { horaHasta } : {}),
      })
      .subscribe({
        next: (espera) => {
          this.enviando.set(false);
          this.anotada.emit(espera);
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          if (error.status === 400) {
            this.error.set(mensajeDelProblema(error, 'Revisa los datos.'));
          }
        },
      });
  }
}

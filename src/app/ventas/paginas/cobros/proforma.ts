import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { soles } from '../../../core/api/moneda';
import { mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import { Item, ProformaDTO } from '../../modelos/ventas.modelos';
import { VentasService } from '../../servicios/ventas.service';

const DIAS_VIGENCIA = 7;

/** CUS21: el back-end calcula la cotización y no la guarda (RN09); solo se imprime. */
@Component({
  selector: 'app-proforma',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal titulo="Proforma" (cerrar)="cerrar.emit()">
      @if (armada(); as proforma) {
        <div class="mb imprimible">
          <div class="mut sm">
            Cautiva Spa E.I.R.L. · documento interno, no reemplaza al comprobante (RN09)
          </div>
          <div class="b">{{ proforma.nombreCliente || 'Clienta ' + proforma.idCliente }}</div>
          @for (item of proforma.items; track $index) {
            <div class="row sm">
              <span class="sp">{{ descripcion(item) }} × {{ item.cantidad }}</span>
              <span class="num">{{ soles(item.subtotal) }}</span>
            </div>
          }
          <hr class="sep" />
          <div class="row b">
            <span class="sp">Total referencial</span>
            <span class="num">{{ soles(proforma.total) }}</span>
          </div>
          <div class="xs mut">
            Válida hasta {{ proforma.fechaValidez }}. La venta se cobra con boleta o factura
            electrónica.
          </div>
        </div>
        <div class="mf">
          <button class="btn sec" type="button" (click)="cerrar.emit()">Cerrar</button>
          <button class="btn" type="button" (click)="imprimir()">Imprimir</button>
        </div>
      } @else {
        <form [formGroup]="formulario" (ngSubmit)="emitir()">
          <div class="mb">
            @if (error(); as mensaje) {
              <div class="alert bad" role="alert">{{ mensaje }}</div>
            }
            <div class="alert info">La proforma se imprime y no se guarda.</div>
            <div class="g2">
              <div class="fld">
                <label class="lbl" for="proformaNombre">NOMBRE DE LA CLIENTA</label>
                <input class="inp" id="proformaNombre" formControlName="nombreCliente" />
              </div>
              <div class="fld">
                <label class="lbl" for="proformaIdCliente">CÓDIGO DE LA CLIENTA (OPCIONAL)</label>
                <input
                  class="inp"
                  id="proformaIdCliente"
                  type="number"
                  min="1"
                  formControlName="idCliente"
                />
              </div>
              <div class="fld">
                <label class="lbl" for="proformaValidez">VÁLIDA HASTA</label>
                <input
                  class="inp"
                  id="proformaValidez"
                  type="date"
                  formControlName="fechaValidez"
                />
              </div>
            </div>

            <div class="h3">Ítems</div>
            @for (item of items; track item; let i = $index) {
              <div class="g2" [formGroup]="item">
                <div class="fld">
                  <label class="lbl" [for]="'proformaTipo' + i">TIPO</label>
                  <select class="inp" [id]="'proformaTipo' + i" formControlName="tipoItem">
                    <option value="SERVICIO">Servicio</option>
                    <option value="PAQUETE">Paquete</option>
                  </select>
                </div>
                <div class="fld">
                  <label class="lbl" [for]="'proformaCodigo' + i">
                    {{
                      item.controls.tipoItem.value === 'SERVICIO'
                        ? 'CÓDIGO DE LA VARIANTE'
                        : 'CÓDIGO DEL PAQUETE'
                    }}
                  </label>
                  <input
                    class="inp"
                    type="number"
                    min="1"
                    [id]="'proformaCodigo' + i"
                    formControlName="codigo"
                  />
                </div>
                <div class="fld">
                  <label class="lbl" [for]="'proformaPromo' + i"
                    >CÓDIGO DE PROMOCIÓN (OPCIONAL)</label
                  >
                  <input
                    class="inp"
                    type="number"
                    min="1"
                    [id]="'proformaPromo' + i"
                    formControlName="idPromocion"
                  />
                </div>
                <div class="fld">
                  <label class="lbl" [for]="'proformaCantidad' + i">CANTIDAD</label>
                  <input
                    class="inp"
                    type="number"
                    min="1"
                    [id]="'proformaCantidad' + i"
                    formControlName="cantidad"
                  />
                </div>
              </div>
              @if (items.length > 1) {
                <button
                  class="btn ghost sm"
                  type="button"
                  style="align-self: flex-start"
                  (click)="quitarItem(i)"
                >
                  Quitar ítem
                </button>
              }
            }
            <button
              class="btn sec sm"
              type="button"
              style="align-self: flex-start"
              (click)="agregarItem()"
            >
              + Ítem
            </button>
          </div>
          <div class="mf">
            <button class="btn sec" type="button" (click)="cerrar.emit()">Cancelar</button>
            <button class="btn" type="submit" [disabled]="enviando()">Emitir proforma</button>
          </div>
        </form>
      }
    </app-modal>
  `,
})
export class Proforma {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly servicio = inject(VentasService);

  readonly cerrar = output<void>();

  protected readonly soles = soles;
  protected readonly armada = signal<ProformaDTO | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    nombreCliente: [''],
    idCliente: [null as number | null, Validators.min(1)],
    fechaValidez: [fechaEnDias(DIAS_VIGENCIA), Validators.required],
  });
  protected items = [this.nuevoItem()];

  protected agregarItem(): void {
    this.items = [...this.items, this.nuevoItem()];
  }

  protected quitarItem(indice: number): void {
    this.items = this.items.filter((_, i) => i !== indice);
  }

  protected descripcion(item: Item): string {
    return item.tipoItem === 'PAQUETE'
      ? `Paquete ${item.idPaquete}`
      : `Variante ${item.idVariante}`;
  }

  protected emitir(): void {
    const { nombreCliente, idCliente, fechaValidez } = this.formulario.getRawValue();
    const nombre = nombreCliente.trim();
    if (!nombre && !idCliente) {
      this.error.set('Escribe el nombre o el código de la clienta.');
      return;
    }
    if (this.formulario.invalid || this.items.some((item) => item.invalid)) {
      this.error.set('Revisa la fecha, los códigos y las cantidades.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .armarProforma({
        ...(nombre ? { nombreCliente: nombre } : {}),
        ...(idCliente ? { idCliente } : {}),
        fechaValidez,
        items: this.items.map((item) => this.aItem(item.getRawValue())),
      })
      .subscribe({
        next: (proforma) => {
          this.enviando.set(false);
          this.armada.set(proforma);
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          if (error.status === 400 || error.status === 404) {
            this.error.set(mensajeDelProblema(error, 'No se pudo armar la proforma.'));
          }
        },
      });
  }

  protected imprimir(): void {
    window.print();
  }

  private nuevoItem() {
    return this.fb.group({
      tipoItem: ['SERVICIO' as 'SERVICIO' | 'PAQUETE'],
      codigo: [null as number | null, [Validators.required, Validators.min(1)]],
      idPromocion: [null as number | null, Validators.min(1)],
      cantidad: [1, [Validators.required, Validators.min(1)]],
    });
  }

  private aItem(item: {
    tipoItem: 'SERVICIO' | 'PAQUETE';
    codigo: number | null;
    idPromocion: number | null;
    cantidad: number;
  }): Item {
    return {
      tipoItem: item.tipoItem,
      cantidad: item.cantidad,
      ...(item.tipoItem === 'SERVICIO'
        ? { idVariante: item.codigo ?? undefined }
        : { idPaquete: item.codigo ?? undefined }),
      ...(item.idPromocion ? { idPromocion: item.idPromocion } : {}),
    };
  }
}

function fechaEnDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

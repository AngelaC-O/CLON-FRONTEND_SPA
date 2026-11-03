import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-cobros',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Cobros y comprobantes"
      frontera="IGU_Cobro"
      [cus]="[
        'CUS18 Cobrar Venta',
        'CUS19 Emitir Comprobante Electrónico',
        'CUS20 Entregar Comprobante',
        'CUS21 Emitir Proforma',
      ]"
    />
  `,
})
export class Cobros {}

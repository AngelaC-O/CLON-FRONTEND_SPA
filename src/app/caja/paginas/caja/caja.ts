import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-caja',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Caja"
      frontera="IGU_Caja"
      [cus]="['CUS44 Abrir Caja', 'CUS45 Cerrar Caja']"
    />
  `,
})
export class Caja {}

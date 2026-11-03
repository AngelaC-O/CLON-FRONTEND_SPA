import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-clientas',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Clientas"
      frontera="IGU_Clientas"
      [cus]="['CUS01 Buscar Clienta', 'CUS02 Registrar Clienta']"
    />
  `,
})
export class Clientas {}

import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-recursos',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Recursos"
      frontera="IGU_Recursos"
      [cus]="['CUS61 Registrar Recurso']"
    />
  `,
})
export class Recursos {}

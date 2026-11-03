import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-atencion',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Atención en curso"
      frontera="IGU_Atencion"
      [cus]="['CUS11 Registrar Atención']"
    />
  `,
})
export class Atencion {}

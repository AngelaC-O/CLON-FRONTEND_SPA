import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-agenda',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Agenda"
      frontera="IGU_Agenda"
      [cus]="[
        'CUS05 Programar Cita',
        'CUS06 Registrar Lista de Espera',
        'CUS07 Registrar Adelanto de Reserva',
        'CUS08 Consultar Agenda',
      ]"
    />
  `,
})
export class Agenda {}

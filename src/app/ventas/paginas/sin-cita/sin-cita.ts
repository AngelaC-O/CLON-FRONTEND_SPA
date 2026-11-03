import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-sin-cita',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Atención sin cita"
      frontera="IGU_VentaRapida"
      [cus]="['CUS13 Registrar Atención sin Cita']"
    />
  `,
})
export class SinCita {}

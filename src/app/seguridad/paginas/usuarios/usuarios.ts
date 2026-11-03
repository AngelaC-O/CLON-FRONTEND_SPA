import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-usuarios',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Usuarios y seguridad"
      frontera="IGU_Usuarios"
      [cus]="['CUS52 Registrar Usuario', 'CUS53 Asignar Rol']"
    />
  `,
})
export class Usuarios {}

import { Component } from '@angular/core';
import { PaginaPendiente } from '../../../layout/pagina-pendiente/pagina-pendiente';

@Component({
  selector: 'app-catalogo',
  imports: [PaginaPendiente],
  template: `
    <app-pagina-pendiente
      titulo="Catálogo y configuración"
      frontera="IGU_Catalogo"
      [cus]="['CUS57 Registrar Servicio']"
    />
  `,
})
export class Catalogo {}

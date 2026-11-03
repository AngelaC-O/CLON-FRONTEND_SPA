import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-acceso-denegado',
  imports: [RouterLink],
  template: `
    <div
      class="card"
      style="max-width: 520px; margin: 40px auto; text-align: center; padding: 40px 28px"
    >
      <div class="kpi bad">Acceso denegado</div>
      <p class="mut">Tu rol no tiene permiso para abrir esta pantalla.</p>
      <a class="btn" routerLink="/inicio">Volver a mi inicio</a>
    </div>
  `,
})
export class AccesoDenegado {}

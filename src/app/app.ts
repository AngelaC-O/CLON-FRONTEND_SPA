import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificacionesService } from './core/notificaciones/notificaciones.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly notificaciones = inject(NotificacionesService);
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvisoDTO } from '../../core/api/modelos.generados';
import { AvisosService } from '../../core/sesion/avisos.service';

/**
 * Tarjeta «Pendientes» del nodo 4:17 con GET /avisos (CUS50). Se crea cada vez que se entra a
 * Inicio, así que vuelve a pedir los avisos al volver.
 */
@Component({
  selector: 'app-panel-avisos',
  imports: [RouterLink],
  template: `
    <section class="card" aria-labelledby="tituloAvisos">
      <h2 class="h2" id="tituloAvisos" style="margin-bottom: 10px">Avisos</h2>
      @if (cargando()) {
        <div class="mut sm">Cargando avisos…</div>
      } @else if (error()) {
        <div class="row nw">
          <span class="sp mut sm">No se pudieron cargar los avisos.</span>
          <button class="btn sm sec" type="button" (click)="cargar()">Reintentar</button>
        </div>
      } @else {
        <ul class="col avisos" style="gap: 8px">
          @for (aviso of avisos(); track $index) {
            <li class="row nw">
              <span class="chip warn num" [attr.aria-label]="'Cantidad: ' + aviso.cantidad">
                {{ aviso.cantidad }}
              </span>
              <span class="sp sm">{{ aviso.mensaje }}</span>
              @if (aviso.ruta) {
                <a class="btn sm sec" [routerLink]="aviso.ruta">Ver</a>
              }
            </li>
          } @empty {
            <li class="mut sm">No hay avisos</li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .avisos {
      list-style: none;
      margin: 0;
      padding: 0;
    }
  `,
})
export class PanelAvisos implements OnInit {
  private readonly servicio = inject(AvisosService);

  protected readonly avisos = signal<AvisoDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.servicio.listar().subscribe({
      next: (avisos) => {
        this.avisos.set(avisos ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set(true);
      },
    });
  }
}

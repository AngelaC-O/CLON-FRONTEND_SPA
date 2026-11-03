import { Injectable, signal } from '@angular/core';

export interface Notificacion {
  texto: string;
  tipo: 'info' | 'error';
}

const DURACION_MS = 6000;

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly estado = signal<Notificacion | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  readonly actual = this.estado.asReadonly();

  mostrar(texto: string, tipo: Notificacion['tipo'] = 'info'): void {
    clearTimeout(this.temporizador);
    this.estado.set({ texto, tipo });
    this.temporizador = setTimeout(() => this.estado.set(null), DURACION_MS);
  }
}

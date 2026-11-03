import { Injectable, signal } from '@angular/core';
import { AtencionDTO } from '../modelos/agenda.modelos';

const CLAVE_ALMACEN = 'cautiva.atencion';

/**
 * Recuerda la atención iniciada en esta pestaña: el contrato no tiene un GET para recuperarla, y
 * PATCH /atenciones/{id}/fin necesita su id (ver docs/NOTAS_IT1.md, Dudas).
 */
@Injectable({ providedIn: 'root' })
export class AtencionEnCursoService {
  private readonly estado = signal<AtencionDTO | null>(leerGuardada());

  readonly actual = this.estado.asReadonly();

  establecer(atencion: AtencionDTO): void {
    this.estado.set(atencion);
    guardar(atencion);
  }

  limpiar(): void {
    this.estado.set(null);
    guardar(null);
  }
}

function leerGuardada(): AtencionDTO | null {
  try {
    const guardada = sessionStorage.getItem(CLAVE_ALMACEN);
    return guardada ? (JSON.parse(guardada) as AtencionDTO) : null;
  } catch {
    return null;
  }
}

function guardar(atencion: AtencionDTO | null): void {
  try {
    if (atencion) {
      sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(atencion));
    } else {
      sessionStorage.removeItem(CLAVE_ALMACEN);
    }
  } catch {
    // Sin almacenamiento la atención dura hasta recargar la página.
  }
}

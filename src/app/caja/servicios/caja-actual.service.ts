import { Injectable, signal } from '@angular/core';
import { CajaDTO } from '../modelos/caja.modelos';

const CLAVE_ALMACEN = 'cautiva.caja';

/**
 * Recuerda la caja abierta en esta pestaña: el contrato no tiene un GET de la caja abierta, y el
 * cierre necesita su id (ver docs/NOTAS_IT1.md, Dudas).
 */
@Injectable({ providedIn: 'root' })
export class CajaActualService {
  private readonly estado = signal<CajaDTO | null>(leerGuardada());

  readonly actual = this.estado.asReadonly();

  establecer(caja: CajaDTO): void {
    this.estado.set(caja);
    guardar(caja);
  }

  limpiar(): void {
    this.estado.set(null);
    guardar(null);
  }
}

function leerGuardada(): CajaDTO | null {
  try {
    const guardada = sessionStorage.getItem(CLAVE_ALMACEN);
    return guardada ? (JSON.parse(guardada) as CajaDTO) : null;
  } catch {
    return null;
  }
}

function guardar(caja: CajaDTO | null): void {
  try {
    if (caja) {
      sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(caja));
    } else {
      sessionStorage.removeItem(CLAVE_ALMACEN);
    }
  } catch {
    // Sin almacenamiento la caja dura hasta recargar la página.
  }
}

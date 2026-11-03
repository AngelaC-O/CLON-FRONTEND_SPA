import { Injectable, signal } from '@angular/core';
import { VentaDTO } from '../modelos/ventas.modelos';

const CLAVE_ALMACEN = 'cautiva.venta';

/** Cobro digital enviado a Izipay que aún no suma: se reenvía con su idTransaccion (RN42). */
export interface CobroEnEspera {
  idTransaccion: number;
  idMedioPago: number;
  monto: number;
  canal: string;
  enlacePago?: string;
}

export interface VentaEnCurso {
  venta: VentaDTO;
  enEspera: CobroEnEspera[];
}

/**
 * Recuerda la venta abierta en esta pestaña: el contrato no tiene un GET de la venta, y recargar
 * perdería los cobros que esperan a Izipay (ver docs/NOTAS_IT1.md, Dudas).
 */
@Injectable({ providedIn: 'root' })
export class VentaEnCursoService {
  private readonly estado = signal<VentaEnCurso | null>(leerGuardada());

  readonly actual = this.estado.asReadonly();

  establecer(venta: VentaDTO, enEspera: CobroEnEspera[] = this.estado()?.enEspera ?? []): void {
    const actual = { venta, enEspera };
    this.estado.set(actual);
    guardar(actual);
  }

  limpiar(): void {
    this.estado.set(null);
    guardar(null);
  }
}

function leerGuardada(): VentaEnCurso | null {
  try {
    const guardada = sessionStorage.getItem(CLAVE_ALMACEN);
    return guardada ? (JSON.parse(guardada) as VentaEnCurso) : null;
  } catch {
    return null;
  }
}

function guardar(venta: VentaEnCurso | null): void {
  try {
    if (venta) {
      sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(venta));
    } else {
      sessionStorage.removeItem(CLAVE_ALMACEN);
    }
  } catch {
    // Sin almacenamiento la venta dura hasta recargar la página.
  }
}

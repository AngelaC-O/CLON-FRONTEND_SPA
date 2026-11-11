import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { BandejaAnulaciones } from './bandeja-anulaciones';
import { Devoluciones } from './devoluciones';
import { SolicitudAnulacion } from './solicitud-anulacion';

type Vista = 'solicitud' | 'bandeja' | 'devoluciones';

/**
 * IGU_Anulacion, dentro del nodo 4:65 «Cobros y comprobantes» (cierra la diferencia 32 de
 * NOTAS_IT1). La solicitud (CUS22) pide VENTAS:ANULAR; la bandeja (CUS23) y las devoluciones
 * (CUS24), VENTAS:EDITAR. Una venta CERRADA nunca se elimina: se anula con nota de crédito (RN12).
 */
@Component({
  selector: 'app-anulaciones',
  imports: [RouterLink, SolicitudAnulacion, BandejaAnulaciones, Devoluciones],
  template: `
    <div class="col" style="gap: 16px">
      <div class="row">
        <div class="sp">
          <h1 class="h1">Anulaciones</h1>
          <div class="mut">
            Una venta cerrada nunca se elimina: se anula con nota de crédito electrónica (RN12).
          </div>
        </div>
        <a class="btn ghost" routerLink="/ventas/cobros">← Cobros</a>
      </div>

      <div class="tabs" role="tablist" aria-label="Anulaciones">
        @for (opcion of vistas(); track opcion.id) {
          <button
            class="tab"
            type="button"
            role="tab"
            [class.on]="vista() === opcion.id"
            [attr.aria-selected]="vista() === opcion.id"
            (click)="vista.set(opcion.id)"
          >
            {{ opcion.texto }}
          </button>
        }
      </div>

      <!-- Las tres vistas quedan montadas: cambiar de pestaña no vuelve a pedir nada. -->
      @if (puedeSolicitar()) {
        <div [hidden]="vista() !== 'solicitud'">
          <app-solicitud-anulacion [idVentaInicial]="idVentaInicial" />
        </div>
      }
      @if (puedeResolver()) {
        <div [hidden]="vista() !== 'bandeja'">
          <app-bandeja-anulaciones (aprobacion)="alAprobar()" />
        </div>
        <div [hidden]="vista() !== 'devoluciones'">
          <app-devoluciones />
        </div>
      }
    </div>
  `,
})
export class Anulaciones {
  private readonly sesion = inject(SesionService);
  private readonly devoluciones = viewChild(Devoluciones);

  protected readonly puedeSolicitar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.ventasAnular),
  );
  protected readonly puedeResolver = computed(() =>
    this.sesion.tienePermiso(PERMISOS.ventasEditar),
  );
  protected readonly vistas = computed(() => [
    ...(this.puedeSolicitar() ? [{ id: 'solicitud' as Vista, texto: 'Solicitar anulación' }] : []),
    ...(this.puedeResolver()
      ? [
          { id: 'bandeja' as Vista, texto: 'Bandeja' },
          { id: 'devoluciones' as Vista, texto: 'Devoluciones' },
        ]
      : []),
  ]);

  /** La venta que llega desde el comprobante emitido (?idVenta=). */
  protected readonly idVentaInicial =
    Number(inject(ActivatedRoute).snapshot.queryParamMap.get('idVenta')) || null;
  protected readonly vista = signal<Vista>(this.vistaInicial());

  protected alAprobar(): void {
    this.devoluciones()?.cargar();
  }

  /** Con una venta en la ruta se abre su solicitud; si no, la bandeja para quien la resuelve. */
  private vistaInicial(): Vista {
    if (this.puedeSolicitar() && (this.idVentaInicial || !this.puedeResolver())) {
      return 'solicitud';
    }
    return this.puedeResolver() ? 'bandeja' : 'solicitud';
  }
}

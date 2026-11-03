import { Component, computed, input } from '@angular/core';
import { encode } from 'uqr';

/** Dibuja el enlace de Izipay como QR: el contrato solo entrega la URL (ver docs/NOTAS_IT1.md). */
@Component({
  selector: 'app-qr-pago',
  template: `
    <svg
      class="qr"
      role="img"
      aria-label="Código QR de Izipay"
      shape-rendering="crispEdges"
      [attr.viewBox]="'0 0 ' + qr().tamano + ' ' + qr().tamano"
    >
      <path fill="#000" [attr.d]="qr().trazo" />
    </svg>
  `,
})
export class QrPago {
  readonly enlace = input.required<string>();

  protected readonly qr = computed(() => {
    const { data, size } = encode(this.enlace());
    const trazo = data
      .flatMap((fila, y) => fila.map((negro, x) => (negro ? `M${x} ${y}h1v1h-1z` : '')))
      .join('');
    return { tamano: size, trazo };
  });
}

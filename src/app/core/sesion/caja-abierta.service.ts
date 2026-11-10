import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CajaDTO } from '../api/modelos.generados';

/**
 * Caja ABIERTA de la sede de la sesión, de GET /cajas/abierta (CUS44). La lee la cabecera para
 * mostrar su estado y la usa IGU_Caja; no se guarda en el navegador (Duda 10 de NOTAS_IT1).
 */
@Injectable({ providedIn: 'root' })
export class CajaAbiertaService {
  private readonly http = inject(HttpClient);
  /** undefined: aún no se consultó; null: la sede no tiene caja abierta (204). */
  private readonly estado = signal<CajaDTO | null | undefined>(undefined);

  readonly actual = this.estado.asReadonly();

  cargar(): Observable<CajaDTO | null> {
    return this.http.get<CajaDTO | null>(`${environment.apiBase}/cajas/abierta`).pipe(
      map((caja) => (caja?.estado === 'ABIERTA' ? caja : null)),
      tap((caja) => this.estado.set(caja)),
    );
  }

  establecer(caja: CajaDTO | null): void {
    this.estado.set(caja?.estado === 'ABIERTA' ? caja : null);
  }
}

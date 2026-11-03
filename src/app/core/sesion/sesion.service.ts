import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CambioClaveDTO, CredencialesDTO, SesionDTO } from '../api/modelos.generados';

const CLAVE_ALMACEN = 'cautiva.sesion';

/**
 * Estado de la sesión del BackOffice. La autoridad es la cookie HttpOnly del back-end: lo guardado
 * aquí solo evita perder el menú al recargar, porque el contrato no tiene un GET de la sesión.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/auth`;
  private readonly estado = signal<SesionDTO | null>(leerGuardada());

  readonly sesion = this.estado.asReadonly();
  readonly autenticada = computed(() => this.estado() !== null);
  readonly debeCambiarClave = computed(() => this.estado()?.debeCambiarClave === true);

  /** Verdadero si el usuario tiene alguno de los permisos; sin permisos pedidos, basta la sesión. */
  tienePermiso(...permisos: string[]): boolean {
    const sesion = this.estado();
    if (!sesion) {
      return false;
    }
    return permisos.length === 0 || permisos.some((p) => sesion.permisos?.includes(p));
  }

  iniciarSesion(credenciales: CredencialesDTO): Observable<SesionDTO> {
    return this.http
      .post<SesionDTO>(`${this.url}/login`, credenciales)
      .pipe(tap((sesion) => this.establecer(sesion)));
  }

  cerrarSesion(): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, null).pipe(finalize(() => this.limpiar()));
  }

  cambiarClave(cambio: CambioClaveDTO): Observable<void> {
    return this.http.post<void>(`${this.url}/cambio-clave`, cambio).pipe(
      tap(() => {
        const sesion = this.estado();
        if (sesion) {
          this.establecer({ ...sesion, debeCambiarClave: false });
        }
      }),
    );
  }

  limpiar(): void {
    this.estado.set(null);
    guardar(null);
  }

  private establecer(sesion: SesionDTO): void {
    this.estado.set(sesion);
    guardar(sesion);
  }
}

function leerGuardada(): SesionDTO | null {
  try {
    const guardada = sessionStorage.getItem(CLAVE_ALMACEN);
    return guardada ? (JSON.parse(guardada) as SesionDTO) : null;
  } catch {
    return null;
  }
}

function guardar(sesion: SesionDTO | null): void {
  try {
    if (sesion) {
      sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(sesion));
    } else {
      sessionStorage.removeItem(CLAVE_ALMACEN);
    }
  } catch {
    // Sin almacenamiento la sesión dura hasta recargar la página.
  }
}

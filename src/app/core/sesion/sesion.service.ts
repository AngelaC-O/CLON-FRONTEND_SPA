import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CambioClaveDTO, CredencialesDTO, SesionDTO } from '../api/modelos.generados';

/**
 * Estado de la sesión del BackOffice. La autoridad es la cookie HttpOnly del back-end: el navegador
 * no guarda nada; al cargar la aplicación se pide GET /auth/sesion (CUS50).
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/auth`;
  private readonly estado = signal<SesionDTO | null>(null);

  readonly sesion = this.estado.asReadonly();
  readonly autenticada = computed(() => this.estado() !== null);
  readonly debeCambiarClave = computed(() => this.estado()?.debeCambiarClave === true);
  readonly nombreCompleto = computed(() => {
    const sesion = this.estado();
    const nombre = [sesion?.nombres, sesion?.apellidos].filter(Boolean).join(' ');
    return nombre || sesion?.nombreUsuario || '';
  });

  /** Verdadero si el usuario tiene alguno de los permisos; sin permisos pedidos, basta la sesión. */
  tienePermiso(...permisos: string[]): boolean {
    const sesion = this.estado();
    if (!sesion) {
      return false;
    }
    return permisos.length === 0 || permisos.some((p) => sesion.permisos?.includes(p));
  }

  /**
   * Recupera la sesión de la cookie al cargar. Un 401 (o cualquier error) deja la aplicación sin
   * sesión, y las guardas llevan al login.
   */
  cargar(): Observable<SesionDTO | null> {
    return this.http.get<SesionDTO>(`${this.url}/sesion`).pipe(
      map((sesion) => sesion ?? null),
      catchError(() => of(null)),
      tap((sesion) => this.estado.set(sesion)),
    );
  }

  iniciarSesion(credenciales: CredencialesDTO): Observable<SesionDTO> {
    return this.http
      .post<SesionDTO>(`${this.url}/login`, credenciales)
      .pipe(tap((sesion) => this.estado.set(sesion)));
  }

  cerrarSesion(): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, null).pipe(finalize(() => this.limpiar()));
  }

  cambiarClave(cambio: CambioClaveDTO): Observable<void> {
    return this.http.post<void>(`${this.url}/cambio-clave`, cambio).pipe(
      tap(() => {
        const sesion = this.estado();
        if (sesion) {
          this.estado.set({ ...sesion, debeCambiarClave: false });
        }
      }),
    );
  }

  limpiar(): void {
    this.estado.set(null);
  }
}

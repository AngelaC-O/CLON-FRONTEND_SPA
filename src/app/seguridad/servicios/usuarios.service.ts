import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AsignarRolDTO, RolDTO, UsuarioDTO } from '../modelos/seguridad.modelos';

/** CUS52 y CUS53. El login, el logout y el cambio de clave están en core/sesion. */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  registrar(usuario: UsuarioDTO): Observable<UsuarioDTO> {
    return this.http.post<UsuarioDTO>(`${this.api}/usuarios`, usuario);
  }

  asignarRol(idUsuario: number, asignacion: AsignarRolDTO): Observable<UsuarioDTO> {
    return this.http.patch<UsuarioDTO>(`${this.api}/usuarios/${idUsuario}/rol`, asignacion);
  }

  listarRoles(): Observable<RolDTO[]> {
    return this.http.get<RolDTO[]>(`${this.api}/roles`);
  }

  configurarPermisos(idRol: number, rol: RolDTO): Observable<RolDTO> {
    return this.http.put<RolDTO>(`${this.api}/roles/${idRol}/permisos`, rol);
  }
}

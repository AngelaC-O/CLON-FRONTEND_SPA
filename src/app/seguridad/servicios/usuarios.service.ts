import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AsignarRolDTO,
  PermisoDTO,
  PersonalSinUsuarioDTO,
  RolDTO,
  UsuarioDTO,
} from '../modelos/seguridad.modelos';

/** CUS52 y CUS53. El login, el logout y el cambio de clave están en core/sesion. */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  listar(): Observable<UsuarioDTO[]> {
    return this.http.get<UsuarioDTO[]>(`${this.api}/usuarios`);
  }

  listarPersonalSinUsuario(): Observable<PersonalSinUsuarioDTO[]> {
    return this.http.get<PersonalSinUsuarioDTO[]>(`${this.api}/usuarios/personal-sin-usuario`);
  }

  registrar(usuario: UsuarioDTO): Observable<UsuarioDTO> {
    return this.http.post<UsuarioDTO>(`${this.api}/usuarios`, usuario);
  }

  asignarRol(idUsuario: number, asignacion: AsignarRolDTO): Observable<UsuarioDTO> {
    return this.http.patch<UsuarioDTO>(`${this.api}/usuarios/${idUsuario}/rol`, asignacion);
  }

  listarRoles(): Observable<RolDTO[]> {
    return this.http.get<RolDTO[]>(`${this.api}/roles`);
  }

  listarPermisos(): Observable<PermisoDTO[]> {
    return this.http.get<PermisoDTO[]>(`${this.api}/permisos`);
  }

  configurarPermisos(idRol: number, rol: RolDTO): Observable<RolDTO> {
    return this.http.put<RolDTO>(`${this.api}/roles/${idRol}/permisos`, rol);
  }
}

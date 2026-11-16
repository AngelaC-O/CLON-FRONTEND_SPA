import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { nombreCompleto, nombreO } from '../../../core/api/nombres';
import { leerProblema, mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { Modal } from '../../../layout/modal/modal';
import {
  PermisoDTO,
  PersonalSinUsuarioDTO,
  RolDTO,
  UsuarioDTO,
} from '../../modelos/seguridad.modelos';
import { UsuariosService } from '../../servicios/usuarios.service';
import { Auditoria } from '../auditoria/auditoria';
import { RestablecerClave } from './restablecer-clave';

/** Rol que no puede quedarse sin seguridad ni sin titular activa (RN48). */
const ROL_ADMINISTRADORA = 'ADMINISTRADORA';
const PERMISOS_RN48 = ['SEGURIDAD:VER', 'SEGURIDAD:CREAR', 'SEGURIDAD:EDITAR'];
export const MENSAJE_RN48_PERMISOS =
  'El rol ADMINISTRADORA conserva SEGURIDAD:VER, SEGURIDAD:CREAR y SEGURIDAD:EDITAR (RN48).';
export const MENSAJE_RN48_ROL =
  'Es la última administradora activa: asigna antes el rol a otra persona (RN48).';

const clave = (p: PermisoDTO) => `${p.modulo}:${p.accion}`;

/**
 * IGU_Usuarios, nodo 4:245: CUS52 Registrar Usuario, CUS53 Asignar Rol y CUS54 Restablecer
 * Contraseña; la pestaña «Auditoría» es IGU_Auditoria (CUS55).
 */
@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule, Modal, Auditoria, RestablecerClave],
  templateUrl: './usuarios.html',
})
export class Usuarios implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(UsuariosService);
  private readonly sesion = inject(SesionService);

  protected readonly pestana = signal<'usuarios' | 'permisos' | 'auditoria'>('usuarios');
  /** Usuario cuya contraseña se restablece (CUS54). */
  protected readonly porRestablecer = signal<UsuarioDTO | null>(null);
  protected readonly roles = signal<RolDTO[]>([]);
  protected readonly usuarios = signal<UsuarioDTO[]>([]);
  protected readonly personal = signal<PersonalSinUsuarioDTO[]>([]);
  protected readonly permisos = signal<PermisoDTO[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly errorRegistro = signal<string | null>(null);
  protected readonly errorAsignacion = signal<string | null>(null);
  protected readonly errorRol = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.seguridadCrear));
  protected readonly puedeEditar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.seguridadEditar),
  );

  /** La clave no vuelve: se actualiza el estado del usuario (desbloqueado, debe cambiarla). */
  protected claveRestablecida(usuario: UsuarioDTO): void {
    this.porRestablecer.set(null);
    this.usuarios.update((lista) =>
      lista.map((u) => (u.idUsuario === usuario.idUsuario ? { ...u, ...usuario } : u)),
    );
    this.notificaciones.mostrar(
      `Contraseña de ${usuario.nombreUsuario} restablecida: deberá cambiarla al entrar.`,
    );
  }

  protected readonly formUsuario = this.fb.group({
    idPersonal: [null as number | null, Validators.required],
    nombreUsuario: ['', [Validators.required, Validators.maxLength(50)]],
    clave: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    idRol: [null as number | null, Validators.required],
  });
  protected readonly formRol = this.fb.group({
    idRol: [null as number | null, Validators.required],
    descripcion: ['', Validators.maxLength(150)],
    estado: ['ACTIVO' as RolDTO['estado'], Validators.required],
    permisos: this.fb.record<boolean>({}),
  });

  /** Filas de la matriz: cada módulo con las acciones que tiene cada rol. */
  protected readonly matriz = computed(() => {
    const roles = this.roles();
    const modulos = [
      ...new Set([
        ...this.permisos().map((p) => p.modulo),
        ...roles.flatMap((r) => (r.permisos ?? []).map((p) => p.modulo)),
      ]),
    ];
    return modulos.sort().map((modulo) => ({
      modulo,
      celdas: roles.map((rol) => ({
        idRol: rol.idRol,
        acciones: (rol.permisos ?? [])
          .filter((p) => p.modulo === modulo)
          .map((p) => p.accion)
          .join(', '),
      })),
    }));
  });

  /** Los permisos de GET /permisos agrupados por módulo, para las casillas del rol. */
  protected readonly grupos = computed(() => {
    const grupos = new Map<string, { clave: string; accion: string }[]>();
    for (const permiso of this.permisos()) {
      const lista = grupos.get(permiso.modulo) ?? [];
      lista.push({ clave: clave(permiso), accion: permiso.accion });
      grupos.set(permiso.modulo, lista);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([modulo, acciones]) => ({ modulo, acciones }));
  });

  ngOnInit(): void {
    this.servicio.listarRoles().subscribe((roles) => {
      this.roles.set(roles);
      if (roles[0]?.idRol !== undefined) {
        this.formRol.controls.idRol.setValue(roles[0].idRol);
        this.cargarRol();
      }
    });
    this.servicio.listar().subscribe((usuarios) => this.usuarios.set(usuarios));
    this.servicio.listarPermisos().subscribe((permisos) => {
      this.permisos.set(permisos);
      const casillas = this.formRol.controls.permisos;
      for (const permiso of permisos) {
        if (!casillas.contains(clave(permiso))) {
          casillas.addControl(clave(permiso), new FormControl(false, { nonNullable: true }));
        }
      }
      this.cargarRol();
    });
  }

  /** UsuarioDTO trae nombres, apellidos, nombreRol y ultimoAcceso (Duda 2, It. 2.1). */
  protected readonly nombreCompleto = nombreCompleto;

  protected nombreRol(usuario: UsuarioDTO): string {
    return nombreO(usuario.nombreRol, this.roles().find((r) => r.idRol === usuario.idRol)?.nombre);
  }

  protected nombrePersonal(persona: PersonalSinUsuarioDTO): string {
    return nombreCompleto(persona);
  }

  /** 16/11/2026 08:55 de una fecha-hora del back-end. */
  protected fechaHora(valor: string): string {
    const [anio, mes, dia] = valor.slice(0, 10).split('-');
    return `${dia}/${mes}/${anio} ${valor.slice(11, 16)}`.trim();
  }

  protected abrirRegistro(): void {
    this.formUsuario.reset();
    this.errorRegistro.set(null);
    this.modalAbierto.set(true);
    this.servicio.listarPersonalSinUsuario().subscribe((personal) => this.personal.set(personal));
  }

  protected registrar(): void {
    if (this.formUsuario.invalid) {
      this.errorRegistro.set(
        'Elige el personal, escribe el usuario y una clave de 8 a 72 caracteres, y elige el rol.',
      );
      return;
    }
    this.errorRegistro.set(null);
    this.enviando.set(true);
    this.servicio.registrar(this.formUsuario.getRawValue() as UsuarioDTO).subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        this.reemplazarFila(usuario);
        this.personal.update((lista) => lista.filter((p) => p.idPersonal !== usuario.idPersonal));
        this.modalAbierto.set(false);
        this.notificaciones.mostrar('Usuario registrado; debe cambiar su clave al entrar.');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // El 409 ya lo muestra el interceptor.
        if (error.status === 400) {
          this.errorRegistro.set(mensajeDelProblema(error, 'Revisa los datos del usuario.'));
        }
      },
    });
  }

  protected asignar(usuario: UsuarioDTO, idRol: number): void {
    if (usuario.idUsuario === undefined || idRol === usuario.idRol) {
      return;
    }
    if (this.esUltimaAdministradora(usuario)) {
      this.errorAsignacion.set(MENSAJE_RN48_ROL);
      return;
    }
    this.errorAsignacion.set(null);
    this.servicio.asignarRol(usuario.idUsuario, { idRol }).subscribe({
      next: (actualizado) => {
        this.reemplazarFila(actualizado);
        this.notificaciones.mostrar('Rol asignado.');
      },
      error: (error: HttpErrorResponse) => {
        // El 422 (RN48) también lo avisa el interceptor; aquí queda junto a la tabla.
        if (error.status === 404 || leerProblema(error)?.regla === 'RN48') {
          this.errorAsignacion.set(mensajeDelProblema(error, MENSAJE_RN48_ROL));
        }
      },
    });
  }

  protected cargarRol(): void {
    const rol = this.roles().find((r) => r.idRol === this.formRol.controls.idRol.value);
    if (!rol) {
      return;
    }
    this.errorRol.set(null);
    this.formRol.patchValue({ descripcion: rol.descripcion ?? '', estado: rol.estado });
    const tiene = new Set((rol.permisos ?? []).map(clave));
    const casillas = this.formRol.controls.permisos;
    for (const nombre of Object.keys(casillas.controls)) {
      casillas.controls[nombre].setValue(tiene.has(nombre));
    }
  }

  protected guardarPermisos(): void {
    const { idRol, descripcion, estado, permisos } = this.formRol.getRawValue();
    if (this.formRol.invalid || idRol === null) {
      this.errorRol.set('Elige el rol.');
      return;
    }
    const elegidos = this.permisos().filter((p) => permisos[clave(p)]);
    const nombre = this.roles().find((r) => r.idRol === idRol)?.nombre ?? '';
    if (
      nombre === ROL_ADMINISTRADORA &&
      PERMISOS_RN48.some((c) => !elegidos.some((p) => clave(p) === c))
    ) {
      this.errorRol.set(MENSAJE_RN48_PERMISOS);
      return;
    }
    const cuerpo: RolDTO = {
      nombre,
      descripcion,
      estado,
      permisos: elegidos.map((p) => ({ modulo: p.modulo, accion: p.accion })),
    };
    this.errorRol.set(null);
    this.enviando.set(true);
    this.servicio.configurarPermisos(idRol, cuerpo).subscribe({
      next: (rol) => {
        this.enviando.set(false);
        this.roles.update((roles) => roles.map((r) => (r.idRol === rol.idRol ? rol : r)));
        this.notificaciones.mostrar(
          'Permisos del rol guardados; valen desde el siguiente ingreso.',
        );
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (error.status === 404) {
          this.errorRol.set(mensajeDelProblema(error, 'El rol no existe.'));
        } else if (leerProblema(error)?.regla === 'RN48') {
          this.errorRol.set(mensajeDelProblema(error, MENSAJE_RN48_PERMISOS));
        }
      },
    });
  }

  /** Quitarle el rol a la única ADMINISTRADORA activa la dejaría sin seguridad (RN48). */
  private esUltimaAdministradora(usuario: UsuarioDTO): boolean {
    const idAdministradora = this.roles().find((r) => r.nombre === ROL_ADMINISTRADORA)?.idRol;
    if (idAdministradora === undefined || usuario.idRol !== idAdministradora) {
      return false;
    }
    const activas = this.usuarios().filter(
      (u) => u.idRol === idAdministradora && u.estado === 'ACTIVO',
    );
    return activas.length <= 1;
  }

  private reemplazarFila(usuario: UsuarioDTO): void {
    this.usuarios.update((filas) =>
      filas.some((f) => f.idUsuario === usuario.idUsuario)
        ? filas.map((f) => (f.idUsuario === usuario.idUsuario ? usuario : f))
        : [...filas, usuario],
    );
  }
}

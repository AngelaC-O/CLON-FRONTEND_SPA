import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { PERMISOS } from '../../../core/sesion/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { Modal } from '../../../layout/modal/modal';
import { PermisoDTO, RolDTO, UsuarioDTO } from '../../modelos/seguridad.modelos';
import { UsuariosService } from '../../servicios/usuarios.service';

/** IGU_Usuarios: CUS52 Registrar Usuario y CUS53 Asignar Rol. */
@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './usuarios.html',
})
export class Usuarios implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly notificaciones = inject(NotificacionesService);
  private readonly servicio = inject(UsuariosService);
  private readonly sesion = inject(SesionService);

  protected readonly pestana = signal<'usuarios' | 'permisos'>('usuarios');
  protected readonly roles = signal<RolDTO[]>([]);
  /** El contrato no tiene lista de usuarios: solo se ven los tocados en esta pantalla. */
  protected readonly usuarios = signal<UsuarioDTO[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly errorRegistro = signal<string | null>(null);
  protected readonly errorAsignacion = signal<string | null>(null);
  protected readonly errorRol = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly puedeCrear = computed(() => this.sesion.tienePermiso(PERMISOS.seguridadCrear));
  protected readonly puedeEditar = computed(() =>
    this.sesion.tienePermiso(PERMISOS.seguridadEditar),
  );

  protected readonly formUsuario = this.fb.group({
    idPersonal: [null as number | null, [Validators.required, Validators.min(1)]],
    nombreUsuario: ['', [Validators.required, Validators.maxLength(50)]],
    clave: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    idRol: [null as number | null, Validators.required],
  });
  protected readonly formAsignacion = this.fb.group({
    idUsuario: [null as number | null, [Validators.required, Validators.min(1)]],
    idRol: [null as number | null, Validators.required],
  });
  protected readonly formRol = this.fb.group({
    idRol: [null as number | null, Validators.required],
    descripcion: ['', Validators.maxLength(150)],
    estado: ['ACTIVO' as RolDTO['estado'], Validators.required],
    permisos: this.fb.array<ReturnType<Usuarios['nuevoPermiso']>>([]),
  });

  /** Filas de la matriz: cada módulo con las acciones que tiene cada rol. */
  protected readonly matriz = computed(() => {
    const roles = this.roles();
    const modulos = [...new Set(roles.flatMap((r) => (r.permisos ?? []).map((p) => p.modulo)))];
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
  protected readonly modulosConocidos = computed(() => this.valoresConocidos('modulo'));
  protected readonly accionesConocidas = computed(() => this.valoresConocidos('accion'));

  ngOnInit(): void {
    this.servicio.listarRoles().subscribe((roles) => {
      this.roles.set(roles);
      if (roles[0]?.idRol !== undefined) {
        this.formRol.controls.idRol.setValue(roles[0].idRol);
        this.cargarRol();
      }
    });
  }

  protected nombreRol(idRol?: number): string {
    return this.roles().find((r) => r.idRol === idRol)?.nombre ?? String(idRol ?? '');
  }

  protected abrirRegistro(): void {
    this.formUsuario.reset();
    this.errorRegistro.set(null);
    this.modalAbierto.set(true);
  }

  protected registrar(): void {
    if (this.formUsuario.invalid) {
      this.errorRegistro.set(
        'Completa el código del personal, el usuario, una clave de 8 a 72 caracteres y el rol.',
      );
      return;
    }
    this.errorRegistro.set(null);
    this.enviando.set(true);
    this.servicio.registrar(this.formUsuario.getRawValue() as UsuarioDTO).subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        this.agregarFila(usuario);
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

  protected asignarDesdeFormulario(): void {
    const { idUsuario, idRol } = this.formAsignacion.getRawValue();
    if (this.formAsignacion.invalid || idUsuario === null || idRol === null) {
      this.errorAsignacion.set('Indica el código del usuario y el rol.');
      return;
    }
    this.errorAsignacion.set(null);
    this.asignar(idUsuario, idRol);
  }

  protected asignar(idUsuario: number | undefined, idRol: number): void {
    if (idUsuario === undefined) {
      return;
    }
    this.servicio.asignarRol(idUsuario, { idRol }).subscribe({
      next: (usuario) => {
        this.agregarFila(usuario);
        this.formAsignacion.reset();
        this.notificaciones.mostrar('Rol asignado.');
      },
      error: (error: HttpErrorResponse) => {
        // Sin endpoint de lista, un código equivocado solo se descubre aquí.
        if (error.status === 404) {
          this.errorAsignacion.set(mensajeDelProblema(error, 'El usuario no existe.'));
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
    const permisos = this.formRol.controls.permisos;
    permisos.clear();
    (rol.permisos ?? []).forEach((p) => permisos.push(this.nuevoPermiso(p)));
  }

  protected agregarPermiso(): void {
    this.formRol.controls.permisos.push(this.nuevoPermiso());
  }

  protected quitarPermiso(indice: number): void {
    this.formRol.controls.permisos.removeAt(indice);
  }

  protected guardarPermisos(): void {
    const { idRol, descripcion, estado, permisos } = this.formRol.getRawValue();
    if (this.formRol.invalid || idRol === null) {
      this.errorRol.set('Cada permiso necesita módulo y acción.');
      return;
    }
    const cuerpo: RolDTO = {
      nombre: this.nombreRol(idRol),
      descripcion,
      estado,
      permisos: permisos.map((p) => ({
        modulo: p.modulo.trim().toUpperCase(),
        accion: p.accion.trim().toUpperCase(),
      })),
    };
    this.errorRol.set(null);
    this.enviando.set(true);
    this.servicio.configurarPermisos(idRol, cuerpo).subscribe({
      next: (rol) => {
        this.enviando.set(false);
        this.roles.update((roles) => roles.map((r) => (r.idRol === rol.idRol ? rol : r)));
        this.notificaciones.mostrar('Permisos del rol guardados.');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (error.status === 404) {
          this.errorRol.set(mensajeDelProblema(error, 'El rol no existe.'));
        }
      },
    });
  }

  private nuevoPermiso(permiso?: PermisoDTO) {
    return this.fb.group({
      modulo: [permiso?.modulo ?? '', [Validators.required, Validators.maxLength(40)]],
      accion: [permiso?.accion ?? '', [Validators.required, Validators.maxLength(30)]],
    });
  }

  private agregarFila(usuario: UsuarioDTO): void {
    this.usuarios.update((filas) => [
      usuario,
      ...filas.filter((f) => f.idUsuario !== usuario.idUsuario),
    ]);
  }

  private valoresConocidos(campo: keyof PermisoDTO): string[] {
    const valores = this.roles().flatMap((r) => (r.permisos ?? []).map((p) => p[campo]));
    return [...new Set(valores)].sort();
  }
}

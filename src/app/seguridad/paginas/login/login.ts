import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { mensajeDelProblema } from '../../../core/api/problema';
import { SesionService } from '../../../core/sesion/sesion.service';

/** IGU_Login, CUS50 Iniciar Sesión. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionService);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    nombreUsuario: ['', Validators.required],
    clave: ['', Validators.required],
  });
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected ingresar(): void {
    if (this.formulario.invalid) {
      this.error.set('Ingrese el usuario y la contraseña.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.sesion.iniciarSesion(this.formulario.getRawValue()).subscribe({
      next: (sesion) => {
        this.enviando.set(false);
        void this.router.navigateByUrl(sesion.debeCambiarClave ? '/cambio-clave' : '/');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // Sin conexión o 5xx ya los avisa el interceptor.
        if (error.status === 400 || error.status === 401 || error.status === 423) {
          this.error.set(mensajeDelProblema(error, 'No se pudo iniciar sesión.'));
        }
      },
    });
  }
}

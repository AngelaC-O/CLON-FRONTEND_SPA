import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { Modal } from '../../../layout/modal/modal';
import { UsuarioDTO } from '../../modelos/seguridad.modelos';
import { UsuariosService } from '../../servicios/usuarios.service';

/**
 * CUS54 Restablecer Contraseña («Restablecer contraseña»): la administradora escribe una clave
 * temporal de 8 a 72 caracteres. El usuario queda desbloqueado y debe cambiarla al entrar; la clave
 * no vuelve en la respuesta.
 */
@Component({
  selector: 'app-restablecer-clave',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal titulo="Restablecer contraseña" [angosto]="true" (cerrar)="cerrar.emit()">
      <form [formGroup]="formulario" (ngSubmit)="restablecer()">
        <div class="mb">
          <div class="mut sm">
            Usuario <b>{{ usuario().nombreUsuario }}</b
            >. Comunícale la clave temporal en persona: deberá cambiarla en su siguiente ingreso.
          </div>
          @if (error(); as mensaje) {
            <div class="alert bad" role="alert">{{ mensaje }}</div>
          }
          <div class="fld">
            <label class="lbl" for="claveTemporal">CLAVE TEMPORAL (8 A 72 CARACTERES)</label>
            <input
              class="inp"
              id="claveTemporal"
              type="password"
              autocomplete="new-password"
              maxlength="72"
              formControlName="clave"
            />
          </div>
          <div class="fld">
            <label class="lbl" for="claveTemporalRepetida">REPÍTELA</label>
            <input
              class="inp"
              id="claveTemporalRepetida"
              type="password"
              autocomplete="new-password"
              maxlength="72"
              formControlName="repetida"
            />
          </div>
        </div>
        <div class="mf">
          <button class="btn sec" type="button" (click)="cerrar.emit()">Cancelar</button>
          <button class="btn" type="submit" [disabled]="enviando()">Restablecer contraseña</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class RestablecerClave {
  private readonly servicio = inject(UsuariosService);

  readonly usuario = input.required<UsuarioDTO>();
  readonly cerrar = output<void>();
  readonly restablecido = output<UsuarioDTO>();

  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    clave: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    repetida: [''],
  });

  protected restablecer(): void {
    const { clave, repetida } = this.formulario.getRawValue();
    const idUsuario = this.usuario().idUsuario;
    if (this.formulario.invalid) {
      this.error.set('La clave temporal tiene de 8 a 72 caracteres.');
      return;
    }
    if (clave !== repetida) {
      this.error.set('Las dos claves no coinciden.');
      return;
    }
    if (idUsuario === undefined) {
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio.restablecerClave(idUsuario, clave).subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        this.formulario.reset();
        this.restablecido.emit(usuario);
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (error.status === 400 || error.status === 404) {
          this.error.set(mensajeDelProblema(error, 'No se pudo restablecer la contraseña.'));
        }
      },
    });
  }
}

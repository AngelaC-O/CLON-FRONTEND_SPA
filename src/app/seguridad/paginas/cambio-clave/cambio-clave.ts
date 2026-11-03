import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeDelProblema } from '../../../core/api/problema';
import { SesionService } from '../../../core/sesion/sesion.service';

/** Cambio de la clave propia (CUS50, DF-18: está en el contrato, no en el draw.io). */
@Component({
  selector: 'app-cambio-clave',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="login" style="grid-template-columns: 1fr">
      <div class="forma">
        <form class="card col" [formGroup]="formulario" (ngSubmit)="guardar()">
          <h1 class="h1">Cambiar clave</h1>
          @if (sesion.debeCambiarClave()) {
            <div class="alert warn" role="status">
              Debes cambiar tu clave antes de usar el sistema.
            </div>
          }
          @if (error(); as mensaje) {
            <div class="alert bad" role="alert">{{ mensaje }}</div>
          }
          <div class="fld">
            <label class="lbl" for="claveActual">CLAVE ACTUAL</label>
            <input
              class="inp"
              id="claveActual"
              type="password"
              formControlName="claveActual"
              autocomplete="current-password"
            />
          </div>
          <div class="fld">
            <label class="lbl" for="claveNueva">CLAVE NUEVA (8 A 72 CARACTERES)</label>
            <input
              class="inp"
              id="claveNueva"
              type="password"
              formControlName="claveNueva"
              autocomplete="new-password"
            />
          </div>
          <button class="btn blk" type="submit" [disabled]="enviando()">Cambiar clave</button>
          @if (sesion.debeCambiarClave()) {
            <button class="btn ghost blk" type="button" (click)="salir()">Salir</button>
          } @else {
            <a class="btn ghost blk" routerLink="/inicio">Volver al inicio</a>
          }
        </form>
      </div>
    </div>
  `,
})
export class CambioClave {
  private readonly router = inject(Router);
  protected readonly sesion = inject(SesionService);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    claveActual: ['', Validators.required],
    claveNueva: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected guardar(): void {
    if (this.formulario.invalid) {
      this.error.set('Ingrese la clave actual y una clave nueva de 8 a 72 caracteres.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.sesion.cambiarClave(this.formulario.getRawValue()).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        // El 422 de la regla ya lo muestra el interceptor.
        if (error.status === 400) {
          this.error.set(mensajeDelProblema(error, 'La clave nueva no es válida.'));
        }
      },
    });
  }

  protected salir(): void {
    const volver = () => void this.router.navigateByUrl('/login');
    this.sesion.cerrarSesion().subscribe({ next: volver, error: volver });
  }
}

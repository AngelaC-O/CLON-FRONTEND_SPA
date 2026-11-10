import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { CategoriaProductoDTO } from '../../modelos/inventario.modelos';
import { ProductosService } from '../../servicios/productos.service';

/** CUS66 Registrar Categoría de Producto («Guardar categoría»). El nombre es único (RF45). */
@Component({
  selector: 'app-categorias-producto',
  imports: [ReactiveFormsModule],
  template: `
    <div class="card col" style="max-width: 560px">
      <h2 class="h3">Categorías de producto</h2>
      @for (categoria of categorias(); track categoria.idCategoria) {
        <div class="row nw categoria">
          <span class="sp">{{ categoria.nombre }}</span>
          <span class="xs mut">{{ cantidad(categoria.idCategoria) }} producto(s)</span>
        </div>
      } @empty {
        <div class="mut sm">Aún no hay categorías.</div>
      }
      @if (puedeCrear()) {
        <form
          class="row nw"
          style="align-items: flex-end"
          [formGroup]="formulario"
          (ngSubmit)="guardar()"
        >
          <div class="fld sp">
            <label class="lbl" for="nuevaCategoria">NUEVA CATEGORÍA</label>
            <input class="inp" id="nuevaCategoria" maxlength="60" formControlName="nombre" />
          </div>
          <button class="btn" type="submit" [disabled]="enviando()">Guardar categoría</button>
        </form>
        @if (error(); as mensaje) {
          <div class="alert bad" role="alert">{{ mensaje }}</div>
        }
      }
    </div>
  `,
})
export class CategoriasProducto {
  private readonly servicio = inject(ProductosService);

  readonly categorias = input<CategoriaProductoDTO[]>([]);
  /** Productos por categoría, para mostrar cuántos tiene cada una. */
  readonly porCategoria = input<Record<number, number>>({});
  readonly puedeCrear = input(false);
  readonly creada = output<CategoriaProductoDTO>();

  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
  });

  protected cantidad(idCategoria?: number): number {
    return this.porCategoria()[idCategoria ?? 0] ?? 0;
  }

  protected guardar(): void {
    const nombre = this.formulario.getRawValue().nombre.trim();
    if (!nombre) {
      this.error.set('Escribe el nombre de la categoría.');
      return;
    }
    const repetida = this.categorias().some(
      (c) => c.nombre?.trim().toLowerCase() === nombre.toLowerCase(),
    );
    if (repetida) {
      this.error.set('Ya existe una categoría con ese nombre.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio.registrarCategoria(nombre).subscribe({
      next: (categoria) => {
        this.enviando.set(false);
        this.formulario.reset();
        this.creada.emit(categoria);
      },
      // El 409 del nombre repetido también lo avisa el interceptor.
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        if (error.status === 409 || error.status === 422 || error.status === 400) {
          this.error.set(mensajeDelProblema(error, 'No se pudo guardar la categoría.'));
        }
      },
    });
  }
}

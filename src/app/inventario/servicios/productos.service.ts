import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import { CategoriaProductoDTO, ProductoDTO } from '../modelos/inventario.modelos';

/** CUS32 y CUS66. La lista de categorías para leer está en core/api/listas.service.ts. */
@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  /** Productos e insumos con su stock de la sede; el margen solo viene para la Administradora (RN24). */
  listar(filtro: { nombre?: string; idCategoria?: number | null } = {}): Observable<ProductoDTO[]> {
    return this.http.get<ProductoDTO[]>(`${this.api}/productos`, { params: parametros(filtro) });
  }

  /** Nace con stock 0 en la sede; el precio sale del costo y el margen (RF87). */
  registrar(producto: ProductoDTO): Observable<ProductoDTO> {
    return this.http.post<ProductoDTO>(`${this.api}/productos`, producto);
  }

  registrarCategoria(nombre: string): Observable<CategoriaProductoDTO> {
    return this.http.post<CategoriaProductoDTO>(`${this.api}/categorias-producto`, { nombre });
  }
}

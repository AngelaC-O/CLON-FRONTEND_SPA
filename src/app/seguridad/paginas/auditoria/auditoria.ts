import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { mensajeDelProblema } from '../../../core/api/problema';
import { AuditoriaDTO, UsuarioDTO } from '../../modelos/seguridad.modelos';
import { UsuariosService } from '../../servicios/usuarios.service';

/** Fecha local como la pide el contrato (2026-11-09), desplazada en días. */
function fechaIso(desplazamientoDias = 0): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + desplazamientoDias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * IGU_Auditoria, nodo 4:245 (CUS55 Consultar Auditoría, SEGURIDAD:VER): quién creó, cambió o
 * anuló cada dato y cuándo. Filtros de usuario, módulo, entidad y fechas («Consultar»); por
 * defecto, los últimos 30 días. La auditoría solo admite inserción (RN29).
 */
@Component({
  selector: 'app-auditoria',
  imports: [ReactiveFormsModule],
  template: `
    <form
      class="card row"
      style="align-items: flex-end"
      [formGroup]="filtro"
      (ngSubmit)="consultar()"
    >
      <div class="fld">
        <label class="lbl" for="auditoriaUsuario">USUARIO</label>
        <select class="inp" id="auditoriaUsuario" formControlName="idUsuario">
          <option [ngValue]="null">Todos</option>
          @for (usuario of usuarios(); track usuario.idUsuario) {
            <option [ngValue]="usuario.idUsuario">{{ usuario.nombreUsuario }}</option>
          }
        </select>
      </div>
      <div class="fld">
        <label class="lbl" for="auditoriaModulo">MÓDULO</label>
        <input class="inp" id="auditoriaModulo" placeholder="Ej. Ventas" formControlName="modulo" />
      </div>
      <div class="fld">
        <label class="lbl" for="auditoriaEntidad">ENTIDAD</label>
        <input
          class="inp"
          id="auditoriaEntidad"
          placeholder="Ej. VENTA"
          formControlName="entidad"
        />
      </div>
      <div class="fld">
        <label class="lbl" for="auditoriaInicio">DESDE</label>
        <input class="inp" id="auditoriaInicio" type="date" formControlName="fechaInicio" />
      </div>
      <div class="fld">
        <label class="lbl" for="auditoriaFin">HASTA</label>
        <input class="inp" id="auditoriaFin" type="date" formControlName="fechaFin" />
      </div>
      <button class="btn" type="submit">Consultar</button>
    </form>

    @if (error(); as mensaje) {
      <div class="alert bad" role="alert">{{ mensaje }}</div>
    }

    @if (registros(); as lista) {
      <div class="card cp0 tw">
        <table class="tbl">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Módulo</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            @for (registro of lista; track registro.idAuditoria) {
              <tr>
                <td class="num">{{ fechaHora(registro.fechaHora) }}</td>
                <td>
                  <div>{{ registro.usuario }}</div>
                  <div class="xs mut">{{ registro.rol }}</div>
                </td>
                <td>{{ registro.modulo }}</td>
                <td>
                  <span class="chip">{{ registro.accion }}</span>
                </td>
                <td class="num">
                  {{ registro.entidad }}
                  @if (registro.idEntidad) {
                    N° {{ registro.idEntidad }}
                  }
                </td>
                <td class="sm">{{ registro.detalle }}</td>
              </tr>
            } @empty {
              <tr>
                <td class="vacio" colspan="6">No hay registros con esos filtros.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class Auditoria implements OnInit {
  private readonly servicio = inject(UsuariosService);

  /** Los usuarios de la página, para filtrar por nombre de usuario. */
  readonly usuarios = input<UsuarioDTO[]>([]);

  protected readonly registros = signal<AuditoriaDTO[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly filtro = inject(FormBuilder).nonNullable.group({
    idUsuario: [null as number | null],
    modulo: [''],
    entidad: [''],
    fechaInicio: [fechaIso(-30)],
    fechaFin: [fechaIso()],
  });

  ngOnInit(): void {
    this.consultar();
  }

  protected fechaHora(valor?: string): string {
    if (!valor) {
      return '';
    }
    const [anio, mes, dia] = valor.slice(0, 10).split('-');
    return `${dia}/${mes}/${anio} ${valor.slice(11, 16)}`;
  }

  protected consultar(): void {
    const { idUsuario, modulo, entidad, fechaInicio, fechaFin } = this.filtro.getRawValue();
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      this.error.set('La fecha de inicio es posterior a la de fin.');
      return;
    }
    this.error.set(null);
    this.servicio
      .consultarAuditoria({
        idUsuario,
        modulo: modulo.trim(),
        entidad: entidad.trim(),
        fechaInicio,
        fechaFin,
      })
      .subscribe({
        next: (registros) => this.registros.set(registros),
        error: (error: HttpErrorResponse) => {
          if (error.status === 400 || error.status === 422) {
            this.error.set(mensajeDelProblema(error, 'Revisa los filtros.'));
          }
        },
      });
  }
}

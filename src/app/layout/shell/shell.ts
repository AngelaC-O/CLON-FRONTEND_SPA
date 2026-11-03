import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import { Component, computed, inject, Injector } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SesionService } from '../../core/sesion/sesion.service';
import { agruparMenu, MENU } from '../menu';
import { MasModulos } from '../mas-modulos/mas-modulos';

const ITEMS_BARRA_INFERIOR = 4;

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly dialogo = inject(Dialog);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  protected readonly sesion = inject(SesionService);

  private readonly items = computed(() =>
    MENU.filter((item) => this.sesion.tienePermiso(...item.permisos)),
  );
  protected readonly grupos = computed(() => agruparMenu(this.items()));
  protected readonly barraInferior = computed(() => this.items().slice(0, ITEMS_BARRA_INFERIOR));
  protected readonly cajaVisible = computed(() =>
    this.items().some((item) => item.ruta === '/caja'),
  );
  protected readonly iniciales = computed(() =>
    (this.sesion.sesion()?.nombreUsuario ?? '')
      .split(/[.\s_-]+/)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join(''),
  );

  protected abrirMas(): void {
    this.dialogo.open(MasModulos, {
      data: this.grupos(),
      width: '100%',
      backdropClass: 'velo',
      positionStrategy: createGlobalPositionStrategy(this.injector).centerHorizontally().bottom(),
    });
  }

  protected salir(): void {
    const volver = () => void this.router.navigateByUrl('/login');
    this.sesion.cerrarSesion().subscribe({ next: volver, error: volver });
  }

  protected cambiarClave(): void {
    void this.router.navigateByUrl('/cambio-clave');
  }
}

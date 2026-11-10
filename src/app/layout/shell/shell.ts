import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import { Component, computed, inject, Injector, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CajaAbiertaService } from '../../core/sesion/caja-abierta.service';
import { PERMISOS } from '../../core/sesion/permisos';
import { SesionService } from '../../core/sesion/sesion.service';
import { agruparMenu, MENU } from '../menu';
import { MasModulos } from '../mas-modulos/mas-modulos';

const ITEMS_BARRA_INFERIOR = 4;

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  templateUrl: './shell.html',
})
export class Shell implements OnInit {
  private readonly dialogo = inject(Dialog);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  protected readonly sesion = inject(SesionService);
  protected readonly caja = inject(CajaAbiertaService);

  private readonly items = computed(() =>
    MENU.filter((item) => this.sesion.tienePermiso(...item.permisos)),
  );
  protected readonly grupos = computed(() => agruparMenu(this.items()));
  protected readonly barraInferior = computed(() => this.items().slice(0, ITEMS_BARRA_INFERIOR));
  /** El estado de la caja sale de GET /cajas/abierta, que pide CAJA:VER. */
  protected readonly cajaVisible = computed(() => this.sesion.tienePermiso(PERMISOS.cajaVer));
  protected readonly rol = computed(() => formatearRol(this.sesion.sesion()?.rol));
  protected readonly iniciales = computed(() =>
    this.sesion
      .nombreCompleto()
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join(''),
  );

  ngOnInit(): void {
    if (this.cajaVisible()) {
      this.caja.cargar().subscribe({ error: () => undefined });
    }
  }

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

/** «RECEPCIONISTA» → «Recepcionista». */
function formatearRol(rol: string | undefined): string {
  if (!rol) {
    return '';
  }
  const texto = rol.replace(/_/g, ' ').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

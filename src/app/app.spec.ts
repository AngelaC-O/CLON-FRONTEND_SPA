import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { NotificacionesService } from './core/notificaciones/notificaciones.service';
import { provideHttpClient } from '@angular/common/http';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('crea la aplicación sin aviso', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.toast')).toBeNull();
  });

  it('muestra los avisos de error como alerta', async () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(NotificacionesService).mostrar('Cruce de cita', 'error');
    await fixture.whenStable();
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('.toast.bad');
    expect(aviso?.textContent).toContain('Cruce de cita');
    expect(aviso?.getAttribute('role')).toBe('alert');
  });
});

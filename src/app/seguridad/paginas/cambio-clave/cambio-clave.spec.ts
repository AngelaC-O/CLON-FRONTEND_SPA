import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { CambioClave } from './cambio-clave';

describe('CambioClave', () => {
  let fixture: ComponentFixture<CambioClave>;
  let raiz: HTMLElement;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  const escribir = (id: string, valor: string) => {
    const entrada = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sessionStorage.setItem(
      'cautiva.sesion',
      JSON.stringify({ debeCambiarClave: true, nombreUsuario: 'carmen.soto', permisos: [] }),
    );
    TestBed.configureTestingModule({
      imports: [CambioClave],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(CambioClave);
    await fixture.whenStable();
    raiz = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('avisa que el cambio es obligatorio y ofrece salir', () => {
    expect(raiz.querySelector('.alert.warn')?.textContent).toContain('Debes cambiar tu clave');
    expect(raiz.querySelector('a.btn')).toBeNull();
    expect(raiz.textContent).toContain('Salir');
  });

  it('no llama al back-end con una clave corta', async () => {
    escribir('claveActual', 'Actual2026');
    escribir('claveNueva', 'corta');
    await enviar();
    http.expectNone('/api/v1/auth/cambio-clave');
    expect(raiz.querySelector('.alert.bad')?.textContent).toContain('8 a 72');
  });

  it('cambia la clave, quita el aviso y entra al sistema', async () => {
    escribir('claveActual', 'Actual2026');
    escribir('claveNueva', 'Nueva2026');
    await enviar();
    const peticion = http.expectOne('/api/v1/auth/cambio-clave');
    expect(peticion.request.body).toEqual({ claveActual: 'Actual2026', claveNueva: 'Nueva2026' });
    peticion.flush(null);
    await fixture.whenStable();
    expect(navegar).toHaveBeenCalledWith('/');
    expect(raiz.querySelector('.alert.warn')).toBeNull();
  });
});

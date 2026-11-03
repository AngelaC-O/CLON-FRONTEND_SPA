import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Envía la cookie de sesión en las llamadas al back-end. El XSRF lo agrega withXsrfConfiguration. */
export const credencialesInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.url.startsWith(environment.apiBase) ? req.clone({ withCredentials: true }) : req);

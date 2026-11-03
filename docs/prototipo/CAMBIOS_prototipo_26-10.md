# Prototipo Cautiva Spa BackOffice — cambios del 26/10/2026

Fuente: caso pulido, matriz (47 RN, 31 RES, 67 CUS) y diccionario v4. Ninguna pantalla agrega tablas, columnas ni actores fuera de esos artefactos.

## Reglas aplicadas en todas las pantallas
- IGV 0 % (Amazonía, RN06): ya no hay desglose de IGV 18 %.
- Izipay: Yape y Plin por QR, tarjeta y adelantos por enlace de pago; un pago digital solo cuenta cuando Izipay lo aprueba (RN42).
- APISPERU: boleta/factura/nota de crédito a SUNAT (series B001, F001, BC01, FC01) y consulta de DNI/RUC con marca VERIFICADO o MANUAL (RN45). En la demo, un DNI o RUC que termina en 0 simula que la consulta falla.
- Cinco áreas fijas: Peluquería y Estilismo, Manicura y Pedicura, Depilación (Salón); Cuidado Facial, Cabina Spa (Spa).
- Cada recurso tiene su propio tiempo de limpieza (0 a 30 min, RN03).
- Cada fila del mapa de 67 CUS abre la pantalla y la pestaña de ese caso de uso.

## Por pantalla
- **Login y mapa**: cierre por 30 min de inactividad, bloqueo a los 5 intentos, mapa de 67 CUS con filtros (primarios, secundarios, versión 2).
- **Agenda** (CUS05–CUS10): lista de espera con fecha y rango de horas; adelanto en efectivo, QR Izipay o enlace de pago (la cita queda reservada hasta que Izipay confirma); limpieza por recurso.
- **Clientas** (CUS01–CUS04): consulta de DNI, RUC aparte para factura, consentimiento obligatorio con fecha (Ley 29733), teléfono único, movimientos del saldo a favor.
- **Atención sin cita** (CUS13): nombre del cliente de paso, duración exacta, solo especialistas del área.
- **Atención en curso** (CUS11–CUS12): bloqueo si el tiempo cruza la cita siguiente (RN41), recomendación de producto, aviso de comisión o sesión de paquete.
- **Cobros y comprobantes** (CUS18–CUS24): pagos Izipay con QR o enlace, boleta/factura con consulta DNI/RUC, estado SUNAT, entrega por correo o WhatsApp, anulación con autorización, nota de crédito y devolución por el mismo medio o saldo a favor.
- **Venta de productos** (CUS25–CUS26): solo productos de venta, recomendaciones del día, «recomendado por».
- **Caja** (CUS44–CUS46): montos digitales tomados de Izipay, aviso de comprobantes pendientes, cierre con diferencia que aprueba la Administradora.
- **Productos e insumos y Kardex** (CUS32–CUS35, CUS66): uso venta/insumo, precio por margen (50 % o 100 % premium), categorías, salida de insumos y ajuste por conteo.
- **Compras y proveedores** (CUS28–CUS31): requerimientos CS-### (tipo, prioridad, aprobación), proveedores con consulta de RUC, compra con factura que entra al kardex.
- **Catálogo y configuración** (CUS57–CUS63, CUS65): recursos con tipo y limpieza, medios de pago, series, parámetros con vigencia.
- **Personal** (CUS36–CUS38): consulta de DNI, horario, aviso (no bloqueo) de sueldo menor a la RMV, desactivar deja el usuario INACTIVO.
- **Asistencia** (CUS39–CUS40): entrada, almuerzo y salida; solicitudes de corrección que aprueba la Administradora (o corrige directamente).
- **Planilla** (CUS41–CUS43): descuento por faltas y por tardanzas, RMV solo como aviso, recibo de pago, estado CALCULADA/BLOQUEADA.
- **Recordatorios y membresías** (CUS14–CUS16): canal y estado ENVIADO/FALLIDO, clientas inactivas por ciclo, membresía cobrada como paquete.
- **Reportes** (CUS48–CUS49): medios de pago, comprobantes para la contadora, costo y margen por servicio y por producto, demanda.
- **Conciliación** (CUS47): ventas vs. comprobantes aceptados por SUNAT (con NC) vs. transacciones, comisión y abono de Izipay.
- **Usuarios y seguridad** (CUS52–CUS56): estado ACTIVO/INACTIVO/BLOQUEADO, cambio de clave obligatorio, auditoría, incidentes con plazo de 48 h.
- **Sedes y canales** (CUS64, CUS17/27/67 en v2): horario 09:00–20:00, canales RESERVA/TIENDA y pago del adelanto con Izipay.
- **Inicio**: pendientes reales (SUNAT, enlaces de pago, lista de espera, cierre por aprobar, stock, requerimientos, incidentes).

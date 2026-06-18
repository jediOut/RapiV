# Ficha Google Play - RapiV Repartidor

Documento listo para copiar en Play Console para la app Android de repartidores.

## Build

- App: RapiV Repartidor
- Package name: `com.rapiv.courier`
- Version: `1.0.1`
- Version code: `3`
- AAB: `artifacts/android/repartidor-frontend/repartidor-frontend-google-play-test-20260616-173647.aab`
- Perfil de build: `google-play-test`
- Track sugerido: prueba interna

## Detalles de la app

### Nombre de la app

RapiV Repartidor

### Descripcion corta

Acepta entregas, sigue rutas y administra tu saldo RapiV.

### Descripcion completa

RapiV Repartidor es la app para repartidores que realizan entregas dentro de RapiV.

La app permite recibir ofertas de entrega, aceptar pedidos disponibles, seguir el flujo de entrega y administrar los pagos asociados a la operacion.

Con RapiV Repartidor puedes:

- Crear o iniciar sesion en tu cuenta de repartidor.
- Activar tu disponibilidad para recibir ofertas.
- Ver pedidos disponibles para entrega.
- Aceptar entregas asignadas.
- Consultar direcciones y rutas de entrega.
- Actualizar el estado del pedido durante el recorrido.
- Conectar tu cuenta para recibir pagos de reparto.
- Recargar saldo RapiV para operar pedidos con pago en efectivo.
- Pagar desde tu saldo las ordenes en efectivo al momento de entregarlas.

Para proteger la operacion, algunas funciones pueden requerir cuenta conectada, saldo suficiente y permisos de ubicacion. La disponibilidad de entregas depende de la zona, demanda y configuracion operativa de RapiV.

RapiV Repartidor no ofrece prestamos, banca, inversion, criptoactivos, transferencias de dinero entre usuarios ni asesoria financiera. El saldo RapiV se usa solo como herramienta operativa para liquidar pedidos en efectivo dentro de la plataforma y no esta disenado para compras externas ni transferencias entre usuarios.

### Novedades

Primera version de RapiV Repartidor para pruebas en Google Play.

## Categoria y datos generales

- Categoria: Business
- Ads: No contiene anuncios.
- App gratuita o de pago: Gratuita.
- Publico objetivo: 18 anos o mas.
- Paises sugeridos para prueba: Mexico.
- Contenido generado por usuarios visible publicamente: No.
- Compras dentro de la app: No declarar como compras digitales. Los pagos o recargas operativas no desbloquean contenido digital de consumo.

## Contacto y URLs

- Politica de privacidad: `https://13-222-167-88.sslip.io/api/legal/privacidad-repartidor`
- Eliminacion de cuenta: `https://13-222-167-88.sslip.io/api/legal/eliminacion-cuenta-repartidor`
- Correo de soporte: confirmar correo publico real. El backend usa `LEGAL_CONTACT_EMAIL` o `contacto@rapiv.app`.
- Sitio web: confirmar URL publica real.

> Para produccion conviene reemplazar el dominio de staging por un dominio HTTPS estable.

## App access

La app requiere iniciar sesion con Google. No hay usuario y contrasena local para revision.

Texto sugerido para Play Console:

```text
La app requiere inicio de sesion con Google. No existe acceso con correo y contrasena local.

Para revisar la app, presionen "Continuar con Google" e inicien sesion con una cuenta Google disponible para pruebas. El flujo crea o valida el perfil de repartidor dentro del ambiente de prueba y permite revisar disponibilidad, ofertas, entregas y saldo.
```

## Declaracion de servicios financieros

Texto sugerido si Google Play pregunta por funciones financieras:

```text
RapiV Repartidor no ofrece prestamos, credito, banca, inversion, criptoactivos, seguros, transferencias de dinero entre usuarios ni asesoria financiera.

La app permite a repartidores consultar pagos operativos por entregas y, cuando aplica, conectar una cuenta externa mediante Stripe Connect para recibir pagos de reparto. Los datos bancarios completos se capturan directamente por Stripe.

El saldo RapiV se usa solo como herramienta operativa para liquidar pedidos pagados en efectivo dentro de la plataforma. No es una cuenta bancaria, no genera rendimientos, no permite compras externas y no permite transferencias entre usuarios.
```

## Data safety - borrador

### Datos que puede recopilar

- Informacion personal: nombre, correo electronico, telefono.
- Ubicacion: ubicacion aproximada o precisa durante disponibilidad y entregas.
- Actividad en la app: ofertas recibidas, entregas aceptadas, estados de pedido y actividad operativa.
- Informacion financiera limitada: identificadores y estado de cuenta conectada con el proveedor de pagos, recargas y movimientos de saldo RapiV.
- Identificadores: identificador de usuario, perfil de repartidor y token de notificaciones push.
- Informacion de app y rendimiento: datos tecnicos, diagnostico, errores e informacion necesaria para seguridad y soporte.

### Uso principal

- Asignacion y gestion de entregas.
- Navegacion y seguimiento operativo.
- Pagos de reparto, recargas y liquidacion de ordenes en efectivo.
- Notificaciones relacionadas con ofertas y entregas.
- Seguridad, prevencion de fraude, soporte y cumplimiento legal.

### Compartir datos

- Google puede procesar datos necesarios para inicio de sesion, mapas o servicios relacionados.
- Stripe puede procesar datos necesarios para pagos, cuentas conectadas, verificacion y liquidaciones.
- Expo u otros proveedores pueden procesar tokens y datos necesarios para notificaciones push.
- Proveedores de infraestructura pueden procesar datos tecnicos necesarios para operar el servicio.

### Pagos

- Los datos completos de tarjeta o cuenta bancaria se procesan directamente por Stripe u otro proveedor externo.
- RapiV puede almacenar identificadores de transaccion, estado de pagos, saldo interno y referencias operativas.

## Activos para Store listing

### Icono

`docs/google-play-assets/rapiv-repartidor-icon-512-no-text.png`

### Grafico de funciones

`docs/google-play-assets/rapiv-repartidor-feature-graphic-1024x500.png`

### Capturas de telefono

- `docs/google-play-assets/screenshots/phone/repartidor/google-ready-redacted/01-login-google.jpg`
- `docs/google-play-assets/screenshots/phone/repartidor/google-ready-redacted/02-entregas-censurado.jpg`
- `docs/google-play-assets/screenshots/phone/repartidor/google-ready-redacted/03-historial-vacio.jpg`
- `docs/google-play-assets/screenshots/phone/repartidor/google-ready-redacted/04-perfil-censurado.jpg`

## Pendientes antes de enviar

1. Confirmar correo publico de soporte.
2. Confirmar que Google Play pueda usar una cuenta Google para revision.
3. Confirmar que las URLs legales esten desplegadas en staging o produccion.
4. Confirmar si se publicara solo en Mexico.
5. Confirmar que el publico objetivo sera 18+.

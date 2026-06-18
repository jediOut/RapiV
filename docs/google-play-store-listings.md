# Fichas Google Play - RapiV

Este documento contiene borradores para completar Play Console de las tres apps Android de RapiV.

## Datos base

| App | Package name | Nombre Play |
| --- | --- | --- |
| Cliente | `com.rapiv.client` | RapiV Cliente |
| Negocios | `com.rapiv.business` | RapiV Negocios |
| Repartidor | `com.rapiv.courier` | RapiV Repartidor |

## Iconos para Play Console

Google Play pide un icono de tienda por app. Usa estos PNG generados desde los iconos actuales de cada app:

| App | Icono Play Console |
| --- | --- |
| Cliente | `docs/google-play-assets/rapiv-cliente-icon-512.png` |
| Negocios | `docs/google-play-assets/rapiv-negocios-icon-512-no-text.png` |
| Repartidor | `docs/google-play-assets/rapiv-repartidor-icon-512-no-text.png` |

Los iconos internos del build ya estan configurados en cada `app.json`:

- Cliente: `cliente-frontend/assets/icon.png` y `cliente-frontend/assets/adaptive-icon.png`
- Negocios: `negocio-frontend/assets/icon.png` y `negocio-frontend/assets/adaptive-icon.png`
- Repartidor: `repartidor-frontend/assets/icon.png` y `repartidor-frontend/assets/adaptive-icon.png`

Si se quiere usar el icono rojo con torre, usa estas versiones ya recortadas y ampliadas:

- Play Console 512x512: `docs/google-play-assets/rapiv-custom-tower-icon-512.png`
- Version grande 1024x1024: `docs/google-play-assets/rapiv-custom-tower-icon-1024.png`

## Graficos de funciones

El grafico de funciones no es una captura de pantalla. Es un banner promocional de la ficha de Google Play y debe medir `1024x500`.

Usa estos archivos:

| App | Grafico de funciones |
| --- | --- |
| Cliente | `docs/google-play-assets/rapiv-cliente-feature-graphic-1024x500.png` |
| Negocios | `docs/google-play-assets/rapiv-negocios-feature-graphic-1024x500.png` |
| Repartidor | `docs/google-play-assets/rapiv-repartidor-feature-graphic-1024x500.png` |
| Generico torre roja | `docs/google-play-assets/rapiv-torre-feature-graphic-clean-1024x500.png` |

## Capturas de telefono

Google Play pide entre 2 y 8 capturas por app. Estas capturas miden `1080x1920`, usan relacion `9:16` y pesan menos de 8 MB.

Cliente:

- `docs/google-play-assets/screenshots/phone/cliente/google-ready-no-status/01-login-cliente.jpg`
- `docs/google-play-assets/screenshots/phone/cliente/google-ready-no-status/02-inicio-productos.jpg`
- `docs/google-play-assets/screenshots/phone/cliente/google-ready-no-status/03-carrito-tarjeta.jpg`
- `docs/google-play-assets/screenshots/phone/cliente/google-ready-no-status/04-carrito-efectivo-envio.jpg`
- `docs/google-play-assets/screenshots/phone/cliente/google-ready-no-status/05-pickup-efectivo.jpg`
- `docs/google-play-assets/screenshots/phone/cliente/google-ready-no-status/06-pedidos-activos.jpg`
- `docs/google-play-assets/screenshots/phone/cliente/google-ready-no-status/07-detalle-pedido.jpg`
- `docs/google-play-assets/screenshots/phone/cliente/google-ready-no-status/08-historial-vacio.jpg`

Negocios:

- `docs/google-play-assets/screenshots/phone/negocios/google-ready-no-status/01-login-negocios.jpg`
- `docs/google-play-assets/screenshots/phone/negocios/google-ready-no-status/02-panel-negocios.jpg`
- `docs/google-play-assets/screenshots/phone/negocios/google-ready-no-status/03-pedidos-negocios.jpg`
- `docs/google-play-assets/screenshots/phone/negocios/google-ready-no-status/04-menu-negocios.jpg`
- `docs/google-play-assets/screenshots/phone/negocios/google-ready-no-status/05-agregar-producto-negocios.jpg`
- `docs/google-play-assets/screenshots/phone/negocios/google-ready-no-status/06-ajustes-negocios.jpg`
- `docs/google-play-assets/screenshots/phone/negocios/google-ready-no-status/07-ajustes-ubicacion-negocios.jpg`

Repartidor:

- `docs/google-play-assets/screenshots/phone/repartidor/google-ready-redacted/01-login-google.jpg`
- `docs/google-play-assets/screenshots/phone/repartidor/google-ready-redacted/02-entregas-censurado.jpg`
- `docs/google-play-assets/screenshots/phone/repartidor/google-ready-redacted/03-historial-vacio.jpg`
- `docs/google-play-assets/screenshots/phone/repartidor/google-ready-redacted/04-perfil-censurado.jpg`

## Datos generales recomendados

- Ads: No contiene anuncios.
- App gratuita o de pago: Gratuita.
- Target audience: 18 anos o mas.
- Categoria Cliente: Food & Drink.
- Categoria Negocios: Business.
- Categoria Repartidor: Business.
- Declaracion de servicios financieros Cliente: RapiV Cliente no ofrece prestamos, banca, inversion, criptoactivos, billetera digital, transferencia de dinero entre usuarios ni asesoria financiera. Los pagos son solo para comprar productos locales y/o servicios de entrega dentro de la app.
- Politica de privacidad Cliente: `https://13-222-167-88.sslip.io/api/legal/privacidad-cliente`
- Eliminacion de cuenta Cliente: `https://13-222-167-88.sslip.io/api/legal/eliminacion-cuenta-cliente`
- Politica de privacidad Negocios: `https://13-222-167-88.sslip.io/api/legal/privacidad-negocio`
- Eliminacion de cuenta Negocios: `https://13-222-167-88.sslip.io/api/legal/eliminacion-cuenta-negocio`
- Politica de privacidad Repartidor: `https://13-222-167-88.sslip.io/api/legal/privacidad-repartidor`
- Eliminacion de cuenta Repartidor: `https://13-222-167-88.sslip.io/api/legal/eliminacion-cuenta-repartidor`
- Correo de soporte pendiente: confirmar correo publico real.
- Sitio web pendiente: confirmar URL publica real.

> Nota: para produccion conviene usar dominio HTTPS estable en lugar del IP de staging.

## RapiV Cliente

### Nombre de la app

RapiV Cliente

### Descripcion corta

Pide en negocios locales y sigue tu entrega en tiempo real.

### Descripcion completa

RapiV Cliente te permite hacer pedidos a negocios locales desde tu telefono y dar seguimiento a tus entregas dentro de la zona de servicio.

Con RapiV Cliente puedes:

- Explorar negocios y productos disponibles.
- Agregar productos al carrito y crear pedidos.
- Elegir tarjeta o efectivo para pagar productos y entregas cuando este disponible.
- Consultar el estado de tus pedidos.
- Compartir tu ubicacion de entrega para que el repartidor pueda llegar contigo.
- Recibir notificaciones relacionadas con tu pedido.

La app esta disenada para conectar clientes, negocios y repartidores en un flujo simple: el cliente pide, el negocio prepara y el repartidor entrega.

RapiV no ofrece servicios bancarios, prestamos, inversiones, criptoactivos, billeteras digitales ni transferencias de dinero entre usuarios. RapiV no almacena los datos completos de tu tarjeta; las tarjetas se usan solo para pagar pedidos de productos locales y servicios de entrega. La disponibilidad de negocios, productos, metodos de pago y entregas puede variar segun la zona de operacion.

### Novedades

Primera version de RapiV Cliente para pruebas en Google Play.

### App access

La app requiere iniciar sesion. Para revision de Google Play, crear y proporcionar una cuenta de prueba de cliente.

Texto sugerido:

```text
La app requiere inicio de sesion. Pueden usar la siguiente cuenta de prueba:
Correo: [correo de prueba]
Contrasena: [contrasena de prueba]
Esta cuenta tiene acceso a las funciones principales de cliente en ambiente de prueba.
```

### Data safety - borrador

Datos que puede recopilar:

- Informacion personal: nombre, correo electronico, telefono.
- Ubicacion: ubicacion aproximada o precisa para entregas.
- Actividad en la app: pedidos, productos consultados, interacciones operativas.
- Informacion de app y rendimiento: datos tecnicos necesarios para operar y diagnosticar el servicio.
- Identificadores: identificador de usuario y token de notificaciones push.

Uso principal:

- Operacion de pedidos y entregas.
- Autenticacion y administracion de cuenta.
- Notificaciones relacionadas con pedidos.
- Prevencion de fraude, seguridad y soporte.
- Cumplimiento legal y resolucion de disputas.

Pagos:

- Los datos completos de tarjeta se procesan por Stripe u otro proveedor de pago externo.
- RapiV no debe declarar que almacena numeros completos de tarjeta si no los guarda en backend.

## RapiV Negocios

### Nombre de la app

RapiV Negocios

### Descripcion corta

Administra pedidos, menu y ventas de tu negocio en RapiV.

### Descripcion completa

RapiV Negocios es la app para comercios que venden dentro de RapiV.

Desde la app puedes administrar la operacion diaria de tu negocio, recibir pedidos y mantener actualizado tu menu para los clientes.

Con RapiV Negocios puedes:

- Registrar y administrar el perfil de tu negocio.
- Configurar la ubicacion del comercio.
- Crear, editar y activar productos del menu.
- Subir imagenes de productos.
- Recibir y consultar pedidos.
- Actualizar el estado de preparacion.
- Revisar ventas y liquidaciones relacionadas con RapiV.
- Conectar tu cuenta para recibir pagos cuando aplique.

RapiV Negocios ayuda a centralizar la venta local en un flujo claro: el cliente pide, el negocio prepara y RapiV coordina la entrega con repartidores disponibles.

La disponibilidad de pagos, entregas y liquidaciones depende de la configuracion del negocio, la zona de servicio y los proveedores de pago conectados.

### Novedades

Primera version de RapiV Negocios para pruebas en Google Play.

### App access

La app requiere iniciar sesion con una cuenta de negocio.

Texto sugerido:

```text
La app requiere inicio de sesion. Pueden usar la siguiente cuenta de prueba:
Correo: [correo de prueba negocio]
Contrasena: [contrasena de prueba]
Esta cuenta tiene un negocio de prueba asociado para revisar pedidos, menu y configuracion.
```

### Data safety - borrador

Datos que puede recopilar:

- Informacion personal: nombre del responsable, correo electronico, telefono.
- Informacion del negocio: nombre comercial, direccion, ubicacion, productos, precios e imagenes.
- Actividad en la app: pedidos, ventas, cambios de menu y estados operativos.
- Fotos o archivos: imagenes de productos subidas por el negocio.
- Informacion financiera limitada: identificadores y estado de cuenta conectada con el proveedor de pagos.
- Identificadores: identificador de usuario, negocio y token de notificaciones push.

Uso principal:

- Administracion de cuenta y negocio.
- Publicacion de menu y productos.
- Gestion de pedidos.
- Liquidaciones, comisiones y pagos.
- Notificaciones operativas.
- Seguridad, soporte y cumplimiento legal.

Pagos:

- Los datos bancarios completos se capturan directamente por Stripe u otro proveedor de pago externo.
- RapiV puede almacenar identificadores y estado de la cuenta conectada, no los datos bancarios completos.

## RapiV Repartidor

> Ficha lista para copiar: `docs/google-play-listing-rapiv-repartidor.md`

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

### Novedades

Primera version de RapiV Repartidor para pruebas en Google Play.

### App access

La app requiere iniciar sesion con Google. No hay usuario y contrasena local para revision.

Texto sugerido:

```text
La app requiere inicio de sesion con Google. No existe acceso con correo y contrasena local.

Para revisar la app, presionen "Continuar con Google" e inicien sesion con una cuenta Google disponible para pruebas. El flujo crea o valida el perfil de repartidor dentro del ambiente de prueba y permite revisar disponibilidad, ofertas, entregas y saldo.
```

### Data safety - borrador

Datos que puede recopilar:

- Informacion personal: nombre, correo electronico, telefono.
- Ubicacion: ubicacion aproximada o precisa durante disponibilidad y entregas.
- Actividad en la app: ofertas recibidas, entregas aceptadas, estados de pedido y actividad operativa.
- Informacion financiera limitada: identificadores y estado de cuenta conectada con el proveedor de pagos, recargas y movimientos de saldo RapiV.
- Identificadores: identificador de usuario, perfil de repartidor y token de notificaciones push.

Uso principal:

- Asignacion y gestion de entregas.
- Navegacion y seguimiento operativo.
- Pagos de reparto, recargas y liquidacion de ordenes en efectivo.
- Notificaciones relacionadas con ofertas y entregas.
- Seguridad, prevencion de fraude, soporte y cumplimiento legal.

Pagos:

- Los datos completos de tarjeta o cuenta bancaria se procesan directamente por Stripe u otro proveedor de pago externo.
- RapiV puede almacenar identificadores de transaccion, estado de pagos, saldo interno y referencias operativas.

## Preguntas para completar antes de enviar

1. Correo publico de soporte para Play Console.
2. URL publica HTTPS para politica de privacidad y eliminacion de cuenta.
3. Cuentas de prueba para Google Play por app.
4. Confirmar si las apps se publicaran solo en Mexico.
5. Confirmar si el target sera 18+ para las tres apps.
6. Confirmar si alguna app tendra anuncios. El borrador asume que no.
7. Confirmar si alguna app permite contenido generado por usuarios visible publicamente. El borrador asume que no.
8. Confirmar si ya existe razon social/desarrollador publico para usar en datos de contacto.

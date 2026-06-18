import { Controller, Get, Header } from "@nestjs/common";

import { Public } from "./common/auth/public.decorator";

const effectiveDate = "2026-06-12";

function legalContactEmail() {
  return process.env.LEGAL_CONTACT_EMAIL?.trim() || "contacto@rapiv.app";
}

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function legalPage(title: string, body: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.55;
      color: #111827;
      background: #f8fafc;
    }
    body {
      margin: 0;
      padding: 32px 16px;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 28px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 30px;
      line-height: 1.2;
    }
    h2 {
      margin-top: 28px;
      font-size: 20px;
    }
    p, li {
      font-size: 15px;
    }
    .meta {
      color: #4b5563;
      margin-top: 0;
    }
    a {
      color: #2563eb;
    }
  </style>
</head>
<body>
  <main>
${body}
  </main>
</body>
</html>`;
}

@Controller("legal")
export class LegalController {
  @Public()
  @Get("privacidad-cliente")
  @Header("Content-Type", "text/html; charset=utf-8")
  customerPrivacy() {
    const contactEmail = legalContactEmail();

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Politica de privacidad - RapiV Cliente</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.55;
      color: #111827;
      background: #f8fafc;
    }
    body {
      margin: 0;
      padding: 32px 16px;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 28px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 30px;
      line-height: 1.2;
    }
    h2 {
      margin-top: 28px;
      font-size: 20px;
    }
    p, li {
      font-size: 15px;
    }
    .meta {
      color: #4b5563;
      margin-top: 0;
    }
    a {
      color: #2563eb;
    }
  </style>
</head>
<body>
  <main>
    <h1>Politica de privacidad - RapiV Cliente</h1>
    <p class="meta">Fecha de entrada en vigor: ${effectiveDate}</p>

    <p>
      Esta politica explica como RapiV trata la informacion de los usuarios de la aplicacion RapiV Cliente.
      La app permite encontrar negocios locales, realizar pedidos, elegir entrega o recoleccion, pagar pedidos y consultar el estado del servicio.
    </p>

    <h2>1. Informacion que recopilamos</h2>
    <p>Podemos recopilar las siguientes categorias de datos cuando usas RapiV Cliente:</p>
    <ul>
      <li>Datos de cuenta: nombre, correo electronico, identificador de usuario y telefono.</li>
      <li>Datos de ubicacion y entrega: direccion o referencia de entrega, latitud y longitud usadas para crear y dar seguimiento a pedidos.</li>
      <li>Datos de pedidos: negocios consultados, productos agregados, historial de pedidos, estado del pedido, metodo de entrega, metodo de pago y montos.</li>
      <li>Datos de pagos: estado de pago, monto, moneda, identificadores de transaccion y datos necesarios para confirmar pagos o reembolsos. RapiV no almacena numeros completos de tarjeta.</li>
      <li>Calificaciones y comentarios: valoraciones que el usuario envie sobre negocios, pedidos o repartidores.</li>
      <li>Datos tecnicos: token de notificaciones push, informacion de sesion, registros de errores, diagnostico y datos necesarios para seguridad y soporte.</li>
    </ul>

    <h2>2. Como usamos la informacion</h2>
    <p>Usamos los datos para:</p>
    <ul>
      <li>Crear y administrar cuentas de usuario.</li>
      <li>Procesar pedidos, entregas, pagos, cancelaciones y reembolsos.</li>
      <li>Mostrar negocios, productos, estado de pedido y ubicacion relacionada con la entrega.</li>
      <li>Enviar notificaciones relacionadas con la cuenta, pedidos y entregas.</li>
      <li>Prevenir fraude, abuso, errores operativos y accesos no autorizados.</li>
      <li>Dar soporte, diagnosticar problemas y mejorar el funcionamiento de la app.</li>
      <li>Cumplir obligaciones legales y resolver disputas.</li>
    </ul>

    <h2>3. Login con Google</h2>
    <p>
      RapiV Cliente permite iniciar sesion con Google. Al usar este metodo, recibimos datos basicos autorizados por Google,
      como correo electronico, nombre e identificador necesario para autenticar la cuenta.
    </p>

    <h2>4. Ubicacion</h2>
    <p>
      La app solicita ubicacion cuando el usuario elige entrega a domicilio o necesita confirmar una direccion de entrega.
      La ubicacion se usa para validar la zona de servicio, crear el pedido y facilitar la entrega.
    </p>

    <h2>5. Pagos</h2>
    <p>
      Los pagos con tarjeta se procesan mediante proveedores externos autorizados, como Stripe.
      RapiV puede almacenar identificadores de transaccion, estado del pago, monto y datos necesarios para soporte,
      pero no almacena numeros completos de tarjeta ni codigos de seguridad.
    </p>

    <h2>6. Terceros y proveedores</h2>
    <p>Podemos usar proveedores para operar funciones de la app, incluyendo:</p>
    <ul>
      <li>Google, para inicio de sesion, mapas o servicios relacionados.</li>
      <li>Stripe u otros proveedores de pago, para procesar pagos y reembolsos.</li>
      <li>Expo u otros servicios de notificaciones, para enviar avisos push.</li>
      <li>Proveedores de infraestructura, base de datos, monitoreo y alojamiento.</li>
    </ul>
    <p>
      Estos proveedores procesan informacion necesaria para prestar el servicio o cumplir obligaciones legales.
    </p>

    <h2>7. Seguridad</h2>
    <p>
      Usamos medidas tecnicas razonables para proteger la informacion, incluyendo transmision cifrada mediante HTTPS
      y almacenamiento de sesion en mecanismos seguros del dispositivo cuando estan disponibles.
      Ningun sistema es completamente infalible, pero trabajamos para reducir riesgos de acceso no autorizado.
    </p>

    <h2>8. Conservacion</h2>
    <p>
      Conservamos informacion mientras sea necesaria para operar la cuenta, procesar pedidos, cumplir obligaciones legales,
      prevenir fraude, resolver disputas o dar soporte. Algunos datos pueden conservarse por periodos mayores cuando la ley
      o necesidades operativas lo requieran.
    </p>

    <h2>9. Derechos y eliminacion de datos</h2>
    <p>
      El usuario puede solicitar acceso, correccion o eliminacion de sus datos escribiendo a
      <a href="mailto:${htmlEscape(contactEmail)}">${htmlEscape(contactEmail)}</a>.
      Algunas solicitudes pueden requerir verificacion de identidad y ciertos datos podrian conservarse cuando exista una
      obligacion legal, contable, antifraude o de resolucion de disputas.
    </p>

    <h2>10. Menores de edad</h2>
    <p>
      RapiV Cliente no esta dirigida a menores de edad. El servicio esta pensado para personas con capacidad para realizar pedidos
      y pagos dentro de la zona de operacion.
    </p>

    <h2>11. Cambios a esta politica</h2>
    <p>
      Podemos actualizar esta politica cuando cambien la app, el servicio o los requisitos legales.
      Publicaremos la version vigente en esta misma URL y actualizaremos la fecha de entrada en vigor cuando corresponda.
    </p>

    <h2>12. Contacto</h2>
    <p>
      Para dudas de privacidad, soporte o solicitudes relacionadas con datos personales, escribe a
      <a href="mailto:${htmlEscape(contactEmail)}">${htmlEscape(contactEmail)}</a>.
    </p>
  </main>
</body>
</html>`;
  }

  @Public()
  @Get("privacidad-negocio")
  @Header("Content-Type", "text/html; charset=utf-8")
  businessPrivacy() {
    const contactEmail = legalContactEmail();

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Politica de privacidad - RapiV Negocios</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.55;
      color: #111827;
      background: #f8fafc;
    }
    body {
      margin: 0;
      padding: 32px 16px;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 28px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 30px;
      line-height: 1.2;
    }
    h2 {
      margin-top: 28px;
      font-size: 20px;
    }
    p, li {
      font-size: 15px;
    }
    .meta {
      color: #4b5563;
      margin-top: 0;
    }
    a {
      color: #2563eb;
    }
  </style>
</head>
<body>
  <main>
    <h1>Politica de privacidad - RapiV Negocios</h1>
    <p class="meta">Fecha de entrada en vigor: ${effectiveDate}</p>

    <p>
      Esta politica explica como RapiV trata la informacion de los usuarios de la aplicacion RapiV Negocios.
      La app permite a comercios locales administrar su perfil, productos, disponibilidad, pedidos, cobros,
      comisiones y liquidaciones relacionadas con pedidos operados mediante RapiV.
    </p>

    <h2>1. Informacion que recopilamos</h2>
    <p>Podemos recopilar las siguientes categorias de datos cuando usas RapiV Negocios:</p>
    <ul>
      <li>Datos de cuenta: nombre, correo electronico, identificador de usuario, telefono y datos necesarios para autenticar la cuenta.</li>
      <li>Datos del negocio: nombre comercial, direccion, ubicacion, descripcion, logo, imagenes, horarios, disponibilidad, configuracion operativa y datos publicados en la app.</li>
      <li>Datos de productos: nombres, descripciones, imagenes, precios, disponibilidad, categorias y cantidades minimas.</li>
      <li>Datos de pedidos: pedidos recibidos, productos solicitados, estados de aceptacion, preparacion, entrega o recoleccion, tiempos operativos, cancelaciones y referencias necesarias para soporte.</li>
      <li>Datos de pagos, comisiones y liquidaciones: metodo de cobro, montos, comision RapiV, monto neto del negocio, estado de pago, estado de liquidacion, confirmaciones de efectivo, identificadores de transaccion y datos necesarios para conciliacion. RapiV no almacena numeros completos de tarjeta.</li>
      <li>Datos de Stripe Connect u otros proveedores de pago: identificadores de cuenta conectada, estado de habilitacion de cobros, estado de onboarding, datos necesarios para procesar pagos y liquidaciones, y datos que el proveedor requiera directamente al negocio.</li>
      <li>Datos de ubicacion: ubicacion del negocio y coordenadas usadas para mostrar el comercio, calcular cobertura, coordinar pedidos, entregas o recolecciones.</li>
      <li>Datos tecnicos: token de notificaciones push, informacion de sesion, registros de errores, diagnostico, direccion IP, datos de dispositivo y datos necesarios para seguridad y soporte.</li>
    </ul>

    <h2>2. Como usamos la informacion</h2>
    <p>Usamos los datos para:</p>
    <ul>
      <li>Crear y administrar cuentas de negocios.</li>
      <li>Mostrar el negocio, productos, precios, disponibilidad y ubicacion dentro de RapiV.</li>
      <li>Recibir, aceptar, rechazar, preparar y dar seguimiento a pedidos.</li>
      <li>Calcular ventas, comisiones, pagos, liquidaciones y conciliaciones operativas.</li>
      <li>Procesar pagos con tarjeta, pagos en efectivo, reembolsos, ajustes o confirmaciones cuando aplique.</li>
      <li>Enviar notificaciones relacionadas con pedidos, cuenta, pagos, liquidaciones, soporte y cambios operativos.</li>
      <li>Prevenir fraude, abuso, errores operativos, accesos no autorizados o incumplimientos de las reglas de la plataforma.</li>
      <li>Dar soporte, diagnosticar problemas y mejorar el funcionamiento de la app.</li>
      <li>Cumplir obligaciones legales, fiscales, contables, de seguridad y de resolucion de disputas.</li>
    </ul>

    <h2>3. Login con Google</h2>
    <p>
      RapiV Negocios permite iniciar sesion con Google. Al usar este metodo, recibimos datos basicos autorizados por Google,
      como correo electronico, nombre e identificador necesario para autenticar la cuenta.
    </p>

    <h2>4. Ubicacion del negocio</h2>
    <p>
      La app puede solicitar o permitir registrar la direccion y ubicacion del negocio. Esta informacion se usa para mostrar
      el comercio, validar zona de servicio, coordinar pedidos, calcular disponibilidad de entrega o recoleccion y facilitar operaciones dentro de RapiV.
    </p>

    <h2>5. Pagos, comisiones y liquidaciones</h2>
    <p>
      RapiV puede tratar informacion relacionada con ventas, comisiones, liquidaciones, pagos en efectivo y pagos con tarjeta.
      Los pagos con tarjeta se procesan mediante proveedores externos autorizados, como Stripe. RapiV puede almacenar
      identificadores de transaccion, estado del pago, monto, comision, liquidacion y datos necesarios para conciliacion,
      soporte, prevencion de fraude y cumplimiento legal, pero no almacena numeros completos de tarjeta ni codigos de seguridad.
    </p>
    <p>
      Si el negocio usa Stripe Connect u otro proveedor de pagos, el proveedor puede recopilar informacion adicional directamente
      del negocio para verificar identidad, habilitar cobros, cumplir obligaciones legales y operar pagos o liquidaciones.
      Ese tratamiento tambien puede estar sujeto a las politicas del proveedor correspondiente.
    </p>

    <h2>6. Terceros y proveedores</h2>
    <p>Podemos usar proveedores para operar funciones de la app, incluyendo:</p>
    <ul>
      <li>Google, para inicio de sesion, mapas o servicios relacionados.</li>
      <li>Stripe u otros proveedores de pago, para procesar pagos, cuentas conectadas, reembolsos y liquidaciones.</li>
      <li>Expo u otros servicios de notificaciones, para enviar avisos push.</li>
      <li>Proveedores de infraestructura, base de datos, monitoreo, almacenamiento de imagenes y alojamiento.</li>
    </ul>
    <p>
      Estos proveedores procesan informacion necesaria para prestar el servicio, proteger la plataforma o cumplir obligaciones legales.
    </p>

    <h2>7. Informacion compartida con otros usuarios</h2>
    <p>
      Parte de la informacion del negocio puede mostrarse a clientes y repartidores dentro de RapiV, incluyendo nombre comercial,
      direccion o zona, ubicacion aproximada o de recoleccion, productos, precios, imagenes, disponibilidad, estado del pedido
      y datos necesarios para completar la operacion.
    </p>
    <p>
      El negocio puede recibir datos limitados de clientes o pedidos necesarios para preparar, entregar o entregar en recoleccion
      un pedido. El negocio debe usar esa informacion solo para completar la operacion y no para fines externos sin autorizacion.
    </p>

    <h2>8. Seguridad</h2>
    <p>
      Usamos medidas tecnicas razonables para proteger la informacion, incluyendo transmision cifrada mediante HTTPS
      y almacenamiento de sesion en mecanismos seguros del dispositivo cuando estan disponibles.
      Ningun sistema es completamente infalible, pero trabajamos para reducir riesgos de acceso no autorizado, perdida,
      alteracion o uso indebido.
    </p>

    <h2>9. Conservacion</h2>
    <p>
      Conservamos informacion mientras sea necesaria para operar la cuenta, administrar pedidos, procesar pagos,
      calcular comisiones y liquidaciones, cumplir obligaciones legales, fiscales o contables, prevenir fraude,
      resolver disputas o dar soporte. Algunos datos pueden conservarse por periodos mayores cuando la ley o necesidades
      operativas lo requieran.
    </p>

    <h2>10. Derechos y eliminacion de datos</h2>
    <p>
      El usuario puede solicitar acceso, correccion o eliminacion de sus datos escribiendo a
      <a href="mailto:${htmlEscape(contactEmail)}">${htmlEscape(contactEmail)}</a>.
      Algunas solicitudes pueden requerir verificacion de identidad y ciertos datos podrian conservarse cuando exista una
      obligacion legal, fiscal, contable, antifraude, de seguridad, soporte o resolucion de disputas.
    </p>
    <p>
      Eliminar o desactivar una cuenta de negocio puede no eliminar inmediatamente registros de pedidos, pagos, comisiones,
      liquidaciones, auditoria o soporte que deban conservarse por motivos legales u operativos.
    </p>

    <h2>11. Menores de edad</h2>
    <p>
      RapiV Negocios no esta dirigida a menores de edad. El servicio esta pensado para personas con capacidad para administrar
      un negocio o actuar como responsable autorizado de un comercio.
    </p>

    <h2>12. Cambios a esta politica</h2>
    <p>
      Podemos actualizar esta politica cuando cambien la app, el servicio o los requisitos legales.
      Publicaremos la version vigente en esta misma URL y actualizaremos la fecha de entrada en vigor cuando corresponda.
    </p>

    <h2>13. Contacto</h2>
    <p>
      Para dudas de privacidad, soporte o solicitudes relacionadas con datos personales, escribe a
      <a href="mailto:${htmlEscape(contactEmail)}">${htmlEscape(contactEmail)}</a>.
    </p>
  </main>
</body>
</html>`;
  }

  @Public()
  @Get("eliminacion-cuenta-negocio")
  @Header("Content-Type", "text/html; charset=utf-8")
  businessAccountDeletion() {
    const contactEmail = legalContactEmail();

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Eliminacion de cuenta - RapiV Negocios</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.55;
      color: #111827;
      background: #f8fafc;
    }
    body {
      margin: 0;
      padding: 32px 16px;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 28px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 30px;
      line-height: 1.2;
    }
    h2 {
      margin-top: 28px;
      font-size: 20px;
    }
    p, li {
      font-size: 15px;
    }
    .meta {
      color: #4b5563;
      margin-top: 0;
    }
    a {
      color: #2563eb;
    }
  </style>
</head>
<body>
  <main>
    <h1>Eliminacion de cuenta - RapiV Negocios</h1>
    <p class="meta">Fecha de entrada en vigor: ${effectiveDate}</p>

    <p>
      Esta pagina explica como los usuarios de RapiV Negocios pueden solicitar la eliminacion de su cuenta
      y de los datos asociados. RapiV Negocios es una aplicacion de RapiV para que comercios locales administren
      su perfil, productos, pedidos, cobros, comisiones y liquidaciones dentro de la plataforma.
    </p>

    <h2>1. Como solicitar la eliminacion</h2>
    <p>Para solicitar la eliminacion de tu cuenta de RapiV Negocios, sigue estos pasos:</p>
    <ol>
      <li>Envia un correo a <a href="mailto:${htmlEscape(contactEmail)}">${htmlEscape(contactEmail)}</a>.</li>
      <li>Usa el asunto: "Eliminar cuenta RapiV Negocios".</li>
      <li>Escribe el correo de Google usado para iniciar sesion en la app.</li>
      <li>Incluye tu nombre, telefono y nombre comercial del negocio registrado, si los agregaste a tu perfil.</li>
      <li>Indica claramente que solicitas eliminar tu cuenta de RapiV Negocios y los datos asociados al negocio.</li>
    </ol>
    <p>
      Para proteger la cuenta y evitar eliminaciones no autorizadas, podemos pedirte verificar la solicitud respondiendo
      desde el mismo correo asociado a tu cuenta o proporcionando informacion suficiente para confirmar tu identidad
      y relacion con el negocio.
    </p>

    <h2>2. Datos que se eliminan o desactivan</h2>
    <p>
      Cuando se aprueba la solicitud, eliminamos, desactivamos o anonimizamos datos asociados directamente a la cuenta
      y al perfil del negocio, cuando no deban conservarse por motivos legales u operativos. Esto puede incluir:
    </p>
    <ul>
      <li>Datos de perfil del responsable del negocio, como nombre, correo electronico, telefono e identificador de usuario.</li>
      <li>Tokens de notificaciones push asociados a la app.</li>
      <li>Datos publicos del negocio, como nombre comercial, descripcion, horarios, direccion, logo e imagenes, cuando no sean necesarios para registros operativos.</li>
      <li>Productos, imagenes, precios, categorias y disponibilidad publicados por el negocio.</li>
      <li>Sesiones activas y datos usados para mantener la cuenta iniciada.</li>
      <li>Configuraciones operativas del negocio dentro de la app.</li>
    </ul>

    <h2>3. Datos que pueden conservarse</h2>
    <p>
      Algunos datos pueden conservarse despues de eliminar o desactivar la cuenta cuando sean necesarios para cumplir
      obligaciones legales, fiscales, contables, antifraude, de seguridad, soporte, pagos, liquidaciones, reembolsos,
      resolucion de disputas o registros operativos. Esto puede incluir:
    </p>
    <ul>
      <li>Historial de pedidos recibidos por el negocio, productos vendidos, montos y estados.</li>
      <li>Registros de pagos, comisiones, liquidaciones, confirmaciones de efectivo, transferencias, reembolsos o ajustes.</li>
      <li>Identificadores de transaccion, cuenta conectada o datos operativos relacionados con proveedores de pago como Stripe.</li>
      <li>Registros de seguridad, auditoria, errores o prevencion de fraude.</li>
      <li>Comunicaciones de soporte relacionadas con la solicitud, pedidos previos, pagos, comisiones o disputas.</li>
    </ul>
    <p>
      Estos datos se conservaran solo durante el tiempo necesario para los fines anteriores o durante el periodo requerido
      por la legislacion aplicable. Como referencia operativa, los registros de pedidos, pagos, comisiones, liquidaciones
      y soporte pueden conservarse hasta por 5 anos, salvo que una ley exija o permita un periodo diferente.
    </p>

    <h2>4. Efectos de la eliminacion</h2>
    <p>
      Eliminar o desactivar una cuenta de RapiV Negocios puede impedir el acceso al panel del negocio, productos, pedidos,
      historial, configuracion, cobros y liquidaciones. Si existen pagos, comisiones, liquidaciones o disputas pendientes,
      RapiV puede mantener la cuenta o ciertos datos en estado limitado hasta cerrar esas obligaciones.
    </p>

    <h2>5. Plazos de atencion</h2>
    <p>
      RapiV buscara confirmar la recepcion de la solicitud dentro de 7 dias naturales y completar la eliminacion o desactivacion
      dentro de 30 dias naturales despues de verificar la identidad del solicitante, salvo que exista una obligacion legal,
      tecnica u operativa que requiera mas tiempo.
    </p>

    <h2>6. Eliminacion desde Google</h2>
    <p>
      Si usaste Google para iniciar sesion, tambien puedes revisar los permisos otorgados a RapiV desde tu cuenta de Google.
      Revocar el acceso en Google no elimina automaticamente tu cuenta de RapiV Negocios; para eliminarla debes enviar la
      solicitud descrita en esta pagina.
    </p>

    <h2>7. Contacto</h2>
    <p>
      Para dudas sobre eliminacion de cuenta o privacidad, escribe a
      <a href="mailto:${htmlEscape(contactEmail)}">${htmlEscape(contactEmail)}</a>.
    </p>
  </main>
</body>
</html>`;
  }

  @Public()
  @Get("eliminacion-cuenta-cliente")
  @Header("Content-Type", "text/html; charset=utf-8")
  customerAccountDeletion() {
    const contactEmail = legalContactEmail();

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Eliminacion de cuenta - RapiV Cliente</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.55;
      color: #111827;
      background: #f8fafc;
    }
    body {
      margin: 0;
      padding: 32px 16px;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 28px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 30px;
      line-height: 1.2;
    }
    h2 {
      margin-top: 28px;
      font-size: 20px;
    }
    p, li {
      font-size: 15px;
    }
    .meta {
      color: #4b5563;
      margin-top: 0;
    }
    a {
      color: #2563eb;
    }
  </style>
</head>
<body>
  <main>
    <h1>Eliminacion de cuenta - RapiV Cliente</h1>
    <p class="meta">Fecha de entrada en vigor: ${effectiveDate}</p>

    <p>
      Esta pagina explica como los usuarios de RapiV Cliente pueden solicitar la eliminacion de su cuenta
      y de los datos asociados. RapiV Cliente es una aplicacion de RapiV para realizar pedidos a negocios locales
      y consultar entregas dentro de la zona de servicio.
    </p>

    <h2>1. Como solicitar la eliminacion</h2>
    <p>Para solicitar la eliminacion de tu cuenta de RapiV Cliente, sigue estos pasos:</p>
    <ol>
      <li>Envia un correo a <a href="mailto:${htmlEscape(contactEmail)}">${htmlEscape(contactEmail)}</a>.</li>
      <li>Usa el asunto: "Eliminar cuenta RapiV Cliente".</li>
      <li>Escribe el correo de Google usado para iniciar sesion en la app.</li>
      <li>Incluye tu nombre y telefono registrados, si los agregaste a tu perfil.</li>
      <li>Indica claramente que solicitas eliminar tu cuenta y los datos asociados a RapiV Cliente.</li>
    </ol>
    <p>
      Para proteger tu cuenta, podemos pedirte verificar la solicitud respondiendo desde el mismo correo asociado
      a tu cuenta o proporcionando informacion suficiente para confirmar tu identidad.
    </p>

    <h2>2. Datos que se eliminan</h2>
    <p>Cuando se aprueba la solicitud, eliminamos o desactivamos datos asociados directamente a la cuenta, incluyendo:</p>
    <ul>
      <li>Datos de perfil de cliente, como nombre, correo electronico, telefono e identificador de usuario.</li>
      <li>Tokens de notificaciones push asociados a la app.</li>
      <li>Direcciones o ubicaciones guardadas para entregas futuras, cuando no deban conservarse por motivos operativos o legales.</li>
      <li>Sesiones activas y datos usados para mantener la cuenta iniciada.</li>
      <li>Calificaciones o comentarios asociados al usuario, cuando puedan eliminarse sin afectar registros operativos necesarios.</li>
    </ul>

    <h2>3. Datos que pueden conservarse</h2>
    <p>
      Algunos datos pueden conservarse despues de eliminar la cuenta cuando sean necesarios para cumplir obligaciones legales,
      fiscales, contables, antifraude, de seguridad, soporte, reembolsos, resolucion de disputas o registros operativos.
      Esto puede incluir:
    </p>
    <ul>
      <li>Historial de pedidos, montos, estado del pedido y referencias necesarias para conciliacion o soporte.</li>
      <li>Identificadores de pago, reembolso o transaccion procesados por proveedores externos.</li>
      <li>Registros de seguridad, auditoria, errores o prevencion de fraude.</li>
      <li>Comunicaciones de soporte relacionadas con la solicitud o con pedidos previos.</li>
    </ul>
    <p>
      Estos datos se conservaran solo durante el tiempo necesario para los fines anteriores o durante el periodo requerido
      por la legislacion aplicable. Como referencia operativa, los registros de pedidos, pagos y soporte pueden conservarse
      hasta por 5 anos, salvo que una ley exija o permita un periodo diferente.
    </p>

    <h2>4. Plazos de atencion</h2>
    <p>
      RapiV buscara confirmar la recepcion de la solicitud dentro de 7 dias naturales y completar la eliminacion dentro
      de 30 dias naturales despues de verificar la identidad del solicitante, salvo que exista una obligacion legal,
      tecnica u operativa que requiera mas tiempo.
    </p>

    <h2>5. Eliminacion desde Google</h2>
    <p>
      Si usaste Google para iniciar sesion, tambien puedes revisar los permisos otorgados a RapiV desde tu cuenta de Google.
      Revocar el acceso en Google no elimina automaticamente tu cuenta de RapiV Cliente; para eliminarla debes enviar la
      solicitud descrita en esta pagina.
    </p>

    <h2>6. Contacto</h2>
    <p>
      Para dudas sobre eliminacion de cuenta o privacidad, escribe a
      <a href="mailto:${htmlEscape(contactEmail)}">${htmlEscape(contactEmail)}</a>.
    </p>
  </main>
</body>
</html>`;
  }

  @Public()
  @Get("privacidad-repartidor")
  @Header("Content-Type", "text/html; charset=utf-8")
  courierPrivacy() {
    const contactEmail = legalContactEmail();
    const escapedContactEmail = htmlEscape(contactEmail);

    return legalPage(
      "Politica de privacidad - RapiV Repartidor",
      `    <h1>Politica de privacidad - RapiV Repartidor</h1>
    <p class="meta">Fecha de entrada en vigor: ${effectiveDate}</p>

    <p>
      Esta politica explica como RapiV trata la informacion de los usuarios de la aplicacion RapiV Repartidor.
      La app permite a repartidores recibir ofertas, aceptar entregas, actualizar estados de pedido, compartir
      ubicacion operativa y administrar pagos relacionados con entregas dentro de la plataforma.
    </p>

    <h2>1. Informacion que recopilamos</h2>
    <p>Podemos recopilar las siguientes categorias de datos cuando usas RapiV Repartidor:</p>
    <ul>
      <li>Datos de cuenta: nombre, correo electronico, identificador de usuario, telefono y datos necesarios para autenticar la cuenta.</li>
      <li>Datos de perfil de repartidor: estado de disponibilidad, configuracion operativa, cuenta conectada, historial de entregas y datos necesarios para administrar la actividad del repartidor.</li>
      <li>Datos de ubicacion: ubicacion aproximada o precisa durante disponibilidad, asignacion, recoleccion y entrega de pedidos.</li>
      <li>Datos de pedidos y entregas: ofertas recibidas, pedidos aceptados, estados de recoleccion o entrega, direcciones o referencias necesarias para completar la entrega, tiempos operativos, cancelaciones e incidencias.</li>
      <li>Datos de pagos, recargas y saldo: montos de reparto, estado de pago, estado de liquidacion, movimientos de saldo RapiV, recargas, descuentos por ordenes en efectivo, identificadores de transaccion y referencias necesarias para conciliacion. RapiV no almacena numeros completos de tarjeta ni datos bancarios completos.</li>
      <li>Datos de Stripe Connect u otros proveedores de pago: identificadores de cuenta conectada, estado de habilitacion de pagos, estado de onboarding, datos necesarios para procesar pagos y datos que el proveedor requiera directamente al repartidor.</li>
      <li>Datos tecnicos: token de notificaciones push, informacion de sesion, registros de errores, diagnostico, direccion IP, datos de dispositivo y datos necesarios para seguridad y soporte.</li>
    </ul>

    <h2>2. Como usamos la informacion</h2>
    <p>Usamos los datos para:</p>
    <ul>
      <li>Crear y administrar cuentas de repartidor.</li>
      <li>Mostrar ofertas de entrega y pedidos asignados.</li>
      <li>Coordinar recoleccion, ruta, entrega y seguimiento operativo.</li>
      <li>Compartir ubicacion necesaria para completar entregas y dar seguimiento al pedido.</li>
      <li>Calcular pagos de reparto, saldo operativo, recargas, descuentos por efectivo y conciliaciones.</li>
      <li>Procesar pagos, recargas, liquidaciones, ajustes o confirmaciones cuando aplique.</li>
      <li>Enviar notificaciones relacionadas con ofertas, entregas, cuenta, pagos, saldo, soporte y cambios operativos.</li>
      <li>Prevenir fraude, abuso, errores operativos, accesos no autorizados o incumplimientos de las reglas de la plataforma.</li>
      <li>Dar soporte, diagnosticar problemas y mejorar el funcionamiento de la app.</li>
      <li>Cumplir obligaciones legales, fiscales, contables, de seguridad y de resolucion de disputas.</li>
    </ul>

    <h2>3. Login con Google</h2>
    <p>
      RapiV Repartidor permite iniciar sesion con Google. Al usar este metodo, recibimos datos basicos autorizados por Google,
      como correo electronico, nombre e identificador necesario para autenticar la cuenta.
    </p>

    <h2>4. Ubicacion</h2>
    <p>
      La app puede solicitar ubicacion aproximada o precisa para mostrar ofertas, coordinar rutas, validar disponibilidad,
      actualizar el avance de una entrega y permitir seguimiento operativo. La ubicacion se usa en relacion con la operacion
      de entregas dentro de RapiV.
    </p>

    <h2>5. Pagos, saldo y proveedores</h2>
    <p>
      RapiV puede tratar informacion relacionada con pagos por entregas, recargas, saldo operativo, pedidos en efectivo,
      descuentos, liquidaciones y conciliaciones. Los pagos con tarjeta y datos bancarios completos se procesan mediante
      proveedores externos autorizados, como Stripe. RapiV puede almacenar identificadores de transaccion, estado del pago,
      monto, saldo interno y datos necesarios para conciliacion, soporte, prevencion de fraude y cumplimiento legal, pero
      no almacena numeros completos de tarjeta ni codigos de seguridad.
    </p>
    <p>
      Si el repartidor usa Stripe Connect u otro proveedor de pagos, el proveedor puede recopilar informacion adicional
      directamente del repartidor para verificar identidad, habilitar pagos, cumplir obligaciones legales y operar
      transferencias o liquidaciones. Ese tratamiento tambien puede estar sujeto a las politicas del proveedor correspondiente.
    </p>
    <p>
      El saldo RapiV se usa solo como herramienta operativa para liquidar pedidos en efectivo dentro de la plataforma.
      No es una cuenta bancaria, no genera rendimientos, no permite compras externas y no permite transferencias entre usuarios.
    </p>

    <h2>6. Terceros y proveedores</h2>
    <p>Podemos usar proveedores para operar funciones de la app, incluyendo:</p>
    <ul>
      <li>Google, para inicio de sesion, mapas o servicios relacionados.</li>
      <li>Stripe u otros proveedores de pago, para procesar pagos, cuentas conectadas, recargas, reembolsos y liquidaciones.</li>
      <li>Expo u otros servicios de notificaciones, para enviar avisos push.</li>
      <li>Proveedores de infraestructura, base de datos, monitoreo y alojamiento.</li>
    </ul>
    <p>
      Estos proveedores procesan informacion necesaria para prestar el servicio, proteger la plataforma o cumplir obligaciones legales.
    </p>

    <h2>7. Informacion compartida con otros usuarios</h2>
    <p>
      Parte de la informacion operativa del repartidor puede mostrarse a clientes, negocios o personal operativo de RapiV
      cuando sea necesaria para completar un pedido, incluyendo nombre, estado del pedido, ubicacion relacionada con la entrega
      y datos necesarios para soporte o seguimiento.
    </p>
    <p>
      El repartidor puede recibir datos limitados de pedidos, clientes o negocios necesarios para recoger y entregar un pedido.
      El repartidor debe usar esa informacion solo para completar la operacion y no para fines externos sin autorizacion.
    </p>

    <h2>8. Seguridad</h2>
    <p>
      Usamos medidas tecnicas razonables para proteger la informacion, incluyendo transmision cifrada mediante HTTPS
      y almacenamiento de sesion en mecanismos seguros del dispositivo cuando estan disponibles.
      Ningun sistema es completamente infalible, pero trabajamos para reducir riesgos de acceso no autorizado, perdida,
      alteracion o uso indebido.
    </p>

    <h2>9. Conservacion</h2>
    <p>
      Conservamos informacion mientras sea necesaria para operar la cuenta, administrar entregas, procesar pagos,
      calcular saldo y liquidaciones, cumplir obligaciones legales, fiscales o contables, prevenir fraude,
      resolver disputas o dar soporte. Algunos datos pueden conservarse por periodos mayores cuando la ley o necesidades
      operativas lo requieran.
    </p>

    <h2>10. Derechos y eliminacion de datos</h2>
    <p>
      El usuario puede solicitar acceso, correccion o eliminacion de sus datos escribiendo a
      <a href="mailto:${escapedContactEmail}">${escapedContactEmail}</a>.
      Algunas solicitudes pueden requerir verificacion de identidad y ciertos datos podrian conservarse cuando exista una
      obligacion legal, fiscal, contable, antifraude, de seguridad, soporte o resolucion de disputas.
    </p>
    <p>
      Eliminar o desactivar una cuenta de repartidor puede no eliminar inmediatamente registros de entregas, pagos, saldo,
      liquidaciones, auditoria o soporte que deban conservarse por motivos legales u operativos.
    </p>

    <h2>11. Menores de edad</h2>
    <p>
      RapiV Repartidor no esta dirigida a menores de edad. El servicio esta pensado para personas con capacidad para realizar
      actividades de reparto y administrar pagos operativos dentro de la zona de servicio.
    </p>

    <h2>12. Cambios a esta politica</h2>
    <p>
      Podemos actualizar esta politica cuando cambien la app, el servicio o los requisitos legales.
      Publicaremos la version vigente en esta misma URL y actualizaremos la fecha de entrada en vigor cuando corresponda.
    </p>

    <h2>13. Contacto</h2>
    <p>
      Para dudas de privacidad, soporte o solicitudes relacionadas con datos personales, escribe a
      <a href="mailto:${escapedContactEmail}">${escapedContactEmail}</a>.
    </p>`,
    );
  }

  @Public()
  @Get("eliminacion-cuenta-repartidor")
  @Header("Content-Type", "text/html; charset=utf-8")
  courierAccountDeletion() {
    const contactEmail = legalContactEmail();
    const escapedContactEmail = htmlEscape(contactEmail);

    return legalPage(
      "Eliminacion de cuenta - RapiV Repartidor",
      `    <h1>Eliminacion de cuenta - RapiV Repartidor</h1>
    <p class="meta">Fecha de entrada en vigor: ${effectiveDate}</p>

    <p>
      Esta pagina explica como los usuarios de RapiV Repartidor pueden solicitar la eliminacion de su cuenta
      y de los datos asociados. RapiV Repartidor es una aplicacion de RapiV para que repartidores reciban,
      acepten y gestionen entregas dentro de la plataforma.
    </p>

    <h2>1. Como solicitar la eliminacion</h2>
    <p>Para solicitar la eliminacion de tu cuenta de RapiV Repartidor, sigue estos pasos:</p>
    <ol>
      <li>Envia un correo a <a href="mailto:${escapedContactEmail}">${escapedContactEmail}</a>.</li>
      <li>Usa el asunto: "Eliminar cuenta RapiV Repartidor".</li>
      <li>Escribe el correo de Google usado para iniciar sesion en la app.</li>
      <li>Incluye tu nombre y telefono registrados, si los agregaste a tu perfil.</li>
      <li>Indica claramente que solicitas eliminar tu cuenta de RapiV Repartidor y los datos asociados al perfil de repartidor.</li>
    </ol>
    <p>
      Para proteger la cuenta y evitar eliminaciones no autorizadas, podemos pedirte verificar la solicitud respondiendo
      desde el mismo correo asociado a tu cuenta o proporcionando informacion suficiente para confirmar tu identidad.
    </p>

    <h2>2. Datos que se eliminan o desactivan</h2>
    <p>
      Cuando se aprueba la solicitud, eliminamos, desactivamos o anonimizamos datos asociados directamente a la cuenta
      y al perfil de repartidor, cuando no deban conservarse por motivos legales u operativos. Esto puede incluir:
    </p>
    <ul>
      <li>Datos de perfil del repartidor, como nombre, correo electronico, telefono e identificador de usuario.</li>
      <li>Tokens de notificaciones push asociados a la app.</li>
      <li>Estado de disponibilidad y configuraciones operativas del repartidor.</li>
      <li>Sesiones activas y datos usados para mantener la cuenta iniciada.</li>
      <li>Datos de ubicacion guardados que no sean necesarios para registros operativos, soporte, seguridad o cumplimiento legal.</li>
    </ul>

    <h2>3. Datos que pueden conservarse</h2>
    <p>
      Algunos datos pueden conservarse despues de eliminar o desactivar la cuenta cuando sean necesarios para cumplir
      obligaciones legales, fiscales, contables, antifraude, de seguridad, soporte, pagos, liquidaciones, reembolsos,
      resolucion de disputas o registros operativos. Esto puede incluir:
    </p>
    <ul>
      <li>Historial de pedidos entregados, rechazados o cancelados, montos y estados.</li>
      <li>Registros de pagos de reparto, recargas, saldo RapiV, descuentos por efectivo, transferencias, reembolsos o ajustes.</li>
      <li>Identificadores de transaccion, cuenta conectada o datos operativos relacionados con proveedores de pago como Stripe.</li>
      <li>Registros de ubicacion asociados a entregas completadas o incidencias operativas.</li>
      <li>Registros de seguridad, auditoria, errores o prevencion de fraude.</li>
      <li>Comunicaciones de soporte relacionadas con la solicitud, entregas previas, pagos, saldo o disputas.</li>
    </ul>
    <p>
      Estos datos se conservaran solo durante el tiempo necesario para los fines anteriores o durante el periodo requerido
      por la legislacion aplicable. Como referencia operativa, los registros de pedidos, pagos, saldo, liquidaciones
      y soporte pueden conservarse hasta por 5 anos, salvo que una ley exija o permita un periodo diferente.
    </p>

    <h2>4. Efectos de la eliminacion</h2>
    <p>
      Eliminar o desactivar una cuenta de RapiV Repartidor puede impedir el acceso a ofertas, entregas, historial,
      saldo, pagos y configuracion. Si existen entregas, pagos, saldo, liquidaciones o disputas pendientes,
      RapiV puede mantener la cuenta o ciertos datos en estado limitado hasta cerrar esas obligaciones.
    </p>

    <h2>5. Plazos de atencion</h2>
    <p>
      RapiV buscara confirmar la recepcion de la solicitud dentro de 7 dias naturales y completar la eliminacion o desactivacion
      dentro de 30 dias naturales despues de verificar la identidad del solicitante, salvo que exista una obligacion legal,
      tecnica u operativa que requiera mas tiempo.
    </p>

    <h2>6. Eliminacion desde Google</h2>
    <p>
      Si usaste Google para iniciar sesion, tambien puedes revisar los permisos otorgados a RapiV desde tu cuenta de Google.
      Revocar el acceso en Google no elimina automaticamente tu cuenta de RapiV Repartidor; para eliminarla debes enviar la
      solicitud descrita en esta pagina.
    </p>

    <h2>7. Contacto</h2>
    <p>
      Para dudas sobre eliminacion de cuenta o privacidad, escribe a
      <a href="mailto:${escapedContactEmail}">${escapedContactEmail}</a>.
    </p>`,
    );
  }
}

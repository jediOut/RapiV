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
}

# Rechazo Google Play - RapiV Cliente

## Diagnostico

Google rechazo `RapiV Cliente` (`com.rapiv.client`) por Play Console Requirements en el area `Developer Account`. Este tipo de rechazo normalmente no indica un error del APK/AAB, sino una incompatibilidad entre el tipo de cuenta de desarrollador, las declaraciones de App content, la categoria seleccionada o la forma en que Google interpreta las funciones declaradas.

La politica vigente de Play Console Requirements indica que deben registrarse como organizacion los desarrolladores que proveen:

- Productos y servicios financieros, como banca, prestamos, trading, fondos de inversion, wallets de criptomonedas o exchanges.
- Apps de salud, como apps medicas o de investigacion con sujetos humanos.
- Apps aprobadas para usar `VpnService`.
- Apps gubernamentales o desarrolladas por/para una agencia de gobierno.

En el repo, `RapiV Cliente` esta configurada como una app de pedidos/entrega de comida y negocios locales. No hay evidencia de `VpnService`, salud, gobierno, prestamos, banca, inversion, criptoactivos o wallet de cliente.

## Riesgo probable

El detonante mas probable es una de estas opciones:

1. La app se envio desde una cuenta personal y Play Console clasifico la app como organizacion obligatoria.
2. En `App content` se declaro accidentalmente alguna funcion financiera, de salud, VPN o gobierno.
3. La ficha o el formulario financiero uso terminos ambiguos como "pagos", "saldo", "liquidaciones", "tarjeta", "proveedor de pagos" o "wallet" sin aclarar que `RapiV Cliente` solo cobra productos/entregas.

## Accion recomendada en Play Console

1. En `Policy > App content`, revisar todas las declaraciones de `RapiV Cliente`.
2. Confirmar que la categoria de la app sea `Food & Drink`, no `Finance`, `Medical`, `Government` ni una categoria relacionada.
3. En cualquier declaracion de funciones financieras, describir el flujo como pago de bienes fisicos/servicios de entrega, no como producto financiero:

```text
RapiV Cliente lets users place local food/product delivery orders. Card or cash payments are used only to pay for physical goods and delivery services ordered in the app. The app does not provide banking, loans, credit, investments, cryptocurrency products, money transfers between users, financial advice, or a customer wallet/stored-value account.
```

4. Verificar que el formulario no declare:

- Personal loans, earned wage access, credit, BNPL or loan lead generation.
- Banking, investment, stock trading, crypto wallet, crypto exchange or money transfer.
- Health/medical/research functionality.
- VPN functionality or `VpnService` usage.
- Government app status.

5. Reenviar a revision desde `Publishing overview`.

## Si Play Console mantiene el bloqueo

Si el rechazo persiste aunque las declaraciones sean correctas, hay dos caminos:

1. Transferir/publicar desde una cuenta de organizacion con razon social y D-U-N-S.
2. Apelar explicando que la app fue clasificada erroneamente.

## Texto sugerido de apelacion

```text
Hello Google Play Review team,

We believe RapiV Cliente (com.rapiv.client) was incorrectly classified under an organization-only app type.

RapiV Cliente is a local food/product ordering and delivery app. Users can browse local businesses, add products to a cart, place delivery or pickup orders, track order status, and receive order notifications.

The app does not provide banking, loans, credit, earned wage access, investments, stock trading, cryptocurrency wallets, cryptocurrency exchange services, money transfers between users, financial advice, health/medical services, VPN functionality, or government services.

Any card or cash payment functionality is only for physical goods and delivery services ordered inside the app. RapiV Cliente does not store full card numbers or security codes; payment processing is handled by an external payment provider for order checkout only.

We have reviewed the App content declarations and store listing to ensure they accurately describe the app as a food/local-order delivery service. Please review the app again under the Food & Drink category.

Thank you.
```

## Nota importante

Las apps `RapiV Negocios` y `RapiV Repartidor` tienen lenguaje y funciones mas sensibles para revision porque mencionan liquidaciones, cuentas conectadas, saldo y recargas. Si esas apps se envian despues, conviene revisar sus declaraciones por separado o publicarlas desde una cuenta de organizacion para reducir riesgo.

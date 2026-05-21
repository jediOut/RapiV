# Cliente frontend architecture

Este front debe concentrarse en experiencia de compra del cliente. No debe duplicar reglas del backend mas alla de validaciones de UI.

## Organizacion ACID

- Atomicidad: cada accion de usuario queda encapsulada en una funcion de `src/services` o contexto dedicado. Ejemplo: crear orden genera un `Idempotency-Key` y delega una unica peticion al backend.
- Consistencia: tipos de API viven en `src/types`; colores y tokens visuales viven en `src/theme`; endpoints base viven en `src/config`.
- Aislamiento: `src/screens` orquesta estado de pantalla, `src/components` renderiza UI reutilizable, `src/services` habla con HTTP/SecureStore y `src/context` administra estado compartido de UI.
- Durabilidad: las pantallas no deben guardar datos criticos como fuente de verdad. Sesion y carrito usan almacenamiento/contexto, y pedidos se consultan al backend.

## Convenciones

- Una pantalla no debe construir URLs ni llamar `fetch` directamente.
- Los mensajes de error deben salir del `apiClient`, para que validaciones del backend se vean iguales en toda la app.
- Cuando una feature crezca, crear carpeta `src/features/<feature>` solo si agrupa screen, componentes y servicios propios.

# Repartidor frontend architecture

Este front pertenece al courier: toma pedidos listos, actualiza estados de entrega y comparte ubicacion.

## Organizacion ACID

- Atomicidad: cada accion de entrega debe ser una llamada de servicio clara: asignar pedido, cambiar estado o publicar ubicacion.
- Consistencia: los flujos de estado permitidos vienen del backend. La UI puede deshabilitar botones, pero el backend valida la transicion real.
- Aislamiento: `screens` contiene flujo de entrega, `services` encapsula API, `config` encapsula zona/API, `types` describe contratos.
- Durabilidad: ubicacion y estados de entrega se consideran persistidos solo despues de respuesta exitosa del backend.

## Convenciones

- No construir URLs en pantallas; usar funciones de `src/services`.
- Mantener fallback de API local para evitar `undefined/orders` cuando no exista variable de entorno.
- Separar componentes nuevos en `src/components` cuando se reutilicen en mas de una pantalla.

# Negocio frontend architecture

Este front pertenece al operador del negocio: perfil, pedidos y menu. Su responsabilidad es operar recursos de un negocio autenticado.

## Organizacion ACID

- Atomicidad: cada accion operativa debe ser una funcion unica en `src/services`, por ejemplo actualizar estado de pedido o disponibilidad de producto.
- Consistencia: los estados visibles deben venir del backend; el front solo mapea a presentacion. Los contratos viven en `src/types`.
- Aislamiento: `BusinessApp` decide navegacion interna; `screens` manejan flujo; `components` son piezas visuales reutilizables; `services` encapsulan HTTP.
- Durabilidad: despues de mutaciones, refrescar o reconciliar contra backend en vez de asumir que el estado local es definitivo.

## Convenciones

- No usar `fetch` fuera de `src/services/apiClient.ts`.
- Mantener `EXPO_PUBLIC_API_URL` con fallback local para desarrollo.
- Las pantallas de negocio no deben conocer detalles de auth storage; reciben `session` desde `App.tsx`.

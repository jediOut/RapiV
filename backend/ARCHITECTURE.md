# Backend architecture

Este proyecto es el limite transaccional de RapiV. Los cambios de negocio que afectan mas de una tabla deben vivir aqui, no en los fronts.

## Organizacion ACID

- Atomicidad: cada caso de uso publico del servicio debe completar todo o fallar todo. Usa `DataSource.transaction` cuando una operacion actualice varias entidades, como crear negocio y asignar rol de propietario.
- Consistencia: las reglas de estado, permisos, zona de servicio e idempotencia viven en servicios de dominio (`OrdersService`, `BusinessesService`, `ProductsService`). Los controllers solo traducen HTTP a llamadas de servicio.
- Aislamiento: los modulos Nest encapsulan su entidad, DTOs, controller y service. Si otro modulo necesita datos, debe pasar por el service publico, salvo dentro de una transaccion explicita con `EntityManager`.
- Durabilidad: todo cambio persistente debe tener entidad TypeORM, migracion cuando cambie esquema, y script de verificacion (`npm run typecheck`, `npm run build`).

## Convenciones

- `src/modules/<domain>` contiene entidad, DTOs, controller y service del dominio.
- `src/common` contiene infraestructura transversal sin estado de negocio: auth, geo, decorators y guards.
- `src/database` contiene conexion y migraciones.
- Evita logica de negocio en `main.ts`, controllers o scripts.

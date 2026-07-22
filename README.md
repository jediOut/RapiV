# RapiV

Plataforma de comercio local y entregas compuesta por un backend NestJS y tres aplicaciones móviles Expo para clientes, negocios y repartidores.

> Estado: producto en desarrollo activo. El repositorio incluye infraestructura de staging, pruebas del backend y documentación operativa.

## Qué resuelve

RapiV conecta comercios locales con clientes y repartidores. Cubre el ciclo completo de una orden: catálogo, carrito, pago o efectivo, aceptación del negocio, asignación del repartidor, entrega, liquidaciones y calificaciones.

## Arquitectura

```text
Cliente Expo ──────┐
Negocio Expo ──────┼──► API NestJS ──► PostgreSQL
Repartidor Expo ───┘         │         Redis / BullMQ
                             ├────────► Stripe Connect
                             ├────────► AWS S3
                             └────────► Expo Push Notifications
```

El monorepo comparte contratos TypeScript entre el backend y los clientes para reducir diferencias entre las respuestas de la API y los tipos utilizados en las aplicaciones.

## Capacidades principales

- Registro, inicio de sesión con contraseña o Google y autorización por roles.
- Administración de negocios, productos, inventario y ubicación.
- Creación de órdenes con reglas de disponibilidad y transacciones de base de datos.
- Pagos con Stripe, Stripe Connect y flujo alternativo de efectivo.
- Ofertas y seguimiento de entregas para repartidores.
- Colas Redis/BullMQ para procesamiento asíncrono.
- Notificaciones push, carga de archivos a S3 y URLs firmadas.
- Calificaciones, conciliaciones y trazabilidad financiera.
- Métricas y logs con Prometheus, Loki y Grafana.

## Stack

| Capa | Tecnologías |
|---|---|
| Backend | NestJS 11, TypeScript, TypeORM, PostgreSQL |
| Asincronía | Redis, BullMQ |
| Aplicaciones | React Native, Expo, TypeScript |
| Integraciones | Stripe Connect, Google OAuth, Expo Push, AWS S3 |
| Operación | Docker Compose, Caddy, Terraform, GitHub Actions |
| Observabilidad | Prometheus, Loki, Grafana |

## Estructura

```text
backend/              API, dominio, migraciones y pruebas
cliente-frontend/     aplicación para realizar pedidos
negocio-frontend/     aplicación para administrar el comercio
repartidor-frontend/  aplicación para entregas
shared/contracts/     contratos TypeScript compartidos
infra/                infraestructura de staging con Terraform
monitoring/           Prometheus, Loki y Grafana
docs/                 despliegue, OAuth, publicación y documentos legales
```

## Ejecución local

### Requisitos

- Node.js 22 o compatible
- Docker y Docker Compose

### Backend

```bash
cp .env.example .env
docker compose up -d postgres redis
cd backend
npm install
npm run migration:run
npm run seed
npm run start:dev
```

Consulta [DATABASE_SETUP.md](DATABASE_SETUP.md) y [backend/README.md](backend/README.md) para la configuración detallada.

### Aplicaciones móviles

En la aplicación que quieras ejecutar:

```bash
cd cliente-frontend # o negocio-frontend / repartidor-frontend
npm install
npx expo start
```

Cada aplicación contiene un `.env.example` con las variables necesarias.

## Calidad y verificación

```bash
cd backend
npm run typecheck
npm test
npm run build
```

El backend incluye pruebas unitarias para servicios de dominio y un smoke test end-to-end en `backend/src/scripts/e2e-smoke.ts`.

## Seguridad

- Contraseñas derivadas con PBKDF2, salt aleatorio y comparación resistente a timing attacks.
- Autenticación JWT y guards globales de roles.
- Credenciales y secretos configurados mediante variables de entorno.
- Migraciones explícitas para cambios de esquema.
- URLs firmadas para acceso controlado a archivos.

## Desarrollo asistido por IA

Durante el desarrollo se usa IA para contrastar decisiones de arquitectura, investigar fallos, proponer escenarios de prueba y revisar documentación. Toda propuesta se valida mediante revisión manual, type checking, pruebas y ejecución del flujo afectado. No se delegan a la IA decisiones de seguridad, pagos o reglas de negocio sin verificación.

## Documentación adicional

- [Arquitectura del backend](backend/ARCHITECTURE.md)
- [Staging en AWS](docs/STAGING_AWS_LITE.md)
- [Monitorización](monitoring/README.md)
- [Pagos](backend/src/modules/payments/README.md)

## Autor

[Jedidiah Viera](https://github.com/jediOut)

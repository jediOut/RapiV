# RapiV Backend

Backend modular NestJS para el ecosistema RapiV.

## Módulos

- `auth`: Registro, login y JWT
- `users`: Identidad del usuario y roles
- `businesses`: Negocios administrados por usuarios
- `products`: Catálogo de productos por negocio
- `orders`: Órdenes y gestión de pedidos

## Base de datos

**Motor:** PostgreSQL 16
**ORM:** TypeORM
**Status:** Configurado con entidades, relaciones y migraciones TypeORM

### Requisitos

- Docker y Docker Compose
- PostgreSQL 16 (o usar Docker Compose)

### Iniciar base de datos

Desde la raíz del proyecto:

```bash
# Linux/Mac
bash start-db.sh

# Windows
start-db.bat

# O manualmente
docker-compose up -d
```

Ver `DATABASE_SETUP.md` para detalles completos.

## Configuración inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear archivo `.env`

Copiar desde `.env.example`:

```bash
cp .env.example .env
```

Actualizar credenciales de base de datos si es necesario.

### 3. Ejecutar aplicación

```bash
# Aplicar esquema de base de datos
npm run migration:run

# Desarrollo (con auto-reload)
npm run start:dev

# Producción
npm run build
npm start
```

El servidor escucha por defecto en `http://localhost:3000`.

## Entidades del modelo

| Entidad | Descripción | Relaciones |
|---------|-------------|-----------|
| `User` | Usuarios del sistema | Owns Businesses, Creates Orders |
| `Business` | Negocios/Tiendas | Owned by User, Has Products, Has Orders |
| `Product` | Productos disponibles | Belongs to Business, In OrderItems |
| `Order` | Órdenes/Pedidos | User, Business, Many OrderItems |
| `OrderItem` | Items dentro de una orden | Order, Product |

## Comandos útiles

```bash
# Ver estructura de base de datos
docker-compose exec postgres psql -U postgres -d rapi_db

# Ver logs de PostgreSQL
docker-compose logs postgres

# Detener base de datos
docker-compose down

# Acceder a PgAdmin en navegador
# http://localhost:5050
```

## Migraciones

El backend no debe depender de `synchronize` para crear o modificar tablas. Mantén `DB_SYNCHRONIZE=false` y registra cada cambio de entidad con una migración TypeORM.

```bash
# Crear una migración vacía para escribir SQL manual
npm run migration:create -- src/database/migrations/NombreDeLaMigracion

# Generar migración desde cambios en entidades y revisarla antes de commitear
npm run migration:generate -- src/database/migrations/NombreDeLaMigracion

# Ejecutar migraciones
npm run migration:run

# Revertir última migración
npm run migration:revert
```

## Estructura de carpetas

```
src/
├── common/
│   └── auth/          # Guards, decorators
├── database/
│   └── database.module.ts
├── modules/
│   ├── auth/          # Autenticación
│   ├── users/         # Gestión de usuarios
│   ├── businesses/    # Gestión de negocios
│   ├── products/      # Catálogo de productos
│   └── orders/        # Gestión de órdenes
├── app.module.ts
└── main.ts
```

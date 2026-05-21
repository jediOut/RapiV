# Base de datos PostgreSQL para RapiV

Este directorio contiene la configuración de la base de datos PostgreSQL usando Docker.

## Requisitos

- Docker y Docker Compose instalados
- Node.js 18+ (para el backend)

## Cómo usar

### 1. Iniciar la base de datos

**En Linux/Mac:**
```bash
bash start-db.sh
```

**En Windows:**
```bash
start-db.bat
```

O manualmente:
```bash
docker-compose up -d
```

### 2. Verificar que esté corriendo

```bash
docker-compose ps
```

### 3. Acceder a PgAdmin (opcional)

- URL: http://localhost:5050
- Email: admin@example.com
- Contraseña: admin

### 4. Configurar backend

Crear archivo `.env` en la carpeta `backend/`:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret

DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=rapiv_app
DB_PASSWORD=replace-with-a-strong-local-password
DB_NAME=rapi_db
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

### 5. Instalar dependencias y correr migraciones

```bash
cd backend
npm install
npm run migration:run
npm run start:dev
```

## Comandos útiles

**Detener la base de datos:**
```bash
docker-compose down
```

**Ver logs:**
```bash
docker-compose logs postgres
```

**Conectarse a psql:**
```bash
docker-compose exec postgres psql -U postgres -d rapi_db
```

**Eliminar volumen de datos (⚠️ borra todo):**
```bash
docker-compose down -v
```

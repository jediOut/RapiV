@echo off
REM Colors and messages
setlocal enabledelayedexpansion

echo [92m🚀 Iniciando base de datos PostgreSQL...[0m

REM Check if Docker is running
docker --version >nul 2>&1
if errorlevel 1 (
    echo [91m❌ Docker no está instalado[0m
    exit /b 1
)

REM Start Docker Compose
docker-compose up -d

REM Wait for database to be ready
echo [93m⏳ Esperando a que PostgreSQL esté listo...[0m
timeout /t 10 /nobreak

REM Check if database is running
docker-compose ps postgres | findstr "Up" >nul
if errorlevel 0 (
    echo [92m✅ PostgreSQL está corriendo en localhost:5432[0m
    echo [92m✅ PgAdmin está disponible en http://localhost:5050[0m
    echo.
    echo [93mCredenciales por defecto:[0m
    echo Base de datos: rapi_db
    echo Usuario: postgres
    echo Contraseña: postgres
    echo.
    echo [93mPgAdmin:[0m
    echo Email: admin@example.com
    echo Contraseña: admin
) else (
    echo [91m❌ Error al iniciar PostgreSQL[0m
    exit /b 1
)

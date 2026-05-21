#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Iniciando base de datos PostgreSQL...${NC}"

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    exit 1
fi

# Start Docker Compose
docker-compose up -d

# Wait for database to be ready
echo -e "${YELLOW}⏳ Esperando a que PostgreSQL esté listo...${NC}"
sleep 10

# Check if database is running
if docker-compose ps postgres | grep "Up"; then
    echo -e "${GREEN}✅ PostgreSQL está corriendo en localhost:5432${NC}"
    echo -e "${GREEN}✅ PgAdmin está disponible en http://localhost:5050${NC}"
    echo ""
    echo -e "${YELLOW}Credenciales por defecto:${NC}"
    echo "Base de datos: rapi_db"
    echo "Usuario: postgres"
    echo "Contraseña: postgres"
    echo ""
    echo -e "${YELLOW}PgAdmin:${NC}"
    echo "Email: admin@example.com"
    echo "Contraseña: admin"
else
    echo -e "${RED}❌ Error al iniciar PostgreSQL${NC}"
    exit 1
fi

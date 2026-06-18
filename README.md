# RapiV

Monorepo de RapiV con backend NestJS, aplicaciones Expo para cliente, negocio y repartidor, y contratos compartidos.

## Deploy staging

El deploy de staging corre con GitHub Actions en `.github/workflows/deploy-staging-lite.yml`.

- En `push` a `main`, Actions corre tests/typecheck del backend.
- Construye la imagen Docker del backend en GitHub y la sube a ECR.
- Envia por SSM a la EC2 solo los archivos minimos de despliegue.
- La EC2 hace `docker pull`, corre migraciones, reinicia `backend`/`caddy` y valida `/api/health` dentro del contenedor.

Recursos actuales:

- ECR backend: `687337999212.dkr.ecr.us-east-1.amazonaws.com/rapiv-backend-staging`
- Bucket deploy: `rapiv-deploy-staging-687337999212`
- API staging: `http://13.222.167.88/api`

Tambien se puede correr manualmente desde GitHub Actions con `workflow_dispatch` en la rama `main`.

## Build Android local

Cuando no haya cuota disponible en EAS Cloud, se puede generar el AAB de Android localmente con Docker.

Requisitos:

- Docker Desktop corriendo.
- Sesion de Expo disponible o `EXPO_TOKEN` configurado si se usa `-NonInteractive`.
- Credenciales Android configuradas en EAS para la app.

Build de cliente para prueba en Google Play:

```powershell
.\scripts\build-android-local.ps1 -App cliente-frontend -Profile google-play-test
```

Build de cliente para produccion:

```powershell
.\scripts\build-android-local.ps1 -App cliente-frontend -Profile production
```

El primer build construye la imagen `rapiv-android-build:local` y puede tardar. Los artefactos quedan en `artifacts/android/<app>/`.
El script usa volumenes Docker para cachear `node_modules`, npm, Gradle, NDK y CMake entre builds.

# RapiV

Proyecto inicial del ecosistema RapiV.

Incluye:

- Aplicacion movil de negocios con React Native/Expo.
- Backend modular con NestJS.

## Stack

- React Native
- Expo
- TypeScript
- NestJS

## Comandos app movil

```bash
npm.cmd install
npm.cmd run start
```

Despues de iniciar Expo puedes abrir la app en Android, iOS o Expo Go.

## Flujo inicial

- Estado del negocio abierto/pausado.
- Resumen de ventas, pedidos activos, tiempo estimado y productos disponibles.
- Lista de pedidos entrantes con estado.
- Menu editable con disponibilidad por producto.
- Perfil basico del negocio.
- Login y registro iniciales para negocios.

## Organizacion

```text
App.tsx
src/
  components/   Componentes reutilizables de UI
  data/         Datos mock temporales
  screens/      Pantallas principales
  theme/        Colores y tokens visuales
  types/        Tipos compartidos
```

El flujo de autenticacion es local por ahora. Cuando exista backend, `LoginScreen` y `RegisterScreen` deben llamar a los endpoints reales y guardar la sesion/token.

Actualizacion: login y registro ya llaman al backend. El JWT se guarda en `expo-secure-store` y se valida al abrir la app.

Mientras pruebas desde iPhone, la app usa la IP LAN configurada en `src/config/api.ts`. En nube/AWS esa URL debe cambiar a un dominio HTTPS publico.

## Backend

El backend vive en `backend/`.

```bash
cd backend
npm.cmd install
npm.cmd run start:dev
```

URL base:

```text
http://localhost:3000/api
```

Modulos iniciales:

- `auth`
- `users`
- `businesses`
- `products`
- `orders`

Seguridad actual:

- Passwords guardadas como hash PBKDF2 con salt.
- JWT para sesiones.
- `GET /api/auth/me` valida la sesion guardada en el cliente.
- Rutas protegidas por defecto con guard global JWT.
- `POST /api/auth/register` y `POST /api/auth/login` son publicas.

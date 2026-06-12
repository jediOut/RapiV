# RapiV Admin Web

Panel web estatico para monitorear liquidaciones pendientes.

## Uso local

1. Inicia el backend:

   ```powershell
   cd C:\jediApps\RapiV\backend
   npm.cmd run start:dev
   ```

2. Abre `C:\jediApps\RapiV\admin-web\index.html` en el navegador.

3. Inicia sesion con un usuario que tenga rol `ADMIN`.

El panel usa por defecto `http://localhost:3000/api`, pero puedes cambiarlo en el campo `API`.

## Funciones

- Ver repartidores con liquidaciones de efectivo pendientes.
- Ver negocios con comisiones pendientes por ordenes en efectivo.
- Generar corte diario de repartidores.
- Generar corte semanal de negocios.
- Marcar liquidaciones como confirmadas cuando ya se entrego el dinero.

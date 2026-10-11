# CDCI Front

Frontend web de la plataforma CDCI, construido con Next.js App Router y TypeScript.

## Desarrollo local

Desde esta carpeta, instala dependencias y levanta el servidor de desarrollo:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Registro y sesión

El frontend incluye `/register` y `/login`, protege el dashboard con la sesión de Spring Security y permite cerrar sesión. Las vistas `/admin/users`, `/admin/roles` y `/admin/audit` ofrecen gestión de cuentas, permisos y trazabilidad. La cookie de sesión `HttpOnly` nunca se lee desde JavaScript; `src/lib/api.ts` envía cookies de forma explícita y solicita un token CSRF antes de cada operación de escritura. Las vistas restringen controles según los permisos devueltos por el servidor; el backend vuelve a comprobar cada petición.

## Conexión con Spring Boot

Copia `.env.example` a `.env.local` y ajusta la URL si el backend escucha en otro puerto:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

El flujo de identidad consume la API Spring Boot. Las pantallas de pipelines, despliegues y actividad todavía muestran datos de demostración hasta que se definan esos endpoints.

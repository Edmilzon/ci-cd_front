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

El frontend incluye `/register` y `/login`, protege el dashboard con la sesión de Spring Security, permite cambiar la contraseña y cerrar sesión. Las vistas `/admin/users`, `/admin/roles` y `/admin/audit` ofrecen gestión de cuentas, permisos y trazabilidad. La cookie de sesión `HttpOnly` nunca se lee desde JavaScript; `src/lib/api.ts` envía cookies de forma explícita y solicita un token CSRF antes de cada operación de escritura. Las vistas restringen controles según los permisos devueltos por el servidor; el backend vuelve a comprobar cada petición.

## Conexión con Spring Boot

Copia `.env.example` a `.env.local` y ajusta la URL si el backend escucha en otro puerto:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

El flujo de identidad consume la API Spring Boot. Las pantallas de pipelines, despliegues y actividad todavía muestran datos de demostración hasta que se definan esos endpoints.

## Releases

El workflow GitHub Actions publica un tag validado a `staging` o `production` y revierte automáticamente si falla el health check. La configuración de Environments, el host Linux y las instrucciones de rollback están en [ops/RELEASE.md](ops/RELEASE.md).

## Proyectos y repositorios

`/projects` crea y busca proyectos; el detalle permite editar, archivar, agregar miembros registrados con roles por proyecto y seleccionar repositorios desde GitHub. El frontend no recibe ni almacena tokens de GitHub: el backend gestiona OAuth, cifrado, renovación y revocación. Para habilitar el botón de conexión, sigue la sección **Proyectos y GitHub** del README del backend y configura su GitHub App.

Después de autorizar, GitHub vuelve al backend en `CDCI_GITHUB_CALLBACK_URL`, que conserva la sesión CDCI y redirige a `/projects`. En producción el dominio, callback y política SameSite de la cookie deben quedar alineados.

# CDCI Front

Frontend web de la plataforma CDCI, construido con Next.js App Router y TypeScript.

## Desarrollo local

Desde esta carpeta, instala dependencias y levanta el servidor de desarrollo:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Conexión con Spring Boot

La pantalla está preparada para consumir la API mediante `src/lib/api.ts`. Copia `.env.example` a `.env.local` y ajusta la URL si el backend escucha en otro puerto:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

El backend actual todavía no expone endpoints de pipelines o despliegues. Por eso, el panel muestra datos de demostración y explica qué acciones requieren la API.

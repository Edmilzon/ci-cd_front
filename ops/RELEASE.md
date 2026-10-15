# Publicar el frontend

`.github/workflows/release.yml` publica manualmente un tag anotado `vMAJOR.MINOR.PATCH` integrado en `main` al ambiente GitHub `staging` o `production`. El check `Frontend CI / verify` requerido en `main` ejecuta pruebas de contrato, lint y build antes del merge. El workflow de publicación crea el build standalone de Next.js para el SHA elegido, lo guarda como artefacto Actions por 90 días y lo despliega por SSH. El job de despliegue verifica su checksum. Si `http://127.0.0.1:3000/` no responde, restaura automáticamente el symlink `current` anterior.

## Configuración de GitHub

Crea `staging` y `production` en **Settings → Environments** antes de la primera publicación. Restringe ambos a ejecuciones desde `main`; configura revisores requeridos en `production` y verifica que GitHub aplique la protección para el plan/visibilidad del repositorio. Crea una regla de tags `v*` que impida modificar o borrar tags publicados. Protege `main` y exige el check `Frontend CI / verify` (con tests, lint y build) antes de integrar cambios. En cada ambiente configura:

| Tipo | Nombre | Valor |
|---|---|---|
| Variable | `CDCI_DEPLOY_HOST` | DNS o IPv4 del host del ambiente. |
| Variable | `CDCI_DEPLOY_USER` | Usuario SSH restringido, por ejemplo `cdci-deploy`. |
| Variable | `CDCI_DEPLOY_PORT` | Puerto SSH; opcional, default `22`. |
| Variable | `CDCI_PUBLIC_URL` | URL HTTPS pública del frontend. |
| Secreto | `CDCI_DEPLOY_SSH_KEY` | Clave privada Ed25519. |
| Secreto | `CDCI_DEPLOY_KNOWN_HOSTS` | Entrada `known_hosts` verificada para host y puerto. |

Protege `main` con revisión de cambios. Después de integrar, crea y publica un tag anotado. Desde **Actions → Frontend release**, selecciona `main`, el tag y el ambiente. Las versiones ligeras, tags fuera de `main` y tags que no cumplan `vMAJOR.MINOR.PATCH` se rechazan.

## Host y proxy

Cada ambiente necesita un host Ubuntu 24.04 x86_64 accesible por SSH desde el runner GitHub-hosted `ubuntu-24.04`, con Node.js 22, OpenSSH, `tar`, `sha256sum`, `curl`, `sudo` y systemd. Verifica la huella del host por un canal confiable antes de guardar `CDCI_DEPLOY_KNOWN_HOSTS`; el workflow exige `StrictHostKeyChecking` y no confía en `ssh-keyscan` durante la publicación.

Prepara `/srv/cdci/frontend/releases` con propiedad para `cdci-deploy`; agrega `cdci-deploy` al grupo `cdci-frontend`, y configura el servicio con `User=cdci-frontend`, `Group=cdci-frontend`, `WorkingDirectory=/srv/cdci/frontend/current`, `Environment=NODE_ENV=production`, `Environment=PORT=3000`, `Environment=HOSTNAME=127.0.0.1` y `ExecStart=/usr/bin/node /srv/cdci/frontend/current/server.js`. El despliegue mantiene `.next/cache` escribible por runtime y el resto de archivos de release de solo lectura. Permite a `cdci-deploy` ejecutar `sudo -n systemctl restart cdci-frontend.service` y `sudo -n systemctl stop cdci-frontend.service`, sin privilegios de root generales.

El build usa `NEXT_PUBLIC_API_URL=""` para mantener la API en el origen actual. Configura TLS en Nginx; enruta `/api/` al backend `127.0.0.1:8080` y el resto al frontend `127.0.0.1:3000`. Esto permite mantener la cookie de sesión bajo el mismo origen en ambos ambientes.

En un fallo de salud, revisa `systemctl status cdci-frontend.service` y `journalctl -u cdci-frontend.service`. El workflow preserva las diez versiones recientes y la versión previa. Una reversión manual se ejecuta repitiendo el workflow con el tag anterior; si ese tag sigue en el host, reutiliza exactamente el paquete que ya se desplegó. También requiere la revisión de production.

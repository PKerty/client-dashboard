# Client dashboard

Dashboard privado con la situación de cada cliente. Next.js 16 + Neon Postgres +
Drizzle, desplegado en Vercel. Lo alimenta una tarea programada de Claude
(`../automation/daily-brief.md`) que lee Gmail y Granola. Diseño completo en
`../docs/superpowers/specs/2026-09-22-client-dashboard-design.md`.

## Desarrollo local

```bash
cp .env.example .env.local        # y editá los valores
# Sin Postgres instalado: DATABASE_URL=pglite:./.pglite
npm install
npm run db:seed                   # carga la lista de clientes (idempotente)
npm run dev                       # http://localhost:3000
npm test                          # vitest contra PGlite en memoria
```

## Deploy en Vercel (una sola vez)

1. Subí el repo a GitHub y en Vercel creá un proyecto apuntando a él con
   **Root Directory = `dashboard`**.
2. En la pestaña *Storage* del proyecto agregá **Neon** (plan gratuito). Eso
   crea `DATABASE_URL` en las variables de entorno.
3. En *Settings → Environment Variables* agregá:
   - `DASHBOARD_PASSWORD`: la clave para entrar.
   - `AUTH_SECRET`: `openssl rand -hex 32`.
   - `INGEST_TOKEN`: `openssl rand -hex 32`.
4. Deploy.
5. En tu máquina, en `dashboard/.env.local`, poné el `DATABASE_URL` de Neon
   (lo ves en Vercel), el mismo `INGEST_TOKEN`, y `DASHBOARD_URL` con la URL
   del deploy. Luego:

   ```bash
   npm run db:migrate
   npm run db:seed
   ../automation/scripts/api.sh GET /api/clients
   ```

Cada cambio de esquema: `npm run db:generate` (crea la migración, se
commitea) y `npm run db:migrate` contra Neon.

## API

Todas las rutas exigen `Authorization: Bearer $INGEST_TOKEN`.

| Método | Ruta                         | Uso                                         |
|--------|------------------------------|---------------------------------------------|
| GET    | /api/clients                 | activos con último snapshot y notas         |
| GET    | /api/clients/:slug           | detalle: últimos 10 snapshots y notas       |
| PATCH  | /api/clients/:slug           | `gmailLabelId`, `domains`, `keywords`       |
| POST   | /api/clients/:slug/snapshots | crear snapshot                              |
| POST   | /api/clients/:slug/notes     | crear nota                                  |

Cuerpo de un snapshot:

```json
{
  "status": "green | yellow | red",
  "summary": "Situación en prosa.",
  "nextSteps": [{ "text": "…", "owner": "el usuario", "due": "2026-09-30" }],
  "openPoints": [{ "text": "…", "since": "2026-09-17" }],
  "sources": {
    "threads": [{ "id": "<gmail thread id>", "subject": "…" }],
    "meetings": [{ "id": "<granola id>", "title": "…", "date": "2026-09-21" }]
  },
  "hasChanges": true
}
```

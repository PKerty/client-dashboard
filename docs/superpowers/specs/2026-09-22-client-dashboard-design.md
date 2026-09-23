# Client dashboard: diseño

Fecha: 2026-09-22. Estado: aprobado en chat.

## Objetivo

Un dashboard privado con la situación de cada cliente (estado, próximos pasos,
puntos abiertos), alimentado automáticamente desde Gmail y Granola, con notas
propias del usuario que la automatización nunca pisa. Se consulta en el
navegador o preguntándole a Claude, que lee los mismos datos.

## Decisiones tomadas

- No se usa Notion. El dashboard es una app propia, gratis, en Vercel.
- Sin Jev ni otro clasificador externo: el volumen (decenas de hilos) no lo
  justifica. La etapa de ingesta queda aislada para poder agregarlo después.
- La ingesta y la síntesis las hace Claude desde una tarea programada de la
  app de escritorio, que corre en la máquina del usuario con sus conectores de
  Gmail y Granola. La app web no tiene credenciales de Google, Granola ni Anthropic.
- Autenticación por clave única. Google SSO queda fuera de esta versión.
- Lista canónica de clientes: `dashboard/clients.json`, ignorado por git y
  cargado a la tabla `clients` con `npm run db:seed`. Si un cliente no tiene
  dominios cargados, la primera corrida los infiere de los hilos que ya tengan
  su etiqueta; si la etiqueta no existe en Gmail, la crea.

## Piezas

### 1. App web (`dashboard/` en el repo, raíz del deploy en Vercel)

- Next.js App Router, TypeScript, Tailwind. Neon Postgres (free tier, desde el
  marketplace de Vercel) con Drizzle ORM y migraciones en `drizzle/`.
- Responsabilidad única: guardar y mostrar. No llama a servicios externos.

### 2. Tarea programada (`automation/daily-brief.md`)

- Prompt versionado en el repo y dado de alta como tarea programada de la app
  de escritorio (cron `0 8 * * 1-5`, hora local). Cada corrida empieza sin
  memoria: el prompt es autocontenido.
- Usa los conectores Gmail y Granola y los scripts de `automation/scripts/`
  para hablar con el API (los scripts leen `INGEST_TOKEN` y `DASHBOARD_URL`
  de `dashboard/.env.local`; el prompt nunca contiene el token).

### 3. Chat

- Claude lee `GET /api/clients` y `GET /api/clients/:slug` con el mismo
  script, y crea notas con `POST /api/clients/:slug/notes` cuando el usuario
  le dicta una nota.

## Datos

```
clients
  id            serial PK
  slug          text unique
  name          text
  gmail_label_id text null        -- id de la etiqueta en Gmail
  gmail_label_name text           -- "clients/<nombre>"
  domains       text[]            -- dominios externos del cliente
  keywords      text[]            -- para matchear títulos de reuniones
  active        boolean default true
  created_at    timestamptz

snapshots
  id            serial PK
  client_id     FK clients
  status        enum('green','yellow','red')
  summary       text              -- situación en prosa, 2-6 oraciones
  next_steps    jsonb             -- [{text, owner?, due?}]
  open_points   jsonb             -- [{text, since?}]
  sources       jsonb             -- {threads:[{id,subject}], meetings:[{id,title,date}]}
  has_changes   boolean           -- false = "sin novedades", se mantuvo el estado
  generated_at  timestamptz

notes
  id            serial PK
  client_id     FK clients
  body          text
  created_at    timestamptz
  updated_at    timestamptz
```

El dashboard muestra el último snapshot por cliente; el historial queda y se
ve colapsado en el detalle.

## API

Todas las rutas bajo `/api` exigen `Authorization: Bearer <INGEST_TOKEN>`.
Cuerpos validados con zod; un cuerpo inválido responde 400 y no escribe nada.

| Método | Ruta                          | Uso                                        |
|--------|-------------------------------|--------------------------------------------|
| GET    | /api/clients                  | clientes activos + último snapshot + notas |
| GET    | /api/clients/:slug            | un cliente, últimos 10 snapshots, notas    |
| PATCH  | /api/clients/:slug            | actualizar gmail_label_id, domains, keywords|
| POST   | /api/clients/:slug/snapshots  | crear snapshot                             |
| POST   | /api/clients/:slug/notes      | crear nota                                 |

Las notas desde la UI usan server actions (crear, editar, borrar), protegidas
por la sesión de la cookie, no por el token.

## Seguridad

- `/login`: formulario con clave. Compara contra `DASHBOARD_PASSWORD` en
  tiempo constante. Si coincide, setea cookie `session` HttpOnly, Secure,
  SameSite=Lax, con valor `exp.hmac(exp)` firmado con `AUTH_SECRET`, 30 días.
- `middleware.ts`: toda ruta salvo `/login`, `/api/*` y assets exige cookie
  válida; si no, redirige a `/login`.
- `/api/*`: bearer token comparado en tiempo constante contra `INGEST_TOKEN`.
- Variables de entorno: `DATABASE_URL`, `DASHBOARD_PASSWORD`, `AUTH_SECRET`,
  `INGEST_TOKEN`. Ejemplo en `dashboard/.env.example`; `.env.local` ignorado.

## UI

- `/`: grilla de tarjetas, una por cliente activo, ordenadas rojo > amarillo >
  verde > sin snapshot, y dentro de cada grupo por última actualización.
  Tarjeta: nombre, semáforo, "hace X", primera oración de la situación,
  cantidad de puntos abiertos.
- `/clients/[slug]`: cabecera con nombre y semáforo; situación; próximos pasos;
  puntos abiertos; notas del usuario (lista con fecha, formulario para agregar,
  editar y borrar inline); historial de snapshots colapsado (fecha, semáforo,
  resumen); fuentes del último snapshot con links a Gmail y Granola.
- Responsive; se usa desde el celular.

## Flujo de la corrida diaria

Para cada cliente activo de `GET /api/clients`:

1. Contexto: último snapshot y notas.
2. Gmail: `search_threads` con `label:<id> newer_than:3d` y, por cada dominio,
   `from:@dominio newer_than:3d`. Hilos del dominio sin la etiqueta se
   etiquetan con `label_thread`. Se leen con `get_thread` los que cambiaron.
3. Granola: `list_meetings` de los últimos 7 días; se consideran del cliente
   las reuniones con participantes de sus dominios o título que contenga una
   keyword. Se lee el contenido de las que no figuran en `sources` del
   último snapshot.
4. Síntesis: partiendo del snapshot anterior y las notas del usuario, redactar
   situación, próximos pasos y puntos abiertos actualizados y asignar
   semáforo (rojo: hay algo bloqueado o vencido o una urgencia del cliente;
   amarillo: hay pendientes del usuario sin fecha o sin respuesta; verde: todo
   en curso). Si no hubo mails ni reuniones nuevas, `has_changes=false` y se
   repite el estado anterior.
5. `POST /api/clients/:slug/snapshots`.

Primera corrida, además: crear las etiquetas de Gmail que falten y guardar su
id con PATCH; inferir los dominios de los clientes que no los tengan.

Si un cliente falla, la corrida sigue con el resto y lo lista en el resumen
final. La notificación de la corrida incluye, por cliente, semáforo y una
línea de qué cambió.

## Errores y tests

- API: zod en cada cuerpo; 401 sin token; 404 slug desconocido; 400 cuerpo
  inválido; nunca escritura parcial (una transacción por request).
- Tests con vitest. Unitarios: firma y verificación de cookie, validadores.
  De integración: rutas y queries contra PGlite (Postgres en memoria) con las
  migraciones aplicadas. Smoke manual del UI en el navegador antes de cada
  commit de UI.

## Fuera de alcance

- Google SSO, multiusuario, roles.
- Marcar puntos abiertos como resueltos desde la UI (se resuelven charlando
  con Claude; la próxima corrida los quita).
- Jev o cualquier pre-clasificador.
- Envío de mails o respuestas automáticas.

## Commits previstos

1. Spec (este archivo).
2. Scaffold Next.js + Tailwind, esquema Drizzle y migración inicial.
3. Login con clave, cookie firmada y middleware.
4. API: rutas de lectura, PATCH, snapshots y notas, con token.
5. UI: grilla de clientes.
6. UI: detalle de cliente con notas (server actions) e historial.
7. Seed de clientes desde `clients.json` y scripts de `automation/scripts/`.
8. Prompt `automation/daily-brief.md` y alta de la tarea programada.

Queda a cargo del usuario: crear el proyecto en Vercel, agregar Neon desde el
marketplace y cargar las variables de entorno. Los pasos van en el README.

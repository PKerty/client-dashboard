# Client dashboard

Dashboard privado con la situación de cada cliente: semáforo, situación,
próximos pasos, puntos abiertos y notas propias. Lo alimenta una tarea
programada de Claude (app de escritorio) que cada mañana lee Gmail y Granola,
taguea los mails por cliente y escribe un snapshot por cliente en el dashboard.

```
dashboard/     app Next.js + Neon Postgres, desplegada en Vercel (ver dashboard/README.md)
automation/    prompt de la corrida diaria y el script api.sh que usa para hablar con el dashboard
docs/          spec y plan de implementación
```

## Puesta en marcha

1. **Dashboard.** Seguí [dashboard/README.md](dashboard/README.md): desarrollo
   local, deploy en Vercel con Neon, variables de entorno, migración y seed.
2. **`dashboard/.env.local`.** Además de las variables de la app, tiene que
   tener `DASHBOARD_URL` (la URL del deploy, o `http://localhost:3000` en
   local) e `INGEST_TOKEN`. `automation/scripts/api.sh` los lee de ahí.
   Probá con:

   ```bash
   automation/scripts/api.sh GET /api/clients
   ```
3. **Tarea programada.** En la app de escritorio de Claude Code, creá una
   tarea programada (sección *Scheduled*, o pidiéndoselo a Claude) con:
   - prompt: el contenido de [automation/daily-brief.md](automation/daily-brief.md)
   - cron: `0 8 * * 1-5` (lunes a viernes a las 8, hora local)
   - conectores necesarios: Gmail y Granola conectados en claude.ai

   La primera vez, corré la tarea con *Run now* y aprobá los permisos que
   pida (Bash para `api.sh`, Gmail, Granola). Quedan guardados para las
   corridas siguientes. Esa primera corrida además crea las etiquetas de
   Gmail que falten e infiere los dominios de los clientes que no los tengan.

La tarea corre solo con la app abierta. Si está cerrada a la hora, corre al
abrirla. Cada corrida termina con un resumen de una línea por cliente.

## Uso diario

- **Ver**: abrí el dashboard y entrá con la clave. Las tarjetas se ordenan
  por urgencia; el detalle muestra situación, pasos, puntos abiertos, notas,
  fuentes (links a Gmail y Granola) e historial.
- **Anotar**: escribí notas desde el detalle del cliente, o dictáselas a
  Claude. La corrida las lee como contexto y nunca las modifica.
- **Actualizar fuera de horario**: *Run now* en la tarea, o pedirle a Claude
  "actualizá <cliente>" en un chat con el repo abierto.
- **Agregar o dar de baja un cliente**: editá la lista en
  `dashboard/scripts/seed.ts` y corré `npm run db:seed` (solo inserta los
  slugs nuevos); para dar de baja, poné `active = false` en la base.

## Cómo consulta Claude

Con el repo abierto en la sesión, Claude usa `automation/scripts/api.sh` para
leer `GET /api/clients/<slug>` y para crear notas con
`POST /api/clients/<slug>/notes`. Todas las rutas del API exigen el bearer
token; nunca hay que pegarlo en un prompt.

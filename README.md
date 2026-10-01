# AcademiaHub · Reserva de espacios y recursos académicos

Primer incremento funcional de la **Fase 4 — Desarrollo Ágil e I+D** del Proyecto Integrador de I+D+I.
Plataforma web para reservar salas, laboratorios y equipos con **disponibilidad en tiempo real** y
**bloqueo automático de solapamientos de horario**.

> Plan de ingeniería completo (arquitectura, backlog, Git, pruebas): [`docs/PLAN_FASE_4.md`](docs/PLAN_FASE_4.md)
> · Tarjetas para el tablero: [`docs/kanban/backlog.csv`](docs/kanban/backlog.csv)

## Qué hace

| Persona                            | Puede                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solicitante (estudiante o docente) | Ingresar con su correo institucional (código de un solo uso), explorar el catálogo con filtros, ver el calendario semanal en vivo, reservar, recibir el comprobante con radicado, cancelar y consultar su historial |
| Encargado de recursos              | Todo lo anterior + aprobar o rechazar (con motivo) las solicitudes de los recursos que tiene asignados                                                                                                              |
| Administrador                      | Todo lo anterior sobre todos los recursos                                                                                                                                                                           |

La regla central —**dos reservas activas del mismo recurso no pueden solaparse**— está en PostgreSQL
(`EXCLUDE USING gist`), no solo en el código: se cumple aunque haya varias instancias o peticiones simultáneas.

## Requisitos

- Node.js **22** (`nvm use` lee `.nvmrc`)
- Docker (para PostgreSQL 16 local) — o un PostgreSQL 16 propio con la extensión `btree_gist` disponible
- Git

## Arranque rápido (≈ 10 minutos)

```bash
npm ci                                   # instala API y web (workspaces)
npm run db:up                            # PostgreSQL 16 en Docker (crea academiahub_dev y academiahub_test)
cp apps/api/.env.example apps/api/.env   # en Windows (PowerShell): Copy-Item
cp apps/web/.env.example apps/web/.env
npm run db:migrate                       # crea el esquema
npm run db:seed                          # 7 recursos de ejemplo (Aula 301, Laboratorio 105…)
npm run dev:api                          # terminal 1 → http://localhost:3000
npm run dev:web                          # terminal 2 → http://localhost:5173
```

1. Abre http://localhost:5173 e ingresa con un correo del dominio configurado en `ALLOWED_EMAIL_DOMAINS`
   (por defecto `@ecci.edu.co`; cámbialo en `apps/api/.env` si quieres probar con otro).
2. En desarrollo el correo **no se envía**: el código de 6 dígitos aparece en la terminal de la API.
3. Para probar el rol de administrador o de encargado, agrega tu correo a `BOOTSTRAP_ADMIN_EMAILS`
   o a `SEED_MANAGER_EMAILS` (en `apps/api/.env`) y vuelve a ejecutar `npm run db:seed`.

## Scripts (desde la raíz)

| Comando                                                       | Qué hace                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev:api` / `npm run dev:web`                         | Servidores de desarrollo con recarga                             |
| `npm run db:up`                                               | Levanta PostgreSQL con `docker compose`                          |
| `npm run db:migrate` · `npm run db:seed`                      | Aplica migraciones · carga recursos de ejemplo (idempotente)     |
| `npm run lint` · `npm run format:check` · `npm run typecheck` | Calidad estática                                                 |
| `npm test`                                                    | Pruebas de API (unitarias + integración con PostgreSQL) y de web |
| `npm run build`                                               | Compila API (`apps/api/dist`) y web (`apps/web/dist`)            |

Las pruebas de integración necesitan `TEST_DATABASE_URL` (ver `apps/api/.env.example`). Sin esa variable se
omiten y solo corren las unitarias. El nombre de esa base **debe contener "test"**: las pruebas vacían las tablas.

## Estructura

```
apps/
  api/                 Node 22 · Express 5 · TypeScript · PostgreSQL
    db/migrations/     Esquema SQL versionado (001_init.sql)
    src/
      domain/          Reglas puras: franjas, calendario del campus, política de reservas
      application/     Casos de uso y puertos (interfaces)
      infrastructure/  Adaptadores: Postgres, SMTP, Socket.IO, cifrado, configuración
      interfaces/http/ Rutas, validación (Zod), DTO y errores HTTP
      composition/     Raíz de composición (único lugar que crea los adaptadores)
    test/              unit/ e integration/
  web/                 React 19 · Vite · Tailwind CSS 4 · TanStack Query
    src/features/      auth · resources · availability · reservations · approvals
docs/                  Plan de ingeniería de la Fase 4 y backlog importable
render.yaml            Blueprint de Render (API + PostgreSQL)
.github/               CI, plantilla de Pull Request y de tarjetas
```

**Regla de dependencia** (la verifica ESLint): `domain` ← `application` ← `infrastructure` / `interfaces`
← `composition`. El dominio y los casos de uso no importan librerías ni capas externas.

## Variables de entorno

Todas las de la API se validan al arrancar (Zod): si falta algo o es inválido, el servidor no inicia y explica por qué.

| Variable                                                                   | Obligatoria      | Descripción                                                            |
| -------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                                                             | Sí               | Conexión a PostgreSQL                                                  |
| `DATABASE_SSL`                                                             | No               | `false` (defecto) · `true` (TLS verificado) · `no-verify`              |
| `OTP_PEPPER`                                                               | Sí               | Secreto para firmar los códigos de acceso. Producción: ≥ 32 caracteres |
| `CORS_ORIGINS`                                                             | Sí en producción | URL(s) del frontend separadas por coma                                 |
| `ALLOWED_EMAIL_DOMAINS`                                                    | No               | Dominios institucionales permitidos (defecto `ecci.edu.co`)            |
| `BOOTSTRAP_ADMIN_EMAILS`                                                   | No               | Correos que reciben el rol ADMIN al primer ingreso                     |
| `MAIL_TRANSPORT`                                                           | No               | `console` (desarrollo) · `smtp` (**obligatorio en producción**)        |
| `SMTP_URL`, `MAIL_FROM`                                                    | Con `smtp`       | p. ej. `smtps://usuario:clave@smtp.proveedor.com:465`                  |
| `CAMPUS_TIMEZONE`, `CAMPUS_OPEN_HOUR`, `CAMPUS_CLOSE_HOUR`, `SLOT_MINUTES` | No               | Reglas del campus (defecto: America/Bogota, 7–19 h, franjas de 60 min) |
| `OTP_TTL_MINUTES`, `SESSION_TTL_HOURS`                                     | No               | Vigencia del código (10 min) y de la sesión (8 h)                      |
| `RATE_LIMIT_ENABLED`                                                       | No               | Límite de intentos por IP en los endpoints de acceso (defecto `true`)  |
| `VITE_API_URL`, `VITE_APP_NAME`                                            | Web              | URL pública de la API y nombre de la marca                             |

## Despliegue

**API + base de datos → Render** (`render.yaml`)

1. En Render: _New → Blueprint_ y elige este repositorio. Completa los valores que pide (`CORS_ORIGINS`,
   `SMTP_URL`, `MAIL_FROM`, `BOOTSTRAP_ADMIN_EMAILS`).
2. El servicio ejecuta `npm run start:prod -w apps/api`, que **aplica las migraciones pendientes y arranca**. El health check es `/api/health`.
3. Con `autoDeployTrigger: checksPass`, Render solo despliega si el CI de GitHub Actions termina en verde.
4. Carga los recursos iniciales una vez, desde tu equipo, con la URL **externa** de la base:
   `DATABASE_URL=<url-externa> DATABASE_SSL=true npm run db:seed`.

**Frontend → Vercel**

1. _Add New → Project_, importa el repositorio y fija **Root Directory = `apps/web`** (preset Vite).
2. Variable de entorno: `VITE_API_URL=https://<tu-api>.onrender.com`.
3. En _Settings → Git_ deja **`main` como rama de producción** (las demás ramas generan _previews_).
4. Agrega la URL de Vercel a `CORS_ORIGINS` en Render.

> Verifica los límites vigentes de los planes gratuitos (suspensión por inactividad, vigencia de la base de datos)
> antes de una demostración. Las cuentas y variables reales no se han configurado todavía: es la tarjeta `TK-03`.

## Flujo de trabajo

GitFlow (`main`, `develop`, `feature/*`, `bugfix/*`, `release/*`, `hotfix/*`) + tablero Scrumban
(Historias → Desarrollo → Code Review → Integración → QA → Done, WIP 2). Los comandos paso a paso, las
reglas de protección de ramas y la Definición de "Done" están en [`docs/PLAN_FASE_4.md`](docs/PLAN_FASE_4.md)
(Bloques 2, 4 y 5). Cada Pull Request usa la plantilla de `.github/pull_request_template.md`.

## Limitaciones conocidas

- El ingreso es por **código enviado al correo**; el SSO institucional (OIDC) es un _spike_ pendiente (`SP-01`).
- El token de sesión se guarda en `localStorage` (riesgo XSS mitigado con vigencia corta y revocación en el servidor).
- El tiempo real funciona con **una** instancia de la API; con varias se necesita un adaptador de Redis (`SP-02`).
- Los correos se envían "en segundo plano" sin cola de reintentos (patrón _outbox_ pendiente).
- Los recursos se administran con `db:seed` o SQL: aún no hay pantalla de administración (`HU-15`).
- No hay todavía pruebas de extremo a extremo en navegador ni cabeceras CSP en el frontend.

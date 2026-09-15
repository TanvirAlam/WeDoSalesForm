# We Do Sales · Samtykke

We Do Sales samtykkeformular (consent form) bygget med **Next.js**, **React**, **TypeScript** og **Supabase**.

Deployes som **én enkelt app på Vercel** — frontend og API i samme projekt.

## Struktur

```
src/
  app/
    layout.tsx      # Root layout (HTML, head, fonts)
    page.tsx        # Hovedside — samtykkeformularen (client component)
    globals.css     # Globale styles
    api/
      health/route.ts   # GET /api/health
      config/route.ts   # GET /api/config
      consent/route.ts  # POST /api/consent (Supabase)
  lib/
    supabase.ts   # Supabase klient (server-side)
    types.ts      # TypeScript typer for tabeller
public/             # Statiske filer (favicon, logos)
server/
  migrate.js        # Supabase migration helper
  schema_supabase.sql # SQL til Supabase SQL Editor
```

## Kommandos

### Installation

```bash
npm install
```

### Udvikling

```bash
npm run dev
# Åbn http://localhost:3000
```

### Bygget

```bash
npm run build
```

### Produktion (lokalt)

```bash
npm run start
# Åbn http://localhost:3000
```

### Lint

```bash
npm run lint
```

### Database migration

```bash
npm run migrate          # Udskriver SQL fra server/schema_supabase.sql
npm run migrate:status   # Vis vejledning til opsætning i Supabase
```

## Deployment til Vercel

1. Push koden til GitHub/GitLab
2. Importér repoet på [vercel.com](https://vercel.com)
3. Sæt miljøvariabler i Vercel dashboard:
   - `SUPABASE_URL` — din Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` — din Service Role Key
4. Deploy!

Ingen separat server eller Docker nødvendig — Next.js API routes og frontend serveres fra samme Vercel-prov.

## Supabase Opsætning

1. Opret et projekt på [supabase.com](https://supabase.com)
2. Gå til **SQL Editor** og kør `server/schema_supabase.sql`
3. Kopier **Service Role Key** fra Settings → API → Service Role Key
4. Sæt `SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY` i din `.env` fil (eller Vercel miljøvariabler)

## Database

Database-schema findes i `server/schema_supabase.sql`. Tabellerne `consents` og `consent_partners` oprettes ved kørsel af SQL-filen i Supabase SQL editor.

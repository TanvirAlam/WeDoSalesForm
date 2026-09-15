#!/usr/bin/env node
/* eslint-disable no-console */
// Migration runner for We Do Sales samtykke.
// - Bruger server/migrations/NNNN_*.sql
// - Tracker anvendte migrationer i tabellen _migrations
// - CLI:  npm run migrate           (kør nye)
//        node server/migrate.js status  (vis hvad der er kørt)

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool, Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function poolConfig() {
    // Tillad DB_URL som ét alternativ til de individuelle PG* env vars.
    if (process.env.DB_URL) return { connectionString: process.env.DB_URL };
    return {
        host:     process.env.PGHOST     || 'localhost',
        port:     Number(process.env.PGPORT) || 5432,
        database: process.env.PGDATABASE || 'wedosalesform',
        user:     process.env.PGUSER     || 'tanviralam',
        password: process.env.PGPASSWORD || '',
    };
}

async function ensureDatabaseExists() {
    // Hvis selve databasen mangler, opret den via en separat forbindelse til "postgres".
    const cfg = poolConfig();
    let dbName;
    if (typeof cfg === 'string' || cfg.connectionString) {
        const url = new URL(cfg.connectionString || cfg);
        dbName = (url.pathname || '').replace(/^\//, '') || 'wedosalesform';
    } else {
        dbName = cfg.database;
    }

    const adminCfg = typeof cfg === 'string' || cfg.connectionString
        ? { connectionString: replaceDbInUrl(cfg.connectionString, 'postgres') }
        : { ...cfg, database: 'postgres' };

    const admin = new Client(adminCfg);
    await admin.connect();
    try {
        const r = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
        if (r.rowCount === 0) {
            // Identifiers skal escapes — vi validerer navnet selv.
            if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
                throw new Error(`Ugyldigt database-navn: ${dbName}`);
            }
            console.log(`➕ Opretter database "${dbName}"…`);
            await admin.query(`CREATE DATABASE "${dbName}"`);
        }
    } finally {
        await admin.end();
    }
}

function replaceDbInUrl(connStr, newDb) {
    const url = new URL(connStr);
    url.pathname = '/' + newDb;
    return url.toString();
}

async function listMigrations(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id          SERIAL PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);
    const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter(f => /^\d{4}_.+\.sql$/.test(f))
        .sort();
    const { rows } = await pool.query('SELECT name FROM _migrations');
    const applied = new Set(rows.map(r => r.name));
    return files.map(f => ({ name: f, applied: applied.has(f) }));
}

async function run() {
    const cmd = process.argv[2] || 'up';

    await ensureDatabaseExists();

    const pool = new Pool(poolConfig());
    try {
        const all = await listMigrations(pool);

        if (cmd === 'status') {
            console.log('Migration status:');
            for (const m of all) {
                console.log(`  ${m.applied ? '✓' : '·'} ${m.name}`);
            }
            const pending = all.filter(m => !m.applied);
            console.log(`\nI alt ${all.length} migrationer, ${pending.length} afventer.`);
            return;
        }

        if (cmd !== 'up') {
            console.error(`Ukendt kommando: "${cmd}". Brug "up" eller "status".`);
            process.exit(2);
        }

        const pending = all.filter(m => !m.applied);
        if (!pending.length) {
            console.log('✓ Ingen afventende migrationer — databasen er up-to-date.');
            return;
        }

        for (const m of pending) {
            console.log(`▶ Kører ${m.name}…`);
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, m.name), 'utf8');
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO _migrations(name) VALUES ($1)', [m.name]);
                await client.query('COMMIT');
                console.log(`✓ ${m.name} anvendt`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`✗ ${m.name} fejlede:`, err.message);
                process.exit(1);
            } finally {
                client.release();
            }
        }

        console.log('\n✅ Alle migrationer gennemført.');
    } finally {
        await pool.end();
    }
}

run().catch(err => {
    console.error('Migration fejlede:', err);
    process.exit(1);
});

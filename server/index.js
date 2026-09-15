// Minimal Express API til We Do Sales samtykkeformularen.
// Ét endpoint: POST /api/consent — gemmer kunde + partnere + underskrift i Postgres.

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const PORT = Number(process.env.PORT) || 4000;
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const pool = new Pool({
    host:     process.env.PGHOST     || 'localhost',
    port:     Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'wedosalesform',
    user:     process.env.PGUSER     || 'tanviralam',
    password: process.env.PGPASSWORD || '',
});

const PARTNERE = [
    { id: 'modstroem',          navn: 'Modstrøm',         formaal: 'salg af el og elaftaler',     varighed: 12 },
    { id: 'forsikring-danmark', navn: 'Forsikring Danmark', formaal: 'tilbud på forsikringer',     varighed: 12 },
    { id: 'pension-danmark',    navn: 'Pension Danmark',   formaal: 'rådgivning om pensionsopsparing', varighed: 12 },
];

const KAMPAGNE = {
    navn:     'Leads · uge 37',
    rep:      { navn: 'Mads K.', id: 'WDS-114' },
    wdsCvr:   process.env.WDS_CVR || '',
};

// Initialiser schema ved opstart (idempotent).
async function initSchema() {
    const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await pool.query(sql);
    console.log('✓ Postgres schema klar');
}

function makeReference() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `WDS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
}

function cleanDigits(s) {
    return String(s || '').replace(/\D/g, '').replace(/^45(?=\d{8}$)/, '');
}

function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(s || '').trim());
}

function isValidPhone(s) {
    return /^\d{8}$/.test(cleanDigits(s));
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' })); // underskrift som base64-PNG

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Hent config (kampagne + partnere) — frontend kan vise det samme som originalen.
app.get('/api/config', (_req, res) => {
    res.json({ kampagne: KAMPAGNE, partnere: PARTNERE });
});

app.post('/api/consent', async (req, res) => {
    const body = req.body || {};
    const navn    = String(body.navn || '').trim();
    const telefon = cleanDigits(body.telefon);
    const email   = String(body.mail || body.email || '').trim();
    const valgteIds = Array.isArray(body.valgte) ? body.valgte.map(String) : [];
    const signatur  = String(body.underskrift || body.signature || '');

    const konsulent = String(body.konsulent || body.konsulent_navn || '').trim();

    const fejl = [];
    if (navn.length < 2)                              fejl.push('navn');
    if (!isValidPhone(telefon))                       fejl.push('telefonnummer');
    if (!isValidEmail(email))                         fejl.push('e-mail');
    if (konsulent.length < 2)                         fejl.push('konsulentens navn');
    if (!valgteIds.length)                            fejl.push('mindst én tilladelse');
    if (!signatur.startsWith('data:image/'))          fejl.push('underskrift');

    if (fejl.length) {
        return res.status(400).json({ ok: false, mangler: fejl });
    }

    const reference = makeReference();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const ins = await client.query(
            `INSERT INTO consents
                (reference, navn, telefon, email, underskrift,
                 kampagne, saelger_navn, saelger_id, konsulent_navn, enhed, version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING id, created_at`,
            [
                reference,
                navn,
                telefon,
                email,
                signatur,
                KAMPAGNE.navn,
                KAMPAGNE.rep.navn,
                KAMPAGNE.rep.id,
                konsulent,
                String(req.headers['user-agent'] || ''),
                'samtykke-v2.0',
            ]
        );

        const consentId = ins.rows[0].id;
        const createdAt = ins.rows[0].created_at;
        const chosenSet = new Set(valgteIds);

        for (const p of PARTNERE) {
            const givet = chosenSet.has(p.id);
            const udloeber = givet
                ? new Date(createdAt.getFullYear(), createdAt.getMonth() + p.varighed, createdAt.getDate())
                : null;
            await client.query(
                `INSERT INTO consent_partners
                    (consent_id, partner_id, partner_navn, formaal, givet, tekst, udloeber)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [
                    consentId,
                    p.id,
                    p.navn,
                    p.formaal,
                    givet,
                    `Ja, ${p.navn} må ringe til mig om ${p.formaal}.`,
                    udloeber,
                ]
            );
        }

        await client.query('COMMIT');
        res.json({
            ok: true,
            reference,
            tidspunkt: createdAt.toISOString(),
            konsulent,
            valgte: PARTNERE.filter(p => chosenSet.has(p.id)).map(p => p.id),
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ DB-fejl:', err);
        res.status(500).json({ ok: false, error: 'database_error' });
    } finally {
        client.release();
    }
});

(async () => {
    try {
        await initSchema();
        app.listen(PORT, () => {
            console.log(`✓ API klar på http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Kunne ikke starte serveren:', err);
        process.exit(1);
    }
})();

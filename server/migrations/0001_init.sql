-- 0001 · initial schema for We Do Sales samtykke

CREATE TABLE IF NOT EXISTS consents (
    id              BIGSERIAL PRIMARY KEY,
    reference       TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    navn            TEXT NOT NULL,
    telefon         TEXT NOT NULL,
    email           TEXT NOT NULL,
    underskrift     TEXT NOT NULL,        -- base64 PNG (data URL)
    kampagne        TEXT NOT NULL,
    saelger_navn    TEXT NOT NULL,
    saelger_id      TEXT NOT NULL,
    konsulent_navn  TEXT,                 -- navn på den sælger/konsulent der sidder med kunden
    enhed           TEXT,
    version         TEXT NOT NULL DEFAULT 'samtykke-v2.0'
);

-- Migration: tilføj konsulent_navn hvis tabellen allerede findes uden kolonnen.
ALTER TABLE consents
    ADD COLUMN IF NOT EXISTS konsulent_navn TEXT;

CREATE INDEX IF NOT EXISTS consents_created_at_idx ON consents (created_at DESC);
CREATE INDEX IF NOT EXISTS consents_telefon_idx   ON consents (telefon);

CREATE TABLE IF NOT EXISTS consent_partners (
    id              BIGSERIAL PRIMARY KEY,
    consent_id      BIGINT NOT NULL REFERENCES consents(id) ON DELETE CASCADE,
    partner_id      TEXT NOT NULL,
    partner_navn    TEXT NOT NULL,
    formaal         TEXT NOT NULL,
    givet           BOOLEAN NOT NULL,
    tekst           TEXT NOT NULL,
    udloeber        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS consent_partners_consent_idx ON consent_partners (consent_id);
CREATE UNIQUE INDEX IF NOT EXISTS consent_partners_uniq
    ON consent_partners (consent_id, partner_id);

#!/usr/bin/env node
/* eslint-disable no-console */
// Supabase migration helper for We Do Sales samtykke.
//
// Med Supabase køres schema direkte i Supabase SQL Editor:
//   1. Åbn https://app.supabase.com/project/<project>/sql/new
//   2. Kør: node server/migrate.js status (viser vejledning)
//   3. Eller kør: node server/migrate.js up (udskriver SQL)
//
// Eller åbn server/schema_supabase.sql og kopier SQL'et ind i Supabase.

const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.join(__dirname, "schema_supabase.sql");

function log(msg) {
  console.log(msg);
}

async function run() {
  const cmd = process.argv[2] || "up";

  if (cmd === "status") {
    log("Supabase migration status:");
    log("");
    log("  Tabellerne oprettes via SQL i Supabase SQL Editor.");
    log("  Se server/schema_supabase.sql for schema.");
    log("");
    log("  Trin:");
    log("    1. Gå til https://app.supabase.com/project/<project>/sql/new");
    log("    2. Åbn server/schema_supabase.sql og kopier SQL'et");
    log("    3. Klik 'Run' i Supabase SQL Editor");
    log("");
    log("✓ Ingen filbaserede migrationer nødvendige.");
    return;
  }

  if (cmd !== "up") {
    console.error(`Ukendt kommando: "${cmd}". Brug "up" eller "status".`);
    process.exit(2);
  }

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error("Fantes ikke: " + SCHEMA_PATH);
    process.exit(1);
  }

  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  log("▶ Udskriver SQL fra server/schema_supabase.sql:");
  log("");
  log(sql);
  log("");
  log("✓ Kopier SQL'et til Supabase SQL Editor og klik 'Run'.");
}

run().catch((err) => {
  console.error("Migration fejlede:", err);
  process.exit(1);
});

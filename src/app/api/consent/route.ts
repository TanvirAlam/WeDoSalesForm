import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { ConsentInsert, ConsentPartnerInsert } from "@/lib/types";

function extractBase64(dataUrl: string): Buffer {
  const base64 = dataUrl.split(",")[1];
  return Buffer.from(base64, "base64");
}

const BUCKET_NAME = "WeDoSalesBucket";

async function uploadSignature(
  supabase: ReturnType<typeof getSupabase>,
  reference: string,
  signatur: string
): Promise<string> {
  const buffer = extractBase64(signatur);
  const fileName = `${reference}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

  return publicUrl;
}

type Partner = {
  id: string;
  navn: string;
  formaal: string;
  varighed: number;
};

const PARTNERE: Partner[] = [
  { id: "modstroem", navn: "Modstrøm", formaal: "salg af el og elaftaler", varighed: 12 },
  { id: "forsikring-danmark", navn: "Forsikring Danmark", formaal: "tilbud på forsikringer", varighed: 12 },
  { id: "pension-danmark", navn: "Pension Danmark", formaal: "rådgivning om pensionsopsparing", varighed: 12 },
];

const KAMPAGNE = {
  navn: "Leads · uge 37",
  rep: { navn: "Mads K.", id: "WDS-114" },
};

function makeReference() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WDS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
}

function cleanDigits(s: string) {
  return String(s || "").replace(/\D/g, "").replace(/^45(?=\d{8}$)/, "");
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(s || "").trim());
}

function isValidPhone(s: string) {
  return /^\d{8}$/.test(cleanDigits(s));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const navn = String(body.navn || "").trim();
    const telefon = cleanDigits(body.telefon);
    const email = String(body.mail || body.email || "").trim();
    const emailBekraeft = String(body.mail2 || body.emailConfirm || "").trim();
    const accepteret = body.accepteret === true;
    const valgteIds: string[] = Array.isArray(body.valgte) ? body.valgte.map(String) : [];
    const signatur = String(body.underskrift || body.signature || "");
    const konsulent = String(body.konsulent || "").trim();

    const fejl: string[] = [];
    if (navn.length < 2) fejl.push("navn");
    if (!isValidPhone(telefon)) fejl.push("telefonnummer");
    if (!isValidEmail(email)) fejl.push("e-mail");
    if (emailBekraeft !== email) fejl.push("gentag e-mail");
    if (!accepteret) fejl.push("acceptere");
    if (konsulent.length < 2) fejl.push("konsulentens navn");
    if (!valgteIds.length) fejl.push("mindst én tilladelse");
    if (!signatur.startsWith("data:image/")) fejl.push("underskrift");

    if (fejl.length) {
      return NextResponse.json({ ok: false, mangler: fejl }, { status: 400 });
    }

    const reference = makeReference();
    const supabase = getSupabase();

    const underskriftUrl = await uploadSignature(supabase, reference, signatur);

    const consentPayload: ConsentInsert = {
      reference,
      navn,
      telefon,
      email,
      underskrift: underskriftUrl,
      kampagne: KAMPAGNE.navn,
      saelger_navn: KAMPAGNE.rep.navn,
      saelger_id: KAMPAGNE.rep.id,
      konsulent_navn: konsulent,
      accepteret,
      enhed: String(req.headers.get("user-agent") || ""),
      version: "samtykke-v2.0",
    };

    const { data: consentDataRaw, error: consentError } = await supabase
      .from("consents")
      .insert([consentPayload] as any)
      .select("id, created_at")
      .single();

    if (consentError || !consentDataRaw) {
      console.error("❌ Supabase-fejl (consents):", consentError?.message || "ukendt");
      return NextResponse.json(
        { ok: false, error: "database_error", detail: consentError?.message || "ukendt" },
        { status: 500 }
      );
    }

    const consentData = consentDataRaw as { id: number; created_at: string };
    const consentId = consentData.id;
    const createdAt = consentData.created_at;
    const chosenSet = new Set(valgteIds);

    for (const p of PARTNERE) {
      const givet = chosenSet.has(p.id);
      const udloeber = givet
        ? new Date(new Date(createdAt).getFullYear(), new Date(createdAt).getMonth() + p.varighed, new Date(createdAt).getDate())
        : null;

      const udloeberISO = udloeber ? udloeber.toISOString() : null;

      const partnerPayload: ConsentPartnerInsert = {
        consent_id: consentId,
        partner_id: p.id,
        partner_navn: p.navn,
        formaal: p.formaal,
        givet,
        tekst: `Ja, ${p.navn} må ringe til mig om ${p.formaal}.`,
        udloeber: udloeberISO,
      };

      const { error: partnerError } = await supabase
        .from("consent_partners")
        .insert([partnerPayload] as any);

      if (partnerError) {
        console.error(`❌ Supabase-fejl (consent_partners - ${p.id}):`, partnerError.message);
        return NextResponse.json(
          { ok: false, error: "database_error", detail: partnerError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      reference,
      tidspunkt: createdAt,
      konsulent,
      valgte: PARTNERE.filter((p) => chosenSet.has(p.id)).map((p) => p.id),
    });
  } catch (err: any) {
    console.error("❌ Fejl:", err.message || err);
    return NextResponse.json(
      { ok: false, error: "server_error", message: err.message },
      { status: 500 }
    );
  }
}

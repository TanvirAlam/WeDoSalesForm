export type Consent = {
  id: number;
  reference: string;
  created_at: string;
  navn: string;
  telefon: string;
  email: string;
  underskrift: string;       // URL til Supabase Storage
  kampagne: string;
  saelger_navn: string;
  saelger_id: string;
  konsulent_navn: string | null;
  cpr: string | null;
  reg_nr: string | null;
  konto_nr: string | null;
  accepteret: boolean;
  enhed: string | null;
  version: string;
};

export type ConsentInsert = Omit<Consent, "id" | "created_at">;

export type ConsentPartner = {
  id: number;
  consent_id: number;
  partner_id: string;
  partner_navn: string;
  formaal: string;
  givet: boolean;
  tekst: string;
  udloeber: string | null;
};

export type ConsentPartnerInsert = Omit<ConsentPartner, "id">;

import { NextResponse } from "next/server";

type Partner = {
  id: string;
  navn: string;
  formaal: string;
  varighed: number;
};

const KAMPAGNE = {
  navn: "Leads · uge 37",
  rep: { navn: "Mads K.", id: "WDS-114" },
};

const PARTNERE: Partner[] = [
  { id: "modstroem", navn: "Modstrøm", formaal: "salg af el og elaftaler", varighed: 12 },
  { id: "forsikring-danmark", navn: "Forsikring Danmark", formaal: "tilbud på forsikringer", varighed: 12 },
  { id: "pension-danmark", navn: "Pension Danmark", formaal: "rådgivning om pensionsopsparing", varighed: 12 },
];

export async function GET() {
  return NextResponse.json({ kampagne: KAMPAGNE, partnere: PARTNERE });
}

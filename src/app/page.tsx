"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./globals.css";

type Partner = {
  id: string;
  navn: string;
  formaal: string;
  varighed: number;
};

type Config = {
  kampagne: { navn: string; rep: { navn: string; id: string } };
  partnere: Partner[];
};

const API = "/api";

function Page() {
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/config`)
      .then((r) => r.json())
      .then((d: Config) => setConfig(d))
      .catch(() =>
        setConfigError("Kunne ikke hente konfiguration. Starter du serveren?")
      );
  }, []);

  const fallback: Config = useMemo(
    () => ({
      kampagne: { navn: "Leads · uge 37", rep: { navn: "Mads K.", id: "WDS-114" } },
      partnere: [
        { id: "modstroem", navn: "Modstrøm", formaal: "salg af el og elaftaler", varighed: 12 },
        { id: "forsikring-danmark", navn: "Forsikring Danmark", formaal: "tilbud på forsikringer", varighed: 12 },
        { id: "pension-danmark", navn: "Pension Danmark", formaal: "rådgivning om pensionsopsparing", varighed: 12 },
      ],
    }),
    []
  );
  const cfg = config || fallback;

  return (
    <>
      <header className="repbar">
        <div className="repbar-inner">
          <div className="wordmark">
            we do sales<span>.</span>
          </div>
        </div>
      </header>

      <main>
        <FormView cfg={cfg} />
        {configError && (
          <p style={{ color: "#A83A22", fontSize: 13, marginTop: 12 }}>
            {configError}
          </p>
        )}
      </main>
    </>
  );
}

export default Page;

/* ================================================================
   FormView — selve samtykkeformularen (form + kvittering).
   ================================================================ */
function FormView({ cfg }: { cfg: Config }) {
  const partnere = cfg.partnere;

  const formRef = useRef<HTMLFormElement>(null);
  const consentsRef = useRef<HTMLDivElement>(null);
  const formErrRef = useRef<HTMLDivElement>(null);
  const konsulentRef = useRef<HTMLInputElement>(null);
  const navnRef = useRef<HTMLInputElement>(null);
  const tlfRef = useRef<HTMLInputElement>(null);
  const mailRef = useRef<HTMLInputElement>(null);
  const mail2Ref = useRef<HTMLInputElement>(null);
  const cprRef = useRef<HTMLInputElement>(null);
  const regRef = useRef<HTMLInputElement>(null);
  const kontoRef = useRef<HTMLInputElement>(null);

  /* ---------- CPR — de sidste 4 cifre skjules som xxxx ---------- */
  const [cpr, setCpr] = useState("");
  const cprMask =
    cpr.length <= 6
      ? cpr
      : cpr.slice(0, 6) + "-" + "x".repeat(cpr.length - 6);

  const onCprChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCpr((prev) => {
      const firstX = raw.search(/[xX]/);
      if (firstX === -1) {
        return raw.replace(/\D/g, "").slice(0, 10);
      }
      const vis = raw
        .slice(0, firstX)
        .replace(/\D/g, "")
        .slice(0, 6);
      const rest = raw.slice(firstX);
      const xs = (rest.match(/[xX]/g) || []).length;
      const typed = rest.replace(/\D/g, "");
      const nextHidden = (
        prev.slice(6).slice(0, Math.max(0, xs)) + typed
      ).slice(0, 10 - vis.length);
      return (vis + nextHidden).slice(0, 10);
    });
  };

  /* ---------- Underskrift (canvas) ---------- */
  const cvRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const inkRef = useRef(false);

  useEffect(() => {
    const cv = cvRef.current!;
    const ctx = cv.getContext("2d")!;
    const wrap = wrapRef.current!;

    const size = () => {
      const r = cv.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      const keep = inkRef.current ? cv.toDataURL() : null;
      cv.width = r.width * d;
      cv.height = r.height * d;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(d, d);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#101A0F";
      if (keep) {
        const i = new Image();
        i.onload = () => ctx.drawImage(i, 0, 0, r.width, r.height);
        i.src = keep;
      }
    };

    size();
    window.addEventListener("resize", size);

    const pos = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      drawingRef.current = true;
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      lastRef.current = p;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y);
      ctx.stroke();
      inkRef.current = true;
      wrap.classList.add("drawn");
      wrap.dataset.invalid = "false";
    };
    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      const p = pos(e);
      const last = lastRef.current!;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
    };
    const onUp = () => {
      drawingRef.current = false;
    };

    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("pointerleave", onUp);

    return () => {
      window.removeEventListener("resize", size);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      cv.removeEventListener("pointerleave", onUp);
    };
  }, []);

  const clearSig = () => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    inkRef.current = false;
    wrapRef.current?.classList.remove("drawn");
  };

  const [kvittering, setKvittering] = useState<null | {
    reference: string;
    tidspunkt: string;
    navn: string;
    telefon: string;
    saelger: string;
    konsulent: string;
    valgte: string[];
  }>(null);

  const [busy, setBusy] = useState(false);
  const [accepteret, setAccepteret] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const konsulentEl = konsulentRef.current!;
    const navn = navnRef.current!;
    const tlf = tlfRef.current!;
    const mail = mailRef.current!;
    const mail2 = mail2Ref.current!;

    const fejl: string[] = [];

    const okKonsulent = konsulentEl.value.trim().length >= 2;
    konsulentEl.setAttribute("aria-invalid", okKonsulent ? "false" : "true");
    if (!okKonsulent) fejl.push("konsulentens navn");

    const okNavn = navn.value.trim().length >= 2;
    navn.setAttribute("aria-invalid", okNavn ? "false" : "true");
    if (!okNavn) fejl.push("navn");

    const telefonRå = tlf.value;
    const telefonCifre = telefonRå.replace(/\D/g, "").replace(/^45(?=\d{8}$)/, "");
    const okTlf = /^\d{8}$/.test(telefonCifre);
    tlf.setAttribute("aria-invalid", okTlf ? "false" : "true");
    if (!okTlf) fejl.push("telefonnummer");

    const okMail = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(mail.value.trim());
    mail.setAttribute("aria-invalid", okMail ? "false" : "true");
    if (!okMail) fejl.push("e-mail");

    const okMail2 =
      okMail && mail2.value.trim() === mail.value.trim();
    mail2.setAttribute("aria-invalid", okMail2 ? "false" : "true");
    if (!okMail2) fejl.push("gentag e-mail");

    const okCpr = /^\d{10}$/.test(cpr);
    cprRef.current?.setAttribute("aria-invalid", okCpr ? "false" : "true");
    if (!okCpr) fejl.push("CPR-nummer");

    const regCifre = regRef.current!.value.replace(/\D/g, "");
    const okReg = /^\d{4}$/.test(regCifre);
    regRef.current?.setAttribute("aria-invalid", okReg ? "false" : "true");
    if (!okReg) fejl.push("reg. nr.");

    const kontoCifre = kontoRef.current!.value.replace(/\D/g, "");
    const okKonto = /^\d{7,10}$/.test(kontoCifre);
    kontoRef.current?.setAttribute("aria-invalid", okKonto ? "false" : "true");
    if (!okKonto) fejl.push("konto nr.");

    const valgteIds: string[] = [];
    partnere.forEach((p) => {
      const el = document.querySelector<HTMLInputElement>(
        `input[data-partner="${p.id}"]:checked`
      );
      if (el) valgteIds.push(p.id);
    });
    consentsRef.current!.dataset.invalid = valgteIds.length ? "false" : "true";
    if (!valgteIds.length) fejl.push("mindst én tilladelse");

    const hasInk = inkRef.current;
    wrapRef.current!.dataset.invalid = hasInk ? "false" : "true";
    if (!hasInk) fejl.push("underskrift");

    const box = formErrRef.current!;
    if (fejl.length) {
      box.textContent = "Mangler: " + fejl.join(", ") + ".";
      box.classList.add("show");
      (
        document.querySelector(
          '[aria-invalid="true"], [data-invalid="true"]'
        ) || box
      ).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    box.classList.remove("show");

    setBusy(true);
    try {
      const res = await fetch(`${API}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          konsulent: konsulentEl.value.trim(),
          navn: navn.value.trim(),
          telefon: telefonCifre,
          mail: mail.value.trim(),
          mail2: mail2.value.trim(),
          cpr,
          regNr: regCifre,
          kontoNr: kontoCifre,
          accepteret,
          valgte: valgteIds,
          underskrift: cvRef.current!.toDataURL("image/png"),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const mangler: string[] = data.mangler || ["ukendt"];
        box.textContent =
          mangler[0] === "ukendt"
            ? "Kunne ikke sende. Tjek forbindelsen og tryk igen."
            : "Mangler: " + mangler.join(", ") + ".";
        box.classList.add("show");
        return;
      }
      setKvittering({
        reference: data.reference,
        tidspunkt: data.tidspunkt,
        navn: navn.value.trim(),
        telefon: telefonCifre,
        saelger: cfg.kampagne.rep.navn,
        konsulent: konsulentEl.value.trim(),
        valgte: data.valgte,
      });
      window.scrollTo({ top: 0 });
    } catch {
      box.textContent = "Kunne ikke sende. Tjek forbindelsen og tryk igen.";
      box.classList.add("show");
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    formRef.current?.reset();
    document
      .querySelectorAll("[aria-invalid]")
      .forEach((el) => el.setAttribute("aria-invalid", "false"));
    consentsRef.current?.setAttribute("data-invalid", "false");
    formErrRef.current?.classList.remove("show");
    clearSig();
    setCpr("");
    setKvittering(null);
    window.scrollTo({ top: 0 });
    setTimeout(() => navnRef.current?.focus(), 0);
  };

  const kortTekst = (p: Partner) =>
    "Ja, " + p.navn + " må ringe til mig om " + p.formaal + ".";

  /* ===================== KVITTERING ===================== */
  if (kvittering) {
    const valgtNavn =
      kvittering.valgte.length === 1
        ? partnere.find((p) => p.id === kvittering.valgte[0])?.navn
        : null;
    return (
      <div className="done show">
        <div className="tick">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#101A0F"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5.2 5.2L20 6.5" />
          </svg>
        </div>
        <h2>Tak, {kvittering.navn.split(" ")[0]}</h2>
        <p>
          {valgtNavn
            ? valgtNavn +
              " ringer inden for få dage. Vi sender en kvittering til din e-mail."
            : "De " +
              kvittering.valgte.length +
              " selskaber ringer inden for få dage. Vi sender en kvittering til din e-mail."}
        </p>
        <div className="receipt">
          <dl>
            <dt>Reference</dt>
            <dd>{kvittering.reference}</dd>
            <dt>Navn</dt>
            <dd>{kvittering.navn}</dd>
            <dt>Telefon</dt>
            <dd>
              •• •• {kvittering.telefon.slice(4, 6)}{" "}
              {kvittering.telefon.slice(6)}
            </dd>
            <dt>Tidspunkt</dt>
            <dd>
              {new Date(kvittering.tidspunkt).toLocaleString("da-DK", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
            <dt>Sælger</dt>
            <dd>{kvittering.saelger}</dd>
            <dt>Konsulent</dt>
            <dd>{kvittering.konsulent}</dd>
          </dl>
          <div className="r-liste">
            {partnere.map((p) => {
              const ja = kvittering.valgte.includes(p.id);
              return (
                <div key={p.id}>
                  <span>{p.navn}</span>
                  <span className={ja ? "r-ja" : "r-nej"}>
                    {ja ? "Må ringe" : "Nej tak"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <button className="again" onClick={again}>
          Registrér næste kunde
        </button>
      </div>
    );
  }

  /* ===================== FORM ===================== */
  return (
    <div id="view-form">
      <div className="ask">
        <h1>Hvem må ringe til dig?</h1>
        <p>
          Sæt kryds ved dem, du gerne vil høre fra. Du bestemmer selv — du kan
          vælge én, to eller alle tre, og du kan sige fra igen når som helst.
        </p>
      </div>

      <form id="form" ref={formRef} onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="konsulent">Navnet på konsulenten / sælgeren</label>
          <input
            type="text"
            id="konsulent"
            ref={konsulentRef}
            autoComplete="name"
            placeholder="Fx Anders S."
          />
          <div className="err">Skriv dit eget navn som sælger.</div>
        </div>
        <hr className="hrSpace" />
        <div className="field">
          <label htmlFor="navn">Fulde navn</label>
          <input
            type="text"
            id="navn"
            ref={navnRef}
            autoComplete="name"
          />
          <div className="err">Skriv kundens fulde navn.</div>
        </div>
        <div className="field">
          <label htmlFor="tlf">Telefonnummer</label>
          <input
            type="tel"
            id="tlf"
            ref={tlfRef}
            inputMode="numeric"
            autoComplete="tel"
            placeholder="12 34 56 78"
          />
          <div className="err">Skriv et dansk nummer på 8 cifre.</div>
        </div>
        <div className="field">
          <label htmlFor="mail">E-mail</label>
          <input
            type="email"
            id="mail"
            ref={mailRef}
            autoComplete="email"
            inputMode="email"
          />
          <div className="err">Tjek e-mailadressen.</div>
        </div>
        <div className="field">
          <label htmlFor="mail2">Gentag e-mail</label>
          <input
            type="email"
            id="mail2"
            ref={mail2Ref}
            autoComplete="off"
            inputMode="email"
          />
          <div className="err">E-mailene skal være ens.</div>
        </div>
        <div className="field">
          <label htmlFor="cpr">CPR-nummer</label>
          <input
            type="text"
            id="cpr"
            ref={cprRef}
            inputMode="numeric"
            autoComplete="off"
            placeholder="DDMMYY-XXXX"
            value={cprMask}
            onChange={onCprChange}
          />
          <div className="err">Skriv et CPR-nummer på 10 cifre.</div>
        </div>

        <div className="konto-group">
          <h2>Indtast kontooplysninger</h2>
          <div className="field">
            <label htmlFor="reg">Reg. nr.</label>
            <input
              type="text"
              id="reg"
              ref={regRef}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="Indtast reg. nr."
            />
            <div className="err">Skriv reg. nr. (4 cifre).</div>
          </div>
          <div className="field">
            <label htmlFor="konto">Konto nr.</label>
            <input
              type="text"
              id="konto"
              ref={kontoRef}
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="Indtast kontonr."
            />
            <div className="err">Skriv kontonummer (7-10 cifre).</div>
          </div>
        </div>

        <div className="consents" id="consents" ref={consentsRef} data-invalid="false">
          <div className="consents-head">
            <h2>Tilladelser</h2>
            <p>
              Hver tilladelse gælder kun det selskab, der står ved den. Vælg
              mindst én for at gå videre.
            </p>
          </div>
          <div id="partnere">
            {partnere.map((p) => (
              <label key={p.id} className="partner">
                <input type="checkbox" data-partner={p.id} />
                <span>
                  <span className="p-navn">{p.navn}</span>
                  <span className="p-tekst">{kortTekst(p)}</span>
                  <span className="p-meta">
                    Gælder i {p.varighed} måneder · kan trækkes tilbage
                    når som helst
                  </span>
                </span>
              </label>
            ))}
          </div>
          <details>
            <summary>Se den fulde samtykkeerklæring</summary>
            <div className="body">
              <p>
                <strong>Sådan fungerer det.</strong> Du giver en
                selvstændig tilladelse til hvert selskab, du sætter kryds
                ved. Et kryds ved ét selskab giver ikke de andre lov til
                at kontakte dig. Selskaberne deler ikke dine oplysninger
                indbyrdes.
              </p>
              <p>
                <strong>Hvem indsamler oplysningerne?</strong> We Do Sales
                indsamler dem som databehandler og sender dem videre til de
                selskaber, du har valgt. Vi bruger dem ikke til vores egne
                formål.
              </p>
              <p>
                <strong>Hvilke oplysninger?</strong> Navn, telefonnummer,
                e-mail, din underskrift samt tidspunkt, sted og hvilken
                sælger der har talt med dig. De sidste gemmes som
                dokumentation for samtykket og bruges ikke til
                markedsføring.
              </p>
              <p>
                <strong>Frivilligt.</strong> Du er ikke forpligtet til at
                give nogen af tilladelserne, og du får ikke en ringere
                behandling ved at sige nej. At give samtykke er ikke det
                samme med at indgå en aftale — du binder dig ikke til at
                købe noget.
              </p>
              <p>
                <strong>Retsgrundlag.</strong>{" "}
                Databeskyttelsesforordningens artikel 6, stk. 1, litra a,
                og markedsføringslovens § 10, stk. 1.
              </p>
              <p>
                <strong>Klage.</strong> Du kan klage til Datatilsynet,
                Carl Jacobsens Vej 35, 2500 Valby, dt@datatilsynet.dk.
              </p>
              {partnere.map((p) => (
                <div key={p.id}>
                  <h4>{p.navn}</h4>
                  <p>
                    Dataansvarlig: {p.navn}. Formål: at ringe til dig
                    om {p.formaal}. Samtykket gælder i {p.varighed}{" "}
                    måneder fra i dag, hvorefter oplysningerne
                    slettes. Vil du fortryde, så skriv til den
                    dataansvarlige. Privatlivspolitik: se selskabets
                    egen side.
                  </p>
                </div>
              ))}
            </div>
          </details>
          <label className="partner">
              <input
                type="checkbox"
                checked={accepteret}
                onChange={(e) => setAccepteret(e.target.checked)}
              />
              <span>
                <span className="p-navn">Acceptere</span>
                <span className="p-meta">
                  Jeg giver samtykke til at Modstrøm må kontakte mig med markedsføring om elaftaler via telefon, e-mail og SMS. Du kan til enhver tid tilbagekalde dit samtykke her (https://www.modstroem.dk/diverse/blacklist/). Læs mere om virksomheden og behandlingen af dine personoplysninger i vores koncern-persondatapolitik (https://www.modstroem.dk/diverse/persondatapolitik/)
                </span>
              </span>
          </label>
        </div>

        <div className="field" style={{ marginTop: 26 }}>
          <div className="sig-head">
            <label htmlFor="sig">Underskrift</label>
            <button type="button" className="sig-clear" onClick={clearSig}>
              Ryd
            </button>
          </div>
          <div className="sigwrap" ref={wrapRef}>
            <canvas ref={cvRef} aria-label="Underskriftsfelt" />
            <div className="sigline" />
            <div className="sighint">Skriv under med fingeren</div>
          </div>
        </div>

        <button
          type="submit"
          className="submit"
          disabled={busy || !accepteret}
        >
          Bekræft tilladelser
        </button>
        <div className="formerr" id="formerr" ref={formErrRef} />
      </form>

      <p className="legal">
        We Do Sales indsamler oplysningerne på vegne af de selskaber, du har sat
        kryds ved. Vi videregiver dem ikke til andre.
      </p>
    </div>
  );
}

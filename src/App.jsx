// YourDomi Bellijst v2.1 — build 2026-03-10
import React, { useState, useEffect, useCallback, useRef } from "react";

// --- DESIGN TOKENS (van screenshot) ------------------------------------------
const T = {
  bg: "#F0EDE6",
  bgCard: "#FFFFFF",
  bgCardAlt: "#F7F5F0",
  green: "#2D5C4E",
  greenDark: "#1E3F35",
  greenLight: "#4A8C78",
  greenPale: "#E8F0EE",
  orange: "#E07B4A",
  orangePale: "#FBF0EA",
  orangeDark: "#C4622E",
  text: "#1A2E29",
  textMid: "#4A5E59",
  textLight: "#8A9E99",
  border: "#DDD9D0",
  borderLight: "#EAE7E0",
  red: "#C0392B",
  redPale: "#FDECEA",
  shadow: "0 2px 12px rgba(45,92,78,0.08)",
  shadowMd: "0 4px 24px rgba(45,92,78,0.12)",
};

// --- TV API -------------------------------------------------------------------

const API_URL = import.meta.env.VITE_API_URL || "https://yourdomi-server-production.up.railway.app";
function getToken() { try { return localStorage.getItem("yd_token") || ""; } catch { return ""; } }
// GET requests: only send auth token, NOT Content-Type (causes CORS preflight issues on GET)
function getHeaders() { return { "x-auth-token": getToken() }; }
function postHeaders() { return { "Content-Type": "application/json", "x-auth-token": getToken() }; }

async function fetchLodgings(page = 1, pageSize = 50, filters = {}, sorteer = "score") {
  const params = new URLSearchParams({ page, size: pageSize });
  if (filters.zoek)         params.set("zoek", filters.zoek);
  if (filters.gemeente)     params.set("gemeente", filters.gemeente);
  if (filters.provincie)    params.set("provincie", filters.provincie);
  if (filters.status)       params.set("status", filters.status);
  if (filters.minSlaap)     params.set("minSlaap", filters.minSlaap);
  if (filters.maxSlaap)     params.set("maxSlaap", filters.maxSlaap);
  if (filters.heeftTelefoon) params.set("heeftTelefoon", "1");
  if (filters.heeftEmail)   params.set("heeftEmail", "1");
  if (filters.heeftWebsite) params.set("heeftWebsite", "1");
  if (filters.regio)        params.set("regio", filters.regio);
  if (filters.type)         params.set("type", filters.type);
  if (sorteer && sorteer !== "score") params.set("sorteer", sorteer);

  const r = await fetch(`${API_URL}/api/panden?${params}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 401) {
    localStorage.removeItem("yd_token");
    localStorage.removeItem("yd_user");
    throw new Error("401");
  }
  if (!r.ok) throw new Error(`Server error ${r.status}`);
  return r.json();
}

// Save enrichment to server + localStorage
async function saveEnrichment(id, data) {
  if (API_URL) {
    try {
      await fetch(`${API_URL}/api/enrichment/${id}`, {
        method: "POST",
        headers: postHeaders(),
        body: JSON.stringify(data),
      });
    } catch (e) { console.warn("Failed to save enrichment to server:", e.message); }
  }
}

// Load all enrichments from server
async function loadAllEnrichments() {
  if (!API_URL) return null;
  try {
    const r = await fetch(`${API_URL}/api/enrichment`, { headers: getHeaders(), signal: AbortSignal.timeout(8000) });
    if (r.ok) return await r.json();
  } catch (e) { console.warn("Failed to load enrichments from server:", e.message); }
  return null;
}

// Load platform scan (light AI: website + Airbnb + Booking only) — used to show pills and rank before full enrichment
async function loadPlatformScan() {
  if (!API_URL) return null;
  try {
    const r = await fetch(`${API_URL}/api/platform-scan`, { headers: getHeaders(), signal: AbortSignal.timeout(8000) });
    if (r.ok) return await r.json();
  } catch (e) { console.warn("Failed to load platform scan:", e.message); }
  return null;
}

// Save outcome to server
async function saveOutcomeToServer(id, outcome, note, contactNaam) {
  if (!API_URL) return;
  try {
    await fetch(`${API_URL}/api/outcomes/${id}`, {
      method: "POST",
      headers: postHeaders(),
      body: JSON.stringify({ outcome, note, contactNaam }),
    });
  } catch (e) { console.warn("Failed to save outcome to server:", e.message); }
}

// --- DEMO DATA GENERATOR -----------------------------------------------------
// 200 realistische Vlaamse vakantiewoningen, gesimuleerd als echte TV-registerdata
// Dit wordt alleen gebruikt als de TV API niet bereikbaar is vanuit de browser (CORS)
function buildDemoData(page = 1, size = 50) {
  const gemns = [
    {n:"Koksijde",p:"West-Vlaanderen",pc:"8670",pre:"WVL"},
    {n:"Koksijde",p:"West-Vlaanderen",pc:"8670",pre:"WVL"},
    {n:"Koksijde",p:"West-Vlaanderen",pc:"8670",pre:"WVL"},
    {n:"De Panne",p:"West-Vlaanderen",pc:"8660",pre:"WVL"},
    {n:"De Panne",p:"West-Vlaanderen",pc:"8660",pre:"WVL"},
    {n:"Nieuwpoort",p:"West-Vlaanderen",pc:"8620",pre:"WVL"},
    {n:"Nieuwpoort",p:"West-Vlaanderen",pc:"8620",pre:"WVL"},
    {n:"Oostduinkerke",p:"West-Vlaanderen",pc:"8670",pre:"WVL"},
    {n:"Blankenberge",p:"West-Vlaanderen",pc:"8370",pre:"WVL"},
    {n:"Blankenberge",p:"West-Vlaanderen",pc:"8370",pre:"WVL"},
    {n:"Knokke-Heist",p:"West-Vlaanderen",pc:"8300",pre:"WVL"},
    {n:"Knokke-Heist",p:"West-Vlaanderen",pc:"8300",pre:"WVL"},
    {n:"Knokke-Heist",p:"West-Vlaanderen",pc:"8300",pre:"WVL"},
    {n:"Oostende",p:"West-Vlaanderen",pc:"8400",pre:"WVL"},
    {n:"Oostende",p:"West-Vlaanderen",pc:"8400",pre:"WVL"},
    {n:"Brugge",p:"West-Vlaanderen",pc:"8000",pre:"WVL"},
    {n:"Brugge",p:"West-Vlaanderen",pc:"8000",pre:"WVL"},
    {n:"Wenduine",p:"West-Vlaanderen",pc:"8420",pre:"WVL"},
    {n:"Middelkerke",p:"West-Vlaanderen",pc:"8430",pre:"WVL"},
    {n:"De Haan",p:"West-Vlaanderen",pc:"8421",pre:"WVL"},
    {n:"Gent",p:"Oost-Vlaanderen",pc:"9000",pre:"OVL"},
    {n:"Gent",p:"Oost-Vlaanderen",pc:"9000",pre:"OVL"},
    {n:"Ghent Historic",p:"Oost-Vlaanderen",pc:"9000",pre:"OVL"},
    {n:"Aalst",p:"Oost-Vlaanderen",pc:"9300",pre:"OVL"},
    {n:"Oudenaarde",p:"Oost-Vlaanderen",pc:"9700",pre:"OVL"},
    {n:"Geraardsbergen",p:"Oost-Vlaanderen",pc:"9500",pre:"OVL"},
    {n:"Dendermonde",p:"Oost-Vlaanderen",pc:"9200",pre:"OVL"},
    {n:"Antwerpen",p:"Antwerpen",pc:"2000",pre:"ANT"},
    {n:"Antwerpen",p:"Antwerpen",pc:"2060",pre:"ANT"},
    {n:"Mechelen",p:"Antwerpen",pc:"2800",pre:"ANT"},
    {n:"Turnhout",p:"Antwerpen",pc:"2300",pre:"ANT"},
    {n:"Lier",p:"Antwerpen",pc:"2500",pre:"ANT"},
    {n:"Mol",p:"Antwerpen",pc:"2400",pre:"ANT"},
    {n:"Leuven",p:"Vlaams-Brabant",pc:"3000",pre:"VBR"},
    {n:"Tienen",p:"Vlaams-Brabant",pc:"3300",pre:"VBR"},
    {n:"Aarschot",p:"Vlaams-Brabant",pc:"3200",pre:"VBR"},
    {n:"Halle",p:"Vlaams-Brabant",pc:"1500",pre:"VBR"},
    {n:"Hasselt",p:"Limburg",pc:"3500",pre:"LIM"},
    {n:"Genk",p:"Limburg",pc:"3600",pre:"LIM"},
    {n:"Tongeren",p:"Limburg",pc:"3700",pre:"LIM"},
    {n:"Maaseik",p:"Limburg",pc:"3680",pre:"LIM"},
    {n:"Spa",p:"Luik",pc:"4900",pre:"LUI"},
    {n:"Liège",p:"Luik",pc:"4000",pre:"LUI"},
    {n:"Durbuy",p:"Luxemburg",pc:"6940",pre:"LUX"},
    {n:"La Roche-en-Ardenne",p:"Luxemburg",pc:"6980",pre:"LUX"},
    {n:"Bouillon",p:"Luxemburg",pc:"6830",pre:"LUX"},
  ];

  const namen = [
    "Villa","Huis","Chalet","Bungalow","Appartement","Studio","Loft","Hoeve",
    "Cottage","Maison","Landgoed","Kasteel","Strandhuis","Vakantiewoning",
    "B&B","Herenhuis","Boerderijtje","Tuinhuis","Waterhuis","Penthouse"
  ];
  const bijvoeg = [
    "De Witte Duinen","Aan De Leie","Ter Beke","Klein Paradijs","Het Zonnehuis",
    "De Groene Vallei","Aan Het Strand","In De Duinen","Het Blauwe Huis",
    "De Rode Loper","Aan De Schelde","Ter Zee","Het Groene Hart","De Vijver",
    "Aan De Maas","Het Oude Dorp","De Boomgaard","In Het Bos","De Zandweg",
    "Op De Heide","Ter Duinen","Het Witte Huis","De Kreek","Aan De Vaart",
    "Het Roze Huis","De Vlinder","Zonnehoek","Rusthoek","Blauw Water",
    "Groene Zoom","Zilte Wind","Gouden Kust","Zilvermeeuw","De Anker",
    "Horizon","Brise Marine","La Mer","Les Dunes","Au Soleil","Du Midi"
  ];
  const straten = [
    "Zeedijk","Duinenweg","Kustlaan","Bosweg","Leiekaai","Scheldekade",
    "Strandlaan","Duinenlaan","Kasteelstraat","Marktplein","Dorpsstraat",
    "Kerkstraat","Bekenstraat","Valleiweg","Bergweg","Waterstraat",
    "Lindenlaan","Eikenstraat","Populierenlaan","Wilgenweg"
  ];
  const statussen = ["aangemeld","aangemeld","aangemeld","erkend","erkend","vergund"];
  const slaap = [2,2,3,4,4,4,5,6,6,6,7,8,8,8,10,10,12,14,16,20];

  // Vaste portfolio-eigenaars (zelfde telefoon = meerdere panden)
  const portfolioTel = [
    "+32 58 51 23 45", // 3 panden Koksijde
    "+32 50 33 44 55", // 2 panden Brugge
    "+32 9 224 56 78",  // 2 panden Gent
    "+32 3 233 11 22",  // 3 panden Antwerpen
  ];
  const portfolioToewijzing = {
    0: portfolioTel[0], 1: portfolioTel[0], 2: portfolioTel[0],   // Koksijde trio
    15: portfolioTel[1], 16: portfolioTel[1],                       // Brugge duo
    20: portfolioTel[2], 21: portfolioTel[2],                       // Gent duo
    27: portfolioTel[3], 28: portfolioTel[3], 29: portfolioTel[3],  // Antwerpen trio
  };

  function seed(i) { return (i * 2654435761) >>> 0; }
  function pick(arr, i) { return arr[seed(i) % arr.length]; }

  const TOTAL = 200;
  const alle = Array.from({length: TOTAL}, (_, i) => {
    const g = gemns[i % gemns.length];
    const nr = seed(i + 100) % 150 + 1;
    const tel = portfolioToewijzing[i] || `+32 ${String(seed(i*3) % 90 + 10)} ${String(seed(i*7) % 90 + 10)} ${String(seed(i*11) % 90 + 10)} ${String(seed(i*13) % 90 + 10)}`;
    const heeftEmail = seed(i * 17) % 3 !== 0;
    const heeftSite = seed(i * 19) % 4 !== 0;
    const naam = `${pick(namen, i)} ${pick(bijvoeg, i+50)}`;
    const s = slaap[seed(i * 23) % slaap.length];
    return {
      id: `tv-${String(i+1).padStart(3,"0")}`,
      name: naam,
      street: `${pick(straten, i+20)} ${nr}`,
      mun: g.n, prov: g.p, pc: g.pc,
      status: statussen[seed(i*29) % statussen.length],
      sleep: s,
      units: s > 8 ? Math.ceil(s/6) : 1,
      phone: tel,
      email: heeftEmail ? `info@${naam.toLowerCase().replace(/[^a-z]/g,"")}.be` : null,
      website: heeftSite ? `https://${naam.toLowerCase().replace(/[^a-z]/g,"")}.be` : null,
      reg: `TV-${g.pre}-${2018 + (seed(i*31) % 6)}-${String(seed(i*37) % 9000 + 1000).padStart(5,"0")}`,
    };
  });

  const start = (page - 1) * size;
  const items = alle.slice(start, start + size);

  return {
    data: items.map(d => ({
      id: d.id, type: "lodgings",
      attributes: {
        name: d.name, street: d.street, "municipality-name": d.mun,
        province: d.prov, "postal-code": d.pc, "registration-status": d.status,
        "number-of-sleep-places": d.sleep, "number-of-units": d.units,
        phone: d.phone, email: d.email, website: d.website,
        "registration-number": d.reg,
      },
      relationships: {},
    })),
    meta: { count: TOTAL, total: TOTAL },
    included: [],
    _isDemo: true,
  };
}

function parseLodging(item, included = []) {
  // NEW FORMAT: server returns flat VF object directly
  if (item.name !== undefined && !item.raw) {
    return item; // already parsed — pass through
  }

  // OLD FORMAT: { id, raw: { attributes: {...} }, included: [] }
  const raw = item.raw || item;
  const a = raw.attributes || {};

  // name can be a string or array of { content, language } objects
  const str = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v.trim();
    if (Array.isArray(v)) {
      const nl = v.find(x => x && x.language === "nl");
      return (nl?.content || v[0]?.content || v[0] || "").toString().trim();
    }
    if (typeof v === "object") return (v.content || v.value || v.name || "").toString().trim();
    return String(v).trim();
  };

  const normalizePhone = (p) => {
    const s = str(p);
    return s ? s.replace(/[\s\-().]/g, "").replace(/^00/, "+").replace(/^\+?0032/, "+32") : null;
  };

  const name = str(a["name"]) || str(a["alternative-name"]) || str(a["schema:name"]) || "";

  return {
    id: raw.id || item.id,
    name: name || str(a["alternative-name"]) || str(a["registratienummer"]) || "Naamloze woning",
    street: str(a["street"] || a["address-street"] || a["straat"] || ""),
    municipality: str(a["municipality-name"] || a["hoofdgemeente"] || a["address-municipality"] || ""),
    province: str(a["province"] || a["provincie"] || a["Provincie"] || ""),
    postalCode: str(a["postal-code"] || a["postcode"] || a["postalCode"] || ""),
    status: str(a["registration-status"] || a["status"] || "aangemeld") || "aangemeld",
    starRating: str(a["star-rating"] || a["comfort-classification"] || "") || null,
    sleepPlaces: parseInt(a["number-of-sleeping-places"] || a["numberOfSleepPlaces"] || 0) || null,
    slaapplaatsen: parseInt(a["number-of-sleeping-places"] || 0) || 0,
    units: parseInt(a["number-of-rental-units"] || a["number-of-units"] || 1) || 1,
    phone: normalizePhone(a["phone"] || a["contact-phone"]),
    phone2: null,
    phoneNorm: normalizePhone(a["phone"] || a["contact-phone"])?.replace(/[^0-9+]/g, "") || null,
    email: str(a["email"] || a["contact-email"] || "") || null,
    website: str(a["website"] || a["contact-website"] || "") || null,
    registrationNumber: str(a["registration-number"] || a["registrationNumber"] || "") || raw.id || item.id,
    onlineSince: str(a["modified"] || a["registration-date"] || a["created"] || "") || null,
    dateOnline: str(a["modified"] || a["registration-date"] || "") || null,
    category: str(a["category"] || "vakantiewoning"),
    toeristischeRegio: "",
    type: "",
    rawUrl: `https://linked.toerismevlaanderen.be/id/lodgings/${raw.id || item.id}`,
  };
}

// --- INSTANT ZOEKLINKS (geen AI nodig) --------------------------------------
function buildZoekLinks(property) {
  const q = encodeURIComponent(`${property.name} ${property.municipality}`);
  const qAirbnb = encodeURIComponent(`${property.name} ${property.municipality} Belgium`);
  const qBooking = encodeURIComponent(`${property.name} ${property.municipality}`);
  return {
    google:   `https://www.google.com/search?q=${q}`,
    airbnb:   `https://www.airbnb.com/s/${qAirbnb}/homes`,
    booking:  `https://www.booking.com/search.html?ss=${qBooking}`,
    maps:     `https://www.google.com/maps/search/${encodeURIComponent(property.street + " " + property.municipality)}`,
    googleImg:`https://www.google.com/search?q=${q}&tbm=isch`,
  };
}

// --- AI VERRIJKING ------------------------------------------------------------
async function enrichProperty(property, portfolioInfo = null) {
  const portfolioContext = portfolioInfo
    ? `\nBELANGRIJK - PORTFOLIO EIGENAAR: Deze eigenaar heeft ${portfolioInfo.count} panden: ${portfolioInfo.names.join(", ")}\nDit is een HOGE PRIORITEIT portfolio lead. Verwerk dit expliciet in de openingszin.`





    : "";

  const prompt = `Je bent een verkoopintelligentie-assistent voor yourdomi.be, een Belgisch beheerbedrijf voor kortetermijnverhuur (Airbnb, Booking.com, VRBO).
VERKOOPSFILOSOFIE: Wij stellen vragen ipv uitleggen wie we zijn. We laten eigenaars zichzelf "verkopen" door te vragen naar hun situatie, pijnpunten en wensen. Goede verkopers luisteren 70%, spreken 30%.${portfolioContext}

Pandgegevens uit Toerisme Vlaanderen register:
- Naam: ${property.name}
- Adres: ${property.street}, ${property.postalCode} ${property.municipality}, ${property.province}
- Status: ${property.status} | Sterren: ${property.starRating || "geen"} | Slaapplaatsen: ${property.sleepPlaces || "?"} | Units: ${property.units || "1"}
- Tel: ${property.phone || "niet beschikbaar"} | Email: ${property.email || "niet beschikbaar"} | Website: ${property.website || "niet gevonden"}

STAP 1 - Online aanwezigheid zoeken (VERPLICHT - gebruik web_search + web_fetch):
Zoek systematisch met deze queries (doe elke zoekactie apart):
1. web_search: "${property.name} ${property.municipality} Airbnb" → zoek exacte Airbnb listing URL (airbnb.com/rooms/...)
2. web_search: "${property.name} ${property.municipality} Booking.com" → zoek exacte Booking URL (booking.com/hotel/...)
3. web_search: "${property.name} ${property.municipality} vakantiewoning" → zoek directe website
4. Als Airbnb URL gevonden: web_fetch de listing pagina → extraheer foto URLs (a0.muscache.com CDN), prijs, beoordeling, reviews
5. Als Booking URL gevonden: web_fetch de listing pagina → extraheer foto URLs (cf.bstatic.com CDN), prijs, beoordeling, reviews
${property.website ? `6. web_fetch "${property.website}" → controleer HTTP status. Als 200 met echte verhuurcontent: werkt=true en zoek foto URLs. Bij fout/parkeerdomein: werkt=false, gevonden=false.` : ""}

BELANGRIJK voor websites:
- Voeg ALLEEN een website toe als je deze effectief hebt kunnen ophalen via web_fetch en hij HTTP 200 teruggeeft met echte vakantieverhuur content
- Als de fetch faalt (timeout, 404, 403, redirect naar parkeerdomein), zet directWebsite.werkt = false en directWebsite.gevonden = false
- Parkeer/placeholder sites (bv. "This domain is for sale", Sedo, GoDaddy) tellen NIET als werkende website
- Zet directWebsite.poorlyBuilt = true als de site WEL werkt maar slecht is: verouderd design, kapotte layout, geen boekingsmogelijkheid, amateuraanpak. Dat is een HEET-signaal (eigenaar kan baat hebben bij yourdomi).
- Geef ECHTE foto URLs terug die je hebt gevonden via web_fetch op de listing pagina (airbnb CDN: a0.muscache.com, booking CDN: cf.bstatic.com) - geen placeholders
- Als je geen foto URLs kan extraheren uit de pagina inhoud, geef een lege array terug

STAP 2 - Agentuur detectie:
Analyseer of het telefoonnummer/email waarschijnlijk een beheerskantoor/agentuur is ipv de eigenaar zelf. Signalen: generiek emaildomein, bekende vastgoedkantoren, meerdere panden op hetzelfde nr, "info@" adressen van vakantieverhuurders.

STAP 3 - Consultieve gespreksstructuur:
Maak 5-7 open vragen die de eigenaar aan het woord laten. Begin met de situatie peilen, dan pijnpunten, dan wensen. NIET pitchen, NIET uitleggen - VRAGEN. Structuur: situatievragen -> implicatievragen -> wensvragen.

SCORE CRITERIA (volg dit strikt):
🔥 HEET = Eigenaar beheert ZELF (geen agentuur), heeft directe contactgegevens, pand is NIET of slecht online (kans om waarde te tonen), OF staat al online maar heeft lage reviews/slechte prijszetting (duidelijke pijnpunten). Een SLECHT GEBOUWDE WEBSITE (verouderd, kapotte layout, geen boekingsmogelijkheid) telt als extra HEET-signaal.
W WARM = Eigenaar beheert zelf maar is al redelijk goed online. Of: contactgegevens beschikbaar maar onduidelijk of zelf beheert. Bellen loont maar minder urgent.
K KOUD = Duidelijk al professioneel beheerd (agentuur gedetecteerd), geen contactgegevens, of pand is al perfect geoptimaliseerd zonder ruimte voor yourdomi.

PRIORITEIT: Geef 1-10. Als er een Airbnb- of Booking.com-listing is gevonden, tel +2 bij de prioriteit (max 10) zodat onze bellers deze eigenaars sneller kunnen contacteren.

Geef ALLEEN deze JSON (geen markdown):
{
  "score": "HEET"|"WARM"|"KOUD",
  "scoreReden": "Concrete reden op basis van de criteria: waarom precies HEET/WARM/KOUD? Vermeld specifiek: beheert zelf of agentuur? Online aanwezig of niet? Ruimte voor verbetering? Max 2 zinnen.",
  "prioriteit": 1-10,
  "openingszin": "Als NIET online gevonden: stel meteen een vraag of ze online zichtbaar zijn en waar ze staan. Als WEL gevonden: verwijs concreet naar hun listing/locatie/portfolio. Max 2 zinnen. NOOIT jezelf introduceren als 'wij zijn...', altijd starten vanuit hun situatie.",
  "consultieveVragen": [
    "Vraag 1 - situatie: bv. Beheert u de verhuur momenteel volledig zelf, of werkt u samen met iemand?",
    "Vraag 2 - situatie: bv. Op welke platforms staat uw woning momenteel?",
    "Vraag 3 - pijnpunt: bv. Wat kost u persoonlijk de meeste tijd in het beheer?",
    "Vraag 4 - pijnpunt: bv. Heeft u het gevoel dat u het maximale uit uw bezettingsgraad haalt?",
    "Vraag 5 - implicatie: bv. Als u die tijd had voor andere dingen, wat zou u dan anders doen?",
    "Vraag 6 - wens: bv. Wat zou voor u het ideale scenario zijn voor de verhuur van dit pand?",
    "Vraag 7 - portfolio (indien van toepassing): bv. U beheert meerdere panden - hoe organiseert u dat op dit moment?"
  ],
  "waarschuwingAgentuur": true|false,
  "agentuurSignalen": "Uitleg waarom dit mogelijk een agentuur/beheerder is ipv eigenaar, of leeg als niet van toepassing",
  "pitchhoek": "Na de vragen: wat biedt yourdomi specifiek voor DEZE eigenaar. 2 zinnen.",
  "zwaktes": ["concreet verbeterpunt 1", "concreet verbeterpunt 2", "concreet verbeterpunt 3"],
  "airbnb": {
    "gevonden": true|false,
    "url": "https://www.airbnb.com/rooms/...",
    "beoordeling": "4.8",
    "aantalReviews": "47",
    "prijsPerNacht": "EUR165",
    "bezettingsgraad": "62%",
    "fotoUrls": ["https://a0.muscache.com/im/pictures/..."]
  },
  "booking": {
    "gevonden": true|false,
    "url": "https://www.booking.com/hotel/...",
    "beoordeling": "8.4",
    "aantalReviews": "23",
    "prijsPerNacht": "EUR180",
    "fotoUrls": ["https://..."]
  },
  "directWebsite": {
    "gevonden": true|false,
    "werkt": true|false,
    "poorlyBuilt": true|false,
    "url": "https://...",
    "fotoUrls": ["https://..."]
  },
  "alleFotos": ["https://..."],
  "geschatMaandelijksInkomen": "EUR2.800 - EUR4.200",
  "geschatBezetting": "58%",
  "inkomensNota": "Korte uitleg",
  "potentieelMetYourDomi": "EUR3.500 - EUR5.200",
  "potentieelNota": "Verwachte verbetering met yourdomi",
  "locatieHighlights": ["dicht bij strand"],
  "eigenaarProfiel": "Wat weten we over eigenaar/uitbater",
  "contractadvies": "full"|"partial"|"visibility",
  "contractUitleg": "Waarom dit type past voor deze eigenaar"
}
Contracttypes: visibility=10% (plaatsing), partial=20% (communicatie+prijszetting), full=25% (alles inclusief)`;

  const resp = await fetch(API_URL + "/api/ai", {
    method: "POST",
    headers: postHeaders(),
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`API fout: ${resp.status}`);
  const data = await resp.json();
  const textBlock = [...(data.content || [])].reverse().find(b => b.type === "text");
  const raw = textBlock?.text || "{}";
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
    return JSON.parse(clean.slice(s, e + 1));
  } catch {
    return {
      score: "WARM", scoreReden: "Analyse mislukt", prioriteit: 5,
      openingszin: `Goedemiddag, ik bel over uw vakantiewoning in ${property.municipality}.`,
      pitchhoek: "yourdomi.be kan uw kortetermijnverhuur volledig beheren.",
      zwaktes: [], airbnb: { gevonden: false }, booking: { gevonden: false },
      directWebsite: { gevonden: false }, alleFotos: [],
      geschatMaandelijksInkomen: "Onbekend", geschatBezetting: "Onbekend",
      inkomensNota: "", potentieelMetYourDomi: "Onbekend", potentieelNota: "",
      locatieHighlights: [], eigenaarProfiel: "", gespreksonderwerpen: [],
      contractadvies: "partial", contractUitleg: "",
    };
  }
}

// --- SESSION STORAGE ----------------------------------------------------------
// --- SESSION STORAGE ----------------------------------------------------------
const SK = "yd2_";
function load(key, def = null) { try { const v = sessionStorage.getItem(SK + key); return v ? JSON.parse(v) : def; } catch { return def; } }
function save(key, val) { try { sessionStorage.setItem(SK + key, JSON.stringify(val)); } catch {} }
function loadCfg(key, def = "") { try { return localStorage.getItem("yd2_cfg_" + key) || def; } catch { return def; } }
function saveCfg(key, val) { try { localStorage.setItem("yd2_cfg_" + key, val); } catch {} }

// --- MONDAY API ---------------------------------------------------------------
async function mondayGraphQL(query, variables = {}, apiKeyOverride = null) {
  const proxyUrl = API_URL + "/api/monday";
  const apiKey = apiKeyOverride != null ? apiKeyOverride : (typeof loadCfg === "function" ? loadCfg("monday_key") : "");
  const resp = await fetch(proxyUrl, {
    method: "POST",
    headers: postHeaders(),
    body: JSON.stringify({ query, variables, apiKey: apiKey || undefined }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await resp.text();
  if (!resp.ok) {
    try { const err = JSON.parse(text); throw new Error(err.error || `Monday proxy fout: ${resp.status}`); } catch (e) { if (e.message) throw e; throw new Error(text || `Monday proxy fout: ${resp.status}`); }
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Server gaf geen geldige response"); }
  if (data.error) throw new Error(data.error);
  if (data.errors) throw new Error(data.errors[0]?.message || "Monday fout");
  return data.data;
}

async function getMondayBoards(apiKeyOverride = null) {
  const data = await mondayGraphQL(`query { boards(limit:50) { id name } }`, {}, apiKeyOverride);
  return data.boards || [];
}

async function getMondayColumns(boardId) {
  const data = await mondayGraphQL(`query($bid:ID!) { boards(ids:[$bid]) { columns { id title type } } }`, { bid: boardId });
  return data.boards?.[0]?.columns || [];
}

// Zoek bestaand item op naam - deduplicatie
async function findItemByName(boardId, name) {
  try {
    const data = await mondayGraphQL(
      `query($bid:[ID!]!, $term:String!) { boards(ids:$bid) { items_page(limit:5, query_params:{rules:[{column_id:"name",compare_value:[$term],operator:contains_text}]}) { items { id name } } } }`,
      { bid: [boardId], term: name.slice(0, 40) }
    );
    return data.boards?.[0]?.items_page?.items?.[0] || null;
  } catch { return null; }
}

// Maak item aan of update bestaand - geeft item ID terug
async function getOrCreateGroup(boardId, groupName) {
  // Get existing groups
  const data = await mondayGraphQL(
    `query($bid:ID!) { boards(ids:[$bid]) { groups { id title } } }`,
    { bid: boardId }
  );
  const groups = data.boards?.[0]?.groups || [];
  const existing = groups.find(g => g.title === groupName);
  if (existing) return existing.id;
  // Create group
  const res = await mondayGraphQL(
    `mutation($bid:ID!, $name:String!) { create_group(board_id:$bid, group_name:$name) { id } }`,
    { bid: boardId, name: groupName }
  );
  return res.create_group?.id;
}

async function upsertItem(boardId, name, columnValues, groupId) {
  const existing = await findItemByName(boardId, name);
  if (existing) {
    await mondayGraphQL(
      `mutation($bid:ID!, $iid:ID!, $cv:JSON!) { change_multiple_column_values(board_id:$bid, item_id:$iid, column_values:$cv) { id } }`,
      { bid: boardId, iid: existing.id, cv: JSON.stringify(columnValues) }
    );
    return existing.id;
  } else {
    const q = groupId
      ? `mutation($bid:ID!, $gid:String!, $name:String!, $cv:JSON!) { create_item(board_id:$bid, group_id:$gid, item_name:$name, column_values:$cv) { id } }`
      : `mutation($bid:ID!, $name:String!, $cv:JSON!) { create_item(board_id:$bid, item_name:$name, column_values:$cv) { id } }`;
    const vars = groupId
      ? { bid: boardId, gid: groupId, name, cv: JSON.stringify(columnValues) }
      : { bid: boardId, name, cv: JSON.stringify(columnValues) };
    const data = await mondayGraphQL(q, vars);
    return data.create_item?.id;
  }
}

// Voeg update-notitie toe (zichtbaar in tijdlijn van het item)
async function addUpdate(itemId, body) {
  await mondayGraphQL(
    `mutation($iid:ID!, $body:String!) { create_update(item_id:$iid, body:$body) { id } }`,
    { iid: itemId, body }
  );
}

// Koppel contact aan account via connect_boards kolom
async function koppelContactAanAccount(contactBoardId, contactId, accountColId, accountId) {
  if (!accountColId || !accountId) return;
  try {
    await mondayGraphQL(
      `mutation($bid:ID!, $iid:ID!, $col:String!, $val:JSON!) { change_column_value(board_id:$bid, item_id:$iid, column_id:$col, value:$val) { id } }`,
      { bid: contactBoardId, iid: contactId, col: accountColId, val: JSON.stringify({ item_ids: [parseInt(accountId)] }) }
    );
  } catch(e) { console.warn("Koppeling contact->account mislukt:", e.message); }
}

// --- MONDAY BOARD AANMAKEN ---------------------------------------------------
// Maakt de volledige YourDomi CRM structuur aan in Monday:
// 1. Accounts board (panden/eigenaars) met alle kolommen
// 2. Contacts board (personen) met koppeling naar Accounts
async function createYourDomiBoards() {
  // -- Stap 1: Accounts board aanmaken --------------------------------------
  const accData = await mondayGraphQL(
    `mutation($name:String!, $kind:BoardKind!) { create_board(board_name:$name, board_kind:$kind) { id } }`,
    { name: "YourDomi - Accounts (Panden)", kind: "public" }
  );
  const accBoardId = accData.create_board?.id;
  if (!accBoardId) throw new Error("Account board aanmaken mislukt");

  // Kolommen aanmaken voor Accounts board
  const accCols = [
    { title: "Lead status",      type: "status",   defaults: JSON.stringify({ labels: { 0:"Nieuw", 1:"Gebeld", 2:"Interesse - Afspraak", 3:"Terugbellen", 4:"Afgewezen", 5:"Klant" } }) },
    { title: "Telefoon",         type: "phone",    defaults: null },
    { title: "E-mail",           type: "email",    defaults: null },
    { title: "Website",          type: "link",     defaults: null },
    { title: "Adres",            type: "location", defaults: null },
    { title: "Omzetschatting",   type: "text",     defaults: null },
    { title: "Platform links",   type: "text",     defaults: null },
    { title: "Contract advies",  type: "text",     defaults: null },
    { title: "Slaapplaatsen",    type: "text",     defaults: null },
    { title: "Registratie TV",   type: "text",     defaults: null },
    { title: "AI Score",         type: "status",   defaults: JSON.stringify({ labels: { 0:"🔥 HEET", 1:"W WARM", 2:"K KOUD" } }) },
  ];

  const accColIds = {};
  for (const col of accCols) {
    try {
      const q = col.defaults
        ? `mutation($bid:ID!,$t:String!,$tp:ColumnType!,$def:JSON!) { create_column(board_id:$bid,title:$t,column_type:$tp,defaults:$def) { id title } }`
        : `mutation($bid:ID!,$t:String!,$tp:ColumnType!) { create_column(board_id:$bid,title:$t,column_type:$tp) { id title } }`;
      const vars = col.defaults
        ? { bid: accBoardId, t: col.title, tp: col.type, def: col.defaults }
        : { bid: accBoardId, t: col.title, tp: col.type };
      const r = await mondayGraphQL(q, vars);
      accColIds[col.title] = r.create_column?.id;
    } catch(e) { console.warn(`Kolom '${col.title}' overgeslagen:`, e.message); }
  }

  // -- Stap 2: Contacts board aanmaken --------------------------------------
  const conData = await mondayGraphQL(
    `mutation($name:String!, $kind:BoardKind!) { create_board(board_name:$name, board_kind:$kind) { id } }`,
    { name: "YourDomi - Contacts (Personen)", kind: "public" }
  );
  const conBoardId = conData.create_board?.id;
  if (!conBoardId) throw new Error("Contacts board aanmaken mislukt");

  const conCols = [
    { title: "Status",           type: "status",         defaults: JSON.stringify({ labels: { 0:"Lead", 1:"Gecontacteerd", 2:"Interesse", 3:"Terugbellen", 4:"Afgewezen" } }) },
    { title: "Telefoon",         type: "phone",          defaults: null },
    { title: "E-mail",           type: "email",          defaults: null },
    { title: "Pand",             type: "text",           defaults: null },
    { title: "Rol",              type: "text",           defaults: null },
    { title: "Account",          type: "board_relation", defaults: JSON.stringify({ boardIds: [parseInt(accBoardId)] }) },
  ];

  const conColIds = {};
  for (const col of conCols) {
    try {
      const q = col.defaults
        ? `mutation($bid:ID!,$t:String!,$tp:ColumnType!,$def:JSON!) { create_column(board_id:$bid,title:$t,column_type:$tp,defaults:$def) { id title } }`
        : `mutation($bid:ID!,$t:String!,$tp:ColumnType!) { create_column(board_id:$bid,title:$t,column_type:$tp) { id title } }`;
      const vars = col.defaults
        ? { bid: conBoardId, t: col.title, tp: col.type, def: col.defaults }
        : { bid: conBoardId, t: col.title, tp: col.type };
      const r = await mondayGraphQL(q, vars);
      conColIds[col.title] = r.create_column?.id;
    } catch(e) { console.warn(`Kolom '${col.title}' overgeslagen:`, e.message); }
  }

  // -- Automatische kolom mapping teruggeven ---------------------------------
  return {
    accountBoardId: accBoardId,
    contactBoardId: conBoardId,
    accountColMap: {
      status:              accColIds["Lead status"]      || "",
      phone:               accColIds["Telefoon"]         || "",
      email:               accColIds["E-mail"]           || "",
      website:             accColIds["Website"]          || "",
      location:            accColIds["Adres"]            || "",
      text_omzet:          accColIds["Omzetschatting"]   || "",
      text_platforms:      accColIds["Platform links"]   || "",
      text_contract:       accColIds["Contract advies"]  || "",
      text_slaapplaatsen:  accColIds["Slaapplaatsen"]    || "",
      text_registratie:    accColIds["Registratie TV"]   || "",
    },
    contactColMap: {
      status:        conColIds["Status"]    || "",
      phone:         conColIds["Telefoon"]  || "",
      email:         conColIds["E-mail"]    || "",
      text_pand:     conColIds["Pand"]      || "",
      text_rol:      conColIds["Rol"]       || "",
      account_link:  conColIds["Account"]   || "",
    },
  };
}

// --- SYNC NAAR ONGOING DEALS BOARD ------------------------------------------
// Mapt beluitkomsten exact op Stage + Next step kolommen van het bestaande board
// --- AI NOTE PARSER: extract CRM fields from call notes ---
async function extractFollowUp(note, outcome) {
  if (!note || note.trim().length < 5) return null;
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const resp = await fetch(API_URL + "/api/ai", {
      method: "POST",
      headers: postHeaders(),
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `You are a CRM assistant for a Belgian short-term rental company (yourdomi.be). 
Analyze this call note and extract structured CRM fields.

Call note: "${note}"
Call outcome: "${outcome}"
Today: ${todayStr}

EXACT valid values for nextStep (must match exactly):
- "Appointment" — meeting/afspraak planned
- "Call Back" — terugbellen afgesproken  
- "Follow-up" — algemene follow-up nodig
- "Make analysis" — analyse maken
- "Make proposal" — voorstel maken
- "Send contract" — contract sturen

EXACT valid values for stage (must match exactly):
- "New / Meeting Planned" — interesse, afspraak plannen
- "Met - Info Requested" — info gevraagd, mail sturen
- "Discovery" — in gesprek, verkenning
- "Analysis / Estimation" — analyse bezig
- "Proposal Sent" — voorstel verstuurd
- "Negotiation" — onderhandeling
- "Contract Sent" — contract verstuurd
- "Won" — gewonnen
- "Lost" — verloren
- "Think About It / Nurture" — nadenken
- "Contact Later" — later contacteren

Respond ONLY with valid JSON, no explanation:
{
  "nextStep": <one of the exact values above or null>,
  "stage": <one of the exact values above or null>,
  "followUpDate": <"YYYY-MM-DD" if a specific date/day is mentioned, else null>,
  "followUpNote": <"short summary of what needs to happen" or null>,
  "assignedTo": <"name of person responsible" or null>
}

Rules:
- Only set stage if the note clearly implies a stage change
- Convert relative dates like "vrijdag", "volgende week", "over 2 dagen" to YYYY-MM-DD
- assignedTo: extract name if someone specific is mentioned (e.g. "Aaron moet bellen" -> "Aaron")
- If nothing concrete, return null for all fields`
        }]
      })
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch(e) {
    console.warn("Follow-up extractie mislukt:", e.message);
    return null;
  }
}

async function syncMondayCRM(property, ai, outcome, note, contactNaam, loggedInUser) {
  const dealsBoardId = "5092514219"; // Railway: MONDAY_BOARD_ID

  // 1. Fetch columns + Monday users in parallel
  const UNSUPPORTED = ["mirror","lookup","formula","button","dependency","auto_number","creation_log","last_updated","item_id","board_relation","subtasks"];
  const [allCols, usersData] = await Promise.all([
    getMondayColumns(dealsBoardId),
    mondayGraphQL(`query { users(kind:non_guests) { id name email } }`),
  ]);
  const cols = allCols.filter(c => !UNSUPPORTED.includes(c.type));
  const colList = cols.map(c => `${c.id} | ${c.title} | ${c.type}`).join("\n");

  // Monday user list: map our usernames to Monday IDs by email
  const mondayUsers = (usersData.users || []).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    // Match to our app username by email prefix (aaron@yourdomi.be → aaron)
    appUsername: u.email?.split("@")[0]?.toLowerCase(),
  }));
  const userListForAI = mondayUsers.map(u => `${u.appUsername} | ${u.name} | monday_id:${u.id}`).join("\n");
  const currentUser = mondayUsers.find(u => u.appUsername === loggedInUser?.toLowerCase());

  // 2. Outcome defaults
  const stageMap    = { gebeld_interesse:"New / Meeting Planned", callback:"New / Meeting Planned", terugbellen:"New / Meeting Planned", afgewezen:"Contact Later" };
  const nextStepMap = { gebeld_interesse:"Appointment", callback:"Call Back", terugbellen:"Call Back", afgewezen:"Follow-up" };
  const probMap     = { gebeld_interesse:60, callback:20, terugbellen:20, afgewezen:0 };

  // 3. Run AI to analyse notes + decide which columns to set and with what values
  const followUp = note ? await extractFollowUp(note, outcome) : null;

  // 4. Use AI to auto-map property data to board columns
  const aiResp = await fetch(API_URL + "/api/ai", {
    method: "POST",
    headers: postHeaders(),
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a Monday.com CRM assistant. Map property data to board columns.

BOARD COLUMNS (id | title | type):
${colList}

TEAM MEMBERS (appUsername | full name | monday_id):
${userListForAI}

LOGGED IN USER (person making the call): ${loggedInUser || "unknown"} (monday_id: ${currentUser?.id || "unknown"})

PROPERTY DATA:
- Name: ${property.name}
- Phone: ${property.phone || ""}
- Email: ${property.email || ""}
- Website: ${property.website || ai?.directWebsite?.url || ""}
- Address: ${[property.street, property.postalCode, property.municipality].filter(Boolean).join(", ")}
- Rooms/sleepplaces: ${property.sleepPlaces || property.slaapplaatsen || ""}
- Call outcome: ${outcome}
- Stage to set: ${followUp?.stage || stageMap[outcome] || "New / Meeting Planned"}
- Next step to set: ${followUp?.nextStep || nextStepMap[outcome] || "Follow-up"}
- Close probability: ${probMap[outcome] ?? 20}
- Follow-up date: ${followUp?.followUpDate || ""}
- Type: Beheer
- Call notes: ${note || ""}

ASSIGNMENT RULES:
- The "deal owner" column (or similar owner/assigned column) = the logged-in user (the caller)
- The "responsible next step" column (or similar responsible/next step person column) = read the notes carefully:
  * If the notes mention another team member by name (e.g. "aaron moet terugbellen", "ruben maakt analyse"), assign that person
  * If no other person is mentioned, assign the logged-in user
- Use the monday_id from the team members list above to set person columns
- Person column format: {"personsAndTeams": [{"id": MONDAY_USER_ID_AS_NUMBER, "kind": "person"}]}

Respond ONLY with a JSON object where keys are column IDs and values are the correct Monday API column value format:
- status column: {"label": "exact label string"}
- phone column: {"phone": "+32...", "countryShortName": "BE"}
- email column: "email@example.com"
- text column: "text value"
- numbers column: 42
- date column: {"date": "YYYY-MM-DD"}
- link column: {"url": "https://...", "text": "Website"}
- location column: {"address": "...", "city": "...", "country": "Belgium"}
- people/person column: {"personsAndTeams": [{"id": 12345678, "kind": "person"}]}

Only include columns where you have a real value. Skip columns you can't confidently map.`
      }]
    })
  });
  const aiData = await aiResp.json();
  const aiText = aiData.content?.[0]?.text || "{}";
  let vals = {};
  try {
    vals = JSON.parse(aiText.replace(/```json|```/g, "").trim());
  } catch(e) {
    console.warn("AI column mapping parse failed:", e.message, aiText);
  }

  const dealNaam = `${property.name}${property.municipality ? ` - ${property.municipality}` : ""}`;

  // Ensure "New - to be confirmed" group exists
  const groupId = await getOrCreateGroup(dealsBoardId, "New - to be confirmed");

  const dealId = await upsertItem(dealsBoardId, dealNaam, vals, groupId);

  if (dealId) {
    const plat = [
      ai?.airbnb?.gevonden  && `Airbnb: ${ai.airbnb.url || "gevonden"}`,
      ai?.booking?.gevonden && `Booking: ${ai.booking.url || "gevonden"}`,
      ai?.directWebsite?.gevonden && `${ai.directWebsite.url || "eigen website"}`,
    ].filter(Boolean).join(" | ");

    const uitkomstLabel = outcome === "gebeld_interesse" ? "✅ Interesse - afspraak plannen"
      : outcome === "callback" || outcome === "terugbellen" ? "🔄 Terugbellen"
      : "❌ Afgewezen";

    const updateBody = [
      `📞 Uitkomst: ${uitkomstLabel}`,
      `👤 Contact: ${contactNaam || "-"}`,
      `🧑‍💼 Beller: ${loggedInUser || "-"}`,
      followUp?.followUpNote ? `⏭️ Volgende stap: ${followUp.followUpNote}` : null,
      followUp?.followUpDate ? `📅 Datum: ${followUp.followUpDate}${followUp.assignedTo ? ` (voor ${followUp.assignedTo})` : ""}` : null,
      note ? `\n📝 Belnotities:\n${note}` : null,
      `\n─────────────────────`,
      ai?.contractadvies ? `📋 Formule: ${ai.contractadvies === "full" ? "Volledig beheer 25%" : ai.contractadvies === "partial" ? "Gedeeld beheer 20%" : "Zichtbaarheid 10%"}` : null,
      ai?.geschatMaandelijksInkomen ? `💰 Omzet nu: ${ai.geschatMaandelijksInkomen} | Met yourdomi: ${ai.potentieelMetYourDomi || "-"}` : null,
      plat ? `🌐 Online: ${plat}` : null,
      ai?.scoreReden ? `📊 AI score reden: ${ai.scoreReden}` : null,
      ai?.openingszin ? `📞 Openingszin: "${ai.openingszin}"` : null,
    ].filter(Boolean).join("\n");

    await addUpdate(dealId, updateBody);
  }

  return { dealId };
}

// --- TEAMS MEETING LINK GENERATOR --------------------------------------------
function buildGoogleMeetUrl(property, ai, note) {
  const subject = encodeURIComponent(`Kennismaking yourdomi.be - ${property.name}, ${property.municipality}`);

  const lines = [
    `🏠 CONTACTGEGEVENS`,
    property.phone   ? `📞 Telefoon:  ${property.phone}`  : null,
    property.email   ? `✉️  E-mail:    ${property.email}`  : null,
    property.website ? `🌐 Website:   ${property.website}` : null,
    ``,
    `📍 PAND`,
    `   Naam:    ${property.name}`,
    [property.street, property.postalCode, property.municipality].filter(Boolean).length
      ? `   Adres:   ${[property.street, property.postalCode, property.municipality].filter(Boolean).join(", ")}` : null,
    property.slaapplaatsen ? `   Slaapplaatsen: ${property.slaapplaatsen}` : null,
    ``,
    `💼 YOURDOMI ANALYSE`,
    ai?.geschatMaandelijksInkomen ? `   Huidig inkomen:    ${ai.geschatMaandelijksInkomen}/maand`     : null,
    ai?.potentieelMetYourDomi     ? `   Potentieel:        ${ai.potentieelMetYourDomi}/maand`          : null,
    ai?.contractadvies ? `   Besproken formule: ${ai.contractadvies === "full" ? "Volledig beheer (25%)" : ai.contractadvies === "partial" ? "Gedeeld beheer (20%)" : "Zichtbaarheid (10%)"}` : null,
    note ? `\n📝 BELNOTITIES\n${note}` : null,
    ``,
    `──────────────────────────`,
    `Agenda automatisch aangemaakt via yourdomi.be bellijst`,
  ].filter(v => v !== null);

  const body = encodeURIComponent(lines.join("\n"));
  const location = encodeURIComponent([property.street, property.postalCode, property.municipality].filter(Boolean).join(", "));

  return `https://calendar.google.com/calendar/r/eventedit?text=${subject}&details=${body}&location=${location}&crm=AVAILABLE`;
}

function buildInternalDebriefUrl(property, ai, note) {
  const subject = encodeURIComponent(`[Intern] Debrief - ${property.name}, ${property.municipality}`);
  const lines = [
    `🏠 PAND: ${property.name} — ${property.municipality}`,
    property.phone ? `📞 ${property.phone}` : null,
    ``,
    `💼 AI ANALYSE`,
    ai?.score ? `Score: ${ai.score} — ${ai.scoreReden || ""}` : null,
    ai?.geschatMaandelijksInkomen ? `Huidig inkomen: ${ai.geschatMaandelijksInkomen}/maand` : null,
    ai?.potentieelMetYourDomi ? `Potentieel: ${ai.potentieelMetYourDomi}/maand` : null,
    ai?.contractadvies ? `Formule: ${ai.contractadvies === "full" ? "Volledig beheer (25%)" : ai.contractadvies === "partial" ? "Gedeeld beheer (20%)" : "Zichtbaarheid (10%)"}` : null,
    note ? `\n📝 BELNOTITIES\n${note}` : null,
    ``,
    `✅ ACTIEPUNTEN`,
    `- `,
    ``,
    `👥 AANWEZIG`,
    `- Aaron`,
    `- Ruben`,
  ].filter(v => v !== null);
  const body = encodeURIComponent(lines.join("\n"));
  return `https://calendar.google.com/calendar/r/eventedit?text=${subject}&details=${body}`;
}

// --- JUSTCALL TRANSCRIPT → AI NOTITIES (koppeling later) -----------------------
function MeetTranscriptNotetaker({ onFilled }) {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const handleSummarize = async () => {
    if (!transcript.trim() || transcript.trim().length < 20) {
      setError("Plak minimaal een paar zinnen transcript.");
      return;
    }
    setLoading(true); setError(null);
    try {
      const r = await fetch(API_URL + "/api/meet/summarize", {
        method: "POST",
        headers: postHeaders(),
        body: JSON.stringify({ transcript: transcript.trim() }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Fout ${r.status}`);
      onFilled(data);
      setError(null);
      setTranscript("");
    } catch (e) {
      setError(e.message || "Samenvatting mislukt");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ marginBottom: 0 }}>
      <textarea
        style={{ ...S.notitieVeld, marginBottom: 8 }}
        rows={4}
        placeholder="Plak hier het transcript van je JustCall-belgesprek (of ander beltranscript)..."
        value={transcript}
        onChange={e => { setTranscript(e.target.value); setError(null); }}
        disabled={loading}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          style={{
            background: T.green,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.8 : 1,
          }}
          onClick={handleSummarize}
          disabled={loading}
        >
          {loading ? "Bezig..." : "Genereer notities uit transcript"}
        </button>
        {error && <span style={{ fontSize: 12, color: T.red }}>{error}</span>}
      </div>
    </div>
  );
}

// --- SCORE CONFIG -------------------------------------------------------------
const SCORES = {
  HEET:  { kleur: T.orange,     pale: T.orangePale,  border: "#E07B4A", emoji: "🔥", label: "HEET" },
  WARM:  { kleur: "#E8A838",    pale: "#FDF5E0",     border: "#E8A838", emoji: null, label: "WARM" },
  KOUD:  { kleur: T.greenLight, pale: T.greenPale,   border: T.greenLight, emoji: null, label: "KOUD" },
};

const CONTRACT_INFO = {
  visibility: { label: "Zichtbaarheid", pct: "10%", color: T.greenLight, desc: "Eigenaar beheert zelf" },
  partial:    { label: "Gedeeld beheer", pct: "20%", color: T.orange,     desc: "Communicatie + prijszetting" },
  full:       { label: "Volledig beheer", pct: "25%", color: T.green,     desc: "Alles uit handen" },
};

// --- HOOFD APP ----------------------------------------------------------------

// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const login = async () => {
    if (!username || !password) return;
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Inloggen mislukt"); return; }
      localStorage.setItem("yd_token", data.token);
      localStorage.setItem("yd_user", JSON.stringify({ username: data.username, name: data.name }));
      onLogin(data);
    } catch(e) {
      setError("Kan server niet bereiken");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F0EDE6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 36px", width: 360, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #E8E4DC" }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#2D5C4E", letterSpacing: -0.5 }}>
            YourDomi<span style={{ color: "#E07B4A" }}>.</span>
          </div>
          <div style={{ fontSize: 12, color: "#9A9488", marginTop: 4, letterSpacing: 2, textTransform: "uppercase" }}>Bellijst</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6560", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Gebruikersnaam</label>
            <input
              style={{ width: "100%", background: "#F0EDE6", border: "1px solid #E8E4DC", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#2A2520", outline: "none", boxSizing: "border-box" }}
              placeholder="aaron"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6560", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Wachtwoord</label>
            <input
              style={{ width: "100%", background: "#F0EDE6", border: "1px solid #E8E4DC", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#2A2520", outline: "none", boxSizing: "border-box" }}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: "#C0392B", background: "#FDF2F2", borderRadius: 6, padding: "8px 10px" }}>⚠️ {error}</div>}
          <button
            onClick={login}
            disabled={loading || !username || !password}
            style={{ background: "#2D5C4E", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4, opacity: (loading || !username || !password) ? 0.6 : 1, fontFamily: "inherit" }}
          >
            {loading ? "Inloggen..." : "Inloggen →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem("yd_token");
      if (!token) return null;
      return JSON.parse(localStorage.getItem("yd_user") || "null");
    } catch { return null; }
  });

  const handleLogin = (data) => setUser({ username: data.username, name: data.name });
  const handleLogout = async () => {
    await fetch(`${API_URL}/api/logout`, { method: "POST", headers: getHeaders() }).catch(() => {});
    localStorage.removeItem("yd_token");
    localStorage.removeItem("yd_user");
    setUser(null);
  };

  const [view, setView] = useState("lijst"); // "lijst" | "dossier" | "config"
  const [properties, setProperties] = useState([]);
  const [enriched, setEnriched] = useState(() => {
    const raw = load("enriched", {});
    const clean = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v && typeof v === "object" && typeof v.score === "string") clean[k] = v;
    }
    return clean;
  });
  const [platformScan, setPlatformScan] = useState({}); // id -> { website, airbnb, booking } from background scan
  const [outcomes, setOutcomes] = useState(() => load("outcomes", {}));
  const [notes, setNotes] = useState(() => load("notes", {}));
  const [hidden, setHidden] = useState(() => load("hidden", [])); // manual hide
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState(new Set());
  const [addressEnrichingIds, setAddressEnrichingIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [phoneGroups, setPhoneGroups] = useState({}); // phoneNorm -> [ids]
  // Monday config
  const [mondayCfg, setMondayCfg] = useState(() => ({
    apiKey:        loadCfg("monday_key"),
    dealsBoardId:  loadCfg("monday_deals_board"),
    dealsColMap:   (() => { try { return JSON.parse(loadCfg("monday_deals_cols") || "{}"); } catch { return {}; } })(),
  }));
  const mondayActief = true; // API key stored server-side in Railway
  const [mondaySyncing, setMondaySyncing] = useState(new Set());
  const [mondayStatus, setMondayStatus] = useState({}); // id -> "ok"|"fout"|"bezig"
  const [mondayFout, setMondayFout] = useState({}); // id -> error message

  // -- FILTERS --
  const [filters, setFilters] = useState({
    zoek: "",
    gemeente: "",
    provincie: "",
    status: "",
    minSlaap: "",
    maxSlaap: "",
    score: "",
    heeftWebsite: false,
    heeftTelefoon: false,
    heeftEmail: false,
    heeftAirbnb: false,
    heeftBooking: false,
    geenAgentuur: false,
    slechteWebsite: false,
    regio: "",
    type: "",
    toonVerborgen: false,
    toonAfgewezen: true,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [sorteer, setSorteer] = useState("score"); // score | naam | slaap | gemeente
  const [displayMode, setDisplayMode] = useState("cards"); // "cards" | "table"
  const [aiGestart, setAiGestart] = useState(false);
  const [meta, setMeta] = useState({ provinces: [], types: [], regios: [] });
  const [cardThumbErrors, setCardThumbErrors] = useState({}); // id -> true when thumb image failed to load

  // Laad panden + start meteen batch verrijking
  const laadPanden = useCallback(async (p = 1, currentFilters = null) => {
    setLoading(true); setError(null);
    try {
      const data = await fetchLodgings(p, 50, currentFilters || {}, sorteer);
      const rawList = Array.isArray(data?.data) ? data.data : [];
      const items = rawList.map(item => parseLodging(item));
      setProperties(items);
      const total = Math.max(0, parseInt(data?.meta?.total, 10) || data?.meta?.count || items.length || 0);
      setTotalCount(total);
      const groups = {};
      items.forEach(it => {
        if (it.phoneNorm) {
          if (!groups[it.phoneNorm]) groups[it.phoneNorm] = [];
          groups[it.phoneNorm].push(it.id);
        }
      });
      setPhoneGroups(groups);
      if (items.length > 0 && !selected) setSelected(items[0]);

    } catch (e) {
      if (e.message === "401") {
        setUser(null); // shows login screen
      } else {
        setError(e.message);
      }
    }
    finally { setLoading(false); }
  }, []);

  // Batch verrijking - laadt alle panden van de pagina 3 tegelijk op
  const startBatchEnrich = useCallback((items, groups, priorityIds = null) => {
    const cached = load("enriched", {});
    let toEnrich = items.filter(p => !cached[p.id]);
    // If priority list given, enrich those first
    if (priorityIds && priorityIds.length > 0) {
      const priSet = new Set(priorityIds);
      const pri = toEnrich.filter(p => priSet.has(p.id));
      const rest = toEnrich.filter(p => !priSet.has(p.id));
      toEnrich = [...pri, ...rest];
    }
    if (toEnrich.length === 0) return;

    const PARALLEL = 3; // 3 tegelijk om rate limits te vermijden
    let idx = 0;

    const volgende = async () => {
      if (idx >= toEnrich.length) return;
      const prop = toEnrich[idx++];
      setEnrichingIds(s => new Set([...s, prop.id]));
      const portfolio = groups[prop.phoneNorm]?.length > 1
        ? { count: groups[prop.phoneNorm].length, names: groups[prop.phoneNorm].map(id => items.find(p => p.id === id)?.name || id) }
        : null;
      try {
        const result = await enrichProperty(prop, portfolio);
        setEnriched(prev => {
          const updated = { ...prev, [prop.id]: result };
          save("enriched", updated);
          return updated;
        });
        saveEnrichment(prop.id, result).catch(() => {});
      } catch (e) { console.error("Verrijking mislukt voor", prop.name, e); }
      finally {
        setEnrichingIds(s => { const n = new Set(s); n.delete(prop.id); return n; });
        await volgende(); // pak volgende zodra deze klaar is
      }
    };

    // Start PARALLEL workers tegelijk
    for (let i = 0; i < Math.min(PARALLEL, toEnrich.length); i++) {
      volgende();
    }
  }, []);

  useEffect(() => {
    // Load meta (provinces, types, regios) from server
    if (API_URL) {
      fetch(`${API_URL}/api/meta`, { headers: getHeaders() }).then(r => {
        if (!r.ok) return;
        return r.json();
      }).then(m => {
        if (m && (m.provinces || m.regios)) setMeta(m);
      }).catch(() => {});
    }
    // Load enrichments from server first (overrides localStorage)
    if (API_URL) {
      loadAllEnrichments().then(serverData => {
        if (serverData && Object.keys(serverData).length > 0) {
          setEnriched(serverData);
          save("enriched", serverData);
        }
      }).catch(() => {});
      loadPlatformScan().then(scanData => {
        if (scanData && typeof scanData === "object") setPlatformScan(scanData);
      }).catch(() => {});
    }
    laadPanden(1);
  }, [laadPanden]);

  // Re-fetch from server when filters change (debounced 400ms)
  useEffect(() => {
    if (!API_URL) return; // client-side filtering only when no server
    const timer = setTimeout(() => {
      setPage(1);
      laadPanden(1, filters);
      setAiGestart(false); // reset AI button when filters change
    }, 400);
    return () => clearTimeout(timer);
  }, [filters.zoek, filters.gemeente, filters.provincie, filters.status, filters.minSlaap, filters.maxSlaap, filters.heeftTelefoon, filters.heeftEmail, filters.heeftWebsite, filters.regio, filters.type, sorteer]);

  // Verberg pand + alle panden met zelfde telefoon als afgewezen
  const verbergPand = useCallback((id, reden = "verborgen") => {
    const prop = properties.find(p => p.id === id);
    let toHide = [id];
    if (reden === "afgewezen" && prop?.phoneNorm) {
      const groep = phoneGroups[prop.phoneNorm] || [];
      if (groep.length > 1) toHide = groep; // wis alle met zelfde nr
    }
    const newHidden = [...new Set([...hidden, ...toHide])];
    setHidden(newHidden);
    save("hidden", newHidden);
    const newOut = { ...outcomes };
    toHide.forEach(hid => { newOut[hid] = reden; });
    setOutcomes(newOut);
    save("outcomes", newOut);
    // Ga naar volgende
    const visible = zichtbaar.filter(p => !toHide.includes(p.id));
    if (visible.length > 0) { setSelected(visible[0]); }
  }, [properties, phoneGroups, hidden, outcomes]);



  // Verrijking wordt batch gewijs gestart bij laadPanden

  const slaaNootOp = (id, val) => {
    const updated = { ...notes, [id]: val };
    setNotes(updated); save("notes", updated);
  };
  const slaUitkomstOp = useCallback((id, val) => {
    const updated = { ...outcomes, [id]: val };
    setOutcomes(updated); save("outcomes", updated);
    saveOutcomeToServer(id, val, notes[id] || "", load("contactnamen", {})[id] || "").catch(() => {});
    // Monday push only via manual button - not automatic
  }, [outcomes, mondayActief, mondayCfg, properties, enriched, notes]);

  // Gefilterde + gesorteerde lijst
  let zichtbaar = properties.filter(p => {
    // Local-only filters (not sent to server)
    if (!filters.toonVerborgen && hidden.includes(p.id)) return false;
    if (!filters.toonAfgewezen && outcomes[p.id] === "afgewezen") return false;
    if (filters.score && enriched[p.id]?.score !== filters.score) return false;
    return true;
  });

  // Helper: merged AI for card (enrichment + platform scan + website-is-Airbnb/Booking)
  const getCardAi = (id, property = null) => {
    const en = enriched[id];
    const scan = platformScan[id];
    let ai = null;
    if (en) {
      ai = {
        ...en,
        airbnb: en.airbnb?.gevonden ? en.airbnb : (scan?.airbnb?.gevonden ? scan.airbnb : { gevonden: false }),
        booking: en.booking?.gevonden ? en.booking : (scan?.booking?.gevonden ? scan.booking : { gevonden: false }),
      };
    } else if (scan) {
      ai = { airbnb: scan.airbnb || { gevonden: false }, booking: scan.booking || { gevonden: false }, directWebsite: scan.website ? { gevonden: scan.website.gevonden, url: scan.website.url } : {} };
    }
    if (property?.website && typeof property.website === "string") {
      const w = property.website.toLowerCase();
      if (w.includes("airbnb.com") && !ai?.airbnb?.gevonden) ai = { ...(ai || {}), airbnb: { gevonden: true, url: property.website } };
      if (w.includes("booking.com") && !ai?.booking?.gevonden) ai = { ...(ai || {}), booking: { gevonden: true, url: property.website } };
    }
    return ai;
  };

  // Extra filters (AI-enrichment + platform-scan based)
  zichtbaar = zichtbaar.filter(p => {
    const ai = getCardAi(p.id, p);
    if (filters.heeftAirbnb && !(ai?.airbnb?.gevonden)) return false;
    if (filters.heeftBooking && !(ai?.booking?.gevonden)) return false;
    if (filters.geenAgentuur && enriched[p.id]?.waarschuwingAgentuur) return false;
    if (filters.slechteWebsite && !(enriched[p.id]?.directWebsite?.poorlyBuilt)) return false;
    return true;
  });

  // Sortering (Airbnb/Booking get extra boost so callers can contact them sooner)
  zichtbaar.sort((a, b) => {
    if (sorteer === "score") {
      const sOrd = { HEET: 0, WARM: 1, KOUD: 2 };
      const aS = sOrd[enriched[a.id]?.score] ?? 3;
      const bS = sOrd[enriched[b.id]?.score] ?? 3;
      if (aS !== bS) return aS - bS;
      let aP = enriched[a.id]?.prioriteit ?? 5, bP = enriched[b.id]?.prioriteit ?? 5;
      const aPlatform = getCardAi(a.id, a)?.airbnb?.gevonden || getCardAi(a.id, a)?.booking?.gevonden;
      const bPlatform = getCardAi(b.id, b)?.airbnb?.gevonden || getCardAi(b.id, b)?.booking?.gevonden;
      if (aPlatform && !bPlatform) aP += 2;
      if (bPlatform && !aPlatform) bP += 2;
      return bP - aP;
    }
    if (sorteer === "platform") {
      const aPlat = getCardAi(a.id, a)?.airbnb?.gevonden || getCardAi(a.id, a)?.booking?.gevonden;
      const bPlat = getCardAi(b.id, b)?.airbnb?.gevonden || getCardAi(b.id, b)?.booking?.gevonden;
      if (aPlat && !bPlat) return -1;
      if (!aPlat && bPlat) return 1;
      return (a.name || "").localeCompare(b.name || "");
    }
    if (sorteer === "naam") return (a.name || "").localeCompare(b.name || "");
    if (sorteer === "slaap_hoog") return (b.slaapplaatsen || 0) - (a.slaapplaatsen || 0);
    if (sorteer === "slaap_laag") return (a.slaapplaatsen || 0) - (b.slaapplaatsen || 0);
    if (sorteer === "nieuwste") {
      const aDate = a.onlineSince || a.dateOnline || "";
      const bDate = b.onlineSince || b.dateOnline || "";
      return bDate.localeCompare(aDate); // newest first
    }
    if (sorteer === "gemeente") return (a.municipality || "").localeCompare(b.municipality || "");
    return 0;
  });

  const uniekeProvincies = [...new Set(properties.map(p => p.province).filter(Boolean))].sort();

  const heetCount = properties.filter(p => enriched[p.id]?.score === "HEET").length;
  const warmCount = properties.filter(p => enriched[p.id]?.score === "WARM").length;
  const portfolioCount = Object.values(phoneGroups).filter(g => g.length > 1).length;
  const verrijktCount = properties.filter(p => enriched[p.id]).length;
  const enrichProgress = properties.length > 0 ? Math.round((verrijktCount / properties.length) * 100) : 0;

  if (view === "config") {
    return (
      <ConfigView
        cfg={mondayCfg}
        onSave={(newCfg) => {
          setMondayCfg(newCfg);
          saveCfg("monday_key", newCfg.apiKey);
          saveCfg("monday_deals_board", newCfg.dealsBoardId || "");
          // column mapping now handled automatically by AI
          setView("lijst");
        }}
        onTerug={() => setView("lijst")}
      />
    );
  }

  if (view === "dossier" && selected) {
    return (
      <DossierView
        property={selected}
        ai={enriched[selected.id]}
        platformScanData={platformScan[selected.id]}
        enriching={enrichingIds.has(selected.id)}
        outcome={outcomes[selected.id] || null}
        note={notes[selected.id] || ""}
        phoneGroups={phoneGroups}
        properties={properties}
        onNote={v => { slaaNootOp(selected.id, v); }}
        onOutcome={v => slaUitkomstOp(selected.id, v)}
        onVerberg={() => verbergPand(selected.id, "verborgen")}
        onAfgewezen={() => verbergPand(selected.id, "afgewezen")}
        onTerug={() => setView("lijst")}
        currentIdx={zichtbaar.findIndex(p => p.id === selected.id) + 1}
        total={zichtbaar.length}
        onVolgende={() => {
          const idx = zichtbaar.findIndex(p => p.id === selected.id);
          if (idx < zichtbaar.length - 1) setSelected(zichtbaar[idx + 1]);
        }}
        onVorige={() => {
          const idx = zichtbaar.findIndex(p => p.id === selected.id);
          if (idx > 0) setSelected(zichtbaar[idx - 1]);
        }}
        onSelectPand={(p) => setSelected(p)}
        mondayActief={mondayActief}
        mondayStatus={mondayStatus[selected.id]}
        mondayFoutMsg={mondayFout[selected.id] || ""}
        mondaySyncing={mondaySyncing.has(selected.id)}
        mondayCfg={mondayCfg}
        onOpenConfig={() => setView("config")}
        onPushMonday={() => {
          const prop = selected;
          const ai = enriched[prop.id];
          const outcome = outcomes[prop.id];
          const note = notes[prop.id] || "";
          const contactNaam = load("contactnamen", {})[prop.id] || prop.name;
          setMondaySyncing(s => new Set([...s, prop.id]));
          setMondayStatus(s => ({ ...s, [prop.id]: "bezig" }));
          syncMondayCRM(prop, ai, outcome, note, contactNaam, user?.username)
            .then(() => setMondayStatus(s => ({ ...s, [prop.id]: "ok" })))
            .catch(e => { console.error("Monday push fout:", e); setMondayStatus(s => ({ ...s, [prop.id]: "fout" })); setMondayFout(s => ({ ...s, [prop.id]: e.message || String(e) })); })
            .finally(() => setMondaySyncing(s => { const n = new Set(s); n.delete(prop.id); return n; }));
        }}
        onSaveContactNaam={(naam) => {
          const updated = { ...load("contactnamen", {}), [selected.id]: naam };
          save("contactnamen", updated);
        }}
        contactNaam={load("contactnamen", {})[selected.id] || ""}
      />
    );
  }

  if (!user || !getToken()) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={S.root}>
      <style>{globalCSS}</style>

      {/* SERVER ERROR BANNER */}
      {error && !loading && (
        <div style={{ background: "#e53e3e", color: "white", textAlign: "center", padding: "8px 16px", fontSize: 13, fontWeight: 600 }}>
          ⚠️ Serverfout: {error} — <button onClick={() => laadPanden(page, filters)} style={{ color: "white", background: "none", border: "1px solid white", borderRadius: 4, padding: "2px 8px", cursor: "pointer", marginLeft: 8 }}>Opnieuw</button>
        </div>
      )}

      <div style={S.header}>
        <div className="yd-header-inner" style={S.headerInner}>
          <div style={S.brand}>
            <span style={S.brandName}>YourDomi</span>
            <span style={S.brandDot}>.</span>
            <span style={S.brandSub}>BELLIJST</span>
          </div>
          <span style={{ fontSize: 12, color: "#9A9488", marginRight: 4 }}>{user?.name || user?.username}</span>
          <button onClick={handleLogout} style={{ ...S.cfgBtn, fontSize: 10, padding: "5px 10px", color: "#9A9488" }} title="Uitloggen">Uitloggen</button>
          <button onClick={() => setView("config")} style={S.cfgBtn} title="Monday & instellingen">
            <span style={{ fontSize: 16 }}></span>
            {mondayActief ? <span style={S.cfgActief}>Monday v</span> : <span style={S.cfgInactief}>Integraties</span>}
          </button>
          <div className="yd-header-stats" style={S.headerStats}>
            <Stat label="Panden" val={zichtbaar.length} />
            <Stat label="🔥 Heet" val={heetCount} accent />
            <Stat label="Portfolio" val={portfolioCount} />
            <div style={S.enrichProgBlok}>
              <div style={S.enrichProgLabel}>AI {verrijktCount}/{properties.length}</div>
              <div style={S.enrichProgBar}>
                <div style={{ ...S.enrichProgFill, width: enrichProgress + "%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTERBAR */}
      <div style={S.filterBar}>
        <div className="yd-filterbar-row" style={S.filterInner}>
          <input
            style={S.zoekInput}
            placeholder="Zoeken op naam, gemeente, postcode..."
            value={filters.zoek}
            onChange={e => setFilters(f => ({ ...f, zoek: e.target.value }))}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
            <button
              style={{
                ...S.filterToggleBtn,
                background: displayMode === "cards" ? T.green : "transparent",
                color: displayMode === "cards" ? "#fff" : T.textMid,
                border: `1px solid ${displayMode === "cards" ? T.green : T.border}`,
              }}
              onClick={() => setDisplayMode("cards")}
            >
              Kaarten
            </button>
            <button
              style={{
                ...S.filterToggleBtn,
                background: displayMode === "table" ? T.green : "transparent",
                color: displayMode === "table" ? "#fff" : T.textMid,
                border: `1px solid ${displayMode === "table" ? T.green : T.border}`,
              }}
              onClick={() => setDisplayMode("table")}
            >
              Tabel
            </button>
          </div>
          <select
            className="yd-sort-select"
            style={{ ...S.filterInput, minWidth: 160, cursor: "pointer" }}
            value={sorteer}
            onChange={e => setSorteer(e.target.value)}
          >
            <option value="score">Sorteren: AI Score</option>
            <option value="platform">Sorteren: Airbnb/Booking eerst</option>
            <option value="naam">Sorteren: Naam A-Z</option>
            <option value="gemeente">Sorteren: Gemeente</option>
            <option value="slaap_hoog">Sorteren: Slaappl. hoog-laag</option>
            <option value="slaap_laag">Sorteren: Slaappl. laag-hoog</option>
            <option value="nieuwste">🆕 Nieuwste online eerst</option>
          </select>
          <button style={S.filterToggleBtn} onClick={() => setFilterOpen(o => !o)}>
            Filters {filterOpen ? "^" : "v"}
          </button>
          <button
            style={{
              ...S.filterToggleBtn,
              background: aiGestart ? "#2D5C4E" : "#E07B4A",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              opacity: enrichingIds.size > 0 ? 0.7 : 1,
            }}
            onClick={() => {
              if (enrichingIds.size > 0) return;
              setAiGestart(true);
              // Enrich current page properties first, then rest
              startBatchEnrich(properties, phoneGroups, properties.map(p => p.id));
            }}
            title={aiGestart ? "AI verrijking actief" : "Start AI verrijking voor gefilterde panden"}
          >
            {enrichingIds.size > 0 ? "AI bezig..." : aiGestart ? "AI gestart v" : "Start AI"}
          </button>
          <button style={S.refreshBtn} onClick={() => laadPanden(page, filters)}>Zoeken</button>
        </div>

        {filterOpen && (
          <div style={S.filterPanel}>
            <div className="yd-filter-grid" style={S.filterGrid}>
              <FilterSelect label="Score" value={filters.score} onChange={v => setFilters(f => ({ ...f, score: v }))}
                options={[["", "Alle scores"], ["HEET", "🔥 Heet"], ["WARM", "W Warm"], ["KOUD", "K Koud"]]} />
              <FilterSelect label="Provincie" value={filters.provincie} onChange={v => setFilters(f => ({ ...f, provincie: v }))}
                options={[["", "Alle provincies"], ...(meta.provinces.length ? meta.provinces : uniekeProvincies).map(p => [p, p])]} />
              <FilterSelect label="Toeristische regio" value={filters.regio} onChange={v => setFilters(f => ({ ...f, regio: v }))}
                options={[["", "Alle regio's"], ...meta.regios.map(r => [r, r])]} />
              <FilterSelect label="Type accommodatie" value={filters.type} onChange={v => setFilters(f => ({ ...f, type: v }))}
                options={[["", "Alle types"], ...meta.types.map(t => [t, t])]} />
              <FilterSelect label="Status" value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))}
                options={[["", "Alle statussen"], ["aangemeld", "Aangemeld"], ["erkend", "Erkend"], ["vergund", "Vergund"]]} />
              <div style={S.filterField}>
                <label style={S.filterLabel}>Gemeente</label>
                <input style={S.filterInput} placeholder="bv. Gent" value={filters.gemeente}
                  onChange={e => setFilters(f => ({ ...f, gemeente: e.target.value }))} />
              </div>
              <div style={S.filterField}>
                <label style={S.filterLabel}>Min. slaapplaatsen</label>
                <input style={S.filterInput} type="number" placeholder="0" value={filters.minSlaap}
                  onChange={e => setFilters(f => ({ ...f, minSlaap: e.target.value }))} />
              </div>
              <div style={S.filterField}>
                <label style={S.filterLabel}>Max. slaapplaatsen</label>
                <input style={S.filterInput} type="number" placeholder="inf" value={filters.maxSlaap}
                  onChange={e => setFilters(f => ({ ...f, maxSlaap: e.target.value }))} />
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e8e3da", paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#9b8ea0", textTransform: "uppercase", marginBottom: 8 }}>Contactgegevens aanwezig</div>
              <div style={S.filterCheckRow}>
                <label style={S.checkLabel}>
                  <input type="checkbox" checked={filters.heeftTelefoon} onChange={e => setFilters(f => ({ ...f, heeftTelefoon: e.target.checked }))} />
                  Telefoon
                </label>
                <label style={S.checkLabel}>
                  <input type="checkbox" checked={filters.heeftEmail} onChange={e => setFilters(f => ({ ...f, heeftEmail: e.target.checked }))} />
                  E-mail
                </label>
                <label style={S.checkLabel}>
                  <input type="checkbox" checked={filters.heeftWebsite} onChange={e => setFilters(f => ({ ...f, heeftWebsite: e.target.checked }))} />
                  Website
                </label>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e8e3da", paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#9b8ea0", textTransform: "uppercase", marginBottom: 8 }}>Online aanwezigheid (na AI / scan)</div>
              <div style={S.filterCheckRow}>
                <label style={S.checkLabel}>
                  <input type="checkbox" checked={filters.heeftAirbnb} onChange={e => setFilters(f => ({ ...f, heeftAirbnb: e.target.checked }))} />
                  Op Airbnb
                </label>
                <label style={S.checkLabel}>
                  <input type="checkbox" checked={filters.heeftBooking} onChange={e => setFilters(f => ({ ...f, heeftBooking: e.target.checked }))} />
                  Op Booking
                </label>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e8e3da", paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#9b8ea0", textTransform: "uppercase", marginBottom: 8 }}>AI-signalen</div>
              <div style={S.filterCheckRow}>
                <label style={S.checkLabel} title="Verberg panden waar telefoon/email waarschijnlijk een makelaar of agentuur is">
                  <input type="checkbox" checked={filters.geenAgentuur} onChange={e => setFilters(f => ({ ...f, geenAgentuur: e.target.checked }))} />
                  Geen agentuur/makelaar
                </label>
                <label style={S.checkLabel} title="Alleen panden met slecht gebouwde website (kans voor yourdomi)">
                  <input type="checkbox" checked={filters.slechteWebsite} onChange={e => setFilters(f => ({ ...f, slechteWebsite: e.target.checked }))} />
                  Slechte website
                </label>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e8e3da", paddingTop: 10, marginTop: 4, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#9b8ea0", textTransform: "uppercase" }}>Zichtbaarheid</div>
              <label style={S.checkLabel}>
                <input type="checkbox" checked={filters.toonVerborgen} onChange={e => setFilters(f => ({ ...f, toonVerborgen: e.target.checked }))} />
                Toon verborgen
              </label>
              <label style={S.checkLabel}>
                <input type="checkbox" checked={filters.toonAfgewezen} onChange={e => setFilters(f => ({ ...f, toonAfgewezen: e.target.checked }))} />
                Toon afgewezen
              </label>
              <button style={S.resetFiltersBtn} onClick={() => setFilters({ zoek:"",gemeente:"",provincie:"",status:"",minSlaap:"",maxSlaap:"",score:"",regio:"",type:"",heeftWebsite:false,heeftTelefoon:false,heeftEmail:false,heeftAirbnb:false,heeftBooking:false,geenAgentuur:false,slechteWebsite:false,toonVerborgen:false,toonAfgewezen:true })}>
                Filters wissen
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div style={S.errorBar}>! {error} - <span style={{cursor:"pointer",textDecoration:"underline"}} onClick={() => laadPanden(1)}>opnieuw proberen</span></div>}

      {/* PANDENLIJST */}
      <div className="yd-lijst" style={S.lijst}>
        {loading && <div style={S.loadingMsg}>Panden ophalen uit Toerisme Vlaanderen...</div>}

        {displayMode === "table" && (
          <div style={{ gridColumn: "1 / -1", width: "100%", maxWidth: "100%", overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 12, background: T.bgCard, marginTop: 12 }}>
            <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.bgCardAlt, borderBottom: `2px solid ${T.border}` }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Naam</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Straat</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Stad</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Postcode</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Telefoon</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>E-mail</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Status</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Slaappl.</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Platform</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: T.text }}>Agentuur</th>
                </tr>
              </thead>
              <tbody>
                {zichtbaar.map((p, i) => {
                  const ai = getCardAi(p.id, p);
                  const platformLabels = [];
                  if (ai?.airbnb?.gevonden) platformLabels.push("Airbnb");
                  if (ai?.booking?.gevonden) platformLabels.push("Booking");
                  const platformStr = platformLabels.length ? platformLabels.join(", ") : "—";
                  const agentuurStr = enriched[p.id]?.waarschuwingAgentuur ? "Ja" : "—";
                  return (
                  <tr
                    key={p.id || i}
                    className="yd-table-row"
                    style={{ borderBottom: `1px solid ${T.borderLight}`, cursor: "pointer" }}
                    onClick={() => {
                      setSelected(p);
                      setView("dossier");
                      if (!enriched[p.id] && !enrichingIds.has(p.id)) {
                        const portfolio = p.phoneNorm && phoneGroups[p.phoneNorm]?.length > 1
                          ? { count: phoneGroups[p.phoneNorm].length, names: phoneGroups[p.phoneNorm].map(id => properties.find(x => x.id === id)?.name || id) }
                          : null;
                        setEnrichingIds(s => new Set([...s, p.id]));
                        enrichProperty(p, portfolio)
                          .then(result => { setEnriched(prev => { const u = { ...prev, [p.id]: result }; save("enriched", u); return u; }); })
                          .catch(e => console.error("Verrijking mislukt:", e))
                          .finally(() => setEnrichingIds(s => { const n = new Set(s); n.delete(p.id); return n; }));
                      }
                    }}
                  >
                    <td style={{ padding: "8px 12px", color: T.text }}>{p.name || "—"}</td>
                    <td style={{ padding: "8px 12px", color: T.textMid }}>{p.street || "—"}</td>
                    <td style={{ padding: "8px 12px", color: T.textMid }}>{p.municipality || "—"}</td>
                    <td style={{ padding: "8px 12px", color: T.textMid }}>{p.postalCode || "—"}</td>
                    <td style={{ padding: "8px 12px", color: T.textMid }}>{p.phone || "—"}</td>
                    <td style={{ padding: "8px 12px", color: T.textMid }}>{p.email || "—"}</td>
                    <td style={{ padding: "8px 12px", color: T.textMid }}>{p.status || "—"}</td>
                    <td style={{ padding: "8px 12px", color: T.textMid }}>{p.slaapplaatsen ?? p.sleepPlaces ?? "—"}</td>
                    <td style={{ padding: "8px 12px", color: T.textMid, fontSize: 11 }}>{platformStr}</td>
                    <td style={{ padding: "8px 12px", color: enriched[p.id]?.waarschuwingAgentuur ? "#C2410C" : T.textLight, fontSize: 11 }}>{agentuurStr}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {displayMode !== "table" && zichtbaar.map((prop, idx) => {
          const ai = getCardAi(prop.id, prop);
          const fullAi = enriched[prop.id]; // full enrichment (score, agentuur, poor site, fotoUrls)
          const sc = fullAi?.score ? SCORES[fullAi.score] : null;
          const uitkomst = outcomes[prop.id];
          const isVerborgen = hidden.includes(prop.id);
          const heeftPortfolio = prop.phoneNorm && (phoneGroups[prop.phoneNorm]?.length || 0) > 1;
          const portfolioAantal = heeftPortfolio ? phoneGroups[prop.phoneNorm].length : 0;
          const isAgency = fullAi?.waarschuwingAgentuur;
          const poorWebsite = fullAi?.directWebsite?.poorlyBuilt;

          return (
            <div
              key={prop.id}
              className="kaart-hover"
              style={{
                ...S.kaart,
                opacity: isVerborgen || uitkomst === "afgewezen" ? 0.45 : 1,
                borderLeft: sc ? `4px solid ${sc.kleur}` : `4px solid ${T.border}`,
                animation: `fadeUp 0.3s ease ${idx * 0.03}s both`,
              }}
              onClick={() => {
                setSelected(prop);
                setView("dossier");
                if (!enriched[prop.id] && !enrichingIds.has(prop.id)) {
                  const portfolio = prop.phoneNorm && phoneGroups[prop.phoneNorm]?.length > 1
                    ? { count: phoneGroups[prop.phoneNorm].length, names: phoneGroups[prop.phoneNorm].map(id => properties.find(p => p.id === id)?.name || id) }
                    : null;
                  setEnrichingIds(s => new Set([...s, prop.id]));
                  enrichProperty(prop, portfolio)
                    .then(result => { setEnriched(prev => { const u = { ...prev, [prop.id]: result }; save("enriched", u); return u; }); })
                    .catch(e => console.error("Verrijking mislukt:", e))
                    .finally(() => setEnrichingIds(s => { const n = new Set(s); n.delete(prop.id); return n; }));
                }
              }}
            >
              {(() => {
                const street = prop.street || prop["address-street"] || prop["straat"] || prop["thoroughfare"] || prop["streetAddress"] || "";
                const city = prop.municipality || prop["municipality-name"] || prop["gemeente"] || prop["hoofdgemeente"] || prop["addressLocality"] || prop["locality"] || "";
                const postalCode = prop.postalCode || prop["postal-code"] || prop["postcode"] || "";
                const fullAddress = prop.fullAddress || prop["fullAddress"] || prop["locn:fullAddress"] || (typeof prop.address === "string" ? prop.address : "") || "";
                const province = prop.province || prop["provincie"] || prop["Provincie"] || "";
                const sleep = prop.sleepPlaces || prop["number-of-sleep-places"] || prop["slaapplaatsen"] || null;
                const units = prop.units || prop["number-of-units"] || null;
                const phones = [];
                const addPhone = (v) => { if (v && !phones.includes(v)) phones.push(v); };
                addPhone(prop.phone); addPhone(prop.phone2); addPhone(prop["contact-phone"]);
                addPhone(prop["telefoon"]); addPhone(prop["phone1"]);
                if (Array.isArray(prop.phones)) prop.phones.forEach(addPhone);
                const firstPhotoUrl = (fullAi?.airbnb?.fotoUrls?.[0] || fullAi?.booking?.fotoUrls?.[0] || fullAi?.directWebsite?.fotoUrls?.[0] || fullAi?.alleFotos?.[0] || platformScan[prop.id]?.fotoUrls?.[0]);
                const showThumb = firstPhotoUrl?.startsWith("http") && !cardThumbErrors[prop.id];

                return (<>
              {/* Thumbnail from Airbnb/Booking/website (when AI has fetched photos) */}
              {showThumb ? (
                <img src={firstPhotoUrl} alt="" style={S.kaartThumb} onError={() => setCardThumbErrors(prev => ({ ...prev, [prop.id]: true }))} />
              ) : (
                <div style={{ ...S.kaartThumb, display: "flex", alignItems: "center", justifyContent: "center", background: T.bgCardAlt }}>
                  <span style={{ fontSize: 32, opacity: 0.4 }}>🏡</span>
                </div>
              )}

              <div style={S.kaartBody}>
                {/* Header: name + score badge */}
                <div style={S.kaartTop}>
                  <div style={S.kaartNaamBlok}>
                    <div style={S.kaartNaam}>{prop.name}</div>
                    {/* Stack: address, date, type, amount – aligned under each other */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                      {(street || city || fullAddress) && (
                        <div style={{ fontSize: 11, color: T.textMid, display: "flex", alignItems: "center", gap: 3, overflow: "hidden", minHeight: 18 }}>
                          <span style={{ flexShrink: 0 }}>📍</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {[street, postalCode, city].filter(Boolean).join(", ") || fullAddress}
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: T.textLight, display: "flex", alignItems: "center", gap: 3, minHeight: 18 }}>
                        <span style={{ flexShrink: 0 }}>🗓</span>
                        <span>{prop.onlineSince ? new Date(prop.onlineSince).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textLight, display: "flex", alignItems: "center", gap: 3, minHeight: 18 }}>
                        <span style={{ flexShrink: 0 }}>🏠</span>
                        <span>{units > 1 ? `${units} units` : "1 unit"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textLight, display: "flex", alignItems: "center", gap: 3, minHeight: 18 }}>
                        <span style={{ flexShrink: 0 }}>🛏</span>
                        <span>{sleep > 0 ? `${sleep} slaapplaatsen` : "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    {sc && <span style={{ ...S.scoreBadge, background: sc.pale, color: sc.kleur, border: `1px solid ${sc.border}` }}>{sc.emoji ? `${sc.emoji} ` : ""}{sc.label || fullAi.score}</span>}
                    {enrichingIds.has(prop.id) && <span style={S.enrichingDot} />}
                    {isAgency && <span style={S.agentuurPill} title={fullAi.agentuurSignalen}>Makelaar/agentuur</span>}
                    {poorWebsite && <span style={S.poorSitePill} title="Website slecht gebouwd – kans voor yourdomi">Slechte site</span>}
                  </div>
                </div>

                {/* Tags: status, portfolio, outcome (no per-card beheer suggestion) */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {prop.status && <span style={S.statusTag}>{prop.status}</span>}
                  {heeftPortfolio && <span style={S.portfolioTag}>🏘 {portfolioAantal} panden</span>}
                  {uitkomst && uitkomst !== "none" && <span style={{ ...S.uitkomstBadge, ...uitkomstStijl(uitkomst) }}>{uitkomstLabel(uitkomst)}</span>}
                </div>

                {/* Contact: phone(s), email, website — fixed structure so cards align with or without website */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10, borderTop: `1px solid ${T.borderLight}`, minHeight: 76 }}>
                  {phones.length > 0 ? phones.map((tel, ti) => (
                    <a key={ti} href={`tel:${tel}`} onClick={e => e.stopPropagation()}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textMid, textDecoration: "none" }}>
                      <span style={{ flexShrink: 0 }}>📞</span>
                      <span style={{ fontWeight: 500 }}>{tel}</span>
                      {phones.length > 1 && <span style={{ fontSize: 9, color: T.textLight }}>#{ti+1}</span>}
                    </a>
                  )) : (prop.email || prop["contact-email"]) ? (
                    <a href={`mailto:${prop.email || prop["contact-email"]}`} onClick={e => e.stopPropagation()}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textMid, textDecoration: "none" }}>
                      <span>✉️</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{prop.email || prop["contact-email"]}</span>
                    </a>
                  ) : (
                    <div style={{ fontSize: 11, color: T.textLight, fontStyle: "italic", display: "flex", alignItems: "center", gap: 4 }}><span>📵</span> Geen contact</div>
                  )}
                  {(() => {
                    const aiWebsite = fullAi?.directWebsite;
                    const websiteWerkt = aiWebsite?.gevonden && aiWebsite?.werkt !== false && aiWebsite?.url;
                    const rawWebsite = prop.website || prop["contact-website"] || prop["website"];
                    if (aiWebsite && !websiteWerkt && !poorWebsite) return <div style={{ minHeight: 20 }} />;
                    if (websiteWerkt) return (
                      <a href={(aiWebsite.url || "").startsWith("http") ? aiWebsite.url : "https://" + aiWebsite.url}
                        target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.green, textDecoration: "none" }}>
                        <span>🌐</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{(aiWebsite.url || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                      </a>
                    );
                    if (rawWebsite) return (
                      <a href={(rawWebsite || "").startsWith("http") ? rawWebsite : "https://" + rawWebsite}
                        target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textLight, textDecoration: "none" }}>
                        <span>🌐</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{(rawWebsite || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                        <span style={{ fontSize: 9, color: T.textLight }}>?</span>
                      </a>
                    );
                    return <div style={{ minHeight: 20 }} />;
                  })()}
                </div>

                {/* Platform pills (left) + bed count bottom right — use Boolean so we never render 0 when no platform found */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8, paddingTop: 8, borderTop: `1px solid ${T.borderLight}` }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(ai?.airbnb?.gevonden || ai?.booking?.gevonden || !!((fullAi?.airbnb?.fotoUrls?.length || fullAi?.booking?.fotoUrls?.length || fullAi?.alleFotos?.length))) ? (
                      <>
                        {ai?.airbnb?.gevonden && <span style={S.platformPillAirbnb}>Airbnb</span>}
                        {ai?.booking?.gevonden && <span style={S.platformPillBooking}>Booking</span>}
                        {(fullAi?.airbnb?.fotoUrls?.length || fullAi?.booking?.fotoUrls?.length || fullAi?.alleFotos?.length) ? <span style={S.fotoPill}>📷</span> : null}
                      </>
                    ) : null}
                  </div>
                  {sleep > 0 && <span style={{ fontSize: 11, color: T.textLight }}>🛏 {sleep}</span>}
                </div>
              </div>
              </>);
            })()}
            </div>
          );
        })}

        {!loading && zichtbaar.length === 0 && (
          <div style={S.leegMelding}>Geen panden gevonden met deze filters.</div>
        )}
      </div>

      {/* PAGINERING */}
      <div style={S.paginering}>
        <button style={S.pagBtn} disabled={page <= 1} onClick={() => { setPage(p => p-1); laadPanden(page-1); }}>&laquo; Vorige</button>
        <span style={{ color: T.textLight, fontSize: 12 }}>{properties.length} van ~{totalCount} panden</span>
        <button style={S.pagBtn} onClick={() => { setPage(p => p+1); laadPanden(page+1); }}>Volgende &raquo;</button>
      </div>
    </div>
  );
}

// --- DOSSIER VIEW -------------------------------------------------------------
function DossierView({ property, ai, platformScanData, enriching, outcome, note, phoneGroups, properties, onNote, onOutcome, onVerberg, onAfgewezen, onTerug, currentIdx, total, onVolgende, onVorige, onSelectPand, mondayActief, mondayStatus, mondaySyncing, mondayCfg, onOpenConfig, onPushMonday, mondayFoutMsg, onSaveContactNaam, contactNaam }) {
  const [activeImg, setActiveImg] = useState(0);
  const [imgErrors, setImgErrors] = useState({});
  const noteRef = useRef(null);

  const sc = ai?.score ? SCORES[ai.score] : null;
  const rawImgs = [
    ...(ai?.airbnb?.fotoUrls || []),
    ...(ai?.booking?.fotoUrls || []),
    ...(ai?.directWebsite?.fotoUrls || []),
    ...(ai?.alleFotos || []),
    ...(platformScanData?.fotoUrls || []),
  ];
  const seen = new Set();
  const images = rawImgs.filter((u, i) => {
    if (!u?.startsWith("http") || imgErrors[i] || seen.has(u)) return false;
    seen.add(u); return true;
  });
  const heeftPortfolio = property.phoneNorm && (phoneGroups[property.phoneNorm]?.length || 0) > 1;
  const portfolioIds = heeftPortfolio ? phoneGroups[property.phoneNorm].filter(id => id !== property.id) : [];
  const portfolioPanden = portfolioIds.map(id => properties.find(p => p.id === id)).filter(Boolean);

  return (
    <div style={S.dossierRoot}>
      <style>{globalCSS}</style>

      {/* TERUG + NAV */}
      <div style={S.dossierNav}>
        <button style={S.terugBtn} onClick={onTerug}>&laquo; Terug naar lijst</button>
        <div style={S.navBtns}>
          <button style={S.navBtn} onClick={onVorige} disabled={currentIdx <= 1}>&lsaquo;</button>
          <span style={{ fontSize: 12, color: T.textLight }}>{currentIdx} / {total}</span>
          <button style={S.navBtn} onClick={onVolgende} disabled={currentIdx >= total}>&rsaquo;</button>
        </div>
      </div>

      {/* HERO */}
      <div style={S.dossierHero}>
        {images.length > 0 ? (
          <>
            <img src={images[activeImg]} alt={property.name} style={S.heroImg}
              onError={() => setImgErrors(p => ({ ...p, [activeImg]: true }))} />
            <div style={S.heroGradient} />
            {images.length > 1 && (
              <>
                <button style={S.heroArrowL} onClick={() => setActiveImg(p => Math.max(0, p-1))}>&lsaquo;</button>
                <button style={S.heroArrowR} onClick={() => setActiveImg(p => Math.min(images.length-1, p+1))}>&rsaquo;</button>
                <div style={S.heroDots}>
                  {images.map((_, i) => <div key={i} className="img-dot" onClick={() => setActiveImg(i)}
                    style={{ width: i === activeImg ? 20 : 6, height: 6, borderRadius: 3, background: i === activeImg ? "#fff" : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.3s" }} />)}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={S.heroPlaceholder}>
            <span style={{ fontSize: 48 }}>🏡</span>
            <span style={{ fontSize: 12, color: T.textLight, letterSpacing: 2, marginTop: 8 }}>
              {enriching ? "AFBEELDINGEN ZOEKEN..." : "GEEN AFBEELDINGEN GEVONDEN"}
            </span>
          </div>
        )}
        {sc && !enriching && (
          <div style={{ ...S.heroBadge, background: sc.kleur }}>
            {sc.emoji ? `${sc.emoji} ` : ""}{sc.label || ai.score} LEAD
          </div>
        )}
      </div>

      {/* INHOUD */}
      <div style={S.dossierBody}>

        {/* Pand kop */}
        <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease both" }}>
          <div style={S.pandKop}>
            <div>
              <h1 style={S.pandNaam}>{property.name}</h1>
              <div style={S.pandAdres}>
                {[property.street, property.postalCode, property.municipality, property.province].filter(Boolean).join(", ")}
              </div>
            </div>
            <div style={{ ...S.statusChip, background: property.status === "erkend" ? T.greenPale : T.orangePale, color: property.status === "erkend" ? T.green : T.orangeDark }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
              {(property.status || "aangemeld").toUpperCase()}
            </div>
          </div>

          {/* Stats */}
          <div style={S.statsRij}>
            {[
              ["🛏", property.sleepPlaces ? `${property.sleepPlaces} slaapplaatsen` : "Slaapplaatsen onbekend"],
              ["🏠", property.units ? `${property.units} unit${property.units > 1 ? "s" : ""}` : "1 unit"],
              ["*", property.starRating || "Geen sterbeoordeling"],
              ["📋", property.registrationNumber?.slice(-8) || property.id.slice(-8)],
            ].map(([icoon, val], i) => (
              <div key={i} style={S.statItem}>
                <span style={{ fontSize: 16 }}>{icoon}</span>
                <span style={S.statTekst}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PORTFOLIO BANNER */}
        {heeftPortfolio && (
          <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.05s both" }}>
            <div style={S.portfolioBanner}>
              <div style={S.portfolioBannerKop}>
                <span style={{ fontSize: 22 }}>🏘</span>
                <div>
                  <div style={S.portfolioTitel}>Portfolio eigenaar - {portfolioPanden.length + 1} panden</div>
                  <div style={S.portfolioSub}>Hoge prioriteit - gebruik portfolio management hoek in openingszin</div>
                </div>
                <div style={S.portfolioBadge}>HOGE WAARDE</div>
              </div>
              <div style={S.portfolioLijst}>
                {portfolioPanden.map(p => (
                  <div key={p.id} className="portfolio-item-hover" style={S.portfolioItemKlikbaar}
                    onClick={() => onSelectPand && onSelectPand(p)}>
                    <span style={{ fontSize: 13 }}>📍</span>
                    <span style={S.portfolioItemNaam}>{p.name}</span>
                    <span style={S.portfolioItemGem}>{p.municipality}</span>
                    <span style={S.portfolioItemArrow}>{"→"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {enriching && (
          <div style={S.sectie}>
            <LaadSkeleton />
          </div>
        )}
        {!enriching && ai && (
          <div>
            {/* AGENTUUR WAARSCHUWING */}
            {ai.waarschuwingAgentuur && (
              <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.08s both" }}>
                <div style={S.agentuurWaarschuwing}>
                  <span style={{ fontSize: 18 }}>!</span>
                  <div>
                    <div style={S.agentuurTitel}>Mogelijk beheersbedrijf / agentuur</div>
                    <div style={S.agentuurTekst}>{ai.agentuurSignalen || "Dit telefoonnummer of e-mailadres is mogelijk van een beheerskantoor, niet de eigenaar. Vraag altijd naar de eigenaar of beslissingsnemer."}</div>
                  </div>
                </div>
              </div>
            )}

            {/* WAAROM HEET/WARM/KOUD – in details van de listing */}
            {ai.scoreReden && (
              <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.08s both" }}>
                <SectieTitel>Waarom {ai.score === "HEET" ? "🔥 HEET" : ai.score === "WARM" ? "WARM" : "KOUD"}?</SectieTitel>
                <div style={{ ...S.intelKaartBase, borderLeft: `4px solid ${SCORES[ai.score]?.border || T.border}` }}>
                  <p style={S.intelKaartTekst}>{ai.scoreReden}</p>
                </div>
              </div>
            )}

            {/* OPENINGSZIN */}
            <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.1s both" }}>
              <SectieTitel>📞 Openingszin</SectieTitel>
              <div style={S.openingsCard}>
                <div style={S.aanhalingsteken}>"</div>
                <p style={S.openingsTekst}>{ai.openingszin}</p>
              </div>
            </div>

            {/* CONSULTIEVE VRAGEN */}
            {ai.consultieveVragen?.length > 0 && (
              <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.12s both" }}>
                <SectieTitel>🎯 Consultieve vragen <span style={{ color: T.orange, fontWeight: 600 }}>- laat hen zichzelf verkopen</span></SectieTitel>
                <div style={S.vragenLijst}>
                  {ai.consultieveVragen.map((v, i) => (
                    <div key={i} style={S.vraagRegel}>
                      <div style={S.vraagNr}>{i + 1}</div>
                      <div style={S.vraagTekst}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CONTRACT ADVIES (alleen aanbeveling; geen suggestie op de kaart) */}
            {ai.contractadvies && (
              <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.15s both" }}>
                <SectieTitel>📝 Aanbevolen contract</SectieTitel>
                <div style={S.contractGrid}>
                  {Object.entries(CONTRACT_INFO).map(([key, info]) => (
                    <div key={key} style={{
                      ...S.contractKaart,
                      border: ai.contractadvies === key ? `2px solid ${info.color}` : `1px solid ${T.border}`,
                      background: ai.contractadvies === key ? info.color + "12" : T.bgCard,
                    }}>
                      <div style={{ ...S.contractPct, color: info.color }}>{info.pct}</div>
                      <div style={S.contractLabel}>{info.label}</div>
                      <div style={S.contractDesc}>{info.desc}</div>
                      {ai.contractadvies === key && <div style={{ ...S.contractAanbevolen, background: info.color }}>Aanbevolen</div>}
                    </div>
                  ))}
                </div>
                {ai.contractUitleg && <p style={S.contractUitleg}>{ai.contractUitleg}</p>}
              </div>
            )}

            {/* BEHEERFORMULES – CHEAT SHEET (referentie, geen per-pand suggestie) */}
            <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.15s both" }}>
              <SectieTitel>📋 Beheerformules – overzicht</SectieTitel>
              <div style={{ ...S.intelKaartBase, background: T.bgCard }}>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                  {Object.entries(CONTRACT_INFO).map(([key, info]) => (
                    <div key={key} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "inherit" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: info.color, marginBottom: 4 }}>{info.pct} {info.label}</div>
                      <div style={{ fontSize: 11, color: T.textMid }}>{info.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ONLINE PLATFORMS */}
            <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.2s both" }}>
              <SectieTitel>🌐 Online aanwezigheid</SectieTitel>
              <div style={S.platformsKolom}>
                {/* Airbnb */}
                <PlatformKaart
                  naam="Airbnb" emoji="🏠" kleur="#FF5A5F"
                  data={ai.airbnb}
                  velden={[
                    ai.airbnb?.beoordeling && `* ${ai.airbnb.beoordeling}`,
                    ai.airbnb?.aantalReviews && `💬 ${ai.airbnb.aantalReviews} reviews`,
                    ai.airbnb?.prijsPerNacht && `💶 ${ai.airbnb.prijsPerNacht}/nacht`,
                    ai.airbnb?.bezettingsgraad && `📅 ${ai.airbnb.bezettingsgraad} bezet`,
                  ].filter(Boolean)}
                />
                {/* Booking.com */}
                <PlatformKaart
                  naam="Booking.com" emoji="🔵" kleur="#003580"
                  data={ai.booking}
                  velden={[
                    ai.booking?.beoordeling && `* ${ai.booking.beoordeling}/10`,
                    ai.booking?.aantalReviews && `💬 ${ai.booking.aantalReviews} reviews`,
                    ai.booking?.prijsPerNacht && `💶 ${ai.booking.prijsPerNacht}/nacht`,
                  ].filter(Boolean)}
                />
                {/* Direct website */}
                <PlatformKaart
                  naam="Eigen website" emoji="🌍" kleur={T.green}
                  data={ai.directWebsite}
                  velden={[
                    ai.directWebsite?.url && `🔗 ${ai.directWebsite.url?.replace(/https?:\/\//, "").slice(0,35)}`,
                  ].filter(Boolean)}
                />
              </div>
            </div>

            {/* OMZET VERGELIJKING */}
            {(ai.geschatMaandelijksInkomen || ai.potentieelMetYourDomi) && (
              <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.25s both" }}>
                <SectieTitel>💰 Omzet analyse</SectieTitel>
                <div style={S.omzetGrid}>
                  <div style={S.omzetKaartNu}>
                    <div style={S.omzetLabelKlein}>Huidig (geschat)</div>
                    <div style={{ ...S.omzetBedrag, color: T.textMid }}>{ai.geschatMaandelijksInkomen || "-"}</div>
                    <div style={S.omzetSubLabel}>per maand . {ai.geschatBezetting || "?"} bezet</div>
                    {ai.inkomensNota && <div style={S.omzetNota}>{ai.inkomensNota}</div>}
                  </div>
                  {ai.potentieelMetYourDomi && (
                    <div style={S.omzetKaartYD}>
                      <div style={S.omzetLabelKlein}>Met yourdomi.be</div>
                      <div style={{ ...S.omzetBedrag, color: T.green }}>{ai.potentieelMetYourDomi}</div>
                      <div style={S.omzetSubLabel}>per maand (prognose)</div>
                      {ai.potentieelNota && <div style={{ ...S.omzetNota, color: T.greenLight }}>{ai.potentieelNota}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* INTEL GRID */}
            <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.3s both" }}>
              <SectieTitel>🎯 Verkoopintelligentie</SectieTitel>
              <div style={S.intelKolom}>
                <IntelKaart titel="Pitch hoek" tekst={ai.pitchhoek} />
                <IntelKaart titel="Waarom deze score" tekst={ai.scoreReden} />
                {ai.eigenaarProfiel && <IntelKaart titel="Eigenaarsprofiel" tekst={ai.eigenaarProfiel} />}
                {ai.locatieHighlights?.length > 0 && (
                  <div style={S.intelKaartBase}>
                    <div style={S.intelKaartTitel}>Locatie highlights</div>
                    <div style={S.tagRij}>{ai.locatieHighlights.map((h, i) => <span key={i} style={S.tagGroen}>{h}</span>)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* ZWAKTES */}
            {ai.zwaktes?.length > 0 && (
              <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.35s both" }}>
                <SectieTitel>! Pand tekortkomingen <span style={{ color: T.textLight, fontWeight: 400, fontSize: 11 }}>(gebruik als haak)</span></SectieTitel>
                <div style={S.tagRij}>{ai.zwaktes.map((z, i) => <span key={i} style={S.tagOranje}>{z}</span>)}</div>
              </div>
            )}


          </div>
        )}

        {/* CONTACT */}
        <div style={{ ...S.sectie, animation: "fadeUp 0.4s ease 0.45s both" }}>
          <SectieTitel>📋 Contactgegevens</SectieTitel>

          {/* Contactnaam invullen voor Monday CRM */}
          <div style={S.contactNaamBlok}>
            <label style={S.contactNaamLabel}>
              Naam contactpersoon
              <span style={S.contactNaamHint}>{ai?.waarschuwingAgentuur ? " ! mogelijk agentuur - vraag naar beslissingsnemer" : " - invullen tijdens gesprek"}</span>
            </label>
            <input
              style={S.contactNaamInput}
              placeholder={ai?.waarschuwingAgentuur ? "Naam eigenaar / beslissingsnemer..." : "Voornaam Achternaam..."}
              value={contactNaam}
              onChange={e => onSaveContactNaam && onSaveContactNaam(e.target.value)}
            />
          </div>

          <div style={S.contactKolom}>
            {property.phone && <ContactRegel icoon="📞" label="Telefoon" val={property.phone} href={`tel:${property.phone}`} />}
            {property.phone2 && <ContactRegel icoon="📞" label="Telefoon 2" val={property.phone2} href={`tel:${property.phone2}`} />}
            {!property.phone && !property.email && (
              <div style={{ fontSize: 12, color: T.textLight, fontStyle: "italic", padding: "4px 0" }}>
                ⏳ Contactgegevens worden opgehaald...
              </div>
            )}
            {property.email && <ContactRegel icoon="@" label="E-mail" val={property.email} href={`mailto:${property.email}`} />}
            {property.website && <ContactRegel icoon="🌐" label="Website" val={property.website} href={property.website.startsWith("http") ? property.website : "https://" + property.website} />}
            {property.street && <ContactRegel icoon="📍" label="Straat" val={`${property.street}${property.postalCode ? ", " + property.postalCode : ""}${property.municipality ? " " + property.municipality : ""}`} href={`https://maps.google.com/?q=${encodeURIComponent([property.street, property.postalCode, property.municipality].filter(Boolean).join(" "))}`} />}
            <ContactRegel icoon="🔖" label="TV Register" val={property.registrationNumber?.slice(-12) || property.id.slice(-12)} href={property.rawUrl} />
          </div>

          {/* ZOEKLINKS */}
          {(() => {
            const links = buildZoekLinks(property);
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: T.textLight, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>🔍 Snel opzoeken</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { label: "Google", href: links.google, color: T.green },
                    { label: "📷 Fotos", href: links.googleImg, color: "#8B5CF6" },
                    { label: "Airbnb", href: links.airbnb, color: "#FF5A5F" },
                    { label: "Booking", href: links.booking, color: "#003580" },
                    { label: "📍 Maps", href: links.maps, color: T.textMid },
                  ].map(({ label, href, color }) => (
                    <a key={label} href={href} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8,
                        background: color + "15", color: color, border: `1px solid ${color}30`,
                        textDecoration: "none", fontFamily: "inherit", cursor: "pointer" }}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* JUSTCALL-TRANSCRIPT → AI NOTITIES (koppeling later) */}
        <div style={{ ...S.sectie, paddingBottom: 16, animation: "fadeUp 0.4s ease 0.48s both" }}>
          <SectieTitel>📞 JustCall – AI notities</SectieTitel>
          <p style={{ fontSize: 11, color: T.textLight, marginBottom: 8 }}>
            Plak het transcript van je JustCall-belgesprek (of ander beltranscript). Koppeling met JustCall volgt later. AI vult daarna automatisch uitkomst, contactnaam en belnotities in.
          </p>
          <MeetTranscriptNotetaker
            onFilled={(result) => {
              if (result.note) onNote(result.note);
              if (result.outcome) onOutcome(result.outcome);
              if (result.contactNaam && onSaveContactNaam) onSaveContactNaam(result.contactNaam);
            }}
          />
        </div>

        {/* NOTITIES */}
        <div style={{ ...S.sectie, paddingBottom: 20, animation: "fadeUp 0.4s ease 0.5s both" }}>
          <SectieTitel>📝 Belnotities</SectieTitel>
          <textarea
            ref={noteRef}
            className="notitie-veld"
            style={S.notitieVeld}
            placeholder="Voeg notities toe voor dit pand... (automatisch opgeslagen)"
            value={note}
            onChange={e => onNote(e.target.value)}
            rows={6}
          />
        </div>
      </div>

      {/* ACTIE BAR */}
      <div style={S.actieBar}>
        <div style={S.actieBarInner}>
          {/* Monday sync status */}
          {mondayActief && (
            <div style={S.mondayStatusRij}>
              {mondaySyncing && <span style={S.mondaySyncBezig}>(~) Syncing Monday...</span>}
              {!mondaySyncing && mondayStatus === "ok" && <span style={S.mondaySyncOk}>v Monday bijgewerkt</span>}
              {!mondaySyncing && mondayStatus === "fout" && (<div style={{ ...S.mondaySyncFout, flexDirection: "column", alignItems: "flex-start", gap: 2 }}><span>! Monday fout - <button onClick={onOpenConfig} style={S.mondayFoutBtn}>check config</button></span>{mondayFoutMsg && <span style={{ fontSize: 10, color: T.red, opacity: 0.8, wordBreak: "break-all" }}>{mondayFoutMsg}</span>}</div>)}
              {!mondaySyncing && !mondayStatus && <span style={S.mondaySyncLabel}>Monday actief</span>}
            </div>
          )}
          {!mondayActief && (
            <button onClick={onOpenConfig} style={S.mondaySetupBtn}> Monday koppelen</button>
          )}

          <div style={S.actieBtns}>
            <button className="actie-btn" style={{ ...S.actieBtn, ...S.btnAfwijzen, ...(outcome === "afgewezen" ? { background: T.red, color: "#fff", border: `1px solid ${T.red}` } : {}) }}
              onClick={() => { onAfgewezen(); }}>
              <span>x</span> Afwijzen
            </button>
            <button className="actie-btn" style={{ ...S.actieBtn, ...S.btnCallback, ...(outcome === "callback" ? { background: T.orange, color: "#fff", border: `1px solid ${T.orange}` } : {}) }}
              onClick={() => { onOutcome(outcome === "callback" ? null : "callback"); setTimeout(() => noteRef.current?.focus(), 100); }}>
              <span>(~)</span> Terugbellen
            </button>
            <button className="actie-btn" style={{ ...S.actieBtn, ...S.btnGebeld, ...(outcome === "gebeld_interesse" ? { background: T.green, color: "#fff", border: `1px solid ${T.green}` } : {}) }}
              onClick={() => onOutcome(outcome === "gebeld_interesse" ? null : "gebeld_interesse")}>
              <span>v</span> Interesse
            </button>
          </div>

          {/* Actieknoppen bij interesse */}
          {outcome === "gebeld_interesse" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              {/* Row 1: Meet buttons */}
              <div style={{ display: "flex", gap: 6 }}>
                <a
                  href={buildGoogleMeetUrl(property, ai, note)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...S.teamsMeetingBtn, flex: 1, textAlign: "center" }}
                  className="actie-btn"
                  title="Plan een kennismakingsgesprek met de eigenaar"
                >
                  📅 Met eigenaar
                </a>
                <a
                  href={buildInternalDebriefUrl(property, ai, note)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...S.teamsMeetingBtn, flex: 1, textAlign: "center", background: "#f0f4ff", color: "#3451b2", border: "1px solid #c7d2fe" }}
                  className="actie-btn"
                  title="Plan intern debriefgesprek met team"
                >
                  🏠 Intern debrief
                </a>
              </div>
              {/* Row 2: Push to CRM */}
              <button
                className="actie-btn"
                style={{ ...S.teamsMeetingBtn, width: "100%", background: mondayStatus === "ok" ? "#00854d" : "#0073ea", cursor: "pointer", border: "none", justifyContent: "center" }}
                onClick={() => {
                  if (!mondayActief) { onOpenConfig(); return; }
                  onPushMonday && onPushMonday();
                }}
              >
                {mondaySyncing ? "⏳ Bezig..." : mondayStatus === "ok" ? "✓ In Monday CRM" : "📋 Push to Monday CRM"}
              </button>
            </div>
          )}

          <button style={S.verbergBtn} onClick={onVerberg}>Pand verbergen uit lijst</button>
        </div>
      </div>
    </div>
  );
}

// --- HULP COMPONENTEN ---------------------------------------------------------
function SectieTitel({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: 2, color: T.textLight, textTransform: "uppercase", marginBottom: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{children}</div>;
}
function IntelKaart({ titel, tekst }) {
  return (
    <div style={S.intelKaartBase}>
      <div style={S.intelKaartTitel}>{titel}</div>
      <p style={S.intelKaartTekst}>{tekst}</p>
    </div>
  );
}
function ContactRegel({ icoon, label, val, href }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={S.contactRegel} className="contact-hover">
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icoon}</span>
      <span style={S.contactLabel}>{label}</span>
      <span style={S.contactVal}>{val}</span>
    </a>
  );
}
function Stat({ label, val, accent }) {
  return (
    <div style={S.headerStat}>
      <div style={{ ...S.headerStatVal, color: accent ? T.orange : T.green }}>{val}</div>
      <div style={S.headerStatLabel}>{label}</div>
    </div>
  );
}
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={S.filterField}>
      <label style={S.filterLabel}>{label}</label>
      <select style={S.filterInput} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
function PlatformKaart({ naam, emoji, kleur, data, velden }) {
  const gevonden = data?.gevonden;
  return (
    <div style={{
      ...S.platformKaartBase,
      borderLeft: `3px solid ${gevonden ? kleur : T.border}`,
      opacity: gevonden ? 1 : 0.55,
    }}>
      <div style={S.platformKopRij}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <span style={{ ...S.platformNaam, color: gevonden ? kleur : T.textLight }}>{naam}</span>
        <span style={{ ...S.platformStatus, background: gevonden ? kleur + "18" : T.bgCardAlt, color: gevonden ? kleur : T.textLight }}>
          {gevonden ? "v Gevonden" : "Niet gevonden"}
        </span>
        {gevonden && data?.url && (
          <a href={data.url} target="_blank" rel="noreferrer" style={S.platformLinkBtn}>Bekijk →</a>
        )}
      </div>
      {gevonden && velden.length > 0 && (
        <div style={S.platformStatRij}>
          {velden.map((v, i) => <span key={i} style={S.platformStat}>{v}</span>)}
        </div>
      )}
    </div>
  );
}

// --- CONFIG VIEW --------------------------------------------------------------

function ConfigView({ cfg, onSave, onTerug }) {
  const [apiKey, setApiKey]           = useState(cfg.apiKey || "");
  const [dealsBoardId, setDealsBoardId] = useState(cfg.dealsBoardId || "");
  const [boards, setBoards]           = useState([]);
  const [testMsg, setTestMsg]         = useState(null);
  const [loadingBoards, setLoadingBoards] = useState(false);

  const verbinden = async () => {
    if (!apiKey) return;
    setLoadingBoards(true); setTestMsg(null);
    try {
      const b = await getMondayBoards(apiKey);
      setBoards(b);
      setTestMsg({ ok: true, tekst: `v Verbonden - ${b.length} boards gevonden` });
    } catch (e) {
      const msg = e.message || String(e);
      setTestMsg({ ok: false, tekst: msg === "Failed to fetch" ? "x Fout: Kon server niet bereiken. Controleer of de backend draait en of VITE_API_URL klopt." : `x Fout: ${msg}` });
    } finally { setLoadingBoards(false); }
  };

  const alKlaar = !!(dealsBoardId && apiKey);

  return (
    <div style={S.root}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={S.cfgHeader}>
        <button onClick={onTerug} style={S.terugBtn}>&laquo; Terug</button>
        <span style={S.cfgTitel}>Integraties & Instellingen</span>
      </div>

      <div style={S.cfgBody}>

        {/* MONDAY ONGOING DEALS */}
        <div style={S.cfgSectie}>
          <div style={S.cfgSectieKop}>
            <span style={{ fontSize: 22 }}>📋</span>
            <div style={{ flex: 1 }}>
              <div style={S.cfgSectieNaam}>Monday.com - Ongoing Deals</div>
              <div style={S.cfgSectieDesc}>
                Claude AI leest de belnotities en bepaalt automatisch welke velden in Monday worden ingevuld — geen handmatige kolom-koppeling nodig.
              </div>
            </div>
            {alKlaar && <span style={S.cfgActiefBadge}>v Actief</span>}
          </div>

          {/* Stap 1 - Token */}
          <div style={S.cfgVeld}>
            <label style={S.cfgLabel}>
              API Token&nbsp;
              <a href="https://support.monday.com/hc/en-us/articles/360005144659" target="_blank" rel="noreferrer" style={{ color: T.greenLight, fontSize: 10 }}>waar vind ik dit? →</a>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={S.cfgInput} type="password" placeholder="eyJhbGci..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
              <button style={S.cfgTestBtn} onClick={verbinden} disabled={loadingBoards || !apiKey}>
                {loadingBoards ? "..." : "Verbinden"}
              </button>
            </div>
            {testMsg && <div style={{ ...S.cfgMsg, color: testMsg.ok ? T.green : T.red, marginTop: 6 }}>{testMsg.tekst}</div>}
          </div>

          {/* Stap 2 - Board selecteren */}
          {boards.length > 0 && (
            <div style={S.cfgVeld}>
              <label style={S.cfgLabel}>Selecteer je Ongoing Deals board</label>
              <select style={S.cfgInput} value={dealsBoardId} onChange={e => setDealsBoardId(e.target.value)}>
                <option value="">- selecteer board -</option>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* AI info */}
          {alKlaar && (
            <div style={{ background: T.greenPale, border: `1px solid ${T.greenLight}40`, borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 12, color: T.green }}>
              ✨ <strong>Volledig automatisch</strong> — Claude AI leest je board kolommen en bepaalt zelf wat er ingevuld wordt op basis van de belnotities. Geen configuratie nodig.
              <div style={{ marginTop: 6, color: T.textMid, fontSize: 11 }}>
                Nieuwe leads landen in de groep <strong>"New - to be confirmed"</strong> · Stage, Next step en datum worden automatisch bepaald uit de notities
              </div>
            </div>
          )}

          {/* Samenvatting als klaar */}
          {alKlaar && (
            <div style={{ ...S.cfgKlaarBlok, marginTop: 12 }}>
              <div style={S.cfgKlaarRij}>
                <span style={{ fontSize: 16 }}>📋</span>
                <span style={{ fontSize: 13, color: T.text }}>
                  Board: <strong>{boards.find(b => b.id === dealsBoardId)?.name || dealsBoardId}</strong>
                </span>
                <a href={`https://yourdomi.monday.com/boards/${dealsBoardId}`} target="_blank" rel="noreferrer" style={{ color: T.greenLight, fontSize: 11 }}>Bekijk →</a>
              </div>
            </div>
          )}
        </div>

        {/* TEAMS */}
        <div style={S.cfgSectie}>
          <div style={S.cfgSectieKop}>
            <span style={{ fontSize: 22 }}>📅</span>
            <div>
              <div style={S.cfgSectieNaam}>JustCall</div>
              <div style={S.cfgSectieDesc}>Bij "Interesse" verschijnt een knop - Google Agenda opent met onderwerp en pandinfo al ingevuld. Geen configuratie nodig.</div>
            </div>
            <span style={S.cfgActiefBadge}>v Actief</span>
          </div>
        </div>

        {/* JUSTCALL */}
        <div style={{ ...S.cfgSectie, opacity: 0.55 }}>
          <div style={S.cfgSectieKop}>
            <span style={{ fontSize: 22 }}>📞</span>
            <div>
              <div style={S.cfgSectieNaam}>JustCall&nbsp;<span style={{ fontSize: 10, background: T.orangePale, color: T.orange, borderRadius: 4, padding: "2px 6px" }}>BINNENKORT</span></div>
              <div style={S.cfgSectieDesc}>Direct bellen vanuit de app + automatische call analyse en transcriptie</div>
            </div>
          </div>
        </div>

        <button style={S.cfgOpslaanBtn} onClick={() => onSave({ apiKey, dealsBoardId })}>
          Instellingen opslaan
        </button>
      </div>
    </div>
  );
}

function LaadSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[80, 120, 60, 100].map((w, i) => (
        <div key={i} style={{ height: i % 2 === 0 ? 14 : 70, width: `${w}%`, borderRadius: 8, background: T.border, animation: "shimmer 1.5s infinite", backgroundImage: `linear-gradient(90deg, ${T.border} 25%, ${T.bgCardAlt} 50%, ${T.border} 75%)`, backgroundSize: "200% 100%" }} />
      ))}
      <div style={{ textAlign: "center", color: T.textLight, fontSize: 11, letterSpacing: 2, marginTop: 8, animation: "pulse 1.5s ease infinite" }}>
        AI ANALYSEERT DIT PAND...
      </div>
    </div>
  );
}

// --- HULPFUNCTIES -------------------------------------------------------------
function uitkomstLabel(u) {
  return { afgewezen: "x Afgewezen", callback: "(~) Terugbellen", gebeld_interesse: "v Gebeld - Interesse", verborgen: "- Verborgen" }[u] || u;
}
function uitkomstStijl(u) {
  return {
    afgewezen: { background: T.redPale, color: T.red },
    callback: { background: T.orangePale, color: T.orangeDark },
    gebeld_interesse: { background: T.greenPale, color: T.green },
    verborgen: { background: T.bgCardAlt, color: T.textLight },
  }[u] || {};
}

// --- GLOBALE CSS --------------------------------------------------------------
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${T.bg}; overflow-x: hidden; margin: 0; padding: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: ${T.bg}; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
  @keyframes shimmer { from { background-position:-200% 0; } to { background-position:200% 0; } }
  .kaart-hover { cursor: pointer; transition: all 0.2s ease; }
  .kaart-hover:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(45,92,78,0.14) !important; }
  .yd-table-row:hover { background: rgba(45,92,78,0.06) !important; }
  .actie-btn { transition: all 0.2s ease !important; }
  .actie-btn:hover { transform: translateY(-2px); }
  .notitie-veld:focus { outline: none; border-color: ${T.greenLight} !important; box-shadow: 0 0 0 3px ${T.greenPale}; }
  .img-dot { transition: all 0.2s; cursor: pointer; }
  .contact-hover { transition: background 0.15s; }
  .contact-hover:hover { background: ${T.greenPale} !important; }
  .portfolio-item-hover:hover { background: ${T.greenPale} !important; }

  /* ── RESPONSIVE ─────────────────────────────────────── */
  @media (max-width: 900px) {
    .yd-filter-grid { grid-template-columns: 1fr 1fr !important; }
    .yd-lijst { grid-template-columns: 1fr !important; }
    .yd-header-stats { gap: 12px !important; }
    .yd-filterbar-row { flex-wrap: wrap !important; }
    .yd-zoek-input { min-width: 0 !important; }
  }
  @media (max-width: 600px) {
    .yd-filter-grid { grid-template-columns: 1fr !important; }
    .yd-header-inner { flex-wrap: wrap !important; gap: 8px !important; padding: 8px 0 !important; }
    .yd-brand { font-size: 14px !important; }
    .yd-header-stats { width: 100% !important; justify-content: space-between !important; }
    .yd-sort-select { display: none !important; }
  }
`;

// --- STYLES -------------------------------------------------------------------
const S = {
  // Agentuur waarschuwing
  agentuurWaarschuwing: { background: "#FFF7ED", border: "1px solid #F97316", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" },
  agentuurTitel: { fontSize: 13, fontWeight: 700, color: "#C2410C", marginBottom: 3 },
  agentuurTekst: { fontSize: 12, color: "#9A3412", lineHeight: 1.5 },
  // Consultieve vragen
  vragenLijst: { display: "flex", flexDirection: "column", gap: 6 },
  vraagRegel: { display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 12px", background: T.bgCard, borderRadius: 8, border: `1px solid ${T.border}` },
  vraagNr: { minWidth: 22, height: 22, borderRadius: "50%", background: T.orange, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  vraagTekst: { fontSize: 13, color: T.text, lineHeight: 1.5 },
  // Portfolio clickable item
  portfolioItemKlikbaar: { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, cursor: "pointer", transition: "background 0.15s" },
  portfolioItemArrow: { marginLeft: "auto", color: T.greenLight, fontSize: 13, fontWeight: 600 },
  // Platform pills in lijst kaart
  platformPillAirbnb: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#FF5A5F18", color: "#FF5A5F", fontWeight: 600, border: "1px solid #FF5A5F40" },
  platformPillBooking: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#00358018", color: "#003580", fontWeight: 600, border: "1px solid #00358040" },
  platformPillSite: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: T.greenPale, color: T.green, fontWeight: 600, border: `1px solid ${T.greenLight}40` },
  fotoPill: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: T.bgCardAlt, color: T.textMid, border: `1px solid ${T.border}` },
  agentuurPill: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#FFF7ED", color: "#C2410C", fontWeight: 600, border: "1px solid #F9731640", cursor: "help" },
  poorSitePill: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#FEF3C7", color: "#B45309", fontWeight: 600, border: "1px solid #F59E0B40", cursor: "help" },
  // Config view
  cfgHeader: { background: T.bgCard, borderBottom: `1px solid ${T.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 50 },
  cfgTitel: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: T.green },
  cfgBody: { padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 600, margin: "0 auto" },
  cfgSectie: { background: T.bgCard, borderRadius: 14, padding: "18px 16px", boxShadow: T.shadow, border: `1px solid ${T.border}` },
  cfgSectieKop: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 },
  cfgSectieNaam: { fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 3 },
  cfgSectieDesc: { fontSize: 12, color: T.textMid, lineHeight: 1.5 },
  cfgVeld: { marginBottom: 12 },
  cfgLabel: { display: "block", fontSize: 11, color: T.textLight, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  cfgInput: { width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", color: T.text, fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none" },
  cfgTestBtn: { background: T.greenPale, border: `1px solid ${T.greenLight}40`, color: T.green, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" },
  cfgMsg: { fontSize: 12, marginTop: 6 },
  cfgKolommen: { marginTop: 12 },
  cfgKolomGrid: { display: "flex", flexDirection: "column", gap: 6 },
  cfgKolomRij: { display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 8 },
  cfgKolomLabel: { fontSize: 12, color: T.textMid },
  cfgKolomSelect: { background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 8px", color: T.text, fontFamily: "inherit", fontSize: 12, outline: "none" },
  cfgOpslaanBtn: { background: T.green, color: "#fff", border: "none", borderRadius: 10, padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
  cfgSubtitel: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8, marginTop: 4 },
  cfgSubHint: { fontSize: 11, color: T.textLight, fontWeight: 400 },
  cfgActiefBadge: { fontSize: 11, background: T.greenPale, color: T.green, borderRadius: 10, padding: "3px 8px", fontWeight: 700, whiteSpace: "nowrap", alignSelf: "flex-start" },
  cfgSetupBlok: { background: T.bgCardAlt, borderRadius: 10, padding: "14px", border: `1px solid ${T.border}`, marginTop: 8 },
  cfgSetupKop: { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 },
  cfgBoardPreview: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  cfgBoardItem: { display: "flex", gap: 10, alignItems: "flex-start", background: T.bgCard, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.borderLight}` },
  cfgMaakAanBtn: { width: "100%", background: T.green, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  cfgKlaarBlok: { background: T.greenPale, borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.greenLight}30`, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 },
  cfgKlaarRij: { display: "flex", alignItems: "center", gap: 8 },
  cfgWijzigBtn: { background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: T.textLight, alignSelf: "flex-start", marginTop: 2 },
  // Contact naam input in dossier
  contactNaamBlok: { marginBottom: 12, padding: "10px 12px", background: T.bgCardAlt, borderRadius: 8, border: `1px solid ${T.border}` },
  contactNaamLabel: { display: "block", fontSize: 11, color: T.textLight, letterSpacing: 0.5, marginBottom: 6 },
  contactNaamHint: { color: T.orange, fontStyle: "italic" },
  contactNaamInput: { width: "100%", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 6, padding: "7px 10px", color: T.text, fontFamily: "inherit", fontSize: 13, outline: "none" },
  // Header config button
  cfgBtn: { display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 },
  cfgActief: { color: T.green, fontWeight: 600, fontSize: 11 },
  cfgInactief: { color: T.textLight, fontSize: 11 },
  // Monday status bar in action bar
  mondayStatusRij: { display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11 },
  mondaySyncBezig: { color: T.textLight, display: "flex", alignItems: "center", gap: 4 },
  mondaySyncOk: { color: T.green, fontWeight: 600 },
  mondaySyncFout: { color: T.red, display: "flex", alignItems: "center", gap: 4 },
  mondayFoutBtn: { background: "none", border: "none", color: T.red, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: 11, padding: 0 },
  mondaySyncLabel: { color: T.textLight },
  mondaySetupBtn: { background: "none", border: `1px dashed ${T.border}`, color: T.textLight, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 11 },
  // Teams meeting button
  teamsMeetingBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#1a73e8", color: "#fff", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", width: "100%", marginTop: 6, transition: "all 0.2s" },
  // Root
  root: { background: T.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: T.text, maxWidth: 1400, margin: "0 auto", padding: "0 12px", boxSizing: "border-box", overflowX: "hidden" },
  // Header
  header: { background: T.bgCard, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50, boxShadow: T.shadow, overflow: "hidden" },
  headerInner: { padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1400, margin: "0 auto" },
  brand: { display: "flex", alignItems: "baseline", gap: 2 },
  brandName: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: T.green },
  brandDot: { color: T.orange, fontSize: 24, fontWeight: 900, lineHeight: 1 },
  brandSub: { fontSize: 9, color: T.textLight, letterSpacing: 3, marginLeft: 6 },
  headerStats: { display: "flex", gap: 20 },
  headerStat: { textAlign: "center" },
  enrichProgBlok: { display: "flex", flexDirection: "column", gap: 3, minWidth: 70 },
  enrichProgLabel: { fontSize: 9, color: T.textLight, letterSpacing: 1, textAlign: "right" },
  enrichProgBar: { height: 4, background: T.border, borderRadius: 2, overflow: "hidden" },
  enrichProgFill: { height: "100%", background: T.orange, borderRadius: 2, transition: "width 0.5s ease" },
  headerStatVal: { fontSize: 18, fontWeight: 700 },
  headerStatLabel: { fontSize: 10, color: T.textLight, letterSpacing: 0.5 },
  // Filter bar
  filterBar: { background: T.bgCard, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 57, zIndex: 40, overflow: "hidden" },
  filterInner: { padding: "10px 0", display: "flex", gap: 6, alignItems: "center", minWidth: 0, width: "100%", boxSizing: "border-box" },
  zoekInput: { flex: "1 1 0", minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.text, fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none" },
  filterToggleBtn: { background: T.greenPale, border: `1px solid ${T.greenLight}30`, color: T.green, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit", whiteSpace: "nowrap" },
  refreshBtn: { background: T.bg, border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 14 },
  filterPanel: { padding: "12px 16px 16px", borderTop: `1px solid ${T.borderLight}`, background: T.bgCardAlt },
  filterGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 },
  filterField: { display: "flex", flexDirection: "column", gap: 4 },
  filterLabel: { fontSize: 10, color: T.textLight, letterSpacing: 1, textTransform: "uppercase" },
  filterInput: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontFamily: "inherit", fontSize: 12, outline: "none" },
  filterCheckRow: { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" },
  checkLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textMid, cursor: "pointer" },
  resetFiltersBtn: { marginLeft: "auto", background: "transparent", border: "none", color: T.textLight, fontSize: 12, cursor: "pointer", textDecoration: "underline" },
  // Error
  demoBanner: { background: '#FFF8E6', color: '#8a6a10', border: '1px solid #e8c84a50', borderBottom: '1px solid #e8c84a50', padding: '8px 16px', fontSize: 12, lineHeight: 1.5 },
  errorBar: { background: T.redPale, color: T.red, padding: '8px 16px', fontSize: 12, borderBottom: `1px solid ${T.red}30` },
  // Lijst
  lijst: { padding: "16px 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, alignItems: "stretch" },
  loadingMsg: { textAlign: "center", color: T.textLight, padding: 24, fontSize: 13 },
  leegMelding: { textAlign: "center", color: T.textLight, padding: 40, fontSize: 13 },
  kaart: {
    background: T.bgCard, borderRadius: 14, padding: 0,
    boxShadow: T.shadow, cursor: "pointer",
    border: `1px solid ${T.border}`,
    overflow: "hidden",
    display: "flex", flexDirection: "column",
  },
  kaartThumb: { width: "100%", height: 120, background: T.bgCardAlt, objectFit: "cover", flexShrink: 0 },
  kaartBody: { padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12 },
  kaartTop: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 0 },
  kaartNaamBlok: { flex: 1, minWidth: 0 },
  kaartNaam: { fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  kaartAdres: { fontSize: 12, color: T.textLight },
  kaartRechts: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 },
  scoreBadge: { fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "3px 8px", letterSpacing: 0.5 },
  enrichingDot: { width: 8, height: 8, borderRadius: "50%", background: T.orange, animation: "pulse 1s ease infinite" },
  kaartBottom: { display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap", marginTop: "auto", paddingTop: 8 },
  statusTag: { fontSize: 10, background: T.bgCardAlt, color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 4, padding: "2px 7px", letterSpacing: 0.5 },
  portfolioTag: { fontSize: 10, background: T.orangePale, color: T.orangeDark, border: `1px solid ${T.orange}40`, borderRadius: 4, padding: "2px 7px", fontWeight: 600 },
  contactTag: { fontSize: 11, color: T.textLight },
  uitkomstBadge: { fontSize: 10, borderRadius: 4, padding: "2px 7px", fontWeight: 500 },
  contractTag: { fontSize: 10, borderRadius: 4, padding: "2px 7px", fontWeight: 600, marginLeft: "auto" },
  // Paginering
  paginering: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 24px", borderTop: `1px solid ${T.border}`, marginTop: 4 },
  pagBtn: { background: T.bgCard, border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 },
  // DOSSIER
  dossierRoot: { background: T.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: T.text, maxWidth: 1400, margin: "0 auto", padding: "0 24px", position: "relative" },
  dossierNav: { background: T.bgCard, borderBottom: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50 },
  terugBtn: { background: "transparent", border: "none", color: T.green, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500 },
  navBtns: { display: "flex", alignItems: "center", gap: 10 },
  navBtn: { background: T.bg, border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" },
  // Hero
  dossierHero: { position: "relative", height: 340, background: T.bgCardAlt, overflow: "hidden", borderRadius: "0 0 16px 16px" },
  heroImg: { width: "100%", height: "100%", objectFit: "cover" },
  heroGradient: { position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(240,237,230,0) 0%, rgba(240,237,230,0.7) 100%)" },
  heroPlaceholder: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `repeating-linear-gradient(45deg, ${T.bgCardAlt} 0px, ${T.bgCardAlt} 10px, ${T.bg} 10px, ${T.bg} 20px)` },
  heroBadge: { position: "absolute", top: 14, right: 14, padding: "5px 12px", borderRadius: 16, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" },
  heroArrowL: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.8)", border: "none", color: T.text, fontSize: 22, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  heroArrowR: { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.8)", border: "none", color: T.text, fontSize: 22, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  heroDots: { position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5, alignItems: "center" },
  // Dossier body
  dossierBody: { overflowY: "auto", padding: "0 0 140px" },
  dossierGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px", alignItems: "start" },
  dossierColLeft: { minWidth: 0 },
  dossierColRight: { minWidth: 0 },
  sectie: { padding: "20px 20px 0" },
  pandKop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  pandNaam: { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: T.text, lineHeight: 1.2, marginBottom: 4 },
  pandAdres: { fontSize: 12, color: T.textLight, lineHeight: 1.4 },
  statusChip: { display: "flex", alignItems: "center", gap: 5, borderRadius: 10, padding: "4px 10px", fontSize: 10, letterSpacing: 1, flexShrink: 0, fontWeight: 600 },
  statsRij: { display: "flex", flexWrap: "wrap", gap: 6, background: T.bgCardAlt, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px" },
  statItem: { display: "flex", alignItems: "center", gap: 5, flex: "1 1 130px" },
  statTekst: { fontSize: 12, color: T.textMid },
  // Portfolio banner
  portfolioBanner: { background: T.orangePale, border: `1px solid ${T.orange}40`, borderRadius: 12, padding: 16 },
  portfolioBannerKop: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  portfolioTitel: { fontSize: 14, fontWeight: 700, color: T.orangeDark, marginBottom: 3 },
  portfolioSub: { fontSize: 12, color: T.orange },
  portfolioBadge: { marginLeft: "auto", background: T.orange, color: "#fff", borderRadius: 5, padding: "3px 8px", fontSize: 9, letterSpacing: 2, fontWeight: 700, whiteSpace: "nowrap" },
  portfolioLijst: { display: "flex", flexDirection: "column", gap: 6 },
  portfolioItem: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.5)", borderRadius: 6, padding: "6px 10px" },
  portfolioItemNaam: { fontSize: 13, fontWeight: 500, color: T.text, flex: 1 },
  portfolioItemGem: { fontSize: 11, color: T.textLight },
  // Opening
  openingsCard: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 18px 18px 24px", position: "relative", overflow: "hidden", boxShadow: T.shadow },
  aanhalingsteken: { position: "absolute", top: 0, left: 10, fontSize: 60, color: T.greenPale, fontFamily: "'Playfair Display', serif", lineHeight: 1, userSelect: "none" },
  openingsTekst: { fontSize: 15, lineHeight: 1.7, color: T.text, fontStyle: "italic", position: "relative", zIndex: 1 },
  // Contract
  contractGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 },
  contractKaart: { borderRadius: 10, padding: "12px 12px 14px", position: "relative", textAlign: "center" },
  contractPct: { fontSize: 22, fontWeight: 900, fontFamily: "'Playfair Display', serif", marginBottom: 2 },
  contractLabel: { fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 3 },
  contractDesc: { fontSize: 10, color: T.textLight, lineHeight: 1.4 },
  contractAanbevolen: { position: "absolute", top: -1, right: -1, color: "#fff", fontSize: 9, padding: "3px 7px", borderRadius: "0 9px 0 6px", letterSpacing: 1, fontWeight: 700 },
  contractUitleg: { fontSize: 12, color: T.textMid, lineHeight: 1.6, fontStyle: "italic" },
  // Platforms
  platformsKolom: { display: "flex", flexDirection: "column", gap: 6 },
  platformKaartBase: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", boxShadow: T.shadow },
  platformKopRij: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  platformNaam: { fontSize: 13, fontWeight: 700, flex: 1 },
  platformStatus: { fontSize: 10, borderRadius: 10, padding: "2px 8px", fontWeight: 600, letterSpacing: 0.3 },
  platformLinkBtn: { fontSize: 11, color: T.greenLight, textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" },
  platformStatRij: { display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 24 },
  platformStat: { fontSize: 12, color: T.textMid, background: T.bgCardAlt, borderRadius: 4, padding: "2px 6px" },
  // Omzet grid
  omzetGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  omzetKaartNu: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: T.shadow },
  omzetKaartYD: { background: T.greenPale, border: `1px solid ${T.greenLight}50`, borderRadius: 12, padding: "14px 16px" },
  omzetLabelKlein: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.textLight, marginBottom: 6 },
  omzetBedrag: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, marginBottom: 2 },
  omzetSubLabel: { fontSize: 11, color: T.textLight, marginBottom: 4 },
  omzetNota: { fontSize: 11, color: T.textLight, lineHeight: 1.4, marginTop: 4 },
  // Intel
  intelKolom: { display: "flex", flexDirection: "column", gap: 8 },
  intelKaartBase: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", boxShadow: T.shadow },
  intelKaartTitel: { fontSize: 10, color: T.textLight, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  intelKaartTekst: { fontSize: 13, color: T.textMid, lineHeight: 1.6 },
  // Tags
  tagRij: { display: "flex", flexWrap: "wrap", gap: 6 },
  tagOranje: { fontSize: 11, background: T.orangePale, color: T.orangeDark, border: `1px solid ${T.orange}40`, borderRadius: 16, padding: "4px 10px" },
  tagGroen: { fontSize: 11, background: T.greenPale, color: T.green, border: `1px solid ${T.greenLight}40`, borderRadius: 16, padding: "4px 10px" },
  // Gespreksonderwerpen
  onderwerpenLijst: { display: "flex", flexDirection: "column", gap: 8 },
  onderwerpRegel: { display: "flex", alignItems: "flex-start", gap: 10, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", boxShadow: T.shadow },
  onderwerpNr: { width: 22, height: 22, background: T.greenPale, color: T.green, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  onderwerpTekst: { fontSize: 13, color: T.textMid, lineHeight: 1.5 },
  // Contact
  contactKolom: { display: "flex", flexDirection: "column", gap: 6 },
  contactRegel: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, textDecoration: "none", boxShadow: T.shadow },
  contactLabel: { fontSize: 11, color: T.textLight, letterSpacing: 1, textTransform: "uppercase", width: 80, flexShrink: 0 },
  contactVal: { fontSize: 13, color: T.green, flex: 1 },
  // Notities
  notitieVeld: { width: "100%", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", color: T.text, fontFamily: "'DM Sans', sans-serif", fontSize: 13, resize: "none", lineHeight: 1.6, boxShadow: T.shadow },
  // Actie bar
  actieBar: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 1400, background: `linear-gradient(to top, ${T.bg} 75%, transparent)`, padding: "28px 16px 16px", zIndex: 100 },
  actieBarInner: { display: "flex", flexDirection: "column", gap: 6 },
  huidigUitkomst: { textAlign: "center", fontSize: 11, color: T.textLight, letterSpacing: 1 },
  actieBtns: { display: "flex", gap: 8 },
  actieBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px 8px", borderRadius: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 0.3, background: T.bgCard, boxShadow: T.shadow },
  btnAfwijzen: { border: `1px solid ${T.red}50`, color: T.red },
  btnCallback: { border: `1px solid ${T.orange}50`, color: T.orangeDark },
  btnGebeld: { flex: 1.5, border: `1px solid ${T.green}50`, color: T.green },
  verbergBtn: { background: "transparent", border: "none", color: T.textLight, fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "center", textDecoration: "underline", paddingBottom: 2 },
};

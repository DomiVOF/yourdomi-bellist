// YourDomi Bellijst v2.2 — redesign: Tailwind + Nunito + lucide-react
import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, Calendar, Building2, Bed, Phone, Mail, Globe, ChevronDown, Settings, LogOut, Home, AlertCircle, Check, Minus, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

// --- DESIGN TOKENS (light, gold-accent theme) --------------------------------
const T = {
  bg: "#FFFFFF",
  bgCard: "#FFFFFF",
  bgCardAlt: "#FAF6EE",
  green: "#2D5C4E",
  greenDark: "#1E3F35",
  greenLight: "#4A8C78",
  greenPale: "#E8F0EE",
  // Gold accents (instead of fel oranje)
  orange: "#C89B3C",
  orangePale: "#FFF7E0",
  orangeDark: "#996F1F",
  text: "#18181B",
  textMid: "#52525B",
  textLight: "#A1A1AA",
  border: "#E4E4E7",
  borderLight: "#F4F4F5",
  red: "#C0392B",
  redPale: "#FDECEA",
  shadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
  shadowMd: "0 24px 60px rgba(15, 23, 42, 0.12)",
  shadowCard: "0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.04)",
  shadowCardHover: "0 4px 8px rgba(0,0,0,0.04), 0 12px 28px rgba(15, 23, 42, 0.1), 0 24px 48px rgba(15, 23, 42, 0.08)",
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
  if (filters.belstatus)    params.set("belstatus", filters.belstatus);
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

async function fetchPagesWithFill(startPage = 1, pageSize = 50, filters = {}, sorteer = "score") {
  let currentPage = startPage;
  let allItems = [];
  let meta = null;

  // Safety cap: never fetch more than 10 pages in one chain
  for (let i = 0; i < 10; i++) {
    const data = await fetchLodgings(currentPage, pageSize, filters, sorteer);
    const rawList = Array.isArray(data?.data) ? data.data : [];
    const items = rawList.map(item => parseLodging(item));
    if (!meta) meta = data.meta || {};
    allItems = allItems.concat(items);

    const total = Math.max(0, parseInt(data?.meta?.total, 10) || data?.meta?.count || allItems.length || 0);
    const hasMore = currentPage * pageSize < total;

    if (allItems.length >= pageSize || !hasMore || rawList.length === 0) break;
    currentPage += 1;
  }

  return { items: allItems, meta };
}

async function findDuplicatesAcrossDB(phone, email, currentIds = [], sorteer = "score") {
  const normalized = normalizePhoneForMatch(phone);
  const emailNorm = email?.toLowerCase().trim();
  let page = 1;
  const found = [];

  while (page <= 10) {
    const data = await fetchLodgings(page, 50, {}, sorteer);
    const rawList = Array.isArray(data?.data) ? data.data : [];
    if (!rawList.length) break;
    const items = rawList.map(item => parseLodging(item));
    items.forEach(p => {
      if (currentIds.includes(p.id)) return;
      const pPhone = normalizePhoneForMatch(p.phone);
      const pEmail = p.email?.toLowerCase().trim();
      if (
        (normalized && pPhone === normalized) ||
        (emailNorm && pEmail === emailNorm)
      ) {
        found.push(p.id);
      }
    });
    if (items.length < 50) break;
    page += 1;
  }

  return found;
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

// Load all outcomes from server (status per pand)
async function loadAllOutcomes() {
  if (!API_URL) return null;
  try {
    const r = await fetch(`${API_URL}/api/outcomes`, { headers: getHeaders(), signal: AbortSignal.timeout(8000) });
    if (r.ok) return await r.json();
  } catch (e) {
    console.warn("Failed to load outcomes from server:", e.message);
  }
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
    ? `\nBELANGRIJK - PORTFOLIO EIGENAAR: Deze eigenaar heeft ${portfolioInfo.count} panden: ${portfolioInfo.names.join(", ")}.`
    : "";

  const prompt = `Je bent een AI-assistent voor yourdomi.be, een Belgisch beheerbedrijf voor kortetermijnverhuur (Airbnb, Booking.com, VRBO). Je focust op één ding: kort en concreet beschrijven in welke situatie de eigenaar nu zit en waar yourdomi kan helpen.${portfolioContext}

Pandgegevens:
- Naam: ${property.name}
- Adres: ${property.street}, ${property.postalCode} ${property.municipality}, ${property.province}
- Status: ${property.status} | Sterren: ${property.starRating || "geen"} | Slaapplaatsen: ${property.sleepPlaces || "?"} | Units: ${property.units || "1"}
- Tel: ${property.phone || "niet beschikbaar"} | Email: ${property.email || "niet beschikbaar"} | Website: ${property.website || "niet gevonden"}

Gebruik eventueel een paar web_search / web_fetch calls om Airbnb, Booking of een eigen website te vinden, maar houd het beknopt (niet te veel tokens).

Schrijf vooral een eenvoudige samenvatting in het Nederlands:
- Beschrijf in 2–3 zinnen hoe de verhuur NU waarschijnlijk geregeld is (zelfbeheer vs. agentuur, online aanwezigheid, kwaliteit/reviews).
- Beschrijf in 1–2 zinnen HOE yourdomi concreet kan helpen (beheer, optimalisatie, ontzorging, betere bezetting/prijzen).
- Bepaal of dit waarschijnlijk een agentuur/beheerskantoor is of de eigenaar zelf (op basis van email/telefoon/website/naam).

Scorelogica:
- HEET = eigenaar (of vermoed eigenaar) beheert zelf en er is duidelijk ruimte voor verbetering (online zichtbaarheid, reviews, pricing, tijdsdruk).
- WARM = al redelijk goed geregeld, maar nog enkele duidelijke verbeterpunten.
- KOUD = duidelijk professioneel beheerd of weinig ruimte voor extra meerwaarde.

Geef ALLEEN deze JSON (geen markdown):
{
  "score": "HEET"|"WARM"|"KOUD",
  "scoreReden": "Korte uitleg waarom dit pand HEET/WARM/KOUD is, met focus op huidige situatie van de eigenaar (zelfbeheer/agentuur, online zichtbaarheid, kwaliteit) en ruimte voor verbetering. Max 2 zinnen.",
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
  "pitchhoek": "In 1-2 zinnen: hoe kan yourdomi concreet helpen in deze specifieke situatie (beheer, optimalisatie, ontzorging, betere bezetting/prijs)?",
  "zwaktes": ["concreet verbeterpunt 1", "concreet verbeterpunt 2", "concreet verbeterpunt 3"],
  "reviewThemes": ["terugkerend punt uit reviews bv. schoonmaak", "nog een thema dat in gesprek bruikbaar is"],
  "slechteReviews": true|false,
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
      zwaktes: [], reviewThemes: [], slechteReviews: false, airbnb: { gevonden: false }, booking: { gevonden: false },
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
- "Infomail send" — infomail verstuurd naar eigenaar

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
- If the notes mention sending an email, info mail, or phrases like "mail gestuurd/verzonden", set stage to "Infomail send" and nextStep to "Follow-up"
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
  const naam = property.contactNaam || "";
  const subject = encodeURIComponent(`Kennismaking YourDomi`);
  const introNaam = naam ? `Beste ${naam},` : `Beste,`;

  const body = encodeURIComponent(
    `${introNaam}\n\n` +
    `Tijdens deze afspraak overlopen we uw situatie en bekijken we hoe wij u kunnen ondersteunen binnen het beheer en de optimalisatie van uw vakantiewoning.\n\n` +
    `Mocht u verhinderd zijn of nog vragen hebben voorafgaand aan de afspraak, aarzel dan niet om ons te contacteren.\n\n` +
    `Voor meer info kan u onze website www.yourdomi.be gerust raadplegen.\n\n` +
    `Met vriendelijke groet,\nYourDomi`
  );

  const guests = property.email ? `&add=${encodeURIComponent(property.email)}` : "";

  return `https://calendar.google.com/calendar/r/eventedit?text=${subject}&details=${body}${guests}&crm=AVAILABLE`;
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
    <div>
      <textarea
        className="w-full bg-white border border-[#EBEBEB] rounded-xl p-4 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-yd-red/30 resize-y mb-3 font-nunito"
        rows={4}
        placeholder="Plak hier het transcript van je JustCall-belgesprek (of ander beltranscript)..."
        value={transcript}
        onChange={e => { setTranscript(e.target.value); setError(null); }}
        disabled={loading}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="rounded-[10px] py-2.5 px-5 bg-[#1A1A1A] text-white font-semibold text-sm border-0 cursor-pointer disabled:opacity-80 disabled:cursor-wait hover:opacity-90 transition-opacity"
          onClick={handleSummarize}
          disabled={loading}
        >
          {loading ? "Bezig..." : "Genereer notities uit transcript"}
        </button>
        {error && <span className="text-xs text-yd-red">{error}</span>}
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

function normalizePhoneForMatch(phone) {
  if (!phone) return null;
  // Remove all spaces, dashes, dots, parentheses
  let p = phone.replace(/[\s\-().]/g, "");
  // Normalize 0032 → +32
  p = p.replace(/^0032/, "+32");
  // Normalize leading 0 (Belgian local) → +32
  // e.g. 0474123456 → +32474123456
  if (p.startsWith("0") && !p.startsWith("00")) {
    p = "+32" + p.slice(1);
  }
  return p;
}

function isLikelyAgency(property, enrichedData = null) {
  if (!property) return false;
  // If AI already flagged it, trust that
  if (enrichedData?.waarschuwingAgentuur === true) return true;
  if (enrichedData?.waarschuwingAgentuur === false) return false;

  // Phone prefix checks — fixed-line numbers starting with
  // 05 or +325 are almost always offices/agencies
  const rawPhone = property.phone || property.phoneNorm || "";
  if (!rawPhone) return false; // no phone, skip check

  const phone = rawPhone
    .replace(/[\s\-().]/g, "")
    .replace(/^00/, "+")
    .replace(/^\+?0032/, "+32")
    .replace(/^0([^0])/, "+32$1"); // 0474... → +32474...

  if (!phone) return false; // guard before startsWith

  const isMobile = /^\+324\d/.test(phone);
  if (!isMobile) {
    if (phone.startsWith("+325") || phone.startsWith("05")) {
      return true;
    }
  }

  // Email domain checks
  const email = (property.email || "").toLowerCase();

  // Check full email string (before AND after @)
  const agencyEmailKeywords = [
    "immo", "vastgoed", "makelaardij", "makelaar",
    "realty", "estate", "agency", "agentuur", "beheer",
    "rental", "verhuur", "vakantie", "holiday", "tourism",
    "booking", "reservations", "toerisme",
    "kustimmo", "coastimmo", "seaimmo",
  ];

  // Split into local part (before @) and domain (after @)
  const emailLocal = email.split("@")[0] || "";
  const emailDomain = email.split("@")[1] || "";

  // Check domain name (strip TLD first for cleaner matching)
  const domainName = emailDomain.split(".")[0] || "";

  for (const kw of agencyEmailKeywords) {
    // Match anywhere in domain name or local part
    if (domainName.includes(kw) || emailLocal.includes(kw)) {
      return true;
    }
  }

  // Also catch generic info@/contact@ with agency domain
  if (email.startsWith("info@") || email.startsWith("contact@")) {
    const genericDomains = [
      "vakantiewoning", "holiday", "rental", "verhuur",
      "beheer", "immo", "realty",
    ];
    for (const kw of genericDomains) {
      if (emailDomain.includes(kw)) return true;
    }
  }

  return false;
}

// Single AI insight line for card: missing platform > no agency > poor site > high reviews
function getCardAiSignal(fullAi, ai) {
  if (!ai && !fullAi) return null;
  const a = fullAi || ai;
  const hasAirbnb = ai?.airbnb?.gevonden;
  const hasBooking = ai?.booking?.gevonden;
  if (!hasAirbnb && hasBooking) return "Alleen Booking.com — mist Airbnb";
  if (hasAirbnb && !hasBooking) return "Alleen Airbnb — mist Booking.com";
  if (!hasAirbnb && !hasBooking && (ai || fullAi)) return "Geen Airbnb/Booking gevonden";
  if (a?.waarschuwingAgentuur) return "Mogelijk agentuur — vraag naar eigenaar";
  if (!a?.waarschuwingAgentuur && (fullAi || ai)) return "Beheert zelf — geen agentuur";
  if (a?.directWebsite?.poorlyBuilt) return "Slechte eigen website";
  const bookingScore = a?.booking?.beoordeling || a?.booking?.rating;
  const airbnbScore = a?.airbnb?.beoordeling || a?.airbnb?.rating;
  if (bookingScore) return `${bookingScore}${String(bookingScore).length <= 2 ? "/10" : ""} op Booking.com`;
  if (airbnbScore) return `${airbnbScore} op Airbnb`;
  return null;
}

// --- PROPERTY CARD (dense layout for cold callers) -----------------------------
function PropertyCard({
  prop,
  fullAi,
  ai,
  outcome,
  enriching,
  isVerborgen,
  heeftPortfolio,
  portfolioAantal,
  uitkomstLabel,
  onCardClick,
  onAfgewezen,
  onOutcome,
  onInteresseClick,
  phoneGroups,
  animationStyle,
}) {
  const street = prop.street || prop["address-street"] || prop.straat || "";
  const city = prop.municipality || prop["municipality-name"] || prop.gemeente || "";
  const postalCode = prop.postalCode || prop["postal-code"] || "";
  const fullAddress = prop.fullAddress || prop["fullAddress"] || ([street, postalCode, city].filter(Boolean).join(", ") || "");
  const sleep = prop.sleepPlaces ?? prop["number-of-sleep-places"] ?? prop.slaapplaatsen ?? null;
  const units = prop.units ?? prop["number-of-units"] ?? 1;
  const phones = [];
  const addPhone = (v) => { if (v && !phones.includes(v)) phones.push(v); };
  addPhone(prop.phone); addPhone(prop.phone2); addPhone(prop["contact-phone"]); addPhone(prop.telefoon); addPhone(prop.phone1);
  if (Array.isArray(prop.phones)) prop.phones.forEach(addPhone);
  const email = prop.email || prop["contact-email"];
  const scoreNum = fullAi?.prioriteit != null ? String(Math.min(99, Math.max(0, fullAi.prioriteit * 10))).padStart(2, "0") : (fullAi?.score === "HEET" ? "85" : fullAi?.score === "WARM" ? "60" : fullAi?.score === "KOUD" ? "40" : null);
  const aiSignal = getCardAiSignal(fullAi, ai);
  const platformLabels = [];
  if (ai?.airbnb?.gevonden) platformLabels.push("Airbnb");
  if (ai?.booking?.gevonden) platformLabels.push("Booking");
  const platformStr = platformLabels.length ? platformLabels.join(", ") : "—";
  const sc = fullAi?.score ? SCORES[fullAi.score] : null;
  const isAgency = fullAi?.waarschuwingAgentuur ||
    isLikelyAgency(prop, fullAi || null) ||
    (prop.phoneNorm && (phoneGroups[prop.phoneNorm]?.length || 0) >= 4);
  const poorWebsite = fullAi?.directWebsite?.poorlyBuilt;

  return (
    <div
      className={`rounded-[16px] bg-white border border-[#EBEBEB] overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] font-nunito ${isVerborgen || outcome === "afgewezen" ? "opacity-45" : "opacity-100"}`}
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)", ...animationStyle }}
    >
      <div
        role="button"
        tabIndex={0}
        className="p-[20px] flex flex-col gap-0 cursor-pointer flex-1 font-nunito"
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCardClick(); } }}
        onClick={onCardClick}
      >
        {/* TOP ROW: name left, score pill + HEET pill right next to each other */}
        <div className="flex justify-between items-start gap-3">
          <h3 className="text-lg font-bold text-[#1A1A1A] leading-tight line-clamp-2 flex-1 min-w-0 font-nunito">{prop.name}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {scoreNum != null && (
              <span className="rounded-[999px] bg-[#1A1A1A] text-white text-xs px-3 py-0.5 font-medium">{scoreNum}</span>
            )}
            {sc?.label === "HEET" && (
              <span className="rounded-[999px] bg-[#FF6B35] text-white text-xs px-2 py-0.5 font-semibold">HEET</span>
            )}
          </div>
        </div>

        {/* SECOND ROW: full address */}
        <div className="text-sm text-[#888888] mt-1 truncate">{fullAddress || "—"}</div>

        <div className="border-t border-[#EBEBEB] my-3" />

        {/* CONTACT ROW */}
        <div className="flex items-center gap-1.5">
          {phones.length > 0 ? (
            <a href={`tel:${phones[0]}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A] no-underline">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{phones[0]}</span>
            </a>
          ) : email ? (
            <a href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A] no-underline truncate max-w-[200px]">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{email}</span>
            </a>
          ) : (
            <span className="flex items-center gap-1 text-sm italic text-[#E8231A] font-nunito" style={{ opacity: 0.7 }}>
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              Geen contact
            </span>
          )}
        </div>

        {/* AI SIGNAL ROW */}
        <div className="text-xs text-[#6B7280] italic mt-1 min-h-[1.25rem]">
          {enriching ? "Bezig met scannen…" : aiSignal || "Nog niet gescand"}
        </div>

        <div className="border-t border-[#EBEBEB] my-3" />

        {/* STATS ROW */}
        <div className="flex items-center gap-2 text-xs text-[#888888] flex-wrap">
          <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {sleep > 0 ? `${sleep} slaapplaatsen` : "—"}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5" /> {units > 1 ? `${units} units` : "1 unit"}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {platformStr}</span>
        </div>

        {/* TAGS ROW */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {prop.status && <span className="rounded-full px-2 py-0.5 text-xs bg-yd-bg text-yd-muted border border-yd-border">{prop.status}</span>}
          {fullAi && !enriching && (fullAi.score != null || fullAi.prioriteit != null) && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">AI-gescand</span>}
          {poorWebsite && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Slechte site</span>}
          {heeftPortfolio && <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">🏘 Portfolio</span>}
        </div>
      </div>

      {/* BOTTOM ACTION ROW (buttons don't navigate) */}
      <div className="px-[20px] pb-5 pt-0 flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
        <button type="button" className={`flex-1 min-w-0 rounded-lg py-2 text-sm font-semibold transition-colors border font-nunito ${outcome === "afgewezen" ? "bg-[#E8231A] text-white border-[#E8231A] opacity-50" : "bg-white text-[#666666] border-[#EBEBEB] hover:bg-yd-bg"}`} onClick={e => { e.stopPropagation(); onAfgewezen(); }}>Afwijzen</button>
        <button type="button" className={`flex-1 min-w-0 rounded-lg py-2 text-sm font-semibold transition-colors border ${outcome === "callback" ? "bg-[#EA580C] text-white border-[#EA580C] opacity-50" : "bg-white text-[#666666] border-[#EBEBEB] hover:bg-yd-bg"}`} onClick={e => { e.stopPropagation(); onOutcome(outcome === "callback" ? null : "callback"); }}>Terugbellen</button>
        <button type="button" className={`flex-1 min-w-0 rounded-lg py-2 text-sm font-semibold transition-colors border font-nunito ${outcome === "gebeld_interesse" ? "bg-[#22C55E] text-[#1A1A1A] border-[#22C55E] opacity-50" : "bg-white text-[#666666] border-[#EBEBEB] hover:bg-yd-bg"}`} onClick={e => { e.stopPropagation(); const isInteresse = outcome === "gebeld_interesse"; onOutcome(isInteresse ? null : "gebeld_interesse"); if (!isInteresse && onInteresseClick) onInteresseClick(prop); }}>✓ Interesse</button>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-yd-bg flex items-center justify-center font-nunito p-4">
      <div className="bg-white rounded-card shadow-card border border-yd-border p-8 w-full max-w-[360px]">
        <div className="mb-7 text-center">
          <div className="font-bold text-2xl text-yd-black tracking-tight">
            YourDomi<span className="text-yd-red">.</span>
          </div>
          <p className="text-xs text-yd-muted mt-1 tracking-widest uppercase">Bellijst</p>
          <p className="text-xs text-yd-muted mt-2 font-medium">Uw vakantiewoning, onze zorg</p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-yd-muted uppercase tracking-wider mb-1.5">Gebruikersnaam</label>
            <input
              className="w-full bg-yd-bg border border-yd-border rounded-input py-2.5 px-3 text-sm text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30 focus:border-yd-red box-border"
              placeholder="aaron"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-yd-muted uppercase tracking-wider mb-1.5">Wachtwoord</label>
            <input
              className="w-full bg-yd-bg border border-yd-border rounded-input py-2.5 px-3 text-sm text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30 focus:border-yd-red box-border"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
            />
          </div>
          {error && <div className="text-xs text-yd-red bg-red-50 rounded-btn py-2 px-2.5">⚠️ {error}</div>}
          <button
            type="button"
            onClick={login}
            disabled={loading || !username || !password}
            className="w-full mt-1 py-3 rounded-btn bg-yd-black text-white font-semibold text-sm border-0 cursor-pointer hover:bg-[#333] transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
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
  const [listSnapshot, setListSnapshot] = useState(null); // preserve applied filters when navigating to dossier
  const [loading, setLoading] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState(new Set());
  const [addressEnrichingIds, setAddressEnrichingIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dbTotalCount, setDbTotalCount] = useState(0);
  const [phoneGroups, setPhoneGroups] = useState({}); // phoneNorm -> [ids]
  const enrichBatchRef = useRef(0); // verhoogt bij elke nieuwe Start AI, om oude batches stil te leggen
  const nextPageCacheRef = useRef(null);
  const fillingRef = useRef(false);
  const lastPageLoadedRef = useRef(1);
  const fetchTokenRef = useRef(0);
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
  const [interessePopupProp, setInteressePopupProp] = useState(null); // card Interesse popup

  // -- FILTERS --
  const initialFilters = {
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
    heeftAi: false,
    geenAgentuur: false,
    belstatus: "",   // "" | "terugbellen" | "interesse" | "afgewezen"
    regio: "",
    type: "",
    toonVerborgen: false,
    toonAfgewezen: true,
    toonInteresse: true,
    toonTerugbellen: true,
  };
  const [filters, setFilters] = useState(initialFilters);       // toegepast op lijst + server
  const [rawFilters, setRawFilters] = useState(initialFilters); // live UI-waarden
  const [filterOpen, setFilterOpen] = useState(false);
  const [sorteer, setSorteer] = useState("score"); // score | naam | slaap | gemeente
  const [displayMode, setDisplayMode] = useState("cards"); // "cards" | "table"
  const [aiGestart, setAiGestart] = useState(false);
  const [meta, setMeta] = useState({ provinces: [], types: [], regios: [] });
  const [cardThumbErrors, setCardThumbErrors] = useState({}); // id -> true when thumb image failed to load
  const [dbEnrichmentCount, setDbEnrichmentCount] = useState(null); // total full enrichments in DB (server-wide)

  const loadHealth = useCallback(async () => {
    if (!API_URL) return;
    try {
      const r = await fetch(`${API_URL}/api/health`, { headers: getHeaders(), signal: AbortSignal.timeout(8000) });
      if (!r.ok) return;
      const j = await r.json();
      const c = Number(j?.enrichments);
      if (Number.isFinite(c)) setDbEnrichmentCount(c);
    } catch (_) {}
  }, []);

  async function preloadNextPage(basePage, currentFilters = null, currentSorteer = null) {
    const myToken = fetchTokenRef.current;
    const filtersToUse = currentFilters || filters;
    const sortToUse = currentSorteer || sorteer;
    const next = basePage + 1;
    try {
      const result = await fetchPagesWithFill(next, 50, filtersToUse, sortToUse);
      if (!result.items.length) {
        nextPageCacheRef.current = null;
        return;
      }
      if (myToken !== fetchTokenRef.current) return;
      nextPageCacheRef.current = { page: next, items: result.items, meta: result.meta };
    } catch {
      nextPageCacheRef.current = null;
    }
  }

  // Laad panden + start meteen batch verrijking
  const laadPanden = useCallback(async (p = 1, currentFilters = null, token = null) => {
    const myToken = token ?? fetchTokenRef.current;
    setLoading(true); setError(null);
    try {
      const { items, meta } = await fetchPagesWithFill(p, 50, currentFilters || {}, sorteer);
      if (myToken !== fetchTokenRef.current) return;
      setProperties(items);
      const total = Math.max(0, parseInt(meta?.total, 10) || meta?.count || items.length || 0);
      setTotalCount(total);
      const dbTotal = Math.max(0, parseInt(meta?.dbTotal, 10) || 0);
      if (dbTotal) setDbTotalCount(dbTotal);
      const groups = {};
      items.forEach(it => {
        const key = it.phoneNorm || normalizePhoneForMatch(it.phone);
        if (key) {
          if (!groups[key]) groups[key] = [];
          groups[key].push(it.id);
        }
      });
      setPhoneGroups(groups);
      if (items.length > 0 && !selected) setSelected(items[0]);
      const pagesUsed = Math.max(1, Math.ceil(items.length / 50));
      lastPageLoadedRef.current = p + pagesUsed - 1;
      if (p * 50 < total) {
        preloadNextPage(p, currentFilters || filters, sorteer);
      } else {
        nextPageCacheRef.current = null;
      }
    } catch (e) {
      if (e.message === "401") {
        setUser(null); // shows login screen
      } else {
        setError(e.message);
      }
    }
    finally {
      if (myToken === fetchTokenRef.current) {
        setLoading(false);
      }
    }
  }, [filters, sorteer, selected]);

  const applyFilters = (nextFilters) => {
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;
    nextPageCacheRef.current = null;
    fillingRef.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    setPage(1);
    setProperties([]);
    setFilters(nextFilters);
    laadPanden(1, nextFilters, myToken);
    setAiGestart(false);
  };

  // Batch verrijking - laadt alle panden van de pagina 3 tegelijk op
  const startBatchEnrich = useCallback((items, groups, priorityIds = null) => {
    // Nieuwe batch-id: alle lopende workers van vorige batches stoppen na hun huidige pand
    enrichBatchRef.current += 1;
    const myBatch = enrichBatchRef.current;
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
      // Als er ondertussen een nieuw Start AI-commando is geweest, stopt deze batch stilletjes
      if (myBatch !== enrichBatchRef.current) return;
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
        saveEnrichment(prop.id, result)
          .then(() => {
            setDbEnrichmentCount(c => (typeof c === "number" ? c + 1 : c));
            loadHealth().catch(() => {});
          })
          .catch(() => {});
      } catch (e) { console.error("Verrijking mislukt voor", prop.name, e); }
      finally {
        setEnrichingIds(s => { const n = new Set(s); n.delete(prop.id); return n; });
        await volgende(); // pak volgende zodra deze klaar is (tenzij batch intussen vervangen is)
      }
    };

    // Start PARALLEL workers tegelijk
    for (let i = 0; i < Math.min(PARALLEL, toEnrich.length); i++) {
      volgende();
    }
  }, [loadHealth]);

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
      loadAllOutcomes().then(serverOutcomes => {
        if (serverOutcomes && typeof serverOutcomes === "object") {
          const outMap = {};
          const notesMap = { ...load("notes", {}) };
          const contactMap = { ...load("contactnamen", {}) };
          for (const [id, row] of Object.entries(serverOutcomes)) {
            if (row.outcome) outMap[id] = row.outcome;
            if (row.note) notesMap[id] = row.note;
            if (row.contactNaam) contactMap[id] = row.contactNaam;
          }
          setOutcomes(outMap);
          setNotes(notesMap);
          save("outcomes", outMap);
          save("notes", notesMap);
          save("contactnamen", contactMap);
        }
      }).catch(() => {});
      loadHealth().catch(() => {});
    }
    laadPanden(1);
  }, [laadPanden, loadHealth]);

  // Verberg pand + alle panden met zelfde telefoon/email als afgewezen
  const verbergPand = useCallback((id, reden = "verborgen") => {
    const prop = properties.find(p => p.id === id);
    let toHide = [id];
    if (reden === "afgewezen" && prop?.phoneNorm) {
      const normKey = prop.phoneNorm || normalizePhoneForMatch(prop.phone);
      const groep = normKey ? (phoneGroups[normKey] || []) : [];
      if (groep.length > 1) toHide = groep; // wis alle met zelfde nr
      const emailNorm = prop?.email?.toLowerCase().trim();
      if (emailNorm) {
        properties.forEach(p => {
          if (p.email?.toLowerCase().trim() === emailNorm && !toHide.includes(p.id)) {
            toHide.push(p.id);
          }
        });
      }
    }
    const newHidden = [...new Set([...hidden, ...toHide])];
    setHidden(newHidden);
    save("hidden", newHidden);
    const newOut = { ...outcomes };
    toHide.forEach(hid => { newOut[hid] = reden; });
    setOutcomes(newOut);
    save("outcomes", newOut);
    if (reden === "afgewezen" && toHide.length > 1) {
      console.log(`Automatisch afgewezen voor ${toHide.length - 1} extra pand(en) op basis van telefoon/e-mail.`);
    }

    // Zoek in de volledige database naar duplicaten op telefoon/e-mail (asynchroon, stilletjes)
    if (reden === "afgewezen" && prop) {
      const phoneRaw = prop.phone || prop.phoneNorm || null;
      const emailRaw = prop.email || null;
      (async () => {
        try {
          const extraIds = await findDuplicatesAcrossDB(phoneRaw, emailRaw, toHide, sorteer);
          if (!extraIds.length) return;
          setHidden(prevHidden => {
            const mergedHidden = [...new Set([...prevHidden, ...extraIds])];
            save("hidden", mergedHidden);
            return mergedHidden;
          });
          setOutcomes(prevOut => {
            const updated = { ...prevOut };
            extraIds.forEach(hid => {
              updated[hid] = "afgewezen";
            });
            save("outcomes", updated);
            return updated;
          });
          extraIds.forEach(hid => {
            const note = notes[hid] || "";
            const contactNaam = load("contactnamen", {})[hid] || "";
            saveOutcomeToServer(hid, "afgewezen", note, contactNaam).catch(() => {});
          });
          console.log(`Automatisch afgewezen voor ${extraIds.length} extra pand(en) op basis van telefoon/e-mail in volledige database.`);
        } catch (e) {
          console.error("Fout bij zoeken naar dubbele panden in DB:", e);
        }
      })();
    }
  }, [properties, phoneGroups, hidden, outcomes, sorteer, notes]);



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
    const outcome = outcomes[p.id];
    if (!filters.toonVerborgen && hidden.includes(p.id) && outcome !== "afgewezen") return false;
    if (!filters.toonAfgewezen && outcome === "afgewezen") return false;
    if (!filters.toonInteresse && (outcome === "gebeld_interesse" || outcome === "interesse")) return false;
    if (!filters.toonTerugbellen && (outcome === "callback" || outcome === "terugbellen")) return false;
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

  zichtbaar = zichtbaar.filter(p => {
    const ai = getCardAi(p.id, p);
    const outcome = outcomes[p.id];
    if (filters.heeftAi && !enriched[p.id]) return false;
    if (filters.geenAgentuur) {
      const aiConfirmed = enriched[p.id]?.waarschuwingAgentuur === true;
      const heuristicFlag = isLikelyAgency(p, enriched[p.id] || null);
      const bulkPhone = p.phoneNorm &&
        (phoneGroups[p.phoneNorm]?.length || 0) >= 4;
      if (aiConfirmed || heuristicFlag || bulkPhone) return false;
    }
    if (filters.belstatus === "terugbellen" && !(outcome === "callback" || outcome === "terugbellen")) return false;
    if (filters.belstatus === "interesse" && !(outcome === "gebeld_interesse" || outcome === "interesse")) return false;
    if (filters.belstatus === "afgewezen" && outcome !== "afgewezen") return false;
    return true;
  });

  const isVisible = (p) => {
    const outcome = outcomes[p.id];
    if (!filters.toonVerborgen && hidden.includes(p.id) && outcome !== "afgewezen") return false;
    if (!filters.toonAfgewezen && outcome === "afgewezen") return false;
    if (!filters.toonInteresse && (outcome === "gebeld_interesse" || outcome === "interesse")) return false;
    if (!filters.toonTerugbellen && (outcome === "callback" || outcome === "terugbellen")) return false;
    if (filters.score && enriched[p.id]?.score !== filters.score) return false;

    const ai = getCardAi(p.id, p);
    if (filters.heeftAi && !enriched[p.id]) return false;
    if (filters.geenAgentuur) {
      const aiConfirmed = enriched[p.id]?.waarschuwingAgentuur === true;
      const heuristicFlag = isLikelyAgency(p, enriched[p.id] || null);
      const bulkPhone = p.phoneNorm &&
        (phoneGroups[p.phoneNorm]?.length || 0) >= 4;
      if (aiConfirmed || heuristicFlag || bulkPhone) return false;
    }
    if (filters.belstatus === "terugbellen" && !(outcome === "callback" || outcome === "terugbellen")) return false;
    if (filters.belstatus === "interesse" && !(outcome === "gebeld_interesse" || outcome === "interesse")) return false;
    if (filters.belstatus === "afgewezen" && outcome !== "afgewezen") return false;
    return true;
  };

  useEffect(() => {
    // Invalidate next-page cache when filters of sortering veranderen
    nextPageCacheRef.current = null;
  }, [filters, sorteer]);

  const fillPage = useCallback(async (currentFilters, currentSorteer) => {
    if (fillingRef.current || loading) return;
    if (!totalCount || properties.length >= totalCount) return;
    const myToken = fetchTokenRef.current;
    fillingRef.current = true;
    try {
      let merged = [...properties];
      let visibleCount = merged.filter(isVisible).length;
      let nextPage = lastPageLoadedRef.current + 1;
      while (visibleCount < 50 && merged.length < totalCount) {
        const data = await fetchLodgings(nextPage, 50, currentFilters, currentSorteer);
        const rawList = Array.isArray(data?.data) ? data.data : [];
        if (!rawList.length) break;
        const newItems = rawList.map(item => parseLodging(item));
        merged = merged.concat(newItems);
        lastPageLoadedRef.current = nextPage;
        nextPage += 1;
        visibleCount = merged.filter(isVisible).length;
        if (merged.length >= totalCount) break;
      }
      if (myToken !== fetchTokenRef.current) return;
      if (merged.length !== properties.length) {
        setProperties(merged);
        const groups = {};
        merged.forEach(it => {
          const key = it.phoneNorm || normalizePhoneForMatch(it.phone);
          if (key) {
            if (!groups[key]) groups[key] = [];
            groups[key].push(it.id);
          }
        });
        setPhoneGroups(groups);
      }
    } catch (e) {
      console.error("fillPage error", e);
    } finally {
      if (myToken === fetchTokenRef.current) {
        fillingRef.current = false;
      }
    }
  }, [loading, totalCount, properties, isVisible]);

  useEffect(() => {
    if (zichtbaar.length < 50 && zichtbaar.length < totalCount && !loading) {
      fillPage(filters, sorteer);
    }
  }, [zichtbaar.length, totalCount, loading, fillPage, filters, sorteer]);

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
  const interesseCount = Object.values(outcomes).filter(o => o === "gebeld_interesse").length;
  const verrijktCount = properties.filter(p => enriched[p.id]).length;
  const verrijktDb = (dbEnrichmentCount != null && Number.isFinite(dbEnrichmentCount)) ? dbEnrichmentCount : null;

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
        onTerug={() => {
          setView("lijst");
          if (!listSnapshot) return;

          if (listSnapshot.displayMode) setDisplayMode(listSnapshot.displayMode);
          if (listSnapshot.sorteer) setSorteer(listSnapshot.sorteer);
          if (listSnapshot.rawFilters) setRawFilters(listSnapshot.rawFilters);

          const nextFilters = listSnapshot.filters || listSnapshot.rawFilters;
          const nextPage = typeof listSnapshot.page === "number" ? listSnapshot.page : 1;
          if (nextFilters) {
            // Unlike applyFilters(), this preserves the previous page + doesn't blank the list.
            fetchTokenRef.current += 1;
            const myToken = fetchTokenRef.current;
            nextPageCacheRef.current = null;
            fillingRef.current = false;
            setPage(nextPage);
            setFilters(nextFilters);
            laadPanden(nextPage, nextFilters, myToken);
          } else {
            setPage(nextPage);
          }

          setAiGestart(false);
        }}
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
    <div className="min-h-screen bg-yd-bg text-yd-black font-nunito max-w-[1400px] mx-auto px-4 md:px-8 box-border overflow-x-hidden">
      <style>{globalCSS}</style>

      {/* SERVER ERROR BANNER */}
      {error && !loading && (
        <div className="bg-yd-red text-white text-center py-2 px-4 text-sm font-semibold">
          ⚠️ Serverfout: {error} — <button type="button" onClick={() => laadPanden(page, filters)} className="ml-2 py-0.5 px-2 border border-white rounded cursor-pointer text-white bg-transparent hover:bg-white/10 transition-colors duration-150">Opnieuw</button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-yd-border sticky top-0 z-50">
        <div className="flex flex-wrap justify-between items-center gap-2 py-3 px-4 md:px-8 max-w-[1400px] mx-auto">
          <div className="flex items-baseline gap-0.5">
            <span className="font-nunito font-bold text-xl text-yd-black">YourDomi</span>
            <span className="text-yd-red font-bold text-xl leading-none">.</span>
            <span className="text-[10px] text-yd-muted tracking-widest uppercase ml-1.5">BELLIJST</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-yd-muted">{user?.name || user?.username}</span>
            <button type="button" onClick={handleLogout} className="flex items-center gap-1.5 border border-yd-border rounded-btn py-1.5 px-2.5 text-xs text-yd-muted hover:bg-yd-bg transition-colors duration-150" title="Uitloggen">
              <LogOut className="w-3.5 h-3.5" /> Uitloggen
            </button>
            <button type="button" onClick={() => setView("config")} className="flex items-center gap-1.5 border border-yd-border rounded-btn py-1.5 px-2.5 text-xs hover:bg-yd-bg transition-colors duration-150" title="Monday & instellingen">
              <Settings className="w-4 h-4" />
              {mondayActief ? <span className="text-score-interesse font-semibold">Monday ✓</span> : <span className="text-yd-muted">Integraties</span>}
            </button>
            <div className="flex items-center gap-0 flex-wrap">
              <Stat label="Heet" val={heetCount} accent />
              <span className="w-px h-5 bg-yd-border mx-2 flex-shrink-0" aria-hidden />
              <Stat label="Interesse" val={interesseCount} />
              <span className="w-px h-5 bg-yd-border mx-2 flex-shrink-0" aria-hidden />
              <Stat label="AI-scanned" val={verrijktDb != null ? verrijktDb : verrijktCount} />
            </div>
          </div>
        </div>
      </header>

      {/* FILTER BAR */}
      <div className="bg-white border-b border-yd-border sticky top-[57px] z-40">
        <div className="flex flex-wrap gap-2 items-center py-2.5 px-4 md:px-8 min-w-0 w-full max-w-[1400px] mx-auto box-border">
          <input
            className="flex-1 min-w-0 bg-yd-bg border border-yd-border rounded-input py-2 px-3 text-sm text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30 focus:border-yd-red transition-shadow"
            placeholder="Zoeken op naam, gemeente, postcode..."
            value={rawFilters.zoek}
            onChange={e => setRawFilters(f => ({ ...f, zoek: e.target.value }))}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`rounded-btn py-2 px-3 text-xs font-semibold transition-all duration-200 ${displayMode === "cards" ? "bg-yd-black text-white border border-yd-black" : "bg-white text-yd-black border border-yd-border hover:bg-yd-bg"}`}
              onClick={() => setDisplayMode("cards")}
            >
              Kaarten
            </button>
            <button
              type="button"
              className={`rounded-btn py-2 px-3 text-xs font-semibold transition-all duration-200 ${displayMode === "table" ? "bg-yd-black text-white border border-yd-black" : "bg-white text-yd-black border border-yd-border hover:bg-yd-bg"}`}
              onClick={() => setDisplayMode("table")}
            >
              Tabel
            </button>
          </div>
          <select
            className="min-w-[160px] bg-white border border-yd-border rounded-btn py-2 px-3 text-xs text-yd-black cursor-pointer outline-none focus:ring-2 focus:ring-yd-red/30"
            value={sorteer}
        onChange={e => {
          nextPageCacheRef.current = null;
          setSorteer(e.target.value);
        }}
          >
            <option value="score">Sorteren: AI Score</option>
            <option value="platform">Sorteren: Airbnb/Booking eerst</option>
            <option value="naam">Sorteren: Naam A-Z</option>
            <option value="gemeente">Sorteren: Gemeente</option>
            <option value="slaap_hoog">Sorteren: Slaappl. hoog-laag</option>
            <option value="slaap_laag">Sorteren: Slaappl. laag-hoog</option>
            <option value="nieuwste">🆕 Nieuwste online eerst</option>
          </select>
          <button type="button" className="rounded-btn py-2 px-3 text-xs border border-yd-border bg-white text-yd-black hover:bg-yd-bg transition-colors duration-150" onClick={() => setFilterOpen(o => !o)}>
            Filters {filterOpen ? "▲" : "▼"}
          </button>
          <button
            type="button"
            className={`rounded-btn py-2 px-4 text-xs font-bold text-white border-none transition-opacity duration-150 ${enrichingIds.size > 0 ? "opacity-70" : "opacity-100"}`}
            style={{ background: aiGestart ? "#22C55E" : "#E8231A" }}
            onClick={() => {
              if (enrichingIds.size > 0) setEnrichingIds(new Set());
              setAiGestart(true);
              const target = zichtbaar;
              if (Array.isArray(target) && target.length > 0) {
                startBatchEnrich(target, phoneGroups, target.map(p => p.id));
              }
            }}
            title={aiGestart ? "AI verrijking actief" : "Start AI verrijking voor gefilterde panden"}
          >
            {enrichingIds.size > 0 ? "AI bezig..." : aiGestart ? "AI gestart ✓" : "Start AI"}
          </button>
          <button
            type="button"
            className="rounded-btn py-2 px-3 border border-yd-black bg-yd-black text-white text-sm font-semibold hover:bg-[#333] transition-colors duration-150"
            onClick={() => applyFilters(rawFilters)}
          >
            Zoeken
          </button>
        </div>

        {filterOpen && (
          <div className="pt-3 pb-4 px-4 border-t border-yd-border bg-yd-bg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
              <FilterSelect label="Score" value={rawFilters.score} onChange={v => setRawFilters(f => ({ ...f, score: v }))}
                options={[["", "Alle scores"], ["HEET", "🔥 Heet"], ["WARM", "W Warm"], ["KOUD", "K Koud"]]} />
              <FilterSelect label="Provincie" value={rawFilters.provincie} onChange={v => setRawFilters(f => ({ ...f, provincie: v }))}
                options={[["", "Alle provincies"], ...(meta.provinces.length ? meta.provinces : uniekeProvincies).map(p => [p, p])]} />
              <FilterSelect label="Toeristische regio" value={rawFilters.regio} onChange={v => setRawFilters(f => ({ ...f, regio: v }))}
                options={[["", "Alle regio's"], ...meta.regios.map(r => [r, r])]} />
              <FilterSelect label="Type accommodatie" value={rawFilters.type} onChange={v => setRawFilters(f => ({ ...f, type: v }))}
                options={[["", "Alle types"], ...meta.types.map(t => [t, t])]} />
              <FilterSelect label="Status" value={rawFilters.status} onChange={v => setRawFilters(f => ({ ...f, status: v }))}
                options={[["", "Alle statussen"], ["aangemeld", "Aangemeld"], ["erkend", "Erkend"], ["vergund", "Vergund"]]} />
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-yd-muted font-semibold">Gemeente</label>
                <input className="bg-white border border-yd-border rounded-btn py-1.5 px-2.5 text-xs text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30" placeholder="bv. Gent" value={rawFilters.gemeente} onChange={e => setRawFilters(f => ({ ...f, gemeente: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-yd-muted font-semibold">Min. slaapplaatsen</label>
                <input className="bg-white border border-yd-border rounded-btn py-1.5 px-2.5 text-xs text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30" type="number" placeholder="0" value={rawFilters.minSlaap} onChange={e => setRawFilters(f => ({ ...f, minSlaap: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-yd-muted font-semibold">Max. slaapplaatsen</label>
                <input className="bg-white border border-yd-border rounded-btn py-1.5 px-2.5 text-xs text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30" type="number" placeholder="inf" value={rawFilters.maxSlaap} onChange={e => setRawFilters(f => ({ ...f, maxSlaap: e.target.value }))} />
              </div>
            </div>

            <div className="pt-2.5 mt-1 border-t border-yd-border">
              <div className="text-[10px] uppercase tracking-wider text-yd-muted font-semibold mb-2">Contactgegevens aanwezig</div>
              <div className="flex gap-4 items-center flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer">
                  <input type="checkbox" checked={rawFilters.heeftTelefoon} onChange={e => setRawFilters(f => ({ ...f, heeftTelefoon: e.target.checked }))} className="rounded border-yd-border" />
                  Telefoon
                </label>
                <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer">
                  <input type="checkbox" checked={rawFilters.heeftEmail} onChange={e => setRawFilters(f => ({ ...f, heeftEmail: e.target.checked }))} className="rounded border-yd-border" />
                  E-mail
                </label>
                <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer">
                  <input type="checkbox" checked={rawFilters.heeftWebsite} onChange={e => setRawFilters(f => ({ ...f, heeftWebsite: e.target.checked }))} className="rounded border-yd-border" />
                  Website
                </label>
              </div>
            </div>

            <div className="pt-2.5 mt-1 border-t border-yd-border">
              <div className="text-[10px] uppercase tracking-wider text-yd-muted font-semibold mb-2">Belstatus</div>
              <div className="flex gap-4 items-center flex-wrap">
                <FilterSelect
                  label=""
                  value={rawFilters.belstatus}
                  onChange={v => setRawFilters(f => ({ ...f, belstatus: v }))}
                  options={[
                    ["", "Alle statussen"],
                    ["terugbellen", "Terugbellen"],
                    ["interesse", "Interesse"],
                    ["afgewezen", "Niet geïnteresseerd"],
                  ]}
                />
              </div>
            </div>
            <div className="pt-2 mt-1 border-t border-yd-border">
              <div className="text-[10px] uppercase tracking-wider text-yd-muted font-semibold mb-1">AI-signalen</div>
              <div className="flex gap-4 items-center flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer">
                  <input type="checkbox" checked={rawFilters.heeftAi} onChange={e => setRawFilters(f => ({ ...f, heeftAi: e.target.checked }))} className="rounded border-yd-border" />
                  Alleen AI-gescand
                </label>
                <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer" title="Verberg panden waar telefoon/email waarschijnlijk een makelaar of agentuur is">
                  <input type="checkbox" checked={rawFilters.geenAgentuur} onChange={e => setRawFilters(f => ({ ...f, geenAgentuur: e.target.checked }))} className="rounded border-yd-border" />
                  Geen agentuur/makelaar
                </label>
              </div>
            </div>

            <div className="pt-2.5 mt-1 border-t border-yd-border flex items-center gap-4 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-yd-muted font-semibold">Zichtbaarheid</span>
              <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer">
                <input type="checkbox" checked={rawFilters.toonVerborgen} onChange={e => setRawFilters(f => ({ ...f, toonVerborgen: e.target.checked }))} className="rounded border-yd-border" />
                Toon verborgen
              </label>
              <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer">
                <input type="checkbox" checked={rawFilters.toonAfgewezen} onChange={e => setRawFilters(f => ({ ...f, toonAfgewezen: e.target.checked }))} className="rounded border-yd-border" />
                Toon afgewezen
              </label>
              <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer">
                <input type="checkbox" checked={rawFilters.toonInteresse} onChange={e => setRawFilters(f => ({ ...f, toonInteresse: e.target.checked }))} className="rounded border-yd-border" />
                Toon interesse
              </label>
              <label className="flex items-center gap-1.5 text-xs text-yd-muted cursor-pointer">
                <input type="checkbox" checked={rawFilters.toonTerugbellen} onChange={e => setRawFilters(f => ({ ...f, toonTerugbellen: e.target.checked }))} className="rounded border-yd-border" />
                Toon terugbellen
              </label>
              <button
                type="button"
                className="ml-auto text-xs text-yd-muted cursor-pointer underline hover:text-yd-black transition-colors"
                onClick={() =>
                  {
                    setRawFilters(initialFilters);
                    applyFilters(initialFilters);
                  }
                }
              >
                Filters wissen
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-yd-red py-2 px-4 text-sm border-b border-red-200">
          ! {error} — <span className="cursor-pointer underline" onClick={() => laadPanden(1, filters)}>opnieuw proberen</span>
        </div>
      )}

      {/* PANDENLIJST — same horizontal padding as filter bar */}
      <div className="pt-5 px-4 md:px-8 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 min-[400px]:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 items-stretch">
        {loading && <div className="text-center text-yd-muted py-6 text-sm">Panden ophalen uit Toerisme Vlaanderen...</div>}

        {displayMode === "table" && (
          <div className="col-span-full w-full max-w-full overflow-x-auto rounded-card border border-yd-border bg-white shadow-card mt-3">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="bg-yd-bg border-b-2 border-yd-border">
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Naam</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">
                    <button type="button" onClick={() => setSorteer(s => s === "score" ? s : "score")} className="font-semibold text-yd-black hover:text-yd-red transition-colors underline-offset-2 hover:underline">Score</button>
                  </th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Straat</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Stad</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Postcode</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Telefoon</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">E-mail</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Status</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Slaappl.</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Platform</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Agentuur</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Uitkomst</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-yd-black">Actie</th>
                </tr>
              </thead>
              <tbody>
                {zichtbaar.map((p, i) => {
                  const ai = getCardAi(p.id, p);
                  const fullAi = enriched[p.id];
                  const platformLabels = [];
                  if (ai?.airbnb?.gevonden) platformLabels.push("Airbnb");
                  if (ai?.booking?.gevonden) platformLabels.push("Booking");
                  const platformStr = platformLabels.length ? platformLabels.join(", ") : "—";
                  const agentuurStr = (
                    enriched[p.id]?.waarschuwingAgentuur ||
                    isLikelyAgency(p, enriched[p.id] || null) ||
                    (p.phoneNorm && (phoneGroups[p.phoneNorm]?.length || 0) >= 4)
                  ) ? "⚠ Ja" : "—";
                  const rowOutcome = outcomes[p.id];
                  const scoreNum = fullAi?.prioriteit != null ? String(Math.min(99, Math.max(0, fullAi.prioriteit * 10))).padStart(2, "0") : (fullAi?.score === "HEET" ? "85" : fullAi?.score === "WARM" ? "60" : fullAi?.score === "KOUD" ? "40" : null);
                  const hasPhone = !!(p.phone || p.phone2 || p["contact-phone"] || p.telefoon || p.phone1 || (Array.isArray(p.phones) && p.phones.length > 0));
                  return (
                  <tr
                    key={p.id || i}
                    className={`border-b border-yd-border cursor-pointer hover:bg-[#F8FAFC] transition-colors ${enriched[p.id]?.score === "HEET" ? "bg-amber-50/80" : "bg-white even:bg-yd-bg/50"}`}
                    onClick={() => {
                      setListSnapshot({ filters: { ...filters }, rawFilters: { ...rawFilters }, page, sorteer, displayMode });
                      setSelected(p);
                      setView("dossier");
                      if (!enriched[p.id] && !enrichingIds.has(p.id)) {
                        const portfolio = p.phoneNorm && phoneGroups[p.phoneNorm]?.length > 1
                          ? { count: phoneGroups[p.phoneNorm].length, names: phoneGroups[p.phoneNorm].map(id => properties.find(x => x.id === id)?.name || id) }
                          : null;
                        setEnrichingIds(s => new Set([...s, p.id]));
                        enrichProperty(p, portfolio)
                          .then(result => { setEnriched(prev => { const u = { ...prev, [p.id]: result }; save("enriched", u); return u; }); })
                          .catch(() => {})
                          .finally(() => setEnrichingIds(s => { const n = new Set(s); n.delete(p.id); return n; }));
                      }
                    }}
                  >
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        className="text-left w-full text-[#1A1A1A] font-semibold hover:underline focus:outline-none focus:underline"
                        onClick={e => { e.stopPropagation(); setListSnapshot({ filters: { ...filters }, rawFilters: { ...rawFilters }, page, sorteer, displayMode }); setSelected(p); setView("dossier"); if (!enriched[p.id] && !enrichingIds.has(p.id)) { const portfolio = p.phoneNorm && phoneGroups[p.phoneNorm]?.length > 1 ? { count: phoneGroups[p.phoneNorm].length, names: phoneGroups[p.phoneNorm].map(id => properties.find(x => x.id === id)?.name || id) } : null; setEnrichingIds(s => new Set([...s, p.id])); enrichProperty(p, portfolio).then(result => { setEnriched(prev => { const u = { ...prev, [p.id]: result }; save("enriched", u); return u; }); }).catch(() => {}).finally(() => setEnrichingIds(s => { const n = new Set(s); n.delete(p.id); return n; })); } }}
                      >
                        {p.name || "—"}
                      </button>
                    </td>
                    <td className="py-2 px-3">
                      {scoreNum != null ? <span className="inline-flex rounded-[999px] bg-[#1A1A1A] text-white text-xs px-3 py-0.5 font-medium">{scoreNum}</span> : "—"}
                    </td>
                    <td className="py-2 px-3 text-yd-muted">{p.street || "—"}</td>
                    <td className="py-2 px-3 text-yd-muted">{p.municipality || "—"}</td>
                    <td className="py-2 px-3 text-yd-muted">{p.postalCode || "—"}</td>
                    <td className="py-2 px-3">
                      {(() => {
                        const num = p.phone || p.phone2 || p["contact-phone"] || p.telefoon || p.phone1 || (Array.isArray(p.phones) && p.phones[0]) || "";
                        return num ? <span className="text-[#1A1A1A] font-semibold">{num}</span> : <span className="text-[#E8231A]">—</span>;
                      })()}
                    </td>
                    <td className="py-2 px-3 text-yd-muted">{p.email || "—"}</td>
                    <td className="py-2 px-3 text-yd-muted">{p.status || "—"}</td>
                    <td className="py-2 px-3 text-yd-muted">{p.slaapplaatsen ?? p.sleepPlaces ?? "—"}</td>
                    <td className="py-2 px-3 text-yd-muted text-xs">{platformStr}</td>
                    <td className={`py-2 px-3 text-xs ${enriched[p.id]?.waarschuwingAgentuur ? "text-orange-700 font-medium" : "text-yd-muted"}`}>{agentuurStr}</td>
                    <td className="py-2 px-3">
                      {rowOutcome && rowOutcome !== "none" && rowOutcome !== "verborgen" ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${rowOutcome === "afgewezen" ? "bg-[#E8231A]/50" : rowOutcome === "callback" || rowOutcome === "terugbellen" ? "bg-[#EA580C]/50" : "bg-[#22C55E]/50"}`}>
                          {rowOutcome === "afgewezen" ? "Afgewezen" : rowOutcome === "callback" || rowOutcome === "terugbellen" ? "Terugbellen" : "Interesse"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                      {hasPhone ? (
                        <a href={`tel:${p.phone || p.phone2 || p["contact-phone"] || p.telefoon || p.phone1 || (Array.isArray(p.phones) && p.phones[0]) || ""}`} className="inline-flex items-center rounded-[999px] bg-[#1A1A1A] text-white text-xs font-medium px-3 py-1 hover:opacity-90 no-underline" onClick={e => e.stopPropagation()}>Bel</a>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {displayMode !== "table" && zichtbaar.map((prop, idx) => {
          const ai = getCardAi(prop.id, prop);
          const fullAi = enriched[prop.id];
          const uitkomst = outcomes[prop.id];
          const isVerborgen = hidden.includes(prop.id);
          const heeftPortfolio = prop.phoneNorm && (phoneGroups[prop.phoneNorm]?.length || 0) > 1;
          const portfolioAantal = heeftPortfolio ? phoneGroups[prop.phoneNorm].length : 0;
          return (
            <PropertyCard
              key={prop.id}
              prop={prop}
              fullAi={fullAi}
              ai={ai}
              outcome={uitkomst}
              enriching={enrichingIds.has(prop.id)}
              isVerborgen={isVerborgen}
              heeftPortfolio={heeftPortfolio}
              portfolioAantal={portfolioAantal}
              uitkomstLabel={uitkomstLabel}
              onCardClick={() => {
                setListSnapshot({ filters: { ...filters }, rawFilters: { ...rawFilters }, page, sorteer, displayMode });
                setSelected(prop);
                setView("dossier");
                if (!enriched[prop.id] && !enrichingIds.has(prop.id)) {
                  const portfolio = prop.phoneNorm && phoneGroups[prop.phoneNorm]?.length > 1
                    ? { count: phoneGroups[prop.phoneNorm].length, names: phoneGroups[prop.phoneNorm].map(id => properties.find(p => p.id === id)?.name || id) }
                    : null;
                  setEnrichingIds(s => new Set([...s, prop.id]));
                  enrichProperty(prop, portfolio)
                    .then(result => { setEnriched(prev => { const u = { ...prev, [prop.id]: result }; save("enriched", u); return u; }); })
                    .catch(() => {})
                    .finally(() => setEnrichingIds(s => { const n = new Set(s); n.delete(prop.id); return n; }));
                }
              }}
              onAfgewezen={() => verbergPand(prop.id, "afgewezen")}
              onOutcome={v => slaUitkomstOp(prop.id, v)}
              phoneGroups={phoneGroups}
              onInteresseClick={(p) => setInteressePopupProp(p)}
              animationStyle={{ animation: `fadeUp 0.3s ease ${idx * 0.03}s both` }}
            />
          );
        })}

        {!loading && zichtbaar.length === 0 && (
          <div className="text-center text-yd-muted py-10 text-sm">Geen panden gevonden met deze filters.</div>
        )}

        {/* INTERESSE POPUP (from card) */}
        {interessePopupProp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setInteressePopupProp(null)}>
            <div className="bg-white rounded-xl border border-[#EBEBEB] shadow-xl max-w-md w-full p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-[#1A1A1A] font-nunito">{interessePopupProp.name}</h3>
                <button type="button" className="text-[#888888] hover:text-[#1A1A1A] text-2xl leading-none p-1" onClick={() => setInteressePopupProp(null)} aria-label="Sluiten">&times;</button>
              </div>
              <div className="flex flex-col gap-2">
                <a href={buildGoogleMeetUrl(interessePopupProp, getCardAi(interessePopupProp.id, interessePopupProp), notes[interessePopupProp.id] || "")} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-white border border-[#EBEBEB] text-[#1A1A1A] text-sm font-bold no-underline hover:bg-[#FAFAFA] transition-colors text-center">Meeting plannen</a>
                <a href={buildInternalDebriefUrl(interessePopupProp, getCardAi(interessePopupProp.id, interessePopupProp), notes[interessePopupProp.id] || "")} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-white border border-[#EBEBEB] text-[#1A1A1A] text-sm font-bold no-underline hover:bg-[#FAFAFA] transition-colors text-center">Intern debrief</a>
                {!mondayActief ? (
                  <button type="button" onClick={() => { setInteressePopupProp(null); setView("config"); }} className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#EBEBEB] text-[#888888] text-sm cursor-pointer hover:bg-[#FAFAFA] transition-colors">Monday koppelen</button>
                ) : mondayStatus[interessePopupProp.id] === "ok" ? (
                  <button type="button" disabled className="w-full py-2.5 px-4 rounded-xl bg-[#E5E7EB] text-[#9CA3AF] text-sm font-semibold cursor-default border border-[#EBEBEB]">In Monday</button>
                ) : (
                  <button type="button" className="w-full py-2.5 px-4 rounded-xl bg-[#E8231A] text-white text-sm font-bold border-none cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center gap-2" onClick={() => {
                    const prop = interessePopupProp;
                    const ai = enriched[prop.id];
                    const outcome = outcomes[prop.id];
                    const note = notes[prop.id] || "";
                    const contactNaam = load("contactnamen", {})[prop.id] || prop.name;
                    setMondaySyncing(s => new Set([...s, prop.id]));
                    setMondayStatus(s => ({ ...s, [prop.id]: "bezig" }));
                    syncMondayCRM(prop, ai, outcome, note, contactNaam, user?.username)
                      .then(() => setMondayStatus(s => ({ ...s, [prop.id]: "ok" })))
                      .catch(e => { setMondayStatus(s => ({ ...s, [prop.id]: "fout" })); setMondayFout(s => ({ ...s, [prop.id]: e.message || String(e) })); })
                      .finally(() => setMondaySyncing(s => { const n = new Set(s); n.delete(prop.id); return n; }));
                  }}>Push to Monday CRM</button>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* PAGINERING */}
      <div className="flex justify-between items-center py-4 px-4 md:px-8 max-w-[1400px] mx-auto border-t border-yd-border mt-1">
        <button
          type="button"
          className="rounded-btn py-2 px-3 border border-yd-black bg-white text-yd-black font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yd-bg transition-colors duration-150"
          disabled={page <= 1}
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            const next = page - 1;
            setPage(next);
            fetchTokenRef.current += 1;
            const myToken = fetchTokenRef.current;
            laadPanden(next, filters, myToken);
          }}
        >« Vorige</button>
        <span className="text-xs text-yd-muted">~{totalCount} panden</span>
        <button
          type="button"
          className="rounded-btn py-2 px-3 border border-yd-black bg-white text-yd-black font-semibold text-sm hover:bg-yd-bg transition-colors duration-150"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            const next = page + 1;
            setPage(next);
            const cached = nextPageCacheRef.current;
            if (cached && cached.page === next) {
              const items = cached.items || [];
              const meta = cached.meta || {};
              if (!items.length) return;
              setProperties(items);
              const total = Math.max(0, parseInt(meta?.total, 10) || meta?.count || items.length || 0);
              setTotalCount(total);
              const dbTotal = Math.max(0, parseInt(meta?.dbTotal, 10) || 0);
              if (dbTotal) setDbTotalCount(dbTotal);
              const groups = {};
              items.forEach(it => {
                if (it.phoneNorm) {
                  if (!groups[it.phoneNorm]) groups[it.phoneNorm] = [];
                  groups[it.phoneNorm].push(it.id);
                }
              });
              setPhoneGroups(groups);
              if (items.length > 0) setSelected(items[0]);
              const pagesUsed = Math.max(1, Math.ceil(items.length / 50));
              lastPageLoadedRef.current = next + pagesUsed - 1;
              nextPageCacheRef.current = null;
              preloadNextPage(next, filters, sorteer);
            } else {
              fetchTokenRef.current += 1;
              const myToken = fetchTokenRef.current;
              laadPanden(next, filters, myToken);
            }
          }}
        >Volgende »</button>
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

  const sectionHeaderClass = "text-xs font-bold tracking-[0.1em] text-[#888888] uppercase mb-3";
  return (
    <div className="min-h-screen bg-[#FAFAFA] font-nunito text-yd-black max-w-[1400px] mx-auto px-4 md:px-8 relative">
      <style>{globalCSS}</style>

      {/* NAV: Terug + pagination */}
      <div className="bg-white border-b border-[#EBEBEB] py-3 px-4 flex justify-between items-center sticky top-0 z-50">
        <button type="button" className="bg-transparent border-none text-[#E8231A] cursor-pointer text-sm font-semibold hover:underline font-nunito" onClick={onTerug}>« Terug naar lijst</button>
        <div className="flex items-center gap-1">
          <button type="button" className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] text-[#1A1A1A] disabled:opacity-50 cursor-pointer hover:bg-[#EBEBEB] transition-colors" onClick={onVorige} disabled={currentIdx <= 1}><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-[#888888] min-w-[4rem] text-right tabular-nums">{currentIdx} / {total}</span>
          <button type="button" className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] text-[#1A1A1A] disabled:opacity-50 cursor-pointer hover:bg-[#EBEBEB] transition-colors" onClick={onVolgende} disabled={currentIdx >= total}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="overflow-y-auto pb-36">

        {/* HEADER: name, address, status */}
        <div className="pt-5 animate-[fadeUp_0.4s_ease_both]" style={{ animationName: "fadeUp" }}>
          <div className="flex justify-between items-start gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-nunito font-extrabold text-3xl text-[#1A1A1A] leading-tight mb-1">{property.name}</h1>
              <div className="text-sm text-[#888888] leading-snug">
                {[property.street, property.postalCode, property.municipality, property.province].filter(Boolean).join(", ")}
              </div>
            </div>
            <span className={`rounded-[999px] py-1.5 px-3 text-xs font-semibold flex-shrink-0 ${property.status === "erkend" ? "bg-[#22C55E] text-white" : "bg-[#E5E7EB] text-[#374151]"}`}>
              {(property.status || "aangemeld").toUpperCase()}
            </span>
          </div>

          {/* STATS BAR: white card, 4 cols, dividers — icon + value only */}
          <div className="flex flex-wrap rounded-xl border border-[#EBEBEB] bg-white overflow-hidden">
            {[
              ["🛏", property.sleepPlaces ?? property.slaapplaatsen ?? "—"],
              ["🏠", property.units ?? "1"],
              ["*", property.starRating || "—"],
              ["📋", property.registrationNumber?.slice(-8) || property.id?.slice(-8) || "—"],
            ].map(([icoon, val], i) => (
              <div key={i} className={`flex items-center gap-2 flex-1 min-w-[120px] py-3 px-4 ${i > 0 ? "border-l border-[#EBEBEB]" : ""}`}>
                <span className="text-lg">{icoon}</span>
                <span className="font-bold text-base text-[#1A1A1A] truncate">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PORTFOLIO BANNER */}
        {heeftPortfolio && (
          <div className="pt-5 animate-[fadeUp_0.4s_ease_0.05s_both]" style={{ animationName: "fadeUp" }}>
            <div className="bg-amber-50 border border-amber-200 rounded-card p-4">
              <div className="flex items-start gap-2.5 mb-3">
                <span className="text-xl">🏘</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-amber-800 mb-0.5">Portfolio eigenaar</div>
                  <div className="text-xs text-amber-700">Hoge prioriteit - gebruik portfolio management hoek in openingszin</div>
                </div>
                <span className="bg-amber-500 text-white rounded px-2 py-0.5 text-[9px] font-bold tracking-wider whitespace-nowrap">HOGE WAARDE</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {portfolioPanden.map(p => (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-md bg-white/50 cursor-pointer hover:bg-amber-100/80 transition-colors" onClick={() => onSelectPand && onSelectPand(p)}>
                    <MapPin className="w-3.5 h-3.5 text-yd-muted flex-shrink-0" />
                    <span className="text-sm font-medium text-yd-black flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-yd-muted">{p.municipality}</span>
                    <span className="text-score-interesse font-semibold text-sm">→</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CONTACTGEGEVENS */}
        <div className="pt-6 animate-[fadeUp_0.4s_ease_0.05s_both]" style={{ animationName: "fadeUp" }}>
          <div className={sectionHeaderClass}>Contactgegevens</div>
          <div className="mb-3 py-2.5 px-3 bg-white rounded-xl border border-[#EBEBEB]">
            <label className="block text-xs text-[#888888] mb-1.5">
              Naam contactpersoon
              <span className={ai?.waarschuwingAgentuur ? " text-yd-red italic" : " text-[#888888]"}>{ai?.waarschuwingAgentuur ? " ! mogelijk agentuur - vraag naar beslissingsnemer" : " - invullen tijdens gesprek"}</span>
            </label>
            <input
              className="w-full bg-white border border-[#EBEBEB] rounded-xl py-2 px-3 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-yd-red/30"
              placeholder={ai?.waarschuwingAgentuur ? "Naam eigenaar / beslissingsnemer..." : "Voornaam Achternaam..."}
              value={contactNaam}
              onChange={e => onSaveContactNaam && onSaveContactNaam(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            {property.phone && (
              <div className="flex items-center gap-2.5 py-2.5 px-3 bg-white rounded-xl border border-[#EBEBEB]">
                <span className="text-sm flex-shrink-0">📞</span>
                <span className="text-xs text-[#888888] w-20 flex-shrink-0">Mobiel</span>
                <span className="text-sm font-medium truncate text-[#1A1A1A] min-w-0">{property.phone}</span>
                <a href={`tel:${property.phone}`} className="text-sm font-bold text-[#E8231A] no-underline hover:underline cursor-pointer font-nunito flex-shrink-0 ml-1">Bel nu</a>
              </div>
            )}
            {property.phone2 && <ContactRegel icoon="📞" label="Telefoon 2" val={property.phone2} href={`tel:${property.phone2}`} />}
            {!property.phone && !property.phone2 && !property.email && <div className="text-xs text-[#888888] italic py-1">⏳ Contactgegevens worden opgehaald...</div>}
            {property.email && <ContactRegel icoon="@" label="E-mail" val={property.email} href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(property.email)}`} />}
            {property.website && <ContactRegel icoon="🌐" label="Website" val={property.website} href={property.website.startsWith("http") ? property.website : "https://" + property.website} />}
            {property.street && <ContactRegel icoon="📍" label="Straat" val={`${property.street}${property.postalCode ? ", " + property.postalCode : ""}${property.municipality ? " " + property.municipality : ""}`} href={`https://maps.google.com/?q=${encodeURIComponent([property.street, property.postalCode, property.municipality].filter(Boolean).join(" "))}`} />}
            <ContactRegel icoon="🔖" label="TV Register" val={property.registrationNumber?.slice(-12) || property.id?.slice(-12)} href={property.rawUrl} />
          </div>
        </div>

        {enriching && (
          <div className="pt-5">
            <LaadSkeleton />
          </div>
        )}
        {!enriching && ai && (
          <div>
            {/* OMZET ANALYSE */}
            {(ai.geschatMaandelijksInkomen || ai.potentieelMetYourDomi) && (
              <div className="pt-6 animate-[fadeUp_0.4s_ease_0.05s_both]" style={{ animationName: "fadeUp" }}>
                <div className={sectionHeaderClass}>Omzet analyse</div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                  <div className="bg-white border border-[#EBEBEB] rounded-xl p-5">
                    <div className="text-xs text-[#888888] mb-1.5">Huidig (geschat)</div>
                    <div className="text-2xl font-extrabold text-[#374151] mb-0.5">{ai.geschatMaandelijksInkomen || "-"}</div>
                    <div className="text-xs text-[#888888] mb-1">per maand . {ai.geschatBezetting || "?"} bezet</div>
                    {ai.inkomensNota && <div className="text-xs text-[#888888] leading-snug mt-1">{ai.inkomensNota}</div>}
                  </div>
                  {ai.potentieelMetYourDomi && (() => {
                    const parseRevenue = (s) => {
                      if (!s || typeof s !== "string") return null;
                      const m = s.match(/[\d.,]+/);
                      if (!m) return null;
                      const num = parseInt(m[0].replace(/[.\s]/g, ""), 10);
                      return Number.isFinite(num) ? num : null;
                    };
                    const huidigNum = parseRevenue(ai.geschatMaandelijksInkomen);
                    const metNum = parseRevenue(ai.potentieelMetYourDomi);
                    const pct = (huidigNum != null && metNum != null && huidigNum > 0)
                      ? Math.round(((metNum - huidigNum) / huidigNum) * 100)
                      : null;
                    return (
                      <>
                        <div className="hidden md:flex flex-col items-center justify-center gap-1 py-2">
                          {pct != null && (
                            <span className="text-lg font-extrabold text-[#22C55E]">+{pct}%</span>
                          )}
                          <span className="text-xs text-[#888888]">revenue increase</span>
                        </div>
                        <div className="bg-[#F8FAFC] border-2 border-[#1A1A1A] rounded-xl p-5 relative">
                          <span className="absolute top-0 right-0 bg-[#E8231A] text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-bl-lg">Aanbevolen</span>
                          <div className="text-xs text-[#888888] mb-1.5">Met yourdomi.be</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-2xl font-extrabold text-[#1A1A1A]">{ai.potentieelMetYourDomi}</span>
                            <TrendingUp className="w-6 h-6 text-[#22C55E] flex-shrink-0" aria-hidden />
                          </div>
                          {pct != null && <div className="text-sm font-semibold text-[#22C55E] mt-1 md:hidden">+{pct}% revenue increase</div>}
                          <div className="text-xs text-[#888888] mb-1">per maand (prognose)</div>
                          {ai.potentieelNota && <div className="text-xs text-[#374151] leading-snug">{ai.potentieelNota}</div>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* VERKOOPINTELLIGENTIE */}
            <div className="pt-6 animate-[fadeUp_0.4s_ease_0.08s_both]" style={{ animationName: "fadeUp" }}>
              <div className={sectionHeaderClass}>Verkoopintelligentie</div>
              <div className="bg-white border border-[#EBEBEB] rounded-xl p-5">
                <div className="font-bold text-base text-[#1A1A1A] mb-2">Samenvatting</div>
                <p className="text-sm text-[#374151] leading-relaxed m-0">
                  {[ai.scoreReden, ai.pitchhoek, ai.eigenaarProfiel].filter(Boolean).join(" ")}
                </p>
                {(ai.locatieHighlights?.length || 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ai.locatieHighlights.map((h, i) => (
                      <span key={i} className="rounded-[999px] px-3 py-1 text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">{h}</span>
                    ))}
                  </div>
                )}
                {(ai.zwaktes?.length || 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ai.zwaktes.map((z, i) => (
                      <span key={i} className="rounded-[999px] px-3 py-1 text-xs font-medium bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA]">{z}</span>
                    ))}
                  </div>
                )}
                {(ai.reviewThemes?.length || 0) > 0 && (
                  <ul className="mt-3 ml-2.5 pl-4 text-sm text-[#374151] leading-relaxed list-disc">
                    {ai.reviewThemes.map((theme, i) => (
                      <li key={i}>{theme}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {(ai?.waarschuwingAgentuur ||
              isLikelyAgency(property, ai || null)) && (
              <div className="pt-6 animate-[fadeUp_0.4s_ease_0.08s_both]" style={{ animationName: "fadeUp" }}>
                <div className="bg-orange-50 border border-orange-300 rounded-xl py-3 px-4 flex gap-3 items-start">
                  <span className="text-lg text-orange-600 font-bold">!</span>
                  <div>
                    <div className="font-bold text-sm text-orange-800 mb-0.5">Mogelijk beheersbedrijf / agentuur</div>
                    <div className="text-xs text-orange-700 leading-relaxed">{ai.agentuurSignalen || "Dit telefoonnummer of e-mailadres is mogelijk van een beheerskantoor, niet de eigenaar. Vraag altijd naar de eigenaar of beslissingsnemer."}</div>
                  </div>
                </div>
              </div>
            )}

            {/* CONSULTIEVE VRAGEN */}
            {ai.consultieveVragen?.length > 0 && (
              <div className="pt-6 animate-[fadeUp_0.4s_ease_0.12s_both]" style={{ animationName: "fadeUp" }}>
                <div className={sectionHeaderClass}>Consultieve vragen <span className="text-[#E8231A] font-semibold normal-case">- laat hen zichzelf verkopen</span></div>
                <div className="bg-white border border-[#EBEBEB] rounded-xl overflow-hidden">
                  {ai.consultieveVragen.map((v, i) => (
                    <div key={i} className={`flex gap-3 items-start py-3 px-4 ${i < ai.consultieveVragen.length - 1 ? "border-b border-[#EBEBEB]" : ""}`}>
                      <span className="w-6 h-6 rounded-full bg-[#1A1A1A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <p className="text-sm text-[#374151] leading-relaxed m-0">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ONLINE AANWEZIGHEID */}
            <div className="pt-6 animate-[fadeUp_0.4s_ease_0.2s_both]" style={{ animationName: "fadeUp" }}>
              <div className={sectionHeaderClass}>Online aanwezigheid</div>
              <div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-[#EBEBEB] bg-white">
                {[
                  { naam: "Airbnb", data: ai.airbnb, url: ai.airbnb?.url },
                  { naam: "Booking.com", data: ai.booking, url: ai.booking?.url },
                  { naam: "Eigen website", data: ai.directWebsite, url: ai.directWebsite?.url },
                ].map(({ naam, data, url }) => {
                  const gevonden = data?.gevonden;
                  return (
                    <div key={naam} className="flex items-center justify-between gap-3 py-3 px-4 border-b border-[#EBEBEB] last:border-b-0">
                      <span className="font-medium text-[#1A1A1A]">{naam}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-sm font-semibold ${gevonden ? "text-[#22C55E]" : "text-[#9CA3AF]"}`}>{gevonden ? "Gevonden" : "Niet gevonden"}</span>
                        {gevonden && url && <a href={url.startsWith("http") ? url : "https://" + url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#E8231A] no-underline hover:underline">Bekijk →</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* SNEL OPZOEKEN */}
        {(() => {
          const links = buildZoekLinks(property);
          return (
            <div className="pt-6 animate-[fadeUp_0.4s_ease_0.45s_both]" style={{ animationName: "fadeUp" }}>
              <div className={sectionHeaderClass}>Snel opzoeken</div>
              <div className="flex flex-wrap gap-2">
                <a href={links.google} target="_blank" rel="noreferrer" className="rounded-[999px] py-2 px-4 text-sm font-medium bg-white border border-[#EBEBEB] text-[#1A1A1A] no-underline hover:bg-[#FAFAFA] transition-colors">Google</a>
                <a href={links.airbnb} target="_blank" rel="noreferrer" className="rounded-[999px] py-2 px-4 text-sm font-medium bg-[#FF5A5F] text-white no-underline hover:opacity-90 transition-opacity">Airbnb</a>
                <a href={links.booking} target="_blank" rel="noreferrer" className="rounded-[999px] py-2 px-4 text-sm font-medium bg-[#003580] text-white no-underline hover:opacity-90 transition-opacity">Booking</a>
                <a href={links.googleImg} target="_blank" rel="noreferrer" className="rounded-[999px] py-2 px-4 text-sm font-medium bg-white border border-[#EBEBEB] text-[#1A1A1A] no-underline hover:bg-[#FAFAFA] transition-colors">Fotos</a>
                <a href={links.maps} target="_blank" rel="noreferrer" className="rounded-[999px] py-2 px-4 text-sm font-medium bg-white border border-[#EBEBEB] text-[#1A1A1A] no-underline hover:bg-[#FAFAFA] transition-colors">Maps</a>
              </div>
            </div>
          );
        })()}

        {/* JUSTCALL NOTITIES — hidden until JustCall connected */}
        {false && (
        <div className="pt-6 pb-4 animate-[fadeUp_0.4s_ease_0.48s_both]" style={{ animationName: "fadeUp" }}>
          <div className={sectionHeaderClass}>JustCall – AI notities</div>
          <p className="text-xs text-[#888888] mb-2">Plak het transcript van je JustCall-belgesprek (of ander beltranscript). Koppeling met JustCall volgt later. AI vult daarna automatisch uitkomst, contactnaam en belnotities in.</p>
          <MeetTranscriptNotetaker onFilled={(result) => { if (result.note) onNote(result.note); if (result.outcome) onOutcome(result.outcome); if (result.contactNaam && onSaveContactNaam) onSaveContactNaam(result.contactNaam); }} />
        </div>
        )}

        {/* BELNOTITIES */}
        <div className="pt-6 pb-8 animate-[fadeUp_0.4s_ease_0.5s_both]" style={{ animationName: "fadeUp" }}>
          <div className={sectionHeaderClass}>Belnotities</div>
          <textarea
            ref={noteRef}
            className="w-full bg-white border border-[#EBEBEB] rounded-xl p-4 text-sm text-[#1A1A1A] resize-none leading-relaxed outline-none focus:ring-2 focus:ring-yd-red/30 font-nunito"
            placeholder="Voeg notities toe voor dit pand... (automatisch opgeslagen)"
            value={note}
            onChange={e => onNote(e.target.value)}
            rows={6}
          />
        </div>
      </div>

      {/* ACTIE BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EBEBEB] py-4 px-4 z-50 safe-area-pb">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-sm font-semibold transition-colors border ${outcome === "afgewezen" ? "bg-[#E8231A] text-white border-[#E8231A] opacity-50" : "bg-white text-[#666666] border-[#EBEBEB] hover:bg-[#FAFAFA]"}`} onClick={() => onAfgewezen()}>Afwijzen</button>
            <button type="button" className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-sm font-semibold transition-colors border ${outcome === "callback" ? "bg-[#EA580C] text-white border-[#EA580C] opacity-50" : "bg-white text-[#666666] border border-[#EBEBEB] hover:bg-[#FAFAFA]"}`} onClick={() => onOutcome(outcome === "callback" ? null : "callback")}>Terugbellen</button>
            <button type="button" className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-sm font-semibold transition-colors border ${outcome === "gebeld_interesse" ? "bg-[#22C55E] text-[#1A1A1A] border-[#22C55E] opacity-50" : "bg-white text-[#666666] border-[#EBEBEB] hover:bg-[#FAFAFA]"}`} onClick={() => onOutcome(outcome === "gebeld_interesse" ? null : "gebeld_interesse")}>✓ Interesse</button>
          </div>

          {outcome === "gebeld_interesse" && (
            <>
              <div className="flex gap-2 flex-wrap">
                <a href={buildGoogleMeetUrl(property, ai, note)} target="_blank" rel="noreferrer" className="flex-1 min-w-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white border border-[#EBEBEB] text-[#1A1A1A] text-sm font-bold no-underline hover:bg-[#FAFAFA] transition-colors text-center">Meeting plannen</a>
                <a href={buildInternalDebriefUrl(property, ai, note)} target="_blank" rel="noreferrer" className="flex-1 min-w-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white border border-[#EBEBEB] text-[#1A1A1A] text-sm font-bold no-underline hover:bg-[#FAFAFA] transition-colors text-center">Intern debrief</a>
              </div>
              {mondaySyncing && <span className="text-xs text-[#888888]">(~) Syncing Monday...</span>}
              {!mondayActief ? (
                <button type="button" onClick={onOpenConfig} className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#EBEBEB] text-[#888888] text-sm cursor-pointer hover:bg-[#FAFAFA] transition-colors">Monday koppelen</button>
              ) : mondayStatus === "ok" ? (
                <button type="button" disabled className="w-full py-2.5 px-4 rounded-xl bg-[#E5E7EB] text-[#9CA3AF] text-sm font-semibold cursor-default border border-[#EBEBEB]">✓ In Monday</button>
              ) : (
                <button type="button" className="w-full py-2.5 px-4 rounded-xl bg-[#E8231A] text-white text-sm font-bold border-none cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center gap-2" onClick={() => onPushMonday && onPushMonday()}>
                  Push to Monday CRM
                </button>
              )}
              {mondayStatus === "fout" && mondayFoutMsg && (
                <div className="text-xs text-yd-red flex items-center gap-1">
                  <button type="button" onClick={onOpenConfig} className="underline">Config</button>
                  <span className="opacity-80 truncate">{mondayFoutMsg}</span>
                </div>
              )}
            </>
          )}

          <button type="button" className="text-xs text-[#888888] cursor-pointer underline hover:text-[#1A1A1A] transition-colors" onClick={onVerberg}>Pand verbergen uit lijst</button>
        </div>
      </div>
    </div>
  );
}

// --- HULP COMPONENTEN ---------------------------------------------------------
function SectieTitel({ children }) {
  return <div className="text-[11px] uppercase tracking-wider text-yd-muted font-semibold mb-3">{children}</div>;
}
function IntelKaart({ titel, tekst }) {
  return (
    <div className="bg-white border border-yd-border rounded-card p-3 shadow-card">
      <div className="font-bold text-sm text-yd-black mb-1">{titel}</div>
      <p className="text-sm text-yd-muted leading-relaxed m-0">{tekst}</p>
    </div>
  );
}
function ContactRegel({ icoon, label, val, href }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-2.5 px-3 bg-white rounded-xl border border-[#EBEBEB] no-underline text-[#1A1A1A] hover:bg-[#FAFAFA] transition-colors">
      <span className="text-sm flex-shrink-0">{icoon}</span>
      <span className="text-xs text-[#888888] w-20 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium truncate">{val}</span>
    </a>
  );
}
function Stat({ label, val, accent }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-xl font-extrabold ${accent ? "text-score-heet" : "text-yd-black"}`}>{val}</span>
      <span className="text-xs text-[#888888] tracking-wide">{label}</span>
    </div>
  );
}
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      {label ? <label className="text-[10px] uppercase tracking-wider text-yd-muted font-semibold">{label}</label> : null}
      <select className="bg-white border border-yd-border rounded-btn py-1.5 px-2.5 text-xs text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
function PlatformKaart({ naam, emoji, kleur, data, velden }) {
  const gevonden = data?.gevonden;
  return (
    <div className="bg-white border border-yd-border rounded-card p-2.5 shadow-card border-l-4 opacity-90" style={{ borderLeftColor: gevonden ? kleur : "#EBEBEB", opacity: gevonden ? 1 : 0.55 }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{emoji}</span>
        <span className="font-bold text-sm flex-1" style={{ color: gevonden ? kleur : undefined }}>{naam}</span>
        <span className="text-[10px] rounded-full py-0.5 px-2 font-semibold" style={{ background: gevonden ? kleur + "18" : "#FAFAFA", color: gevonden ? kleur : "#888888" }}>{gevonden ? "✓ Gevonden" : "Niet gevonden"}</span>
        {gevonden && data?.url && <a href={data.url} target="_blank" rel="noreferrer" className="text-xs font-semibold whitespace-nowrap" style={{ color: kleur }}>Bekijk →</a>}
      </div>
      {gevonden && velden.length > 0 && <div className="flex flex-wrap gap-2 pl-6">{velden.map((v, i) => <span key={i} className="text-xs text-yd-muted bg-yd-bg rounded px-1.5 py-0.5">{v}</span>)}</div>}
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
    <div className="min-h-screen bg-yd-bg font-nunito text-yd-black max-w-[1400px] mx-auto px-4 box-border overflow-x-hidden">
      <div className="bg-white border-b border-yd-border py-3.5 px-5 flex items-center gap-4 sticky top-0 z-50">
        <button type="button" onClick={onTerug} className="bg-transparent border-none text-yd-red cursor-pointer text-sm font-medium hover:underline">« Terug</button>
        <span className="font-bold text-lg text-yd-black">Integraties & Instellingen</span>
      </div>

      <div className="py-5 px-4 flex flex-col gap-4 max-w-[600px] mx-auto">

        <div className="bg-white rounded-card p-4 shadow-card border border-yd-border">
          <div className="flex gap-3.5 items-start mb-4">
            <span className="text-xl">📋</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-yd-black mb-0.5">Monday.com - Ongoing Deals</div>
              <div className="text-xs text-yd-muted leading-relaxed">Claude AI leest de belnotities en bepaalt automatisch welke velden in Monday worden ingevuld — geen handmatige kolom-koppeling nodig.</div>
            </div>
            {alKlaar && <span className="text-xs font-bold bg-emerald-100 text-score-interesse rounded-btn py-0.5 px-2 whitespace-nowrap">✓ Actief</span>}
          </div>

          <div className="mb-3">
            <label className="block text-[11px] uppercase tracking-wider text-yd-muted mb-1.5">
              API Token <a href="https://support.monday.com/hc/en-us/articles/360005144659" target="_blank" rel="noreferrer" className="text-score-interesse text-[10px]">waar vind ik dit? →</a>
            </label>
            <div className="flex gap-2">
              <input className="flex-1 min-w-0 bg-yd-bg border border-yd-border rounded-btn py-2 px-3 text-sm text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30" type="password" placeholder="eyJhbGci..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
              <button type="button" className="rounded-btn py-2 px-4 bg-emerald-50 border border-emerald-200 text-score-interesse font-semibold text-sm cursor-pointer whitespace-nowrap disabled:opacity-50" onClick={verbinden} disabled={loadingBoards || !apiKey}>{loadingBoards ? "..." : "Verbinden"}</button>
            </div>
            {testMsg && <div className={`text-xs mt-1.5 ${testMsg.ok ? "text-score-interesse" : "text-yd-red"}`}>{testMsg.tekst}</div>}
          </div>

          {boards.length > 0 && (
            <div className="mb-3">
              <label className="block text-[11px] uppercase tracking-wider text-yd-muted mb-1.5">Selecteer je Ongoing Deals board</label>
              <select className="w-full bg-yd-bg border border-yd-border rounded-btn py-2 px-3 text-sm text-yd-black outline-none focus:ring-2 focus:ring-yd-red/30" value={dealsBoardId} onChange={e => setDealsBoardId(e.target.value)}>
                <option value="">- selecteer board -</option>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {alKlaar && (
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-lg py-2.5 px-3.5 mt-2 text-xs text-score-interesse">
              ✨ <strong>Volledig automatisch</strong> — Claude AI leest je board kolommen en bepaalt zelf wat er ingevuld wordt op basis van de belnotities. Geen configuratie nodig.
              <div className="mt-1.5 text-yd-muted text-[11px]">Nieuwe leads landen in de groep <strong>"New - to be confirmed"</strong> · Stage, Next step en datum worden automatisch bepaald uit de notities</div>
            </div>
          )}

          {alKlaar && (
            <div className="bg-emerald-50 rounded-btn py-3 px-3.5 border border-emerald-200/50 mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <span className="text-sm text-yd-black">Board: <strong>{boards.find(b => b.id === dealsBoardId)?.name || dealsBoardId}</strong></span>
                <a href={`https://yourdomi.monday.com/boards/${dealsBoardId}`} target="_blank" rel="noreferrer" className="text-score-interesse text-xs font-semibold ml-auto">Bekijk →</a>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-card p-4 shadow-card border border-yd-border">
          <div className="flex gap-3.5 items-start">
            <span className="text-xl">📅</span>
            <div className="flex-1">
              <div className="font-bold text-sm text-yd-black mb-0.5">JustCall</div>
              <div className="text-xs text-yd-muted leading-relaxed">Bij "Interesse" verschijnt een knop - Google Agenda opent met onderwerp en pandinfo al ingevuld. Geen configuratie nodig.</div>
            </div>
            <span className="text-xs font-bold bg-emerald-100 text-score-interesse rounded-btn py-0.5 px-2">✓ Actief</span>
          </div>
        </div>

        <div className="bg-white rounded-card p-4 shadow-card border border-yd-border opacity-55">
          <div className="flex gap-3.5 items-start">
            <span className="text-xl">📞</span>
            <div className="flex-1">
              <div className="font-bold text-sm text-yd-black mb-0.5">JustCall <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">BINNENKORT</span></div>
              <div className="text-xs text-yd-muted leading-relaxed">Direct bellen vanuit de app + automatische call analyse en transcriptie</div>
            </div>
          </div>
        </div>

        <button type="button" className="rounded-btn py-3 px-6 bg-yd-black text-white font-bold text-sm border-0 cursor-pointer hover:bg-[#333] transition-colors duration-150 mt-1" onClick={() => onSave({ apiKey, dealsBoardId })}>Instellingen opslaan</button>
      </div>
    </div>
  );
}

function LaadSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[80, 120, 60, 100].map((w, i) => (
        <div key={i} className="rounded-lg bg-yd-border animate-pulse" style={{ height: i % 2 === 0 ? 14 : 70, width: `${w}%` }} />
      ))}
      <div className="text-center text-yd-muted text-xs tracking-wider mt-2 animate-pulse">AI ANALYSEERT DIT PAND...</div>
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

// --- GLOBALE CSS (fadeUp + scrollbar + responsive) ---------------------------
const globalCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { overflow-x: hidden; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #FAFAFA; }
  ::-webkit-scrollbar-thumb { background: #EBEBEB; border-radius: 3px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

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


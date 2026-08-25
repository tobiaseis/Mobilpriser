# Mobilpriser — plan for prissammenligning af telefoner med abonnement

Mål: en hjemmeside der dagligt henter kontantpris, afbetalingspris og abonnementspris
fra danske teleselskaber, regner den **reelle samlede pris** ud for hvert tilbud, og
viser prishistorik pr. telefon, så man kan se om et "tilbud" faktisk er billigt.

Alt skal kunne køre gratis: **GitHub Actions** (indsamling) + **Vercel Hobby** (website).

---

## 1. Startomfang

**Telefoner (fase 1):**

| Model | Varianter der følges |
|---|---|
| Samsung Galaxy S26 | 256 GB (evt. 512 GB) |
| Samsung Galaxy S26+ | 256 GB |
| Samsung Galaxy S26 Ultra | 256 GB / 512 GB |
| iPhone 17 | 256 GB |
| iPhone 17 Pro | 256 GB |

**Udbydere (fase 1):** YouSee, Telenor, Telmore, CBB, Call me.
**Senere:** 3, Telia, Oister, Greentel, eesy + kontantpris-referencer (Elgiganten, Power, Proshop, Apple).

Kendte URL-mønstre (fundet ved research):

```
telmore.dk/shop/mobiltelefoner/apple/iphone-17
telmore.dk/shop/mobiltelefoner/apple/iphone-17-pro
telenor.dk/shop/mobil/apple/apple-iphone-17-256gb-<farve>/
telenor.dk/shop/mobiler/apple/            (oversigt)
cbb.dk/shop/mobiltelefoner/samsung/galaxy-s26/
callme.dk/shop/samsung/samsung-galaxy-s26/
yousee.dk/shop/mobiltelefoner            (oversigt)
```

Varianter (lager/farve) ligger ofte i URL'en hos Telenor, men som valg på siden hos de
øvrige. Derfor skal scraperen både kunne *finde* produkt-URLs (discovery) og *læse
varianter* på produktsiden.

---

## 2. Hvorfor det her er sværere end "hent en pris"

De danske udbydere sælger næsten aldrig én pris. Et tilbud består typisk af:

- **udbetaling / engangsbeløb** (0 kr. hos de fleste)
- **månedlig afbetaling på telefonen** over 6/12/24 (nogle steder 36) måneder, rente- og gebyrfri
- **abonnementspris pr. måned**, ofte med **kampagnepris de første N måneder** ("2 mdr. gratis", "69 kr. de første 3 mdr., derefter 149 kr.")
- **bindingsperiode** der kan være kortere end afbetalingsperioden (fx binding 6 mdr., afbetaling 24 mdr.)
- **oprettelsesgebyr / fragt**
- **inkluderede tjenester** (YouSee Play, TV 2 Play, Viaplay) der ofte er gratis i 2 mdr. og derefter koster

Konsekvens: to tilbud kan **ikke** sammenlignes på "pris pr. måned". Hele fundamentet i
projektet er derfor en beregningsmodel, ikke scraperen. Scraperen skal hente
*komponenterne*, ikke en færdig pris.

---

## 3. Datamodel

Ét normaliseret `Offer`-objekt pr. (udbyder × telefonvariant × abonnement):

```ts
type Offer = {
  id: string;                    // provider:phone:variant:plan
  provider: 'yousee'|'telenor'|'telmore'|'cbb'|'callme';
  phone: { brand: string; model: string; storage: number; color?: string };
  url: string;

  cashPrice: number | null;      // kontantpris uden abonnement, hvis den findes
  upfront: number;               // udbetaling
  deviceMonthly: number;         // afbetaling pr. md.
  deviceMonths: number;          // 6 | 12 | 24 | 36

  plan: {
    name: string;
    monthly: number;             // normalpris
    campaignMonthly?: number;    // kampagnepris
    campaignMonths?: number;
    dataGb: number | 'unlimited';
    addons: string[];            // "TV 2 Play (2 mdr.)"
  };

  bindingMonths: number;
  setupFee: number;
  shippingFee: number;

  scrapedAt: string;             // ISO
  source: 'json-ld'|'next-data'|'api'|'dom';
  confidence: 'high'|'medium'|'low';
};
```

Alt gemmes som **filer i repoet** — ingen database, ingen driftsomkostning:

```
data/latest.json                 # nuværende tilbud (bygges ind i sitet)
data/history/2026-08-25.json     # daglige snapshots (fuld kopi)
data/history.jsonl               # append-only: én linje pr. (dag, offer-id, nøgletal)
data/reference/cash-prices.json  # markedskontantpriser (Elgiganten/Power/Apple)
```

`history.jsonl` holdes smal (dato, id, effectivePhonePrice, bindingMonths) så repoet ikke
eksploderer. Ved ~60 tilbud/dag er det ca. 2 MB om året.

---

## 4. Beregningsmodel — effektiv telefonpris

Hovedtallet på sitet er **den effektive telefonpris**: hvad tilbuddet i alt koster dig i
kroner, fra du trykker køb, til bindingen er ovre og telefonen er betalt.

### 4.1 Formlen

```
effektivTelefonpris = udbetaling + oprettelse + fragt
                    + Σ_{m=1..B} abonnementspris(m)        // B = bindingsperioden
                    + afbetalingPrMd × afbetalingsMdr       // hele afbetalingen

abonnementspris(m) = campaignMonthly hvis m ≤ campaignMonths, ellers monthly
```

Ét tal pr. tilbud, i kroner, direkte sammenligneligt med at gå ind i en butik og lægge
pengene på disken.

### 4.2 To ting formlen skal have styr på

**Restgæld når afbetalingen er længere end bindingen.** Det er almindeligt at binde sig i
6 måneder på et abonnement, mens telefonen afbetales over 24. Når bindingen slutter,
skylder du stadig 18 ydelser — dem kan du ikke gå fra ved at opsige abonnementet. Derfor
tælles **hele** afbetalingsperioden med, ikke kun de måneder der ligger inden for
bindingen. Restgælden vises som sin egen kolonne i tabellen, så det er synligt hvor stor
en del af prisen der ligger efter bindingen.

**Tilbud uden separat afbetaling.** Nogle udbydere lægger telefonen ind i
abonnementsprisen i stedet for en synlig afbetaling. Så er `afbetalingPrMd = 0`, og hele
beløbet ligger i abonnementsleddet. Formlen håndterer begge former uden særtilfælde — det
er netop derfor komponenterne hentes hver for sig frem for en færdig "pris pr. måned".

### 4.3 Sammenligning på tværs af forskellige bindingsperioder

Et tilbud med 6 måneders binding vil altid se billigere ud end et med 24 måneders binding,
fordi der tælles 18 måneders abonnement mindre med. Det er korrekt — men kun hvis man
rent faktisk skifter væk efter 6 måneder. Sitet har derfor to visninger:

- **Egen bindingsperiode** (standard). Tallet er præcis det, du binder dig til. Tabellen
  viser bindingslængden tydeligt ved siden af beløbet, så man ikke sammenligner 6 mdr.
  med 24 mdr. i blinde.
- **Fælles horisont** (12/24/36 mdr.). Måneder ud over bindingen tælles med til
  normalprisen, så tilbud med forskellig bindingslængde kan stilles op mod hinanden.

### 4.4 Er det faktisk billigt?

Ud over udbydernes rækker indeholder tabellen en **referencerække**:

```
reference = markedsKontantpris + billigsteSimOnly × B
```

altså: køb telefonen kontant og tag det billigste SIM-only abonnement ved siden af.
Et tilbud der ligger under referencen, er reelt billigere end at gøre det selv.

- 🟢 **under referencen** — reelt tilbud
- 🟡 **inden for ±300 kr.** — bekvemt, men ingen gevinst
- 🔴 **over referencen** — du betaler overpris for telefonen gennem abonnementet

Fælden er lav afbetaling kombineret med et abonnement, der er 60–80 kr. dyrere end
nødvendigt. Over 24 måneder er det 1.500–2.000 kr., der er gemt i månedsprisen.

Inkluderede streamingtjenester værdisættes til **0 kr. som standard** (kan slås til med en
selvvalgt værdi i UI'et) — ellers pynter man tilbuddene kunstigt.

### 4.5 Hvad der følges over tid

Tidsserien i statistikken er **effektiv telefonpris pr. (udbyder × telefonvariant)** —
samme tal som i tabellen. Så viser grafen ikke bare om listeprisen er faldet, men om
tilbuddet som helhed er blevet bedre.

## 5. Sådan hentes data

Rækkefølge pr. udbyder — billigste og mest stabile metode først:

1. **JSON-LD** (`<script type="application/ld+json">` med `Product`/`Offer`). Webshops
   udgiver den til Google; den er langt mere stabil end CSS-selektorer.
2. **Indlejret state** — `__NEXT_DATA__`, `__NUXT__` eller lignende. Giver ofte hele
   produktkataloget med varianter og afbetalingsplaner i ét hug.
3. **Internt JSON-API** — findes ved én gang at køre Playwright med netværkslog og se,
   hvad produktsiden selv kalder. Bedste udfald: derefter hentes priser med et enkelt
   `fetch` uden browser.
4. **Playwright + headless Chromium** som fallback, hvis priserne først dukker op efter
   JS-kørsel eller efter valg af variant.

Hver udbyder implementeres som en adapter med samme interface:

```ts
interface ProviderAdapter {
  id: string;
  discover(targets: PhoneTarget[]): Promise<ProductRef[]>;
  scrape(ref: ProductRef): Promise<Offer[]>;
}
```

**Robusthed** (vigtigere end dækning):
- `zod`-validering af hvert `Offer` før det accepteres
- fornuftsgrænser: kontantpris 1.000–25.000, månedspris 0–1.500, afbetaling 6–36 mdr.
- fejler en udbyder → behold gårsdagens data, markér `stale: true`, skriv advarsel i
  Actions-summary. **Aldrig** commit af halve/tomme data.
- fixture-tests: gemt HTML pr. udbyder i `tests/fixtures/`, så parserne kan testes uden net
- ændrer et site sig, fanges det af enten zod, fornuftsgrænserne eller en
  "pris ændret >40 % på én dag"-kontrol

**God opførsel:** 1 kørsel i døgnet, ~1 request/sek., ærlig User-Agent med link til
projektet, `robots.txt` respekteres, ingen billeder/logoer kopieres, kilde-link og
"priser hentet <tidspunkt>" på hver visning. Ingen login, ingen persondata.

---

## 6. Teknisk arkitektur

```
Mobilpriser/
├─ apps/web/               Next.js 15 (App Router) → Vercel
│   ├─ app/                forside, /telefon/[slug], /om
│   └─ lib/                indlæsning af data/, beregninger til visning
├─ packages/core/          datamodel (zod), TCO-beregning, statistik  ← delt
├─ packages/scraper/       CLI + én adapter pr. udbyder
│   └─ src/providers/{yousee,telenor,telmore,cbb,callme}.ts
├─ config/phones.yaml      hvilke modeller/varianter der følges + slug-overrides
├─ data/                   snapshots + historik (committes af robotten)
└─ .github/workflows/
    ├─ scrape.yml          cron 05:10 UTC dagligt + manuel kørsel
    └─ ci.yml              typecheck, lint, tests på PR
```

TypeScript hele vejen, så `packages/core` deles mellem scraper og website — samme
beregning i indsamling og visning.

### Dataflow

```
GitHub Actions (cron)
   → scraper kører mod de 5 sites
   → validerer + normaliserer til Offer[]
   → skriver data/latest.json + data/history/<dato>.json + data/history.jsonl
   → commit & push til main
   → Vercel bygger automatisk på push (statisk site, ingen runtime-kald)
```

Websitet laver **ingen** requests til teleselskaberne. Alt er statisk genereret fra
committede data. Det er gratis, hurtigt og kan ikke bloede penge.

### Hvorfor det er gratis

- Offentligt GitHub-repo → ubegrænsede Actions-minutter (privat: 2.000 min./md., og
  kørslen tager ~3–5 min./dag ≈ 150 min./md., så det holder også privat)
- Vercel Hobby → gratis til ikke-kommercielt brug, auto-deploy ved push
- Ingen database, ingen cron-server, ingen serverless-scraping (som ville blive
  IP-blokeret og koste eksekveringstid)

---

## 7. Website — hvad man ser

**Forside:** de 5 telefoner som kort. Pr. telefon: "billigste reelle pris lige nu",
hvilken udbyder, og om det er historisk billigt.

**Telefonside (`/telefon/samsung-galaxy-s26-ultra-256gb`):**
- sammenligningstabel over alle udbyderes tilbud, sorteret efter valgt horisont
  (kolonner: udbyder, abonnement, binding, udbetaling, afbetaling/md., abonnement/md.,
  restgæld efter binding, **effektiv telefonpris**, vurdering 🟢🟡🔴)
- referencerække: "køb kontant + billigste SIM-only" — alt under den er et reelt tilbud
- kontroller: egen binding / fælles horisont (12/24/36), databehov (GB), værdi af streaming
- prisgraf: effektiv telefonpris over tid, én linje pr. udbyder
- statistikpanel: laveste nogensinde, median 90 dage, percentil for dagens pris,
  "prisen er faldet 3 gange på 60 dage"
- link til udbyderens side + tidsstempel

**Statistik-siden svarer på det egentlige spørgsmål:** er 8.499 kr. i dag godt, eller er
det bare den pris, den altid har haft? Derfor er percentil + "billigst nogensinde"-badge
vigtigere end selve grafen.

---

## 8. Faseplan

| Fase | Indhold | Resultat |
|---|---|---|
| **0** | Repo-skelet, TypeScript, pnpm workspace, `config/phones.yaml`, datamodel + zod i `packages/core` | Kan bygge og teste |
| **1** | Beregningsmodel + tests (effektiv telefonpris, restgæld, kampagneperioder, gebyrer) | Kernen virker, verificeret med håndregnede eksempler |
| **2** | **Én** udbyder ende-til-ende (Telmore — enkle produkt-URLs) inkl. fixture-test | Bevis for at metoden holder |
| **3** | De 4 øvrige udbydere, én ad gangen | `data/latest.json` med rigtige tal |
| **4** | Referencedata: billigste SIM-only pr. datakategori + markedskontantpriser | Kan svare på "er det billigt" |
| **5** | GitHub Actions: cron, commit-back, fejlhåndtering, Actions-summary | Kører af sig selv hver dag |
| **6** | Next.js-site: forside + telefonside + sammenligningstabel, deploy til Vercel | Offentligt website |
| **7** | Historik-grafer + statistikpanel (kræver ~2–4 ugers indsamlede data for at være interessant) | Det fulde produkt |
| **8** | Hærdning: alarm ved scraper-fejl, flere telefoner, flere udbydere | Vedligeholdelsesklar |

Fase 0–2 er det der afgør, om projektet holder. Kommer vi igennem fase 2 med rigtige tal
fra Telmore, er resten mekanisk arbejde.

---

## 9. Risici og hvad vi gør ved dem

| Risiko | Sandsynlighed | Håndtering |
|---|---|---|
| Bot-beskyttelse (Cloudflare/Akamai) blokerer Actions' IP | Middel | Rigtig browser via Playwright, lav frekvens, ærlig UA, retry med backoff. Bliver en udbyder ved med at blokere: markér som "ikke tilgængelig" i UI'et frem for at eskalere. Vi omgår ikke beskyttelse. |
| Sitet redesignes → parser knækker | **Høj** (sker et par gange om året pr. site) | JSON-LD/`__NEXT_DATA__` frem for CSS-selektorer, zod + fornuftsgrænser, fixture-tests, fejl = behold gamle data + advarsel |
| Priser afhænger af varevalg (farve/lager) og vises først i kurven | Høj | Discovery pr. variant; hvor prisen kun findes i flowet, gemmes `confidence: 'medium'` og det vises i UI'et |
| Kampagner er svære at parse ("2 mdr. gratis, derefter …") | Høj | Eksplicitte felter i modellen + regex-regler pr. udbyder + manuel gennemgang af de første snapshots |
| S26-modellerne føres ikke af alle udbydere | Middel | Manglende tilbud er et gyldigt resultat — vises som "ikke i sortiment" |
| Juridisk/ToS | Lav | Priser er fakta, ikke ophavsret. Vi henter offentlige sider i lavt tempo, kopierer ikke billeder/tekst, linker til kilden, angiver tidsstempel, ikke-kommercielt. Klar ansvarsfraskrivelse: bekræft altid prisen hos udbyderen. |
| Repoet vokser af daglige snapshots | Lav | Smal JSONL til historik, fulde snapshots komprimeres/tyndes ud efter 90 dage |

---

## 10. Åbne valg (mine standardantagelser, kan ændres)

1. **Horisont:** hvert tilbuds egen bindingsperiode som standard, med fælles horisont
   (12/24/36 mdr.) som ekstra visning.
2. **Restgæld på telefonen efter bindingen tælles med** i den effektive telefonpris —
   den kan man ikke gå fra ved at opsige abonnementet.
3. **Streamingværdi:** 0 kr. som standard, valgfrit tilvalg i UI'et.
4. **Referencerække:** markedskontantpris + billigste SIM-only i samme GB-kategori
   (kræver ekstra scraping, men uden den kan vi ikke svare på "er det billigt").
5. **Repo offentligt** (gratis Actions + gennemsigtighed) — kan også køre privat.
6. **Kun nye kunder, privat, uden mersalg** (forsikring, tilbehør) i første omgang.

---

## 11. Første skridt

Fase 0–2: repo-skelet, beregningsmodel med tests, og Telmore ende-til-ende.
Det er ~1 dags arbejde og giver et konkret `data/latest.json` med rigtige priser at
vurdere resten ud fra.

> Bemærk: netværkspolitikken i den nuværende sandkasse blokerer yousee.dk, telenor.dk,
> telmore.dk, cbb.dk og callme.dk, så de præcise selektorer/JSON-strukturer kan ikke
> verificeres herfra. Adapterne bygges derfor med fixture-drevne tests, og selve
> HTML-hentningen valideres første gang i GitHub Actions, hvor der er fri netadgang.

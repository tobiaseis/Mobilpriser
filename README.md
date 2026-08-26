# Mobilpriser

Sammenligner mindsteprisen for 6 måneders binding på telefon med abonnement hos danske
teleselskaber (YouSee, Telenor, Telmore, CBB, Call me). Se [PLAN.md](./PLAN.md) for den
fulde projektplan, beregningsmodel og risikovurdering.

## Sådan hænger det sammen

```
packages/core      Datamodel (zod) + mindsteprisberegning — delt af scraper og website
packages/scraper    Henter og validerer tilbud, skriver data/
apps/web            Next.js-website der udelukkende læser data/ — kalder aldrig udbyderne
config/phones.yaml  Hvilke telefoner der følges, og hvilke URLs der er bekræftet pr. udbyder
data/               Committede snapshots — latest.json, history/, history.jsonl, reference/
.github/workflows/  scrape.yml (daglig cron) + ci.yml (test/typecheck/build på PR)
```

Scraperen kører i GitHub Actions, committer resultatet til `data/`, og Vercel bygger
websitet statisk ud fra de committede filer. Websitet foretager ingen kald til
teleselskabernes sider.

## Beregningsmodellen kort

Bindingsperioden er lovbestemt til 6 måneder, så det er hele sammenligningsvinduet:

```
mindstepris = udbetaling + oprettelse + fragt
            + abonnement × 6 måneder
            + afbetaling × 6 måneder
```

De fleste udbydere oplyser mindsteprisen selv, og så læses den direkte.
YouSee gør ikke, og der regnes den ud af komponenterne med samme formel
(`source: "computed"`). Beregnede tal er mere skrøbelige — en forkert
månedspris i `config/plans.yaml` slår igennem med seks gange fejlen — så de
markeres i UI'et og får lav konfidens.

Udbyderne er forpligtet til selv at oplyse denne mindstepris på produktsiden, så
scraperen henter det oplyste tal som hovedkilde og regner det samtidig ud fra
komponenterne som krydstjek. Se `packages/core/src/pricing.ts` og PLAN.md §4 for detaljer.

## Kom i gang lokalt

Kræver Node 22+ og [pnpm](https://pnpm.io) (`corepack enable` er nok, hvis pnpm ikke
allerede er installeret).

```bash
pnpm install
pnpm --filter @mobilpriser/core build   # scraper og web afhænger af den kompilerede core

# Tests og typecheck (samme som CI kører)
pnpm --filter @mobilpriser/core test
pnpm --filter @mobilpriser/core typecheck
pnpm --filter @mobilpriser/scraper test
pnpm --filter @mobilpriser/scraper typecheck
pnpm --filter @mobilpriser/web typecheck
pnpm --filter @mobilpriser/web lint

# Websitet, læser fra data/ i repo-roden
pnpm --filter @mobilpriser/web dev
```

### Kør scraperen manuelt

```bash
pnpm --filter @mobilpriser/scraper run scrape
```

Opdaterer `data/latest.json`, tilføjer et snapshot i `data/history/<dato>.json` og en
linje pr. tilbud i `data/history.jsonl`. Fejler en udbyder, beholdes gårsdagens tilbud og
markeres `stale: true` frem for at forsvinde fra sitet.

Siderne hentes statisk først. Er prisen ikke i den serverleverede HTML, og har siden
næsten ingen synlig tekst, hentes den igen med en rigtig browser (Playwright) — det er
nødvendigt hos Call me, som bygger produktsiden i browseren.

**Bemærk:** i det miljø, dette blev udviklet i, er de fem udbyderes domæner blokeret af
netværkspolitikken, så parserne er kun verificeret mod syntetiske fixtures
(`packages/scraper/test/fixtures/`) plus en lokalt serveret JS-tegnet testside. Hentningen
mod de rigtige sider verificeres i GitHub Actions.

### Diagnosticér siderne

```bash
pnpm --filter @mobilpriser/scraper run diagnose
```

Rapporterer per side: HTTP-status, sidetitel, JSON-LD, om ordet "mindstepris" findes,
hvilke beløb der står omkring det, om siden ser udsolgt ud, prisrelateret kontekst til at
regne mindsteprisen ud af komponenter, og om browser-gengivelse hjælper.
`PROVIDER=callme` begrænser til én udbyder; `URL=<a>,<b>` undersøger vilkårlige sider,
også dem der er slået fra i config. Findes også som workflowet **"Diagnosticer udbydersider"**, der kun kan køres
manuelt og ikke skriver til `data/`. Det er den hurtigste vej til at forstå, hvorfor en
parser ikke rammer.

### Status pr. udbyder (sidst bekræftet ved kørsel)

| Udbyder | Status |
|---|---|
| Telenor | Virker — mindsteprisen står i serverleveret HTML |
| Telmore | Kræver browser-gengivelse; det serverleverede skelet viser "0 kr." og "Udsolgt" som pladsholdere |
| Call me | Virker via browser-gengivelse. Sælger telefonen til fuld betaling nu, ikke afbetaling — derfor lavere mindstepriser |
| Telenor / Telmore | Bekræftet mod eksterne tal: Telmore iPhone 17 = 7.543 kr., S26 Ultra = 12.293 kr. |
| CBB | Svarer 403 på vores bot. Afvisningen omgås ikke — markeres som utilgængelig |
| Norlys, 3 | Virker |
| OiSTER | Flyttet til referencekilde: deres "Mindstepris" er identisk med kontantprisen og dækker kun telefonen |
| YouSee | Mindsteprisen regnes ud (telefonpris fra JSON-LD + 6 x månedspris), fordi siden ikke oplyser den. Markeret "beregnet" og lav konfidens |

## Tilføj flere telefoner eller udbyder-URLs

Rediger `config/phones.yaml`. En telefon uden en URL for en given udbyder bliver stille
sprunget over af scraperen (advarsel i kørslens summary) frem for at gætte en URL.

## Referencedata ("er det faktisk billigt")

`data/reference/cash-prices.json` skrives af scraperen selv, ikke i hånden. Kilden er
**forhandlere**, ikke teleudbyderne: en udbyders egen kontantpris ligger typisk over
detailhandlens, og bruges den som målestok, kommer ethvert abonnementstilbud til at se
bedre ud, end det er. Forskellen er ikke akademisk — Proshop havde iPhone 17 til 6.666 kr.,
mens YouSees pris uden abonnement stod til 7.499 kr.

PriceRunner er den primære kilde, fordi de allerede sammenligner på tværs af butikker;
Elgiganten, POWER og OiSTER hentes som supplement. Priserne læses fra JSON-LD, som webshops
udgiver til Google Shopping og har en interesse i holde korrekt.

```
reference = laveste forhandlerpris + laveste månedspris x 6
```

Et tilbud under det beløb er billigere end at købe telefonen selv og tage det billigste
abonnement ved siden af. Månedsprisen er den laveste blandt de sammenlignede tilbud, ikke
markedets billigste SIM-only — en konservativ målestok, for et billigere abonnement udefra
ville kun gøre dommen hårdere.

### robots.txt

Før hver hentning hos en forhandler spørges domænets `robots.txt`, og forbyder den os,
springes siden over med en advarsel. Kan filen ikke læses, hentes der ikke — at gætte på et
ja er præcis den antagelse, reglen findes for at undgå. Udbydernes sider er endnu ikke
omfattet af tjekket; det er et bevidst valg om ikke at slå noget fra, der virker, uden at
det er besluttet.

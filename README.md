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

**Bemærk:** i det miljø, dette blev udviklet i, er yousee.dk, telenor.dk, telmore.dk,
cbb.dk og callme.dk blokeret af netværkspolitikken, så selve hentningen kunne ikke
verificeres mod de rigtige sider herfra — kun mod syntetiske test-fixtures
(`packages/scraper/test/fixtures/`). Første rigtige kørsel sker i selve
`.github/workflows/scrape.yml`, hvor der er fri netadgang. Data i `data/` er derfor
tomt indtil da.

## Tilføj flere telefoner eller udbyder-URLs

Rediger `config/phones.yaml`. En telefon uden en URL for en given udbyder bliver stille
sprunget over af scraperen (advarsel i kørslens summary) frem for at gætte en URL.

## Referencedata ("er det faktisk billigt")

`data/reference/cash-prices.json` er tom fra start. Så snart den udfyldes med
markedskontantpriser og billigste SIM-only-priser pr. databehov, viser websitet automatisk
en vurdering (🟢/🟡/🔴) i sammenligningstabellen — se PLAN.md, fase 4.

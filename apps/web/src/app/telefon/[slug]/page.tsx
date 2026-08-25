import Link from "next/link";
import { notFound } from "next/navigation";
import { calculateReference, verdictFor, type Verdict } from "@mobilpriser/core";
import { formatDataGb, formatDate, formatKr } from "@/lib/format";
import {
  loadLatest,
  loadPhones,
  loadReference,
  offersForPhone,
  PROVIDER_NAMES,
  type Offer,
} from "@/lib/data";

export function generateStaticParams() {
  return loadPhones().map((phone) => ({ slug: phone.slug }));
}

const VERDICT_LABEL: Record<Verdict, string> = {
  good: "Under reference",
  neutral: "Neutral",
  bad: "Over reference",
};

function VerdictBadge({ offer, cashPrices, cheapestSimOnlyByDataGb }: {
  offer: Offer;
  cashPrices: Record<string, number>;
  cheapestSimOnlyByDataGb: Record<string, number>;
}) {
  const cashPrice = cashPrices[offer.phone.slug];
  const dataGbKey = offer.components.dataGb != null ? String(offer.components.dataGb) : undefined;
  const simOnlyMonthly = dataGbKey ? cheapestSimOnlyByDataGb[dataGbKey] : undefined;

  if (cashPrice == null || simOnlyMonthly == null) {
    return <span className="badge badge-unknown">Ingen reference endnu</span>;
  }

  const reference = calculateReference(cashPrice, simOnlyMonthly);
  const verdict = verdictFor(offer.minPrice, reference);
  const className =
    verdict === "good" ? "badge-good" : verdict === "bad" ? "badge-bad" : "badge-neutral";

  return <span className={`badge ${className}`}>{VERDICT_LABEL[verdict]}</span>;
}

interface PhonePageProps {
  params: Promise<{ slug: string }>;
}

export default async function PhonePage({ params }: PhonePageProps) {
  const { slug } = await params;
  const phones = loadPhones();
  const phone = phones.find((p) => p.slug === slug);
  if (!phone) notFound();

  const latest = loadLatest();
  const reference = loadReference();
  const offers = offersForPhone(latest.offers, slug);

  const hasAnyReference = Object.keys(reference.cashPrices).length > 0;

  return (
    <>
      <Link href="/" className="back-link">
        ← Alle telefoner
      </Link>
      <h1>
        {phone.brand} {phone.model} · {phone.storage} GB
      </h1>
      <p className="lede">
        Mindstepris for de 6 måneders binding hos hver udbyder, sorteret fra billigst til
        dyrest.
      </p>
      <p className="meta-line">Data hentet: {formatDate(latest.generatedAt)}</p>

      {offers.some((offer) => offer.source === "computed") && (
        <div className="warning-box">
          Tal mærket <strong>beregnet</strong> er ikke oplyst af udbyderen, men regnet ud af
          telefonpris og abonnement. De er mere usikre end de aflæste: en forkert månedspris
          slår igennem med seks gange fejlen.
        </div>
      )}

      {!hasAnyReference && (
        <div className="warning-box">
          Referencepriser (kontant + billigste SIM-only) er endnu ikke indsamlet, så
          vurderingskolonnen kan ikke sige noget om, hvorvidt tilbuddene reelt er billige — kun
          hvordan de rangerer indbyrdes.
        </div>
      )}

      {offers.length === 0 ? (
        <p>Ingen tilbud indsamlet for denne telefon endnu.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Udbyder</th>
                <th>Abonnement</th>
                <th>Data</th>
                <th>Udbetaling</th>
                <th>Afbetaling</th>
                <th>Pr. måned</th>
                <th>Mindstepris</th>
                <th>Vurdering</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td>
                    <a href={offer.url} target="_blank" rel="noopener noreferrer">
                      {PROVIDER_NAMES[offer.provider]}
                    </a>
                    {offer.stale && <span className="badge badge-stale" style={{ marginLeft: 8 }}>Ikke opdateret i dag</span>}
                  </td>
                  <td>{offer.components.planName ?? "—"}</td>
                  <td>{formatDataGb(offer.components.dataGb)}</td>
                  <td className="num">
                    {offer.components.upfront != null ? formatKr(offer.components.upfront) : "—"}
                  </td>
                  <td className="num">
                    {offer.components.deviceMonthly != null
                      ? `${formatKr(offer.components.deviceMonthly)}/md.`
                      : "—"}
                  </td>
                  <td className="num">
                    {offer.components.planMonthly != null
                      ? `${formatKr(offer.components.planMonthly)}/md.`
                      : "—"}
                  </td>
                  <td className="num min-price">
                    {formatKr(offer.minPrice)}
                    {offer.source === "computed" && (
                      <span className="badge badge-computed" title="Udbyderen oplyser ikke en samlet mindstepris. Tallet er regnet ud af telefonpris og abonnement.">
                        beregnet
                      </span>
                    )}
                  </td>
                  <td>
                    <VerdictBadge
                      offer={offer}
                      cashPrices={reference.cashPrices}
                      cheapestSimOnlyByDataGb={reference.cheapestSimOnlyByDataGb}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

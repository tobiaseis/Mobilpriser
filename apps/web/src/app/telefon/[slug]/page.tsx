import Link from "next/link";
import { notFound } from "next/navigation";
import { EgetAbonnement } from "../../EgetAbonnement";
import { Freshness } from "../../Freshness";
import { Sammenligning } from "./Sammenligning";
import { loadLatest, loadPhones, loadReference, offersForPhone } from "@/lib/data";

export function generateStaticParams() {
  return loadPhones().map((phone) => ({ slug: phone.slug }));
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
        dyrest. Beløbet ved køb plus seks måneders abonnement og eventuelle gebyrer giver
        mindsteprisen — står felterne tomme, kunne opdelingen ikke udledes med sikkerhed
        fra udbyderens side.
      </p>
      <Freshness generatedAt={latest.generatedAt} builtAt={process.env.BUILD_TIME ?? null} />

      <EgetAbonnement />

      {offers.some((offer) => offer.source === "computed") && (
        <div className="warning-box">
          Tal mærket <strong>beregnet</strong> er ikke oplyst af udbyderen, men regnet ud af
          telefonpris og abonnement. De er mere usikre end de aflæste: en forkert månedspris
          slår igennem med seks gange fejlen.
        </div>
      )}

      <Sammenligning
        offers={offers}
        cashPrice={reference.cashPrices[slug]}
        cashPriceSource={reference.cashPriceSource[slug]}
        cheapestMonthly={reference.cheapestMonthly}
      />
    </>
  );
}

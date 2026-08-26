import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EgetAbonnement } from "../../EgetAbonnement";
import { Sammenligning } from "./Sammenligning";
import { loadLatest, loadPhones, loadReference, offersForPhone } from "@/lib/data";

export function generateStaticParams() {
  return loadPhones().map((phone) => ({ slug: phone.slug }));
}

interface PhonePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PhonePageProps): Promise<Metadata> {
  const { slug } = await params;
  const phone = loadPhones().find((p) => p.slug === slug);
  if (!phone) return {};
  return {
    title: `${phone.brand} ${phone.model} ${phone.storage} GB`,
    description: `Mindsteprisen for ${phone.brand} ${phone.model} med abonnement hos danske udbydere, målt mod hvad telefonen koster kontant.`,
  };
}

export default async function PhonePage({ params }: PhonePageProps) {
  const { slug } = await params;
  const phones = loadPhones();
  const phone = phones.find((p) => p.slug === slug);
  if (!phone) notFound();

  const latest = loadLatest();
  const reference = loadReference();
  const offers = offersForPhone(latest.offers, slug);
  const computedCount = offers.filter((offer) => offer.source === "computed").length;

  return (
    <>
      <div className="page-head">
        <Link href="/" className="back-link">
          Alle telefoner
        </Link>
        <h1 className="page-title">
          {phone.brand} {phone.model} <span className="variant">{phone.storage} GB</span>
        </h1>
        <p className="page-lede">
          Hver bjælke er én udbyders mindstepris for hele bindingsperioden — beløbet ved køb,
          seks måneders abonnement og gebyrer lagt sammen. Den røde streg er, hvad telefonen
          koster, hvis du bare køber den.
        </p>
      </div>

      <EgetAbonnement />

      {computedCount > 0 && (
        <div className="notice" style={{ marginTop: 20 }}>
          <div>
            {computedCount === 1 ? "Ét tal" : `${computedCount} tal`} er mærket{" "}
            <strong>beregnet</strong>: udbyderen oplyser ikke en samlet mindstepris, så den er
            regnet ud af telefonpris og abonnement. Den slags tal er mere usikre — en forkert
            månedspris slår igennem med seks gange fejlen.
          </div>
        </div>
      )}

      <section className="section">
        <h2 className="eyebrow">
          {offers.length === 1 ? "1 udbyder" : `${offers.length} udbydere`} · billigst først
        </h2>
        <Sammenligning
          offers={offers}
          cashPrice={reference.cashPrices[slug]}
          cashPriceSource={reference.cashPriceSource[slug]}
          cheapestMonthly={reference.cheapestMonthly}
        />
      </section>
    </>
  );
}

import Link from "next/link";
import { formatKr, formatDate } from "@/lib/format";
import { loadLatest, loadPhones, offersForPhone, PROVIDER_NAMES } from "@/lib/data";

export default function HomePage() {
  const phones = loadPhones();
  const latest = loadLatest();

  return (
    <>
      <h1>De fem telefoner</h1>
      <p className="lede">
        Mindstepris for de 6 måneders binding, hos den billigste udbyder lige nu. Klik på en
        telefon for at se alle udbydernes tilbud side om side.
      </p>
      <p className="meta-line">Data hentet: {formatDate(latest.generatedAt)}</p>

      <div className="phone-grid">
        {phones.map((phone) => {
          const offers = offersForPhone(latest.offers, phone.slug);
          const cheapest = offers[0];

          return (
            <Link key={phone.slug} href={`/telefon/${phone.slug}`} className="phone-card">
              <h2>
                {phone.brand} {phone.model}
              </h2>
              {cheapest ? (
                <>
                  <p className="price">{formatKr(cheapest.statedMinPrice)}</p>
                  <p className="provider">{PROVIDER_NAMES[cheapest.provider]}</p>
                </>
              ) : (
                <p className="empty">Ingen data endnu</p>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}

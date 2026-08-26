import { EgetAbonnement } from "./EgetAbonnement";
import { Freshness } from "./Freshness";
import { Telefonliste } from "./Telefonliste";
import { loadLatest, loadPhones } from "@/lib/data";

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
      <Freshness generatedAt={latest.generatedAt} builtAt={process.env.BUILD_TIME ?? null} />

      <EgetAbonnement />

      <Telefonliste phones={phones} offers={latest.offers} />
    </>
  );
}

"use client";

import { useId } from "react";
import { BINDING_MONTHS } from "@mobilpriser/core";
import { formatKr } from "@/lib/format";
import {
  MAX_OWN_MONTHLY,
  parseOwnMonthly,
  setOwnMonthly,
  useOwnMonthlyRaw,
} from "@/lib/ownPlan";

/**
 * Feltet, hvor man skriver sit eget abonnement.
 *
 * Det står både på forsiden og på hver telefonside og deler tallet gennem
 * browserens lager, så man kun skriver det én gang.
 */
export function EgetAbonnement() {
  const inputId = useId();
  const noteId = useId();
  const raw = useOwnMonthlyRaw();
  const monthly = parseOwnMonthly(raw);
  const written = raw != null && raw.trim() !== "";
  const invalid = written && monthly == null;

  return (
    <div className="own-plan">
      <div>
        <label className="own-plan-label" htmlFor={inputId}>
          Hvad giver du for dit abonnement i dag?
        </label>

        <div className="own-plan-field">
          <span className="own-plan-input-wrap">
            <input
              id={inputId}
              className="own-plan-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_OWN_MONTHLY}
              step={1}
              placeholder="fx 149"
              value={raw ?? ""}
              aria-describedby={noteId}
              aria-invalid={invalid || undefined}
              onChange={(event) => setOwnMonthly(event.target.value)}
            />
            <span className="own-plan-unit" aria-hidden="true">
              kr./md.
            </span>
          </span>
          {written && (
            <button type="button" className="own-plan-reset" onClick={() => setOwnMonthly("")}>
              Nulstil
            </button>
          )}
        </div>
      </div>

      <p
        id={noteId}
        className="own-plan-note"
        data-tone={invalid ? "error" : undefined}
        aria-live="polite"
      >
        {monthly != null ? (
          <>
            <strong>{formatKr(monthly * BINDING_MONTHS)}</strong> over {BINDING_MONTHS} måneder
            trækkes fra hver mindstepris. Dem giver du ud alligevel, så de er ikke en merudgift
            ved at få en ny telefon.
          </>
        ) : invalid ? (
          <>
            Skriv et beløb mellem 0 og {MAX_OWN_MONTHLY} kr. Indtil da vises mindstepriserne,
            som udbyderne oplyser dem.
          </>
        ) : (
          <>
            Så trækker vi seks måneder af det fra hver pris og viser, hvad telefonen koster
            dig oveni. Beløbet bliver i din egen browser — det sendes ingen steder hen.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Skalaen bag prisbjælkerne.
 *
 * Ét tal pr. udbyder, målt mod én reference. Bjælken vokser fra nul, og
 * referencen er en streg tværs gennem stakken — det, tilbuddet skal slå.
 * Den del af bjælken, der ligger ud over stregen, er overskridelsen og
 * tegnes for sig, så beløbet man betaler for meget, er til at se og ikke
 * kun til at læse.
 *
 * Med et eget abonnement indtastet kan merprisen blive negativ — så er
 * udbyderens abonnement billigere end ens eget, og telefonen følger med.
 * Derfor kan skalaen begynde under nul, og bjælken vokse til venstre.
 */

export type SegmentKind = "base" | "over" | "gain";

export interface BarSegment {
  kind: SegmentKind;
  /** Procent fra venstre kant af sporet. */
  left: number;
  width: number;
  /** Hvilken ende der er dataenden og derfor rundes. */
  end: "left" | "right" | null;
}

export interface BarScale {
  /** Referencestregens placering i procent, eller null hvis den ikke kendes. */
  refPos: number | null;
  /** Nulpunktets placering i procent. */
  zeroPos: number;
  /** Nulstregen tegnes kun, når den ikke falder sammen med venstre kant. */
  showZero: boolean;
  segments: (value: number) => BarSegment[];
}

/** Luft i højre ende, så den længste bjælke ikke støder mod kanten. */
const HEADROOM = 0.04;

/**
 * Miniaturen på forsidens kort måler ikke i kroner, men i forhold til
 * referencen: stregen står altid samme sted, og bjælken viser, hvor stor en
 * del af "køb den selv" tilbuddet koster.
 *
 * Kortene står i et gitter ved siden af hinanden, og en skala pr. kort ville
 * lade fem forskellige målestokke se ens ud. Med referencen som fælles
 * enhed betyder en kortere bjælke det samme på alle fem — også selvom de er
 * fem forskellige telefoner til fem forskellige priser.
 */
const MINI_REF_POS = 68;

/** Længste bjælke, der kan være i sporet — derover er tallet klippet. */
const MINI_MAX_RATIO = 100 / MINI_REF_POS;

/** Et mærke i venstre ende, når merprisen er under nul og bjælken ingen længde har. */
const MINI_ZERO_MARK = 4;

export function referenceBar(
  value: number,
  reference: number,
): { refPos: number; segments: BarSegment[] } {
  if (value <= 0) {
    return {
      refPos: MINI_REF_POS,
      segments: [{ kind: "gain", left: 0, width: MINI_ZERO_MARK, end: "right" }],
    };
  }

  const ratio = value / reference;
  if (ratio <= 1) {
    return {
      refPos: MINI_REF_POS,
      segments: [{ kind: "base", left: 0, width: ratio * MINI_REF_POS, end: "right" }],
    };
  }

  const capped = Math.min(ratio, MINI_MAX_RATIO);
  return {
    refPos: MINI_REF_POS,
    segments: [
      { kind: "base", left: 0, width: MINI_REF_POS, end: null },
      {
        kind: "over",
        left: MINI_REF_POS,
        width: (capped - 1) * MINI_REF_POS,
        end: capped < MINI_MAX_RATIO ? "right" : null,
      },
    ],
  };
}

export function barScale(values: number[], reference: number | null): BarScale {
  const low = Math.min(0, ...values);
  const highest = Math.max(...values, reference ?? Number.NEGATIVE_INFINITY);
  // Er alt nul, ville spændet blive nul og hver placering NaN.
  const rawSpan = highest - low || 1;
  const span = rawSpan * (1 + HEADROOM);

  const pos = (value: number) => ((value - low) / span) * 100;
  const zeroPos = pos(0);
  const refPos = reference == null ? null : pos(reference);

  return {
    refPos,
    zeroPos,
    showZero: zeroPos > 0.5,
    segments(value) {
      if (value < 0) {
        return [{ kind: "gain", left: pos(value), width: zeroPos - pos(value), end: "left" }];
      }
      if (reference == null || value <= reference) {
        return [{ kind: "base", left: zeroPos, width: pos(value) - zeroPos, end: "right" }];
      }
      return [
        { kind: "base", left: zeroPos, width: refPos! - zeroPos, end: null },
        { kind: "over", left: refPos!, width: pos(value) - refPos!, end: "right" },
      ];
    },
  };
}

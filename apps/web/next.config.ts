import type { NextConfig } from "next";

/**
 * Sitet er statisk. Hver side bygges med de priser, der lå i data/ da
 * bygningen kørte, så nye tal først bliver synlige, når Vercel har bygget
 * om. To ting følger af det:
 *
 *  - HTML må ikke blive liggende i browserens cache hen over en ny
 *    bygning. Forsiden og telefonsiderne genvalideres derfor ved hvert
 *    besøg. Filerne under _next/static får nyt navn ved hver bygning og
 *    beholder Next.js' egen immutable-cache — de kan aldrig blive gamle.
 *  - Bygningstidspunktet bages ind, så siden selv kan fortælle, hvornår
 *    den sidst blev bygget. Står der et gammelt tidspunkt dér, mens
 *    data/ er nyere i repoet, er det bygningen der mangler — ikke
 *    scraperen. Det var netop den skelnen, der ikke kunne foretages,
 *    da sitet stod stille på gårsdagens priser.
 */
const REVALIDATE_HTML = {
  key: "Cache-Control",
  value: "public, max-age=0, must-revalidate",
};

const nextConfig: NextConfig = {
  env: {
    BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    return [
      { source: "/", headers: [REVALIDATE_HTML] },
      { source: "/telefon/:slug", headers: [REVALIDATE_HTML] },
    ];
  },
};

export default nextConfig;

import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRobotsCache, isAllowed, isUrlAllowed, parseRobots } from "../src/robots.js";

beforeEach(clearRobotsCache);

describe("parseRobots / isAllowed", () => {
  it("følger reglerne for alle robotter", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /kurv\nDisallow: /konto");

    expect(isAllowed(robots, "/pl/1-343/Mobiltelefoner")).toBe(true);
    expect(isAllowed(robots, "/kurv")).toBe(false);
    expect(isAllowed(robots, "/konto/login")).toBe(false);
  });

  it("lader den længste matchende regel vinde", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /shop\nAllow: /shop/produkt");

    expect(isAllowed(robots, "/shop/kurv")).toBe(false);
    expect(isAllowed(robots, "/shop/produkt/123")).toBe(true);
  });

  it("forstår 'Disallow:' uden værdi som at alt er tilladt", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:"), "/hvadsomhelst")).toBe(true);
  });

  it("foretrækker en gruppe, der nævner os ved navn", () => {
    const robots = parseRobots(
      "User-agent: *\nDisallow: /\n\nUser-agent: Mobilpriser-bot\nDisallow: /kurv",
    );

    // Den generelle regel forbyder alt, men vores egen gruppe gør ikke.
    expect(isAllowed(robots, "/produkt")).toBe(true);
    expect(isAllowed(robots, "/kurv")).toBe(false);
  });

  it("deler regelsæt mellem flere agenter nævnt i træk", () => {
    const robots = parseRobots("User-agent: foo\nUser-agent: *\nDisallow: /privat");
    expect(isAllowed(robots, "/privat")).toBe(false);
  });

  it("ignorerer kommentarer og tomme linjer", () => {
    const robots = parseRobots("# kommentar\nUser-agent: *\n\nDisallow: /a # bagefter");
    expect(isAllowed(robots, "/a")).toBe(false);
    expect(isAllowed(robots, "/b")).toBe(true);
  });

  it("tillader alt, når der ingen regler er", () => {
    expect(isAllowed(parseRobots(""), "/hvadsomhelst")).toBe(true);
  });
});

describe("isUrlAllowed", () => {
  it("henter robots.txt fra domænets rod", async () => {
    const fetchText = vi.fn(async () => "User-agent: *\nDisallow: /kurv");

    const allowed = await isUrlAllowed("https://www.pricerunner.dk/pl/1-343/Foo", fetchText);

    expect(fetchText).toHaveBeenCalledWith("https://www.pricerunner.dk/robots.txt");
    expect(allowed).toBe(true);
  });

  it("henter kun robots.txt én gang pr. domæne", async () => {
    const fetchText = vi.fn(async () => "User-agent: *\nDisallow:");

    await isUrlAllowed("https://example.dk/a", fetchText);
    await isUrlAllowed("https://example.dk/b", fetchText);

    expect(fetchText).toHaveBeenCalledOnce();
  });

  it("betragter en manglende robots.txt (404) som at alt er tilladt", async () => {
    const fetchText = vi.fn(async () => {
      throw new Error("HTTP 404 for https://example.dk/robots.txt");
    });

    expect(await isUrlAllowed("https://example.dk/produkt", fetchText)).toBe(true);
  });

  it("henter ikke, når robots.txt ikke kunne læses af andre grunde", async () => {
    // At gætte på et ja er præcis den antagelse, reglen findes for at undgå.
    const fetchText = vi.fn(async () => {
      throw new Error("HTTP 500 for https://example.dk/robots.txt");
    });

    expect(await isUrlAllowed("https://example.dk/produkt", fetchText)).toBe(false);
  });

  it("afviser en sti, robots.txt forbyder", async () => {
    const fetchText = vi.fn(async () => "User-agent: *\nDisallow: /pl");

    expect(await isUrlAllowed("https://www.pricerunner.dk/pl/1-343/Foo", fetchText)).toBe(false);
  });
});

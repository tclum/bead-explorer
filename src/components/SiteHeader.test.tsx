import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import SiteHeader from "./SiteHeader";

const ALLOWED_HREFS = new Set(["/", "/challenge"]);

function collectHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const rx = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

describe("SiteHeader", () => {
  it("links to both / and /challenge and nothing else", () => {
    const html = renderToStaticMarkup(<SiteHeader current="/" />);
    const hrefs = collectHrefs(html);
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/challenge");
    for (const h of hrefs) {
      expect(ALLOWED_HREFS.has(h)).toBe(true);
    }
  });

  it("marks the active link with aria-current=page", () => {
    const html = renderToStaticMarkup(<SiteHeader current="/challenge" />);
    // React may emit attributes in either order; test each pairing.
    const activeChallenge =
      /<a[^>]*aria-current="page"[^>]*href="\/challenge"/.test(html) ||
      /<a[^>]*href="\/challenge"[^>]*aria-current="page"/.test(html);
    expect(activeChallenge).toBe(true);
    // The site-title link to "/" also renders, but only the nav's Overview
    // link should be considered — check that no nav-height "/" link is marked.
    const activeSlash =
      /<a[^>]*aria-current="page"[^>]*href="\/"/.test(html) ||
      /<a[^>]*href="\/"[^>]*aria-current="page"/.test(html);
    expect(activeSlash).toBe(false);
  });
});

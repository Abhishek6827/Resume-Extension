import * as cheerio from "cheerio";

/**
 * Scrapes a job description URL and extracts clean, readable text.
 * Strips script tags, navigation, headers, footers, and formatting.
 */
export async function scrapeJobDescription(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page. HTTP status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Strip elements that don't contain job description content
    $(
      "script, style, nav, footer, header, iframe, noscript, svg, link, form, button"
    ).remove();

    // Check specific selectors for common sites if possible
    let targetText = "";

    if (url.includes("linkedin.com")) {
      targetText =
        $(".jobs-description__content").text() ||
        $(".jobs-description").text() ||
        "";
    } else if (url.includes("indeed.com")) {
      targetText = $("#jobDescriptionText").text() || "";
    } else if (url.includes("naukri.com")) {
      targetText = $(".job-desc").text() || $(".dang-inner-html").text() || "";
    } else if (url.includes("glassdoor.com")) {
      targetText = $(".jobDescriptionContent").text() || "";
    }

    // Fallback: If no site-specific element found, extract from body
    if (!targetText.trim()) {
      // Find the main or body element
      const bodyEl = $("main").length > 0 ? $("main") : $("body");

      // Replace common block elements with newlines to preserve spacing
      bodyEl.find("p, div, li, br, h1, h2, h3, h4, h5, h6").each((_, el) => {
        $(el).append("\n");
      });

      targetText = bodyEl.text();
    }

    // Clean whitespace
    const cleanText = targetText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");

    if (!cleanText.trim()) {
      throw new Error("Extracted text is empty. The site may require JavaScript.");
    }

    return cleanText;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`URL scraping failed: ${message}`);
  }
}

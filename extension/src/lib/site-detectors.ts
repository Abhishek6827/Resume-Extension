/**
 * Job Description selectors for well-known portals.
 */
const KNOWN_SELECTORS: Record<string, string[]> = {
  "linkedin.com": [
    "#job-details",
    ".jobs-description__container",
    ".jobs-box__html-content",
    ".jobs-description-content__text",
    ".jobs-description__content",
    ".jobs-description",
    ".job-view-layout .description",
  ],
  "indeed.com": [
    "#jobDescriptionText",
    ".jobsearch-JobComponent-description",
    "[id*='jobDescription']",
  ],
  "naukri.com": [
    ".job-desc",
    "[class*='job-desc']",
    ".dang-inner-html",
    "[class*='description']",
  ],
  "glassdoor.com": [
    ".jobDescriptionContent",
    "[class*='JobDetails']",
    "[class*='jobDescription']",
  ],
};

/**
 * Common keywords indicating job description text blocks.
 */
const RECRUITMENT_KEYWORDS = [
  "responsibilities",
  "requirements",
  "qualifications",
  "what you will do",
  "what you'll do",
  "about the role",
  "about the job",
  "skills required",
  "key responsibilities",
  "minimum qualifications",
  "preferred qualifications",
  "experience required",
  "role summary",
];

export interface DetectionResult {
  found: boolean;
  text: string;
  confidence: "high" | "medium" | "low";
  source: string;
}

/**
 * Universal detector that parses the current document DOM to extract the job description.
 */
export function detectJobDescription(): DetectionResult {
  if (typeof document === "undefined") {
    return { found: false, text: "", confidence: "low", source: "server" };
  }

  const url = window.location.href.toLowerCase();

  // 1. Try Known Portals First
  for (const [domain, selectors] of Object.entries(KNOWN_SELECTORS)) {
    if (url.includes(domain)) {
      for (const selector of selectors) {
        try {
          const el = document.querySelector(selector);
          const text = (el?.textContent || "").trim();
          if (text.length > 200) {
            return {
              found: true,
              text,
              confidence: "high",
              source: domain.split(".")[0],
            };
          }
        } catch (e) {
          // Ignore invalid selectors or cross-origin issues
        }
      }
    }
  }

  // 2. Universal Detection for Careers / Company sites
  // Look for headings containing recruitment keywords
  let headings: Element[] = [];
  try {
    headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, strong, b"));
  } catch (e) {
    // Ignore query issues
  }
  
  let bestCandidateBlock: HTMLElement | null = null;
  let maxScore = 0;

  for (const heading of headings) {
    const text = (heading.textContent || "").toLowerCase().trim();
    
    // Check if heading matches keywords
    const matchesKeyword = RECRUITMENT_KEYWORDS.some((kw) => text.includes(kw));
    if (matchesKeyword) {
      // Find parent block or sibling content
      const parent = heading.parentElement;
      if (parent) {
        // Simple score based on paragraph count and list items
        try {
          const paragraphs = parent.querySelectorAll("p, li");
          const score = paragraphs.length;
          if (score > maxScore) {
            maxScore = score;
            bestCandidateBlock = parent as HTMLElement;
          }
        } catch (e) {
          // Ignore parent query issues
        }
      }
    }
  }

  if (bestCandidateBlock && maxScore > 2) {
    const text = (bestCandidateBlock.textContent || "").trim();
    if (text.length > 300) {
      return {
        found: true,
        text,
        confidence: "medium",
        source: "universal-detector",
      };
    }
  }

  // 3. Last Resort Fallback: Scan body for the largest text block
  let divs: Element[] = [];
  try {
    divs = Array.from(document.querySelectorAll("main, article, #content, .content, div"));
  } catch (e) {
    // Ignore query issues
  }
  
  let longestText = "";
  let longestEl: Element | null = null;

  for (const div of divs) {
    // Avoid checking body or html elements directly to prevent noise
    if (div.tagName === "BODY" || div.tagName === "HTML") continue;
    const text = (div.textContent || "").trim();
    // Verify it contains basic recruitment indicators somewhere
    const hasJobIndicators = RECRUITMENT_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
    
    if (hasJobIndicators && text.length > longestText.length && text.length < 15000) {
      longestText = text;
      longestEl = div;
    }
  }

  if (longestText.length > 300 && longestEl) {
    return {
      found: true,
      text: longestText,
      confidence: "low",
      source: "body-heuristics",
    };
  }

  return { found: false, text: "", confidence: "low", source: "none" };
}

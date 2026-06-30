import type { ResumeData, TailoredResult } from "./types";

/**
 * Storage key constants
 */
const KEYS = {
  RESUME_DATA: "rt_resume_data",
  RESUME_RAW_TEXT: "rt_resume_raw_text",
  ORIGINAL_PDF: "rt_original_pdf",
  LAST_DETECTED_JD: "rt_last_detected_jd",
  TAILORED_RESULT: "rt_tailored_result",
};

/**
 * Check if running inside chrome extension context
 */
const isExtension = typeof chrome !== "undefined" && chrome.storage !== undefined;

/**
 * Fallback to localStorage for web previews/development convenience
 */
const storage = {
  get: async (key: string): Promise<string | null> => {
    if (isExtension) {
      const result = await chrome.storage.local.get([key]);
      return (result[key] as string) || null;
    }
    return localStorage.getItem(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (isExtension) {
      await chrome.storage.local.set({ [key]: value });
    } else {
      localStorage.setItem(key, value);
    }
  },
  remove: async (key: string): Promise<void> => {
    if (isExtension) {
      await chrome.storage.local.remove([key]);
    } else {
      localStorage.removeItem(key);
    }
  },
};

export async function saveResume(data: ResumeData): Promise<void> {
  await storage.set(KEYS.RESUME_DATA, JSON.stringify(data));
}

export async function getResume(): Promise<ResumeData | null> {
  const data = await storage.get(KEYS.RESUME_DATA);
  return data ? JSON.parse(data) : null;
}

export async function saveResumeRawText(text: string): Promise<void> {
  await storage.set(KEYS.RESUME_RAW_TEXT, text);
}

export async function getResumeRawText(): Promise<string | null> {
  return await storage.get(KEYS.RESUME_RAW_TEXT);
}

export async function saveOriginalPDF(base64: string): Promise<void> {
  await storage.set(KEYS.ORIGINAL_PDF, base64);
}

export async function getOriginalPDF(): Promise<string | null> {
  return await storage.get(KEYS.ORIGINAL_PDF);
}

export async function saveLastDetectedJD(text: string): Promise<void> {
  await storage.set(KEYS.LAST_DETECTED_JD, text);
}

export async function getLastDetectedJD(): Promise<string | null> {
  return await storage.get(KEYS.LAST_DETECTED_JD);
}

export async function saveTailoredResult(result: TailoredResult): Promise<void> {
  await storage.set(KEYS.TAILORED_RESULT, JSON.stringify(result));
}

export async function getTailoredResult(): Promise<TailoredResult | null> {
  const data = await storage.get(KEYS.TAILORED_RESULT);
  return data ? JSON.parse(data) : null;
}

export async function clearAllStorage(): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.clear();
  } else {
    localStorage.clear();
  }
}

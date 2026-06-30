import { generatePDF } from "./lib/pdf-generator";

async function run() {
  try {
    const buffer = await generatePDF({
      name: "Abhishek",
      contact: { email: "test@test.com" }
    } as any);
    console.log("Success! Buffer size:", buffer.length);
  } catch (err) {
    console.error("Crash:", err);
  }
}
run();

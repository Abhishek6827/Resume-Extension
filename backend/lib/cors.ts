import { NextResponse } from "next/server";

export function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  // Allow chrome-extension, localhost, and Vercel domains
  const isAllowed =
    origin.startsWith("chrome-extension://") ||
    origin.includes("localhost") ||
    origin.includes("vercel.app");

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function handleOptions(request: Request) {
  return NextResponse.json({}, { headers: getCorsHeaders(request) });
}

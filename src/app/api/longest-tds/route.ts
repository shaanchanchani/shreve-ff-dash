import { NextResponse } from "next/server";

const upstreamURL =
  process.env.LONGEST_TDS_SERVICE_URL ??
  process.env.LONGEST_TDS_URL ??
  process.env.NEXT_PUBLIC_LONGEST_TDS_URL ??
  "";

export async function GET() {
  if (!upstreamURL || upstreamURL.startsWith("/")) {
    return NextResponse.json(
      {
        error:
          "Longest TDs service URL is not configured. Set LONGEST_TDS_SERVICE_URL to the FastAPI endpoint.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(upstreamURL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Upstream longest TDs service returned an error.",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to reach longest TDs service.",
        detail: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import type { SearchApiResponse } from "@/lib/paper";
import { searchSemanticScholarPapers } from "@/lib/semantic-scholar/search-papers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";
  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");

  let limit: number | undefined;
  let offset: number | undefined;
  if (limitRaw !== null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (!Number.isFinite(n)) {
      const body: SearchApiResponse = {
        papers: [],
        error: { code: "BAD_REQUEST", message: "Invalid limit." },
      };
      return NextResponse.json(body, { status: 400 });
    }
    limit = n;
  }
  if (offsetRaw !== null && offsetRaw !== "") {
    const n = Number(offsetRaw);
    if (!Number.isFinite(n) || n < 0) {
      const body: SearchApiResponse = {
        papers: [],
        error: { code: "BAD_REQUEST", message: "Invalid offset." },
      };
      return NextResponse.json(body, { status: 400 });
    }
    offset = n;
  }

  const result = await searchSemanticScholarPapers({
    query,
    limit,
    offset,
  });

  if (!result.ok) {
    const status =
      result.status === 429
        ? 429
        : result.status === 0
          ? 503
          : result.status >= 400 && result.status < 600
            ? result.status
            : 502;
    const body: SearchApiResponse = {
      papers: [],
      error: { code: result.code, message: result.message },
    };
    return NextResponse.json(body, { status });
  }

  const body: SearchApiResponse = {
    papers: result.papers,
    total: result.total,
  };
  return NextResponse.json(body);
}

import { DEFAULT_POLICIES } from "@/lib/guard/policies";

export async function GET() {
  return Response.json({ policies: DEFAULT_POLICIES });
}

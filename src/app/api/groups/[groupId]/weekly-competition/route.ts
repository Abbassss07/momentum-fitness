import { CompetitionAccessError, getGroupWeeklyCompetition } from "@/lib/server/groupWeeklyCompetition";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;
  if (!UUID_PATTERN.test(groupId)) {
    return Response.json({ error: "Invalid group identifier." }, { status: 400 });
  }

  try {
    const competition = await getGroupWeeklyCompetition(groupId, authorization);
    return Response.json(competition, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof CompetitionAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Could not load the weekly competition." }, { status: 500 });
  }
}


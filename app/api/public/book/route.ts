import {
  scheduleSettings,
  assertExternalAvailability,
  calendarApiError,
} from "@/lib/server/calendar";
import { customerCalculator } from "@/lib/server/customer-calculator";
import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/server/env";
import { HttpError, parseJson } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { bookingRequestSchema } from "@/lib/server/schemas";
import { getAuthorizedSubmission } from "@/lib/server/submission-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    await assertRateLimit(request, "book", 10, 600);
    if (!databaseConfigured()) throw new HttpError(503, "Booking is not configured");

    const body = await parseJson(request, bookingRequestSchema);
    const startsAt = new Date(body.startsAt);
    const now = Date.now();

    if (startsAt.getTime() <= now) throw new HttpError(400, "Booking time must be in the future");
    if (startsAt.getTime() > now + 366 * 24 * 60 * 60 * 1000) {
      throw new HttpError(400, "Booking time is too far in the future");
    }

    const db = createAdminClient();
    const submission = await getAuthorizedSubmission(db, body.submissionId, body.accessToken);
    if (!submission) throw new HttpError(404, "Submission not found");
    const calculator = await customerCalculator(submission.calculatorId, "bookings");
    const schedule = await scheduleSettings(calculator.organizationId!);
    await assertExternalAvailability(
      calculator.organizationId!,
      startsAt.toISOString(),
      new Date(startsAt.getTime() + schedule.duration_minutes * 60000).toISOString(),
    );
    if (["booked", "won", "lost"].includes(submission.status)) {
      throw new HttpError(409, "This submission can no longer be booked");
    }

    const { data: bookingId, error } = await db.rpc("request_booking", {
      p_submission_id: submission.id,
      p_starts_at: startsAt.toISOString(),
    });

    if (error) {
      if (error.code === "23505") throw new HttpError(409, "An active booking already exists");
      throw error;
    }

    return NextResponse.json({ ok: true, bookingId });
  } catch (error) {
    const { status, message } = calendarApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

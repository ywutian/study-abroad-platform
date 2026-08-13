import { resolveApplicationYear } from '@study-abroad/shared';

type RecurringGlobalEventShape = {
  eventDate: Date;
  registrationDeadline?: Date | null;
  lateDeadline?: Date | null;
  resultDate?: Date | null;
  isRecurring?: boolean;
  year?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const TERMINAL_APPLICATION_STATUSES = new Set([
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'WAITLISTED',
  'WITHDRAWN',
]);

const TERMINAL_PERSONAL_EVENT_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function isBeforeUtcDay(date: Date, reference = new Date()): boolean {
  return startOfUtcDay(date).getTime() < startOfUtcDay(reference).getTime();
}

export function daysUntilUtcDay(date: Date, reference = new Date()): number {
  return Math.ceil(
    (startOfUtcDay(date).getTime() - startOfUtcDay(reference).getTime()) /
      DAY_MS,
  );
}

export function isTerminalApplicationStatus(status: string): boolean {
  return TERMINAL_APPLICATION_STATUSES.has(status);
}

export function inferApplicationYear(deadline?: string | Date): number {
  if (!deadline) return resolveApplicationYear();
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return resolveApplicationYear();
  return date.getUTCMonth() >= 7
    ? date.getUTCFullYear() + 1
    : date.getUTCFullYear();
}

export function cycleRoundKey(applicationYear: number, round: string): string {
  return `${applicationYear}:${round}`;
}

export function getPersonalLifecycleDate(event: {
  deadline?: Date | null;
  eventDate?: Date | null;
}): Date | null {
  const dates: Date[] = [];
  for (const date of [event.deadline, event.eventDate]) {
    if (date && !Number.isNaN(date.getTime())) dates.push(date);
  }
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export function getPersonalActionDate(
  event: { deadline?: Date | null; eventDate?: Date | null },
  reference = new Date(),
): Date | null {
  const dates = [event.deadline, event.eventDate]
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());
  return dates.find((date) => date >= reference) ?? dates.at(-1) ?? null;
}

export function isApplicationTimelineArchived(
  timeline: { status: string; deadline?: Date | null },
  reference = new Date(),
): boolean {
  return (
    isTerminalApplicationStatus(timeline.status) ||
    Boolean(timeline.deadline && isBeforeUtcDay(timeline.deadline, reference))
  );
}

export function isPersonalEventArchived(
  event: {
    status: string;
    deadline?: Date | null;
    eventDate?: Date | null;
  },
  reference = new Date(),
): boolean {
  if (TERMINAL_PERSONAL_EVENT_STATUSES.has(event.status)) return true;
  const lifecycleDate = getPersonalLifecycleDate(event);
  return Boolean(lifecycleDate && isBeforeUtcDay(lifecycleDate, reference));
}

export function rollAnnualDateForward(
  date: Date | string,
  reference = new Date(),
): Date {
  const source = new Date(date);
  const today = startOfUtcDay(reference);
  const rolled = new Date(source);

  rolled.setUTCFullYear(today.getUTCFullYear());
  if (startOfUtcDay(rolled).getTime() < today.getTime()) {
    rolled.setUTCFullYear(today.getUTCFullYear() + 1);
  }

  return rolled;
}

function addUtcYears(date: Date | null | undefined, years: number) {
  if (!date) return date;
  const shifted = new Date(date);
  shifted.setUTCFullYear(shifted.getUTCFullYear() + years);
  return shifted;
}

export function withEffectiveRecurringGlobalEvent<
  T extends RecurringGlobalEventShape,
>(event: T, reference = new Date()): T {
  if (!event.isRecurring) return event;

  const eventDate = rollAnnualDateForward(event.eventDate, reference);
  const yearShift =
    eventDate.getUTCFullYear() - event.eventDate.getUTCFullYear();

  return {
    ...event,
    eventDate,
    registrationDeadline: addUtcYears(event.registrationDeadline, yearShift),
    lateDeadline: addUtcYears(event.lateDeadline, yearShift),
    resultDate: addUtcYears(event.resultDate, yearShift),
    year: eventDate.getUTCFullYear(),
  };
}

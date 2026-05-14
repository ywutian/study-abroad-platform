type RecurringGlobalEventShape = {
  eventDate: Date;
  registrationDeadline?: Date | null;
  lateDeadline?: Date | null;
  resultDate?: Date | null;
  isRecurring?: boolean;
  year?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

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

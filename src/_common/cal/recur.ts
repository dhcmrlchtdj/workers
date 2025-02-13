import { PriorityQueue } from "../ds/priority-queue"
import type { Event, Group, RecurrenceRule } from "./jscalendar"

export function getEventFromGroup(
	start: number,
	end: number,
	g: Group,
): Event[] {
	return g.entries
		.filter((x) => x["@type"] === "Event")
		.flatMap((x) => getEventFromEvent(start, end, x))
}

function getEventFromEvent(start: number, end: number, e: Event): Event[] {
	const first = new Date(e.start)
	if (first.getTime() > end) return []

	// https://datatracker.ietf.org/doc/html/rfc8984#section-4.3.6
	if (e.excluded) return []

	// https://datatracker.ietf.org/doc/html/rfc8984#section-4.3.3
	if (e.recurrenceRules) return [...iterRecurrence(start, end, e)]

	return [e]
}

function* iterRecurrence(
	start: number,
	end: number,
	evt: Event,
): Generator<Event> {
	const recurrence = iterRules(start, end, evt, evt.recurrenceRules)
	const exclusions = iterRules(start, end, evt, evt.excludedRecurrenceRules)
	let nextExclude = exclusions.next()
	for (const date of recurrence) {
		while (!nextExclude.done && nextExclude.value < date) {
			nextExclude = exclusions.next()
		}
		if (nextExclude.value === date) continue
		yield maybeOverride(evt, date)
	}
}

function maybeOverride(evt: Event, date: Date): Event {
	const recurrenceId = date.toISOString()
	const recurrenceIdTimeZone =
		Intl.DateTimeFormat().resolvedOptions().timeZone
	if (evt.recurrenceOverrides) {
		// TODO: how to handle patch, and timezone
		const patch = evt.recurrenceOverrides.get(recurrenceId)
		if (patch) {
			return {
				...evt,
				...patch,
				recurrenceId,
				recurrenceIdTimeZone,
			}
		}
	}
	return {
		...evt,
		recurrenceId,
		recurrenceIdTimeZone,
	}
}

function* iterRules(
	start: number,
	end: number,
	evt: Event,
	rules?: RecurrenceRule[],
): Generator<Date> {
	if (!rules) return

	const pq = new PriorityQueue<[Date, Generator<Date>]>((a, b) => a[0] < b[0])
	for (const rule of rules) {
		const gen = iterRule(start, end, evt, rule)
		const next = gen.next()
		if (!next.done) pq.add([next.value, gen])
	}

	while (!pq.isEmpty()) {
		const [date, gen] = pq.poll()!
		yield date
		const next = gen.next()
		if (!next.done) pq.add([next.value, gen])
	}
}

function* iterRule(
	start: number,
	end: number,
	evt: Event,
	rule: RecurrenceRule,
): Generator<Date> {
	if (rule.rscale && rule.rscale !== "gregorian")
		throw new Error("Unsupported rscale")
	if (rule.skip && rule.skip !== "omit") throw new Error("Unsupported skip")
	let nextEvent = new Date(evt.start)
	let count = 0
	while (true) {
		const ts = nextEvent.getTime()
		if (rule.count && count >= rule.count) break
		if (rule.until && ts > new Date(rule.until).getTime()) break
		if (ts > end) break
		if (ts >= start) yield nextEvent
		count++
		nextEvent = getNextDate(ts, rule.frequency, rule.interval || 1)
	}
}

function getNextDate(
	date: number,
	frequency: RecurrenceRule["frequency"],
	interval: number,
): Date {
	let newDate = new Date(date)
	switch (frequency) {
		case "yearly":
			newDate.setFullYear(newDate.getFullYear() + interval)
			break
		case "monthly":
			newDate.setMonth(newDate.getMonth() + interval)
			break
		case "weekly":
			newDate.setDate(newDate.getDate() + interval * 7)
			break
		case "daily":
			newDate.setDate(newDate.getDate() + interval)
			break
		case "hourly":
			newDate.setHours(newDate.getHours() + interval)
			break
		case "minutely":
			newDate.setMinutes(newDate.getMinutes() + interval)
			break
		case "secondly":
			newDate.setSeconds(newDate.getSeconds() + interval)
			break
	}
	return newDate
}

const pad = (value: number) => `0${value}`.slice(-2)

export const format = (date: Date, fmt: string): string => {
	const _year = date.getUTCFullYear()
	const _month = date.getUTCMonth() + 1
	const _date = date.getUTCDate()
	const _hour = date.getUTCHours()
	const _minute = date.getUTCMinutes()
	const _second = date.getUTCSeconds()
	const pairs: Record<string, string | number> = {
		YYYY: _year,
		M: _month,
		MM: pad(_month),
		D: _date,
		DD: pad(_date),
		h: _hour,
		hh: pad(_hour),
		m: _minute,
		mm: pad(_minute),
		s: _second,
		ss: pad(_second),
	}
	return fmt.replaceAll(
		/YYYY|MM?|DD?|hh?|mm?|ss?/g,
		(matched) => pairs[matched] as string,
	)
}

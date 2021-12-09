const pad = (value: number) => `0${value}`.slice(-2)

export const format = (date: Date, fmt: string, utc: boolean = true) => {
    const _year = utc ? date.getUTCFullYear() : date.getFullYear()
    const _month = (utc ? date.getUTCMonth() : date.getMonth()) + 1
    const _date = utc ? date.getUTCDate() : date.getDate()
    const _hour = utc ? date.getUTCHours() : date.getHours()
    const _minute = utc ? date.getUTCMinutes() : date.getMinutes()
    const _second = utc ? date.getUTCSeconds() : date.getSeconds()
    const pairs = {
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

    // @ts-ignore
    return fmt.replace(/YYYY|MM?|DD?|hh?|mm?|ss?/g, (matched) => pairs[matched])
}

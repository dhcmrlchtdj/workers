export type Logplex = {
    priority: string
    version: string
    timestamp: Date
    hostname: string
    app: string
    proc: string
    msg: string
}

// https://tools.ietf.org/html/rfc5424#section-6
const RE_LOGPLEX = new RegExp(
    [
        /\d+\s/, // size
        /<(\d+)>/, // priority
        /(\d+)\s/, // version
        /(\S+)\s/, // timestamp
        /(\S+)\s/, // hostname
        /(\S+)\s/, // app name
        /(\S+)\s-\s/, // proc id
        /(.*)/, // msg
    ]
        .map((re) => re.source)
        .join(''),
)

export const parse = (s: string): Logplex | null => {
    const m = RE_LOGPLEX.exec(s)
    if (m === null) return null

    const log: Logplex = {
        priority: m[1],
        version: m[2],
        timestamp: new Date(m[3]),
        hostname: m[4],
        app: m[5],
        proc: m[6],
        msg: m[7],
    }
    return log
}

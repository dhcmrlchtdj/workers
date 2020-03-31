import { execute } from '../_common/fauna'

/*

// index
CreateIndex({
    name: "badip-sortby-timestamp-desc",
    unique: false,
    serialized: true,
    source: Collection("badip"),
    terms: [],
    values: [
        {field: ["data", "timestamp"], reverse: true},
        {field: ["data", "ip"]}
    ]
})

// badip_add
Query(Lambda(
    ["ip"],
    Select(
        ["ts"],
        Create(Collection("badip"), {
            data: { ip: Var("ip"), timestamp: Now() }
        })
    )
))

// badip_get_all
Query(Lambda(
    [],
    Select(
        ["data"],
        Distinct(Map(
            Paginate(Match(Index("badip-sortby-timestamp-desc")), {size: 100000}),
            Lambda(["ts", "ip"], Var("ip"))
        ))
    )
))

// badip_get_recent
Query(Lambda(
    ["days"],
    Let(
        { now: Now() },
        Select(
            ["data"],
            Distinct(Map(
                Filter(
                    Paginate(Match(Index("badip-sortby-timestamp-desc")), {size: 100000}),
                    Lambda(["ts", "ip"], LTE(TimeDiff(Var("ts"), Var("now"), "days"), Var("days")))
                ),
                Lambda(["ts", "ip"], Var("ip"))
            ))
        )
    )
))

*/

declare const FAUNA_KEY: string

const sortIPv4 = (a: string, b: string): number => {
    const na = a
        .split('.')
        .map(Number)
        .reduce((a, b) => a * 256 + b)
    const nb = b
        .split('.')
        .map(Number)
        .reduce((a, b) => a * 256 + b)
    return na - nb
}
const sortIPv6 = (a: string, b: string): number => {
    const pa = a.split(':').map((x) => parseInt(x, 16))
    const pb = b.split(':').map((x) => parseInt(x, 16))
    let i = 0
    const len = Math.min(pa.length, pb.length) + 1
    while (i < len) {
        const na = pa[i]
        const nb = pb[i]
        if (na < nb) {
            return -1
        } else if (na > nb) {
            return 1
        } else if (Number.isNaN(na) && !Number.isNaN(nb)) {
            return -1
        } else if (!Number.isNaN(na) && Number.isNaN(nb)) {
            return 1
        }
        i++
    }
    return 0
}
const sortIP = (a: string, b: string): number => {
    const v4a = a.includes('.')
    const v4b = b.includes('.')
    if (v4a && v4b) {
        return sortIPv4(a, b)
    } else if (!v4a && !v4b) {
        return sortIPv6(a, b)
    } else if (v4a) {
        return -1
    } else {
        return 1
    }
}

export const report = async (ip: string) => {
    const stmt = JSON.stringify({
        call: { function: 'badip_add' },
        arguments: [ip],
    })
    await execute(FAUNA_KEY, stmt)
}

export const getAll = async (): Promise<string[]> => {
    const stmt = JSON.stringify({
        call: { function: 'badip_get_all' },
        arguments: [],
    })
    const resp = await execute<string[]>(FAUNA_KEY, stmt)
    return resp.sort(sortIP)
}

export const getRecent = async (days: number): Promise<string[]> => {
    const stmt = JSON.stringify({
        call: { function: 'badip_get_recent' },
        arguments: [days],
    })
    const resp = await execute<string[]>(FAUNA_KEY, stmt)
    return resp.sort(sortIP)
}

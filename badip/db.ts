import { execute } from '../_common/fauna'

/*

// badip_add
Query(Lambda(
    ["ip"],
    Select(
        ["ts"],
        Create(Collection("badip"), {
            data: { ip: Var("ip"), timestamp: Now(null) }
        })
    )
))

// badip_get_all
Query(Lambda(
    [],
    Select(
        ["data"],
        Distinct(Map(
            Paginate(Match(Index("badip-ip")), {size:100000}),
            Lambda(["x"], Select(["data", "ip"], Get(Var("x"))))
        ))
    )
))

// badip_get_recent
Query(Lambda(
    ["days"],
    Let(
        {now: Now()},
        Select(
            ["data"],
            Distinct(Map(
                Filter(
                    Paginate(Match(Index("badip-ip")), {size:100000}),
                    Lambda(
                        ["x"],
                        LTE(
                            TimeDiff(
                                Select(["data", "timestamp"], Get(Var("x"))),
                                Var("now"),
                                "days"
                            ),
                            Var("days")
                        )
                    )
                ),
                Lambda(["x"], Select(["data", "ip"], Get(Var("x"))))
            ))
        )
    )
))

*/

declare const FAUNA_KEY: string

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
    return resp.sort()
}

export const getRecent = async (days: number): Promise<string[]> => {
    const stmt = JSON.stringify({
        call: { function: 'badip_get_recent' },
        arguments: [days],
    })
    const resp = await execute<string[]>(FAUNA_KEY, stmt)
    return resp.sort()
}

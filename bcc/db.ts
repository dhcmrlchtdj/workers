import {} from '@cloudflare/workers-types'

// https://github.com/fauna/faunadb-js/blob/2.13.0/src/
// https://docs.fauna.com/fauna/current/start/fql_for_sql_users.html
// https://dashboard.fauna.com/webshell/@db/kv

declare const BCC_FAUNA_KEY: string

const execute = async (query: string) => {
    const resp = await fetch('https://db.fauna.com', {
        method: 'POST',
        headers: {
            Connection: 'close',
            'Content-Type': 'text/plain;charset=UTF-8',
            Authorization: `Basic ${btoa(BCC_FAUNA_KEY + ':')}`,
            'X-FaunaDB-API-Version': '2.7',
            'X-Fauna-Driver': 'JavascriptX',
        },
        body: query,
    })
    if (resp.ok) {
        const json = await resp.json()
        return json
    } else {
        const msg = await resp.text()
        throw msg
    }
}

export const addTags = async (chat_id: number, tags: string[]) => {
    /*
    If(
        Exists(Match(Index('bcc_sort_by_chat_id_asc'), -1001450758329)),
        Update(
            Select('ref',Get(Match(Index('bcc_sort_by_chat_id_asc'), -1001450758329))),
            {
                data: {
                    tags: Distinct(Union(
                        Select(["data","tags"], Get(Match(Index('bcc_sort_by_chat_id_asc'), -1001450758329))),
                        ['#ocaml', '#gc', '#type']
                    ))
                }
            }
        ),
        Create(
            Collection('bcc'),
            { data: { chat_id: -1001450758329, tags: ['#ocaml', '#gc', '#type'] } }
        )
    )
    */
    const query = JSON.stringify({
        if: {
            exists: {
                match: { index: 'bcc_sort_by_chat_id_asc' },
                terms: chat_id,
            },
        },
        then: {
            update: {
                select: 'ref',
                from: {
                    get: {
                        match: { index: 'bcc_sort_by_chat_id_asc' },
                        terms: chat_id,
                    },
                },
            },
            params: {
                object: {
                    data: {
                        object: {
                            tags: {
                                distinct: {
                                    union: [
                                        {
                                            select: ['data', 'tags'],
                                            from: {
                                                get: {
                                                    match: {
                                                        index:
                                                            'bcc_sort_by_chat_id_asc',
                                                    },
                                                    terms: chat_id,
                                                },
                                            },
                                        },
                                        tags,
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        },
        else: {
            create: { collection: 'bcc' },
            params: {
                object: {
                    data: {
                        object: {
                            chat_id,
                            tags,
                        },
                    },
                },
            },
        },
    })
    await execute(query)
}

export const getTags = async (chat_id: number): Promise<string[]> => {
    /*
    If(
        Exists(Match(Index('bcc_sort_by_chat_id_asc'), -1001450758329)),
        Select(["data","tags"], Get(Match(Index('bcc_sort_by_chat_id_asc'), -1001450758329))),
        []
    )
    */
    const query = JSON.stringify({
        if: {
            exists: {
                match: { index: 'bcc_sort_by_chat_id_asc' },
                terms: chat_id,
            },
        },
        then: {
            select: ['data', 'tags'],
            from: {
                get: {
                    match: { index: 'bcc_sort_by_chat_id_asc' },
                    terms: chat_id,
                },
            },
        },
        else: [],
    })
    const resp = await execute(query)
    const tags = resp.resource
    return tags
}

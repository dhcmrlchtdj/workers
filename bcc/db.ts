import {} from '@cloudflare/workers-types'

// https://github.com/fauna/faunadb-js/blob/2.13.0/src/
// https://docs.fauna.com/fauna/current/start/fql_for_sql_users.html

declare const BCC_FAUNA_KEY: string

const execute = async (query: string) => {
    const resp = await fetch('https://db.fauna.com', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${btoa(BCC_FAUNA_KEY + ':')}`,
            'X-FaunaDB-API-Version': '2.7',
            'X-Fauna-Driver': 'JavascriptX',
        },
        body: query,
    })
    const json = await resp.json()
    return json
}

export const addTags = async (chat_id: number, tags: string[]) => {
    /*
    Map(
        ['#xxx', '#yyy', '#zzz'],
        Lambda(
            'tag',
            Create(
                Collection('bcc'),
                { data: { chat_id: chat_id, tag: q.Var('tag') } }
            )
        )
    )
    */
    const query = JSON.stringify({
        map: {
            lambda: 'tag',
            expr: {
                create: { collection: 'bcc' },
                params: {
                    object: {
                        data: {
                            object: {
                                chat_id,
                                tag: { var: 'tag' },
                            },
                        },
                    },
                },
            },
        },
        collection: tags,
    })
    const resp = await execute(query)
    return resp
}

export const getTags = async (chat_id: number): Promise<string[]> => {
    /*
    Paginate(
        Match(Index('chat_id'), chat_id),
        100000
    )
    */
    const query = JSON.stringify({
        paginate: {
            match: { index: 'chat_id' },
            terms: chat_id,
        },
    })
    const resp = await execute(query)
    const tags = resp.resource.data
    return tags
}

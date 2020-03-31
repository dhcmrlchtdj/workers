// https://github.com/fauna/faunadb-js/blob/2.13.0/src/
// https://docs.fauna.com/fauna/current/start/fql_for_sql_users.html
// https://dashboard.fauna.com/webshell/@db/kv

declare const FAUNA_KEY: string

export const execute = async <T>(body: string): Promise<T> => {
    const resp = await fetch('https://db.fauna.com', {
        method: 'POST',
        headers: {
            connection: 'close',
            authorization: `Basic ${btoa(FAUNA_KEY + ':')}`,
            'x-faunadb-api-version': '2.7',
            'x-fauna-driver': 'JavascriptX',
        },
        body,
    })
    if (resp.ok) {
        const json = await resp.json()
        return json.resource
    } else {
        throw new Error(resp.statusText)
    }
}

export const call = <T>(func: string, ...args: unknown[]): Promise<T> => {
    return execute<T>(
        JSON.stringify({
            call: { function: func },
            arguments: args,
        }),
    )
}

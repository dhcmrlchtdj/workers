// https://github.com/fauna/faunadb-js/blob/2.13.0/src/
// https://docs.fauna.com/fauna/current/start/fql_for_sql_users.html
// https://dashboard.fauna.com/webshell/@db/kv

import { check } from './check_response'

export class FaunaClient {
    private auth: string
    constructor(token: string) {
        this.auth = `Basic ${btoa(token + ':')}`
    }
    async query<T>(body: string): Promise<T> {
        const resp = await fetch('https://db.fauna.com', {
            method: 'POST',
            headers: {
                authorization: this.auth,
                connection: 'close',
                'x-faunadb-api-version': '2.7',
                'x-fauna-driver': 'JavascriptX',
            },
            body,
        })
        await check(resp)
        const json = await resp.json()
        return json.resource
    }
    async execute<T>(func: string, ...args: unknown[]): Promise<T> {
        return this.query<T>(
            JSON.stringify({
                call: { function: func },
                arguments: args,
            }),
        )
    }
}

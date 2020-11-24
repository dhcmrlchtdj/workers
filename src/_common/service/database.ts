import { encode } from '../base64'
import { check } from '../check_response'

export type PGArray<T> = [
    {
        Elements: T[] | null
        Dimensions: Array<{ Length: number; LowerBound: number }> | null
        Status: number
    },
]

export class Database {
    private api: string
    private auth: string
    constructor(api: string, token: string) {
        this.api = api
        this.auth = 'Basic ' + encode('token:' + token)
    }

    async raw(sql: string, ...args: unknown[]): Promise<Response> {
        const resp = await fetch(this.api, {
            method: 'POST',
            headers: {
                authorization: this.auth,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ sql, args }),
        })
        await check(resp)
        return resp
    }

    async query<T>(sql: string, ...args: unknown[]): Promise<T[]> {
        const resp = await this.raw(sql, ...args)
        const json: T[] = await resp.json()
        return json
    }

    async queryOne<T>(sql: string, ...args: unknown[]): Promise<T | null> {
        const r = await this.query<T>(sql, ...args)
        if (r.length === 0) return null
        if (r.length > 1) throw new Error('query return more than 1 row')
        return r[0]!
    }
}

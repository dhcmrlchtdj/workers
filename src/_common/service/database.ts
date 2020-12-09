import { encode } from '../base64'
import { POST } from '../feccan'

export class Database {
    private api: string
    private auth: string
    constructor(api: string, token: string) {
        this.api = api
        this.auth = 'Basic ' + encode('token:' + token)
    }

    raw(sql: string, ...args: unknown[]): Promise<Response> {
        return POST(this.api, JSON.stringify({ sql, args }), {
            authorization: this.auth,
            'content-type': 'application/json',
        })
    }

    query<T>(sql: string, ...args: unknown[]): Promise<T[]> {
        return this.raw(sql, ...args).then((r) => r.json())
    }

    async queryOne<T>(sql: string, ...args: unknown[]): Promise<T | null> {
        const r = await this.query<T>(sql, ...args)
        if (r.length === 0) return null
        if (r.length > 1) throw new Error('query return more than 1 row')
        return r[0]!
    }
}

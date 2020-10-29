import { encode } from './crypto/base64'

export type PGArray<T> = [
    {
        Elements: T[] | null
        Dimensions: [{ Length: number; LowerBound: number }]
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
    async query<T>(sql: string, ...args: unknown[]): Promise<T[]> {
        const resp = await fetch(this.api, {
            method: 'POST',
            headers: {
                authorization: this.auth,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ sql, args }),
        })
        if (resp.status === 200) {
            const json = await resp.json()
            return json
        } else {
            const text = await resp.text()
            throw new Error(resp.statusText + '\n' + text)
        }
    }
    async queryOne<T>(sql: string, ...args: unknown[]): Promise<T | null> {
        const r = await this.query<T>(sql, ...args)
        if (r.length === 0) return null
        if (r.length > 1) throw new Error('query return more than 1 row')
        return r[0]
    }
}

// https://github.com/fauna/faunadb-js/blob/2.13.0/src/
// https://docs.fauna.com/fauna/current/start/fql_for_sql_users.html
// https://dashboard.fauna.com/webshell/@db/kv

import { POST } from "../http-client.js"

export class FaunaClient {
	private auth: string
	constructor(token: string) {
		this.auth = `Basic ${btoa(token + ":")}`
	}
	async query<T>(body: string): Promise<T> {
		const json = await POST("https://db.fauna.com", body, {
			authorization: this.auth,
			connection: "close",
			"x-faunadb-api-version": "2.7",
			"x-fauna-driver": "JavascriptX",
		}).then((r) => r.json<{ resource: T }>())
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

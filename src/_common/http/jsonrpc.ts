type ID = string | number | null

export type Request<
	T extends unknown[] | Record<string | number, unknown> = unknown[],
> = {
	jsonrpc: "2.0"
	id?: ID
	method: string
	params?: T
}
export type Notification<
	T extends unknown[] | Record<string | number, unknown> = unknown[],
> = Omit<Request<T>, "id">

export type Response<T = unknown, E = unknown> =
	| {
			jsonrpc: "2.0"
			id?: ID
			result: T
	  }
	| {
			jsonrpc: "2.0"
			id?: ID
			error: {
				code: number
				message: string
				data?: E
			}
	  }

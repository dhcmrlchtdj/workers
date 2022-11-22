type ReqInit = RequestInit<RequestInitCfProperties>

async function feccan(input: RequestInfo, init?: ReqInit): Promise<Response> {
	const resp = await fetch(input, init)
	if (resp.status < 200 || resp.status >= 300) {
		const text = await resp.text()
		const url = input instanceof Request ? input.url : input.toString()
		throw new Error(resp.statusText + "\n" + text + "\n" + url)
	}
	return resp
}

export async function GET(
	input: RequestInfo,
	headers?: HeadersInit,
): Promise<Response> {
	const opt: ReqInit = {}
	if (headers) opt.headers = headers
	return feccan(input, opt)
}

export async function PUT(
	input: RequestInfo,
	body: BodyInit | null,
	headers?: HeadersInit,
): Promise<Response> {
	const opt: ReqInit = { method: "PUT", body }
	if (headers) opt.headers = headers
	return feccan(input, opt)
}

export async function POST(
	input: RequestInfo,
	body: BodyInit | null,
	headers?: HeadersInit,
): Promise<Response> {
	const opt: ReqInit = { method: "POST", body }
	if (headers) opt.headers = headers
	return feccan(input, opt)
}

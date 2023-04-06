type ReqInit = RequestInit<RequestInitCfProperties>

export async function GET(
	input: RequestInfo,
	headers?: HeadersInit,
): Promise<Response> {
	const opt: ReqInit = {}
	if (headers) opt.headers = headers
	return fetch(input, opt)
}

export async function PUT(
	input: RequestInfo,
	body: BodyInit | null,
	headers?: HeadersInit,
): Promise<Response> {
	const opt: ReqInit = { method: "PUT", body }
	if (headers) opt.headers = headers
	return fetch(input, opt)
}

export async function POST(
	input: RequestInfo,
	body: BodyInit | null,
	headers?: HeadersInit,
): Promise<Response> {
	const opt: ReqInit = { method: "POST", body }
	if (headers) opt.headers = headers
	return fetch(input, opt)
}

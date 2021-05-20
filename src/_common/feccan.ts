async function feccan(
    input: RequestInfo,
    init?: RequestInit,
): Promise<Response> {
    const resp = await fetch(input, init)
    if (resp.status < 200 || resp.status >= 300) {
        const text = await resp.text()
        throw new Error(resp.statusText + "\n" + text)
    }
    return resp
}

export async function GET(
    input: RequestInfo,
    headers?: HeadersInit,
): Promise<Response> {
    return feccan(input, { headers })
}

export async function PUT(
    input: RequestInfo,
    body: BodyInit | null,
    headers?: HeadersInit,
): Promise<Response> {
    return feccan(input, { method: "PUT", body, headers })
}

export async function POST(
    input: RequestInfo,
    body: BodyInit | null,
    headers?: HeadersInit,
): Promise<Response> {
    return feccan(input, { method: "POST", body, headers })
}

// https://gist.github.com/mhart/1b3bbfbdfa6825baab003b5f55a15322

import {} from '@cloudflare/workers-types'

declare const SENTRY_KEY: string

const fakeUUIDv4 = () => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return [...bytes].map(b => ('0' + b.toString(16)).slice(-2)).join('') // to hex
}

const buildPacket = (project: string, request: Request, err: Error): string => {
    // https://docs.sentry.io/development/sdk-dev/event-payloads/
    const url = new URL(request.url)
    return JSON.stringify({
        event_id: fakeUUIDv4(),
        timestamp: Date.now() / 1000,
        platform: 'javascript',
        level: 'error',
        environment: 'production',
        tags: { project },
        request: {
            method: request.method,
            url: `${url.protocol}//${url.hostname}${url.pathname}`,
            query_string: url.search,
            headers: request.headers,
        },
        exception: {
            values: [
                {
                    type: err.name,
                    value: err.message,
                },
            ],
        },
    })
}

export const sentry = async (project: string, request: Request, err: Error) => {
    // https://docs.sentry.io/development/sdk-dev/overview/
    const PROJECT_ID = 5024029
    const url = `https://sentry.io/api/${PROJECT_ID}/store/`
    const auth = [
        'Sentry sentry_version=7',
        `sentry_client=sentry_at_cloudflare_worker/1.0`,
        `sentry_timestamp=${Date.now() / 1000}`,
        `sentry_key=${SENTRY_KEY}`,
    ].join(', ')
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sentry-Auth': auth,
        },
        body: buildPacket(project, request, err),
    })
    return resp
}

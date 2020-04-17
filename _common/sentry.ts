// https://gist.github.com/mhart/1b3bbfbdfa6825baab003b5f55a15322

const fakeUUIDv4 = () => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return [...bytes].map((b) => ('0' + b.toString(16)).slice(-2)).join('') // to hex
}

const parseError = (err: Error) => {
    return (err.stack || '')
        .split('\n')
        .slice(1)
        .map((line) => {
            if (line.match(/^\s*[-]{4,}$/)) {
                return { filename: line }
            }
            const lineMatch = line.match(
                /at (?:(.+)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/,
            )
            if (!lineMatch) return
            return {
                function: lineMatch[1] || undefined,
                filename: lineMatch[2] || undefined,
                lineno: Number(lineMatch[3]) || undefined,
                colno: Number(lineMatch[4]) || undefined,
                in_app: lineMatch[5] !== 'native' || undefined,
            }
        })
        .filter(Boolean)
        .reverse()
}

const buildPacket = (project: string, request: Request, err: Error): string => {
    // https://docs.sentry.io/development/sdk-dev/event-payloads/
    const url = new URL(request.url)
    const stacktrace = parseError(err)
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
            headers: (() => {
                const h: Record<string, string> = {}
                request.headers.forEach((v, k) => {
                    h[k] = v
                })
                return h
            })(),
        },
        exception: {
            values: [
                {
                    type: err.name,
                    value: err.message,
                    stacktrace: {
                        frames: stacktrace,
                    },
                },
            ],
        },
    })
}

export class Sentry {
    private projectId: number
    private project: string
    private token: string
    constructor(projectId: number, token: string, project: string) {
        this.project = project
        this.projectId = projectId
        this.token = token
    }
    async log(request: Request, err: Error) {
        // https://docs.sentry.io/development/sdk-dev/overview/
        const url = `https://sentry.io/api/${this.projectId}/store/`
        const auth = [
            'Sentry sentry_version=7',
            `sentry_client=sentry_at_cloudflare_worker/1.0`,
            `sentry_timestamp=${Date.now() / 1000}`,
            `sentry_key=${this.token}`,
        ].join(', ')
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': auth,
            },
            body: buildPacket(this.project, request, err),
        })
        return resp
    }
}

// https://gist.github.com/dukejones/d160a1b2051ff7c1a485bdcf966f1bcc
// https://explorer.docs.rollbar.com/#operation/create-item
// https://github.com/rollbar/rollbar.js
// https://github.com/stacktracejs/error-stack-parser

import { UUIDv4 } from './uuid'

type Level = 'critical' | 'error' | 'warning' | 'info' | 'debug'

export class Rollbar {
    token: string
    project: string
    constructor(token: string, project: string) {
        this.token = token
        this.project = project
    }

    private send(
        level: Level,
        body: Record<string, unknown>,
    ): Promise<Response> {
        const resp = fetch('https://api.rollbar.com/api/1/item/', {
            method: 'POST',
            body: JSON.stringify({
                access_token: this.token,
                data: {
                    environment: 'production',
                    timestamp: (Date.now() / 1000) | 0,
                    platform: 'cloudflare-worker',
                    language: 'javascript',
                    uuid: UUIDv4(),
                    level,
                    ...body,
                },
            }),
        })
        return resp
    }

    private log(level: Level, err: Error, req: Request | undefined) {
        const body = {
            title: `${err.name}: ${err.message}`,
            body: {
                trace: {
                    project: this.project,
                    exception: {
                        class: err.name,
                        message: err.message,
                    },
                    frames: parseError(err),
                },
            },
            request: parseRequest(req),
        }
        return this.send(level, body)
    }

    error(err: Error, req?: Request): Promise<Response> {
        return this.log('error', err, req)
    }

    warn(err: Error, req?: Request): Promise<Response> {
        return this.log('warning', err, req)
    }
}

function parseRequest(req: Request | undefined) {
    if (req === undefined) return undefined
    const url = new URL(req.url)
    const parsed = {
        url: `${url.protocol}//${url.hostname}${url.pathname}`,
        method: req.method,
        headers: (() => {
            const h: Record<string, string> = {}
            for (let [key, val] of req.headers.entries()) {
                h[key] = val
            }
            return h
        })(),
        query_string: url.search,
        user_ip: req.headers.get('CF-Connecting-IP'),
    }
    return parsed
}

function parseError(error: Error) {
    if (typeof error.stack !== 'string') return []
    const stacks = error.stack
        .split('\n')
        .filter((line) => line.match(/^\s*at .*(\S+:\d+|\(native\))/m))
        .map((line) => line.replace(/^\s+/, ''))
        .map((line) => {
            const loc = line.match(/ (\((.+):(\d+):(\d+)\)$)/)
            if (loc) line = line.replace(loc[0]!, '')
            const tokens = line.split(/\s+/).slice(1)
            const method = tokens.join(' ') || undefined
            const locationParts = ((urlLike: string) => {
                if (urlLike.indexOf(':') === -1) {
                    return [urlLike]
                }
                var regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/
                var parts = regExp.exec(urlLike.replace(/[()]/g, ''))!
                return [parts[1], parts[2], parts[3]]
            })(loc ? loc[1]! : tokens.pop()!)
            return {
                method,
                lineno: locationParts[1],
                colno: locationParts[2],
                filename: locationParts[0],
            }
        })
    return stacks
}

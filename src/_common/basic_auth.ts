import { decode } from './base64'

export function getBA(auth: string | null): [string, string] {
    if (!auth) throw new Error('missing authorization')
    const match = /\s*basic\s*(\S+)\s*/i.exec(auth)
    if (!match) throw new Error('expect BasicAuth')
    const user_pass = /([^:]+):(\S+)/.exec(decode(match[1]!))
    if (!user_pass) throw new Error('expect user:pass')
    return [user_pass[1]!, user_pass[2]!]
}

export function validate(req:Request, user: string, pass: string) {
    const [u, p] = getBA(req.headers.get('authorization'))
    if (u !== user || p !== pass) throw new Error('unauthorized')
}

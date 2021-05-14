import { POST } from '../feccan'

export const BASE_AWS_OREGON = 'https://us-west-2-1.aws.cloud2.influxdata.com'

export class Line {
    private _measurement: string
    private _ts: string
    private _tag: Record<string, string>
    private _field: Record<string, string>
    constructor() {
        this._measurement = ''
        this._ts = ''
        this._tag = {}
        this._field = {}
    }
    measurement(m: string): Line {
        this._measurement = m
        return this
    }
    timestamp(t: Date | string | number): Line {
        if (typeof t === 'string') {
            this._ts = t
        } else if (typeof t === 'number') {
            this._ts = String(t)
        } else {
            this._ts = String(t.getTime())
        }
        return this
    }
    tag(key: string, value: string): Line {
        this._tag[key] = value
        return this
    }
    bool(key: string, value: boolean): Line {
        if (value) {
            this._field[key] = 'true'
        } else {
            this._field[key] = 'false'
        }
        return this
    }
    str(key: string, value: string): Line {
        this._field[key] = JSON.stringify(value)
        return this
    }
    float(key: string, value: number): Line {
        this._field[key] = value.toString()
        return this
    }
    int(key: string, value: number): Line {
        this._field[key] = value.toString() + 'i'
        return this
    }
    uint(key: string, value: number): Line {
        this._field[key] = value.toString() + 'u'
        return this
    }
    serialize(): string {
        let tag = Object.keys(this._tag)
            .sort()
            .map((key) => `${key}=${this._tag[key]}`)
            .join(',')
        if (tag.length > 0) {
            tag = ',' + tag
        }
        const field = Object.keys(this._field)
            .sort()
            .map((key) => `${key}=${this._field[key]}`)
            .join(',')
        return `${this._measurement}${tag} ${field} ${this._ts}`
    }
}

export class InfluxClient {
    private token: string
    private base: string
    private query: string
    constructor(
        token: string,
        base: string,
        org: string,
        bucket: string,
        precision: 's' | 'ms' | 'us' | 'ns',
    ) {
        this.token = token
        this.base = base

        const u = new URLSearchParams()
        u.append('org', org)
        u.append('bucket', bucket)
        u.append('precision', precision)
        this.query = u.toString()
    }
    async write(data: string): Promise<void> {
        // https://docs.influxdata.com/influxdb/v2.0/api/#operation/PostWrite
        const url = `${this.base}/api/v2/write?${this.query}`
        await POST(url, data, { authorization: `Token ${this.token}` })
    }
}

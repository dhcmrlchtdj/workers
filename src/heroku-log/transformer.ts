import { Logplex } from '../_common/logplex'
import { parse } from '../_common/logfmt'
import { Line } from '../_common/service/influx'

const base = (log: Logplex): Line => {
    return new Line()
        .tag('priority', log.priority)
        .tag('version', log.version)
        .timestamp(log.timestamp)
        .tag('hostname', log.hostname)
        .tag('app', log.app)
        .tag('proc', log.proc)
}

const herokuRouter = (log: Logplex): Line => {
    const slog = parse(log.msg)
    const line = base(log)
        .str('at', slog.at!)
        .str('method', slog.method!)
        .str('path', slog.path!)
        .str('host', slog.host!)
        .str('request_id', slog.request_id!)
        .str('fwd', slog.fwd!)
        .str('dyno', slog.dyno!)
        .str('protocol', slog.protocol!)
        .int('connect', parseInt(slog.connect!))
        .int('service', parseInt(slog.service!))
        .int('status', parseInt(slog.status!))
        .int('bytes', parseInt(slog.bytes!))
    return line
}

const appLog = (log: Logplex): Line => {
    const line = base(log)
    if (!log.msg.startsWith('{')) {
        return line.str('msg', log.msg)
    }
    const jsonlog = JSON.parse(log.msg)
    if (jsonlog.module === 'pgx') {
        line.str('module', 'pgx').str('message', jsonlog.message)
        if (jsonlog.sql) {
            line.str('sql', jsonlog.sql).float('latency', jsonlog.time)
        }
    } else if (jsonlog.module === 'server') {
        line.str('module', 'server')
            .str('method', jsonlog.method)
            .str('path', jsonlog.path)
            .int('status', jsonlog.status)
            .int('bytes', jsonlog.bytes)
            .float('latency', jsonlog.latency)
            .str('ip', jsonlog.request['Cf-Connecting-Ip'])
            .str('ua', jsonlog.request['User-Agent'])
            .str('x-request-id', jsonlog.request['X-Request-Id'])
    } else {
        line.str('module', jsonlog.module || 'unknown').str('msg', log.msg)
    }
    return line
}

export const transform = (log: Logplex): Line | null => {
    if (log.app === 'heroku' && log.proc === 'router') {
        return herokuRouter(log).measurement('heroku/router')
    } else if (log.app === 'app' && log.proc.startsWith('scheduler.')) {
        return appLog(log).measurement('app/scheduler')
    } else if (log.app === 'app' && log.proc.startsWith('web.')) {
        return appLog(log).measurement('app/web')
    }
    return null
}

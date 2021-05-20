import { Logplex } from "../_common/logplex"
import { parse } from "../_common/logfmt"
import { Line } from "../_common/service/influx"

const base = (log: Logplex): Line => {
    return new Line()
        .str("log_priority", log.priority)
        .str("log_version", log.version)
        .timestamp(log.timestamp)
        .str("log_hostname", log.hostname)
        .str("log_app", log.app)
        .str("log_proc", log.proc)
}

const herokuRouter = (log: Logplex): Line => {
    const msg = parse(log.msg)
    const line = base(log)
        .str("at", msg.at!)
        .tag("method", msg.method!)
        .tag("path", msg.path!)
        .str("host", msg.host!)
        .str("request_id", msg.request_id!)
        .str("fwd", msg.fwd!)
        .str("dyno", msg.dyno!)
        .str("protocol", msg.protocol!)
        .int("connect", parseInt(msg.connect!))
        .int("service", parseInt(msg.service!))
        .int("status", parseInt(msg.status!))
        .int("bytes", parseInt(msg.bytes!))
    return line
}

const appLog = (log: Logplex): Line => {
    const line = base(log)
    if (!log.msg.startsWith("{")) {
        return line.str("msg", log.msg)
    }
    const jsonlog = JSON.parse(log.msg)
    if (jsonlog.module === "pgx") {
        line.str("module", "pgx")
            .str("message", jsonlog.message)
            .tag("sql", jsonlog.sql)
            .float("latency", jsonlog.time)
    } else if (jsonlog.module === "server") {
        line.str("module", "server")
            .tag("method", jsonlog.method)
            .tag("path", jsonlog.path)
            .int("status", jsonlog.status)
            .int("bytes", jsonlog.bytes)
            .float("latency", jsonlog.latency)
            .str("ip", jsonlog.request["Cf-Connecting-Ip"])
            .str("ua", jsonlog.request["User-Agent"])
            .str("x-request-id", jsonlog.request["X-Request-Id"])
    } else {
        line.str("module", jsonlog.module || "unknown").str("msg", log.msg)
    }
    return line
}

export const transform = (log: Logplex): Line | null => {
    if (log.app === "heroku" && log.proc === "router") {
        return herokuRouter(log).measurement("heroku/router")
    } else if (log.app === "app" && log.proc.startsWith("scheduler.")) {
        return appLog(log).measurement("app/scheduler")
    } else if (log.app === "app" && log.proc.startsWith("web.")) {
        return appLog(log).measurement("app/web")
    }
    return null
}

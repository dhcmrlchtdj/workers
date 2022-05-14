type Route<T> = {
    handler: T | null
    static: Map<string, Route<T>>
    parameter: Map<string, Route<T>>
    wildcard: T | null
}

class BaseRouter<T> {
    private _route: Route<T>
    constructor() {
        this._route = this._newRoute()
    }
    private _newRoute(): Route<T> {
        return {
            handler: null,
            static: new Map(),
            parameter: new Map(),
            wildcard: null,
        }
    }
    private _add(segments: string[], idx: number, handler: T, route: Route<T>) {
        if (idx === segments.length) {
            route.handler = handler
        } else {
            const seg = segments[idx]!
            if (seg === "*") {
                if (segments.length - idx > 1) {
                    throw new Error('"*" must be the last segment')
                }
                route.wildcard = handler
            } else if (seg[0] === ":") {
                const param = seg.slice(1)
                const r = route.parameter.get(param) ?? this._newRoute()
                this._add(segments, idx + 1, handler, r)
                route.parameter.set(param, r)
            } else {
                const r = route.static.get(seg) ?? this._newRoute()
                this._add(segments, idx + 1, handler, r)
                route.static.set(seg, r)
            }
        }
    }
    add(segments: string[], handler: T): this {
        this._add(segments, 0, handler, this._route)
        return this
    }
    private _lookup(
        segments: string[],
        idx: number,
        params: Map<string, string>,
        route: Route<T>,
    ): { handler: T | null; params: Map<string, string> } {
        if (idx === segments.length) {
            if (route.handler !== null) {
                return { handler: route.handler, params }
            }
        } else {
            const seg = segments[idx]!

            const staticRoute = route.static.get(seg)
            if (staticRoute !== undefined) {
                const matched = this._lookup(
                    segments,
                    idx + 1,
                    params,
                    staticRoute,
                )
                if (matched.handler !== null) return matched
            }

            if (seg !== "") {
                for (const [param, paramRoute] of route.parameter) {
                    const matched = this._lookup(
                        segments,
                        idx + 1,
                        params,
                        paramRoute,
                    )
                    if (matched.handler !== null) {
                        matched.params.set(param, seg)
                        return matched
                    }
                }
            }

            if (route.wildcard !== null) {
                params.set("*", segments.slice(idx).join("/"))
                return { handler: route.wildcard, params }
            }
        }
        return { handler: null, params }
    }
    lookup(segments: string[]) {
        return this._lookup(segments, 0, new Map(), this._route)
    }
}

export type Params = Map<string, string>
type Handler<Context> = (ctx: Context) => Promise<Response>

export class WorkerRouter<Context> {
    private _router: BaseRouter<Handler<Context>>
    constructor() {
        this._router = new BaseRouter<Handler<Context>>()
    }

    private async defaultHandler(_ctx: unknown) {
        return new Response("Handler Not Found", {
            status: 404,
            statusText: "Not Found",
        })
    }
    fallback(handler: Handler<Context>): this {
        this.defaultHandler = handler
        return this
    }

    private add(
        method: string,
        pathname: string,
        handler: Handler<Context>,
    ): this {
        const segments = [method.toUpperCase(), ...pathname.split("/")]
        this._router.add(segments, handler)
        return this
    }
    head(pathname: string, handler: Handler<Context>): this {
        return this.add("HEAD", pathname, handler)
    }
    get(pathname: string, handler: Handler<Context>): this {
        return this.add("GET", pathname, handler)
    }
    post(pathname: string, handler: Handler<Context>): this {
        return this.add("POST", pathname, handler)
    }
    put(pathname: string, handler: Handler<Context>): this {
        return this.add("PUT", pathname, handler)
    }
    delete(pathname: string, handler: Handler<Context>): this {
        return this.add("DELETE", pathname, handler)
    }

    route(request: Request): { handler: Handler<Context>; params: Params } {
        const url = new URL(request.url)
        const segments = [
            request.method.toUpperCase(),
            ...url.pathname.split("/"),
        ]
        const matched = this._router.lookup(segments)
        const handler = matched.handler ?? this.defaultHandler
        return { handler, params: matched.params }
    }
}

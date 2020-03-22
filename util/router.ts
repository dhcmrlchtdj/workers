export type Params = Map<string, string>

type Route<T> = {
    handler: T | null
    static: Map<string, Route<T>>
    parameter: Map<string, Route<T>>
    any: T | null
}

class BaseRouter<T> {
    private _routes: Route<T>
    constructor() {
        this._routes = this._newRoute()
    }
    private _newRoute(): Route<T> {
        return {
            handler: null,
            static: new Map(),
            parameter: new Map(),
            any: null,
        }
    }
    protected _add(
        segments: string[],
        handler: T,
        routes: Route<T> = this._routes,
    ) {
        if (segments.length === 0) {
            routes.handler = handler
        } else {
            const seg = segments[0]
            if (seg === '*') {
                routes.any = handler
            } else if (seg[0] === ':') {
                const param = seg.slice(1)
                const r = routes.parameter.get(param) ?? this._newRoute()
                this._add(segments.slice(1), handler, r)
                routes.parameter.set(param, r)
            } else {
                const r = routes.static.get(seg) ?? this._newRoute()
                this._add(segments.slice(1), handler, r)
                routes.static.set(seg, r)
            }
        }
    }
    protected _route(
        segments: string[],
        params: Params = new Map(),
        routes: Route<T> = this._routes,
    ): [T, Params] | null {
        if (segments.length === 0) {
            if (routes.handler !== null) {
                return [routes.handler, params]
            }
        } else {
            const seg = segments[0]
            const subSeg = segments.slice(1)

            const staticRoutes = routes.static.get(seg)
            if (staticRoutes !== undefined) {
                const matched = this._route(subSeg, params, staticRoutes)
                if (matched !== null) return matched
            }

            if (seg !== '') {
                for (const [param, paramRouter] of routes.parameter) {
                    const matched = this._route(subSeg, params, paramRouter)
                    if (matched !== null) {
                        params.set(param, seg)
                        return matched
                    }
                }
            }

            if (routes.any !== null) {
                params.set('*', segments.join('/'))
                return [routes.any, params]
            }
        }
        return null
    }
}

export type WorkerHandler = (
    event: FetchEvent,
    params: Params,
) => Promise<Response>

export class WorkerRouter extends BaseRouter<WorkerHandler> {
    constructor() {
        super()
    }

    private async defaultHandler(_event: FetchEvent, _params: Params) {
        return new Response('Not Found', { status: 404 })
    }
    fallback(handler: WorkerHandler): WorkerRouter {
        this.defaultHandler = handler
        return this
    }

    add(
        method: string,
        pathname: string,
        handler: WorkerHandler,
    ): WorkerRouter {
        const segments = [method.toUpperCase(), ...pathname.split('/')]
        super._add(segments, handler)
        return this
    }
    head(pathname: string, handler: WorkerHandler): WorkerRouter {
        return this.add('HEAD', pathname, handler)
    }
    get(pathname: string, handler: WorkerHandler): WorkerRouter {
        return this.add('GET', pathname, handler)
    }
    post(pathname: string, handler: WorkerHandler): WorkerRouter {
        return this.add('POST', pathname, handler)
    }
    put(pathname: string, handler: WorkerHandler): WorkerRouter {
        return this.add('PUT', pathname, handler)
    }
    delete(pathname: string, handler: WorkerHandler): WorkerRouter {
        return this.add('DELETE', pathname, handler)
    }

    route(event: FetchEvent): Promise<Response> {
        const request = event.request
        const url = new URL(request.url)
        const segments = [
            request.method.toUpperCase(),
            ...url.pathname.split('/'),
        ]
        const [handler, params] = super._route(segments) ?? [
            this.defaultHandler,
            new Map(),
        ]
        const resp = handler(event, params)
        return resp
    }
}

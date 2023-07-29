import { MIME_JSON, MIME_SVG, MIME_TEXT } from "./mime.js"

export type Builder<T> = (x: T) => void

///

export function compose<T>(...builders: Builder<T>[]): Builder<T> {
	return (x) => {
		for (const builder of builders) {
			builder(x)
		}
	}
}

///

export function noop<T>(): Builder<T> {
	return () => {}
}

///

export function headers<T extends { headers: Headers }>(
	h: HeadersInit,
): Builder<T> {
	return (b) => (b.headers = new Headers(h))
}

export function header<T extends { headers: Headers }>(
	key: string,
	value: string,
): Builder<T> {
	return (b) => b.headers.set(key, value)
}

export function contentType<T extends { headers: Headers }>(
	value: string,
): Builder<T> {
	return header("content-type", value)
}

export function cacheControl<T extends { headers: Headers }>(
	directives: string,
): Builder<T> {
	return header("cache-control", directives)
}

///

export function body<T extends { body?: BodyInit | null }>(
	data: BodyInit | null,
): Builder<T> {
	return (b) => (b.body = data)
}

export function json<T extends { body?: BodyInit | null; headers: Headers }>(
	data: unknown,
): Builder<T> {
	return compose(body(JSON.stringify(data)), contentType(MIME_JSON))
}

export function text<T extends { body?: BodyInit | null; headers: Headers }>(
	data: string,
): Builder<T> {
	return compose(body(data), contentType(MIME_TEXT))
}

export function svg<T extends { body?: BodyInit | null; headers: Headers }>(
	data: string,
): Builder<T> {
	return compose(body(data), contentType(MIME_SVG))
}

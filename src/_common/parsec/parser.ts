import { err, ok, type Result } from "../result"
import type { IO } from "./io"

export type Parser<T, W = unknown> = (_: IO<W>) => Promise<Result<T>>

export async function run<T, W>(
	parser: Parser<T, W>,
	io: IO<W>,
): Promise<Result<T>> {
	const r = await parser(io)
	if (r.isErr()) {
		await io.writer.error?.(r.unwrapErr())
	} else {
		await io.writer.close?.()
	}
	return r
}

///

export const EOF = Symbol("EOF")
export const EMPTY = Symbol("EMPTY")

export const eof: Parser<typeof EOF, unknown> = async (io) => {
	const next = await io.reader.peek()
	if (next === undefined) {
		return ok(EOF)
	} else {
		return err(`eof: expect EOF, actual '${next}'`)
	}
}
export const hasMore: Parser<typeof EMPTY, unknown> = async (io) => {
	const next = await io.reader.peek()
	if (next !== undefined) {
		return ok(EMPTY)
	} else {
		return err(`hasMore: expect not EOF`)
	}
}
export function char(ch: string): Parser<string> {
	return async (io) => {
		const next = await io.reader.peek()
		if (next === ch) {
			await io.reader.advance()
			return ok(next)
		} else {
			return err(`char: expect ${ch}, actual '${next}'`)
		}
	}
}
export function notChar(ch: string): Parser<string> {
	return async (io) => {
		const next = await io.reader.peek()
		if (next === undefined || next === ch) {
			return err(`notChar: unexpected '${next}'`)
		} else {
			await io.reader.advance()
			return ok(next)
		}
	}
}
export function satisfy(fn: (c: string) => boolean): Parser<string> {
	return async (io) => {
		const next = await io.reader.peek()
		if (next !== undefined && fn(next)) {
			await io.reader.advance()
			return ok(next)
		} else {
			return err(`satisfy: unexpected '${next}'`)
		}
	}
}
export function str(s: string): Parser<string> {
	return async (io) => {
		const next = await io.reader.peek(s.length)
		if (next === s) {
			await io.reader.advance(s.length)
			return ok(s)
		} else {
			return err(`str: expect ${s}, actual '${next}'`)
		}
	}
}

///

export function sequence<T extends Parser<unknown, W>[], W = unknown>(
	...cs: T
): Parser<{
	[K in keyof T]: T[K] extends Parser<infer R, W> ? R : never
}> {
	return async (io) => {
		const rs = []
		const mark = await io.reader.mark()
		for (const c of cs) {
			const r = await c(io)
			if (r.isErr()) {
				await io.reader.backTo(mark)
				return err(`seq: ${r.unwrapErr().message}`)
			} else {
				rs.push(r.unwrap())
			}
		}
		await io.reader.unmark(mark)
		return ok(rs) as any
	}
}
export function choice<T extends Parser<unknown, W>[], W = unknown>(
	...cs: T
): Parser<T[number] extends Parser<infer R, W> ? R : never> {
	return async (io) => {
		let r = err("choice: fail to match") as any
		for (const c of cs) {
			const mark = await io.reader.mark()
			r = await c(io)
			if (r.isOk()) {
				await io.reader.unmark(mark)
				return r
			} else {
				await io.reader.backTo(mark)
			}
		}
		return err(`choice: ${r.unwrapErr().message}`)
	}
}
export function repeat0<T, W = unknown>(c: Parser<T, W>): Parser<T[], W> {
	return async (io) => {
		const rs: T[] = []
		while (true) {
			const mark = await io.reader.mark()
			const r = await c(io)
			if (r.isErr()) {
				await io.reader.backTo(mark)
				break
			} else {
				await io.reader.unmark(mark)
				rs.push(r.unwrap())
			}
		}
		return ok(rs)
	}
}
export function repeat1<T, W = unknown>(c: Parser<T, W>): Parser<T[], W> {
	return bind(repeat0(c), (r) =>
		r.length > 0 ? ok(r) : err("repeat1: expect at least 1 element"),
	)
}
export function optional<T, W = unknown>(
	c: Parser<T, W>,
): Parser<T | typeof EMPTY, W> {
	return bindErr<T | typeof EMPTY>(c, (_) => ok(EMPTY))
}
export function sepBy<T, W = unknown>(
	sep: Parser<unknown, unknown>,
	c: Parser<T, W>,
): Parser<T[], W> {
	return async (io) => {
		const rs: T[] = []
		let mark = await io.reader.mark()
		while (true) {
			const r = await c(io)
			if (r.isErr()) {
				await io.reader.backTo(mark)
				break
			} else {
				await io.reader.unmark(mark)
				rs.push(r.unwrap())
			}

			mark = await io.reader.mark()
			const s = await sep(io)
			if (s.isErr()) {
				await io.reader.backTo(mark)
				break
			}
		}
		return ok(rs)
	}
}
export function delimited<T, W = unknown>(
	left: Parser<unknown, unknown>,
	c: Parser<T, W>,
	right: Parser<unknown, unknown>,
): Parser<T> {
	return mapErr(
		map(sequence(left, c, right), (r) => r[1]),
		(e) => "delimited: " + e.message,
	)
}
export function tuple0<T, W = unknown>(
	p0: Parser<T, W>,
	p1: Parser<unknown, unknown>,
): Parser<T, W> {
	return map(sequence(p0, p1), (r) => r[0])
}
export function tuple1<T, W = unknown>(
	p0: Parser<unknown, unknown>,
	p1: Parser<T, W>,
): Parser<T, W> {
	return map(sequence(p0, p1), (r) => r[1])
}
export function end<T, W = unknown>(p: Parser<T, W>): Parser<T, W> {
	return tuple0(p, eof)
}

///

export function effect<T, I = unknown>(
	p: Parser<T, I>,
	fn: (r: T) => void,
): Parser<T, I> {
	return map(p, (r) => (fn(r), r))
}
export function map<T, K, I = unknown>(
	p: Parser<T, I>,
	fn: (r: T) => K,
): Parser<K, I> {
	return bind(p, (r) => ok(fn(r)))
}
export function mapErr<T, I = unknown>(
	p: Parser<T, I>,
	fn: (r: Error) => Error | string,
): Parser<T, I> {
	return bindErr(p, (e) => err(fn(e)))
}
export function bind<T, K, I = unknown>(
	p: Parser<T, I>,
	fn: (r: T) => Result<K>,
): Parser<K, I> {
	return async (io) => {
		const r = await p(io)
		if (r.isOk()) {
			return fn(r.unwrap())
		} else {
			return r
		}
	}
}
export function bindErr<T, I = unknown>(
	p: Parser<T, I>,
	fn: (r: Error) => Result<T>,
): Parser<T, I> {
	return async (io) => {
		const r = await p(io)
		if (r.isErr()) {
			return fn(r.unwrapErr())
		} else {
			return r
		}
	}
}

///

export function effectAsync<T, I = unknown>(
	p: Parser<T, I>,
	fn: (r: T, io: IO<I>) => Promise<void>,
): Parser<T, I> {
	return mapAsync(p, async (r, io) => (await fn(r, io), r))
}
export function mapAsync<T, K, I = unknown>(
	p: Parser<T, I>,
	fn: (r: T, io: IO<I>) => Promise<K>,
): Parser<K, I> {
	return bindAsync(p, async (r, io) => ok(await fn(r, io)))
}
export function mapErrAsync<T, I = unknown>(
	p: Parser<T, I>,
	fn: (r: Error, io: IO<I>) => Promise<Error | string>,
): Parser<T, I> {
	return bindErrAsync(p, async (e, io) => err(await fn(e, io)))
}
export function bindAsync<T, K, I = unknown>(
	p: Parser<T, I>,
	fn: (r: T, io: IO<I>) => Promise<Result<K>>,
): Parser<K, I> {
	return async (io) => {
		const r = await p(io)
		if (r.isOk()) {
			return fn(r.unwrap(), io)
		} else {
			return r
		}
	}
}
export function bindErrAsync<T, I = unknown>(
	p: Parser<T, I>,
	fn: (r: Error, io: IO<I>) => Promise<Result<T>>,
): Parser<T, I> {
	return async (io) => {
		const r = await p(io)
		if (r.isErr()) {
			return fn(r.unwrapErr(), io)
		} else {
			return r
		}
	}
}

///

export function fix<T, W = unknown>(
	f: (x: Parser<T, W>) => Parser<T, W>,
): Parser<T, W> {
	const _fix: typeof fix = (ff) => (io) => ff(_fix(ff))(io)
	return _fix(f)
}

///

export const space = satisfy(
	(c) => c === " " || c === "\t" || c === "\r" || c === "\n",
)
export const space0 = repeat0(space)
export const space1 = repeat1(space)

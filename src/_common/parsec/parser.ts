import { err, ok, type Result } from "../result"
import type { IOReader } from "./io"

export type Parser<T> = (_: IOReader) => Promise<Result<T>>

///

export const EOF = Symbol("EOF")
export const EMPTY = Symbol("EMPTY")

export const eof: Parser<typeof EOF> = async (io) => {
	const next = await io.peek()
	if (next === undefined) {
		return ok(EOF)
	} else {
		return err(`eof: expect EOF, actual '${next}'`)
	}
}
export const hasMore: Parser<typeof EMPTY> = async (io) => {
	const next = await io.peek()
	if (next !== undefined) {
		return ok(EMPTY)
	} else {
		return err(`hasMore: expect not EOF`)
	}
}
export function anyChar(): Parser<string> {
	return async (io) => {
		const next = await io.peek()
		if (next !== undefined) {
			await io.advance()
			return ok(next)
		} else {
			return err(`anyChar: expect not EOF`)
		}
	}
}
export function char(ch: string): Parser<string> {
	return async (io) => {
		const next = await io.peek()
		if (next === ch) {
			await io.advance()
			return ok(next)
		} else {
			return err(`char: expect ${ch}, actual '${next}'`)
		}
	}
}
export function notChar(ch: string): Parser<string> {
	return async (io) => {
		const next = await io.peek()
		if (next === undefined || next === ch) {
			return err(`notChar: unexpected '${next}'`)
		} else {
			await io.advance()
			return ok(next)
		}
	}
}
export function satisfy(fn: (c: string) => boolean): Parser<string> {
	return async (io) => {
		const next = await io.peek()
		if (next !== undefined && fn(next)) {
			await io.advance()
			return ok(next)
		} else {
			return err(`satisfy: unexpected '${next}'`)
		}
	}
}
export function str(s: string): Parser<string> {
	return async (io) => {
		const next = await io.peek(s.length)
		if (next === s) {
			await io.advance(s.length)
			return ok(s)
		} else {
			return err(`str: expect ${s}, actual '${next}'`)
		}
	}
}

///

export function pure<T>(val: T): Parser<T> {
	return async () => ok(val)
}
export function sequence<T extends Parser<unknown>[]>(
	...cs: T
): Parser<{
	[K in keyof T]: T[K] extends Parser<infer R> ? R : never
}> {
	return async (io) => {
		const rs = []
		const mark = await io.mark()
		for (const c of cs) {
			const r = await c(io)
			if (r.isErr()) {
				await io.backTo(mark)
				return err(`seq: ${r.unwrapErr().message}`)
			} else {
				rs.push(r.unwrap())
			}
		}
		await io.unmark(mark)
		return ok(rs) as any
	}
}
export function choice<T extends Parser<unknown>[]>(
	...cs: T
): Parser<T[number] extends Parser<infer R> ? R : never> {
	return async (io) => {
		let r = err("choice: fail to match") as any
		for (const c of cs) {
			const mark = await io.mark()
			r = await c(io)
			if (r.isOk()) {
				await io.unmark(mark)
				return r
			} else {
				await io.backTo(mark)
			}
		}
		return err(`choice: ${r.unwrapErr().message}`)
	}
}
export function repeat0<T>(c: Parser<T>): Parser<T[]> {
	return async (io) => {
		const rs: T[] = []
		while (true) {
			const mark = await io.mark()
			const r = await c(io)
			if (r.isErr()) {
				await io.backTo(mark)
				break
			} else {
				await io.unmark(mark)
				rs.push(r.unwrap())
			}
		}
		return ok(rs)
	}
}
export function repeat1<T>(c: Parser<T>): Parser<T[]> {
	return bind(repeat0(c), (r) =>
		r.length > 0 ? ok(r) : err("repeat1: expect at least 1 element"),
	)
}
export function optional<T>(c: Parser<T>): Parser<T | typeof EMPTY> {
	return bindErr<T | typeof EMPTY>(c, (_) => ok(EMPTY))
}
export function sepBy<T>(sep: Parser<unknown>, c: Parser<T>): Parser<T[]> {
	return async (io) => {
		const rs: T[] = []
		let mark = await io.mark()
		while (true) {
			const r = await c(io)
			if (r.isErr()) {
				await io.backTo(mark)
				break
			} else {
				await io.unmark(mark)
				rs.push(r.unwrap())
			}

			mark = await io.mark()
			const s = await sep(io)
			if (s.isErr()) {
				await io.backTo(mark)
				break
			}
		}
		return ok(rs)
	}
}
export function delimited<T>(
	left: Parser<unknown>,
	c: Parser<T>,
	right: Parser<unknown>,
): Parser<T> {
	return mapErr(
		map(sequence(left, c, right), (r) => r[1]),
		(e) => "delimited: " + e.message,
	)
}
export function tuple0<T>(p0: Parser<T>, p1: Parser<unknown>): Parser<T> {
	return map(sequence(p0, p1), (r) => r[0])
}
export function tuple1<T>(p0: Parser<unknown>, p1: Parser<T>): Parser<T> {
	return map(sequence(p0, p1), (r) => r[1])
}
export function end<T>(p: Parser<T>): Parser<T> {
	return tuple0(p, eof)
}

///

export function tap<T>(p: Parser<T>, fn: (r: T) => void): Parser<T> {
	return map(p, (r) => (fn(r), r))
}
export function map<T, K>(p: Parser<T>, fn: (r: T) => K): Parser<K> {
	return bind(p, (r) => ok(fn(r)))
}
export function mapErr<T>(
	p: Parser<T>,
	fn: (r: Error) => Error | string,
): Parser<T> {
	return bindErr(p, (e) => err(fn(e)))
}
export function bind<T, K>(p: Parser<T>, fn: (r: T) => Result<K>): Parser<K> {
	return async (io) => {
		const r = await p(io)
		if (r.isOk()) {
			return fn(r.unwrap())
		} else {
			return r
		}
	}
}
export function bindErr<T>(
	p: Parser<T>,
	fn: (r: Error) => Result<T>,
): Parser<T> {
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

export function fix<T>(f: (x: Parser<T>) => Parser<T>): Parser<T> {
	const _fix: typeof fix = (ff) => (io) => ff(_fix(ff))(io)
	return _fix(f)
}

///

export const space = satisfy(
	(c) => c === " " || c === "\t" || c === "\r" || c === "\n",
)
export const space0 = repeat0(space)
export const space1 = repeat1(space)

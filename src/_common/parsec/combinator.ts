import { err, ok, type Result } from "../result"
import { advance, drop, mark, read, reset, type OP } from "./op"

export type Parser<T> = () => Generator<OP, Result<T>>

///

export const EOF = Symbol("EOF")
export const EMPTY = Symbol("EMPTY")

export const eof: Parser<typeof EOF> = function* () {
	const ch = yield read()
	if (ch === undefined) {
		return ok(EOF)
	} else {
		return err(`eof: expect EOF, actual '${ch}'`)
	}
}
export const notEof: Parser<string> = function* () {
	const ch = yield read()
	if (ch !== undefined) {
		return ok(ch)
	} else {
		return err(`notEof: expect not EOF`)
	}
}
export const anyChar: Parser<string> = function* () {
	const ch = yield read()
	if (ch !== undefined) {
		yield advance()
		return ok(ch)
	} else {
		return err(`anyChar: expect not EOF`)
	}
}
export function char(ch: string): Parser<string> {
	if (ch.length === 0 || ch.length > 1)
		throw new Error(`char: expect single char input, actual '${ch}'`)
	return function* () {
		const curr = yield read()
		if (curr === ch) {
			yield advance()
			return ok(curr)
		} else {
			return err(`char: expect ${ch}, actual '${curr}'`)
		}
	}
}
export function notChar(ch: string): Parser<string> {
	if (ch.length === 0 || ch.length > 1)
		throw new Error(`notChar: expect single char input, actual '${ch}'`)
	return function* () {
		const curr = yield read()
		if (curr === undefined || curr === ch) {
			return err(`notChar: unexpected '${curr}'`)
		} else {
			yield advance()
			return ok(curr)
		}
	}
}
export function satisfy(fn: (c: string) => boolean): Parser<string> {
	return function* () {
		const ch = yield read()
		if (ch !== undefined && fn(ch)) {
			yield advance()
			return ok(ch)
		} else {
			return err(`satisfy: unexpected '${ch}'`)
		}
	}
}
export function str(s: string): Parser<string> {
	if (s.length === 0) return pure("")
	if (s.length === 1) return mapErr(char(s), (e) => "str: " + e.message)
	return function* () {
		let buf = ""
		for (const c of s) {
			const ch = yield read()
			if (ch === c) {
				yield advance()
				buf += ch
			} else {
				return err(`str: expect ${s}, actual '${buf}'`)
			}
		}
		return ok(s)
	}
}

///

export function pure<T>(val: T): Parser<T> {
	// eslint-disable-next-line require-yield
	return function* () {
		return ok(val)
	}
}
export function seq<T extends Parser<unknown>[]>(
	...cs: T
): Parser<{
	[K in keyof T]: T[K] extends Parser<infer R> ? R : never
}> {
	return function* () {
		const rs = []
		for (const c of cs) {
			const r = yield* c()
			if (r.isErr()) {
				return err(`seq: ${r.unwrapErr().message}`)
			} else {
				rs.push(r.unwrap())
			}
		}
		return ok(rs) as any
	}
}
export function choice<T extends Parser<unknown>[]>(
	...cs: T
): Parser<T[number] extends Parser<infer R> ? R : never> {
	return function* () {
		let r: Result<any> = err("fail to match")
		for (const c of cs) {
			const pos = yield mark()
			r = yield* c()
			if (r.isErr()) {
				yield reset(pos)
			} else {
				yield drop(pos)
				return r
			}
		}
		return err(`choice: ${r.unwrapErr().message}`)
	}
}
export function repeat0<T>(c: Parser<T>): Parser<T[]> {
	return function* () {
		const rs: T[] = []
		while (true) {
			const pos = yield mark()
			const r = yield* c()
			if (r.isErr()) {
				yield reset(pos)
				break
			} else {
				yield drop(pos)
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
export function opt<T>(c: Parser<T>): Parser<T | typeof EMPTY> {
	return function* () {
		const pos = yield mark()
		const r = yield* c()
		if (r.isErr()) {
			yield reset(pos)
			return ok(EMPTY)
		} else {
			yield drop(pos)
			return r
		}
	}
}
export function sepBy<T>(sep: Parser<unknown>, c: Parser<T>): Parser<T[]> {
	return function* () {
		const rs: T[] = []
		let pos = yield mark()
		while (true) {
			const r = yield* c()
			if (r.isErr()) {
				yield reset(pos)
				break
			} else {
				yield drop(pos)
				rs.push(r.unwrap())
			}

			pos = yield mark()
			const s = yield* sep()
			if (s.isErr()) {
				yield reset(pos)
				break
			}
		}
		return ok(rs)
	}
}
export function between<T>(
	left: Parser<unknown>,
	c: Parser<T>,
	right: Parser<unknown>,
): Parser<T> {
	return mapErr(
		map(seq(left, c, right), (r) => r[1]),
		(e) => "delimited: " + e.message,
	)
}
export function tuple0<T>(p0: Parser<T>, p1: Parser<unknown>): Parser<T> {
	return map(seq(p0, p1), (r) => r[0])
}
export function tuple1<T>(p0: Parser<unknown>, p1: Parser<T>): Parser<T> {
	return map(seq(p0, p1), (r) => r[1])
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
	return function* () {
		const r = yield* p()
		if (r.isErr()) {
			return r
		} else {
			return fn(r.unwrap())
		}
	}
}
export function bindErr<T>(
	p: Parser<T>,
	fn: (r: Error) => Result<T>,
): Parser<T> {
	return function* () {
		const r = yield* p()
		if (r.isErr()) {
			return fn(r.unwrapErr())
		} else {
			return r
		}
	}
}

///

export function fix<T>(f: (x: Parser<T>) => Parser<T>): Parser<T> {
	const _fix: typeof fix = (ff) => () => ff(_fix(ff))()
	return _fix(f)
}

///

export const space = satisfy(
	(c) => c === " " || c === "\t" || c === "\r" || c === "\n",
)
export const space0 = repeat0(space)
export const space1 = repeat1(space)

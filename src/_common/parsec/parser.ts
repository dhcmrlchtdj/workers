import { err, ok, type Result } from "../result"
import type { AsyncReader, SyncReader } from "./io"
import { advance, backTo, mark, peek, unmark, type OP } from "./op"

export type Parser<T> = () => Generator<OP, Result<T>>

export function parse<T>(parser: Parser<T>, r: SyncReader): Result<T> {
	const gen = parser()
	let op = gen.next()
	while (!op.done) {
		const v = op.value
		switch (v.t) {
			case "peek":
				op = gen.next(r.peek(v.n))
				break
			case "advance":
				op = gen.next(r.advance(v.n))
				break
			case "mark":
				op = gen.next(r.mark())
				break
			case "unmark":
				op = gen.next(r.unmark(v.pos))
				break
			case "backTo":
				op = gen.next(r.backTo(v.pos))
				break
			default:
				throw new Error("unreachable")
		}
	}
	return op.value
}
export async function parseAsync<T>(
	parser: Parser<T>,
	r: AsyncReader,
): Promise<Result<T>> {
	const gen = parser()
	let op = gen.next()
	while (!op.done) {
		const v = op.value
		switch (v.t) {
			case "peek":
				op = gen.next(await r.peek(v.n))
				break
			case "advance":
				op = gen.next(r.advance(v.n))
				break
			case "mark":
				op = gen.next(r.mark())
				break
			case "unmark":
				op = gen.next(r.unmark(v.pos))
				break
			case "backTo":
				op = gen.next(r.backTo(v.pos))
				break
			default:
				throw new Error("unreachable")
		}
	}
	return op.value
}

///

export const EOF = Symbol("EOF")
export const EMPTY = Symbol("EMPTY")

export const eof: Parser<typeof EOF> = function* () {
	const next = yield peek()
	if (next === undefined) {
		return ok(EOF)
	} else {
		return err(`eof: expect EOF, actual '${next}'`)
	}
}
export const notEof: Parser<typeof EMPTY> = function* () {
	const next = yield peek()
	if (next !== undefined) {
		return ok(EMPTY)
	} else {
		return err(`notEof: expect not EOF`)
	}
}
export const anyChar: Parser<string> = function* () {
	const next = yield peek()
	if (next !== undefined) {
		yield advance()
		return ok(next)
	} else {
		return err(`anyChar: expect not EOF`)
	}
}
export function char(ch: string): Parser<string> {
	return function* () {
		const next = yield peek()
		if (next === ch) {
			yield advance()
			return ok(next)
		} else {
			return err(`char: expect ${ch}, actual '${next}'`)
		}
	}
}
export function notChar(ch: string): Parser<string> {
	return function* () {
		const next = yield peek()
		if (next === undefined || next === ch) {
			return err(`notChar: unexpected '${next}'`)
		} else {
			yield advance()
			return ok(next)
		}
	}
}
export function satisfy(fn: (c: string) => boolean): Parser<string> {
	return function* () {
		const next = yield peek()
		if (next !== undefined && fn(next)) {
			yield advance()
			return ok(next)
		} else {
			return err(`satisfy: unexpected '${next}'`)
		}
	}
}
export function str(s: string): Parser<string> {
	return function* () {
		const next = yield peek(s.length)
		if (next === s) {
			yield advance(s.length)
			return ok(s)
		} else {
			return err(`str: expect ${s}, actual '${next}'`)
		}
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
		const pos = yield mark()
		for (const c of cs) {
			const r = yield* c()
			if (r.isErr()) {
				yield backTo(pos)
				return err(`seq: ${r.unwrapErr().message}`)
			} else {
				rs.push(r.unwrap())
			}
		}
		yield unmark(pos)
		return ok(rs) as any
	}
}
export function choice<T extends Parser<unknown>[]>(
	...cs: T
): Parser<T[number] extends Parser<infer R> ? R : never> {
	return function* () {
		let r = err("choice: fail to match") as any
		for (const c of cs) {
			const pos = yield mark()
			r = yield* c()
			if (r.isOk()) {
				yield unmark(pos)
				return r
			} else {
				yield backTo(pos)
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
				yield backTo(pos)
				break
			} else {
				yield unmark(pos)
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
	return bindErr<T | typeof EMPTY>(c, (_) => ok(EMPTY))
}
export function sepBy<T>(sep: Parser<unknown>, c: Parser<T>): Parser<T[]> {
	return function* () {
		const rs: T[] = []
		let pos = yield mark()
		while (true) {
			const r = yield* c()
			if (r.isErr()) {
				yield backTo(pos)
				break
			} else {
				yield unmark(pos)
				rs.push(r.unwrap())
			}

			pos = yield mark()
			const s = yield* sep()
			if (s.isErr()) {
				yield backTo(pos)
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

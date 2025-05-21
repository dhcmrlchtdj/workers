import type { Result } from "../result"
import type { Parser } from "./combinator"
import type { AsyncReader, SyncReader } from "./io"
import type { OP } from "./op"

export function parse<T>(parser: Parser<T>, r: SyncReader): Result<T> {
	const gen = parser()
	let op = gen.next()
	while (!op.done) {
		op = gen.next(handleOp(op.value, r))
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
		op = gen.next(await handleOp(op.value, r))
	}
	return op.value
}

function handleOp(op: OP, r: SyncReader | AsyncReader): unknown {
	switch (op.t) {
		case "read":
			return r.read()
		case "advance":
			return r.advance()
		case "mark":
			return r.mark()
		case "drop":
			return r.drop(op.pos)
		case "reset":
			return r.reset(op.pos)
		default:
			throw new Error("unreachable")
	}
}

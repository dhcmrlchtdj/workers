// based on https://github.com/ocaml/ocaml/blob/4.12.0/otherlibs/systhreads/event.ml
// which is distributed with LGPL-2.1

import { Deferred } from "./deferred.js"
import { Option, none, some } from "./option.js"

const genSym = (() => {
	let id = 0
	return () => id++
})()

function randomize<T>(arr: T[]): T[] {
	return [...arr].sort(() => Math.random() - 0.5)
}

const noop = () => {}

///

type BasicOp<T> = {
	poll(): boolean
	suspend(): void
	result(): T
}

type Behavior<T> = (performed: Deferred<number>, idx: number) => BasicOp<T>

type GenOp<T> = { gen: Behavior<T>; shouldNotAbort: number[] }
type AbortEnv = Map<number, () => void> // map id to onAbort

///

abstract class Op<T> {
	sync(): Promise<T> {
		const { genOps, abortEnv } = this.flatten([], [], new Map())
		return basicSync(abortEnv, randomize(genOps))
	}
	poll(): Option<T> {
		const { genOps, abortEnv } = this.flatten([], [], new Map())
		return basicPoll(abortEnv, randomize(genOps))
	}
	wrapAbort(onAbort: () => void): Op<T> {
		return new WrapAbort(this, onAbort)
	}
	abstract wrap<R>(fn: (v: T) => R): Op<R>
	protected abstract flatten(
		abortList: number[],
		genOps: GenOp<T>[],
		abortEnv: AbortEnv,
	): { genOps: GenOp<T>[]; abortEnv: AbortEnv }
}
class Communication<T> extends Op<T> {
	private behavior: Behavior<T>
	constructor(behavior: Behavior<T>) {
		super()
		this.behavior = behavior
	}
	wrap<R>(fn: (v: T) => R): Op<R> {
		return new Communication((performed, idx) => {
			const op = this.behavior(performed, idx)
			return {
				poll: () => op.poll(),
				suspend: () => op.suspend(),
				result: () => fn(op.result()),
			}
		})
	}
	flatten(
		shouldNotAbort: number[],
		genOps: GenOp<T>[],
		abortEnv: AbortEnv,
	): { genOps: GenOp<T>[]; abortEnv: AbortEnv } {
		genOps.push({ gen: this.behavior, shouldNotAbort })
		return { genOps, abortEnv }
	}
}
class Choose<T> extends Op<T> {
	private ops: Op<T>[]
	constructor(ops: Op<T>[]) {
		super()
		this.ops = ops
	}
	wrap<R>(fn: (v: T) => R): Op<R> {
		return new Choose(this.ops.map((e) => e.wrap(fn)))
	}
	flatten(
		shouldNotAbort: number[],
		genOps: GenOp<T>[],
		abortEnv: AbortEnv,
	): { genOps: GenOp<T>[]; abortEnv: AbortEnv } {
		return this.ops.reduce(
			({ genOps, abortEnv }, curr: Op<T>) => {
				// @ts-expect-error
				return curr.flatten(shouldNotAbort, genOps, abortEnv)
			},
			{ genOps, abortEnv },
		)
	}
}
class WrapAbort<T> extends Op<T> {
	private op: Op<T>
	private onAbort: () => void
	constructor(op: Op<T>, onAbort: () => void) {
		super()
		this.op = op
		this.onAbort = onAbort
	}
	wrap<R>(fn: (v: T) => R): Op<R> {
		return new WrapAbort(this.op.wrap(fn), this.onAbort)
	}
	flatten(
		shouldNotAbort: number[],
		genOps: GenOp<T>[],
		abortEnv: AbortEnv,
	): { genOps: GenOp<T>[]; abortEnv: AbortEnv } {
		const id = genSym()
		abortEnv.set(id, this.onAbort)
		const shouldNotAbort2 = [...shouldNotAbort, id]
		// @ts-expect-error
		return this.op.flatten(shouldNotAbort2, genOps, abortEnv)
	}
}
class Guard<T> extends Op<T> {
	private g: () => Op<T>
	constructor(g: () => Op<T>) {
		super()
		this.g = g
	}
	wrap<R>(fn: (v: T) => R): Op<R> {
		return new Guard(() => this.g().wrap(fn))
	}
	flatten(
		shouldNotAbort: number[],
		genOps: GenOp<T>[],
		abortEnv: AbortEnv,
	): { genOps: GenOp<T>[]; abortEnv: AbortEnv } {
		const op = this.g()
		// @ts-expect-error
		return op.flatten(shouldNotAbort, genOps, abortEnv)
	}
}

///

export function select<T>(...ops: Op<T>[]): Promise<T> {
	return new Choose(ops).sync()
}
export function choose<T>(...ops: Op<T>[]): Op<T> {
	return new Choose(ops)
}
export function guard<T>(fn: () => Op<T>): Op<T> {
	return new Guard(fn)
}

///

export function always<T>(data: T): Op<T> {
	return new Communication((performed, idx) => {
		return {
			poll: () => {
				performed.resolve(idx)
				return true
			},
			suspend: () => {},
			result: () => data,
		}
	})
}
export function never(): Op<never> {
	return new Communication((_performed, _idx) => {
		return {
			poll: () => false,
			suspend: () => {},
			result: () => {
				throw new Error("never")
			},
		}
	})
}
export function fromPromise<T>(p: Promise<T>): Op<Promise<T>> {
	let fulfilled = false
	p.finally(() => (fulfilled = true))
	return new Communication((performed, idx) => {
		return {
			poll: () => {
				if (fulfilled) {
					performed.resolve(idx)
					return true
				} else {
					return false
				}
			},
			suspend: () => {
				p.finally(() => performed.resolve(idx))
			},
			result: () => p,
		}
	})
}
export function fromAbortSignal(signal: AbortSignal): Op<Promise<unknown>> {
	const d = new Deferred<unknown>()
	if (signal.aborted) {
		d.resolve(signal.reason)
	} else {
		const cb = () => d.resolve(signal.reason)
		signal.addEventListener("abort", cb, { once: true })
	}
	return new Communication((performed, idx) => {
		return {
			poll: () => {
				if (d.isFulfilled) {
					performed.resolve(idx)
					return true
				} else {
					return false
				}
			},
			suspend: () => {
				d.promise.finally(() => performed.resolve(idx)).catch(noop)
			},
			result: () => d.promise,
		}
	})
}
export function fromTimeout(delay: number): Op<unknown> {
	return guard(() => fromAbortSignal(AbortSignal.timeout(delay)))
}

///

async function basicSync<T>(
	abortEnv: AbortEnv,
	genOps: GenOp<T>[],
): Promise<T> {
	const performed = new Deferred<number>()
	const ops = genOps.map(({ gen }, idx) => {
		return gen(performed, idx)
	})
	const pollOps = (idx: number): false | number => {
		if (idx >= ops.length) return false
		if (ops[idx]!.poll()) return idx
		return pollOps(idx + 1)
	}

	const ready = pollOps(0)
	if (ready === false) {
		ops.forEach((x) => x.suspend())
	}
	const idx = await performed.promise

	const result = ops[idx]!.result()
	doAborts(abortEnv, genOps[idx]!.shouldNotAbort)
	return result
}

function basicPoll<T>(abortEnv: AbortEnv, genOps: GenOp<T>[]): Option<T> {
	const performed = new Deferred<number>()
	const ops = genOps.map(({ gen }, idx) => {
		return gen(performed, idx)
	})
	const pollOps = (idx: number): false | number => {
		if (idx >= ops.length) return false
		if (ops[idx]!.poll()) return idx
		return pollOps(idx + 1)
	}

	const ready = pollOps(0)

	if (ready !== false) {
		const result = ops[ready]!.result()
		doAborts(abortEnv, genOps[ready]!.shouldNotAbort)
		return some(result)
	} else {
		doAborts(abortEnv, [])
		return none
	}
}

function doAborts(abortEnv: AbortEnv, shouldNotAbort: number[]) {
	for (const [id, onAbort] of abortEnv.entries()) {
		if (!shouldNotAbort.includes(id)) {
			onAbort()
		}
	}
}

///

type Sender<T> = {
	performed: Deferred<number>
	idx: number
	data: Option<T>
	sent: boolean
}
type Receiver<T> = {
	performed: Deferred<number>
	idx: number
	data: Option<T>
}

export class Channel<T> {
	private _senders: Sender<T>[]
	private _receivers: Receiver<T>[]
	private _closed: boolean
	constructor() {
		this._senders = []
		this._receivers = []
		this._closed = false
	}

	close() {
		if (this._closed) return
		this._closed = true
		if (this._receivers.length > 0 && this._senders.length === 0) {
			this._receivers.forEach((r) => {
				r.performed.resolve(r.idx)
			})
		}
	}
	isClosed(): boolean {
		return this._closed
	}

	send(data: T): Op<boolean> {
		if (this._closed) return always(false)
		return new Communication((performed, idx) => {
			const sender: Sender<T> = {
				performed,
				idx,
				data: some(data),
				sent: false,
			}
			return {
				poll: () => {
					while (this._receivers.length > 0) {
						const receiver = this._receivers.shift()!
						if (receiver.performed.isFulfilled) continue
						receiver.data = sender.data
						performed.resolve(idx)
						sender.sent = true
						receiver.performed.resolve(receiver.idx)
						return true
					}
					return false
				},
				suspend: () => {
					const senders = this._senders.filter(
						(x) => !x.performed.isFulfilled,
					)
					senders.push(sender)
					this._senders = senders
				},
				result: () => sender.sent,
			}
		})
	}
	receive(): Op<Option<T>> {
		if (this._closed) return always(none)
		return new Communication((performed, idx) => {
			const receiver: Receiver<T> = {
				performed,
				idx,
				data: none,
			}
			return {
				poll: () => {
					while (this._senders.length > 0) {
						const sender = this._senders.shift()!
						if (sender.performed.isFulfilled) continue
						receiver.data = sender.data
						performed.resolve(idx)
						sender.sent = true
						sender.performed.resolve(sender.idx)
						return true
					}
					if (this._closed) {
						performed.resolve(idx)
						return true
					}
					return false
				},
				suspend: () => {
					const receivers = this._receivers.filter(
						(x) => !x.performed.isFulfilled,
					)
					receivers.push(receiver)
					this._receivers = receivers
				},
				result: () => receiver.data,
			}
		})
	}
}

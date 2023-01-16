// based on https://github.com/ocaml/ocaml/blob/4.12.0/otherlibs/systhreads/event.ml
// which is distributed with LGPL-2.1

import { Option, none, some } from "./option.js"
import { Condition, Mutex } from "./sync.js"

class Box<T> {
	private inner: T
	constructor(inner: T) {
		this.inner = inner
	}
	get(): T {
		return this.inner
	}
	set(inner: T) {
		this.inner = inner
	}
}

const genSym = (() => {
	let id = 0
	return () => id++
})()

function randomize<T>(arr: T[]): T[] {
	return [...arr].sort(() => Math.random() - 0.5)
}

///

type BasicOp<T> = {
	poll(): boolean
	suspend(): void
	result(): T
}

type Behavior<T> = (
	performed: Box<number>,
	cond: Condition,
	idx: number,
) => BasicOp<T>

type GenOp<T> = { gen: Behavior<T>; abortList: number[] }
type Abort = { id: number; onAbort: () => void }

///

abstract class Op<T> {
	sync(): Promise<T> {
		const [ops, abortEnv] = this.flatten([], [], [])
		return basicSync(abortEnv, randomize(ops))
	}
	poll(): Option<T> {
		const [ops, abortEnv] = this.flatten([], [], [])
		return basicPoll(abortEnv, randomize(ops))
	}
	wrapAbort(onAbort: () => void): Op<T> {
		return new WrapAbort(this, onAbort)
	}
	abstract wrap<R>(fn: (v: T) => R): Op<R>
	protected abstract flatten(
		abortList: number[],
		acc: GenOp<T>[],
		accAbort: Abort[],
	): [GenOp<T>[], Abort[]]
}
class Communication<T> extends Op<T> {
	private behavior: Behavior<T>
	constructor(behavior: Behavior<T>) {
		super()
		this.behavior = behavior
	}
	wrap<R>(fn: (v: T) => R): Op<R> {
		return new Communication((performed, condition, idx) => {
			const op = this.behavior(performed, condition, idx)
			return {
				poll: () => op.poll(),
				suspend: () => op.suspend(),
				result: () => fn(op.result()),
			}
		})
	}
	flatten(
		abortList: number[],
		acc: GenOp<T>[],
		accAbort: Abort[],
	): [GenOp<T>[], Abort[]] {
		return [[{ gen: this.behavior, abortList }, ...acc], accAbort]
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
		abortList: number[],
		acc: GenOp<T>[],
		accAbort: Abort[],
	): [GenOp<T>[], Abort[]] {
		return this.ops.reduce(
			(prev: [GenOp<T>[], Abort[]], curr: Op<T>) => {
				// @ts-expect-error
				return curr.flatten(abortList, prev[0], prev[1])
			},
			[acc, accAbort],
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
		abortList: number[],
		acc: GenOp<T>[],
		accAbort: Abort[],
	): [GenOp<T>[], Abort[]] {
		const id = genSym()
		// @ts-expect-error
		return this.op.flatten([id, ...abortList], acc, [
			{ id, onAbort: this.onAbort },
			...accAbort,
		])
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
		abortList: number[],
		acc: GenOp<T>[],
		accAbort: Abort[],
	): [GenOp<T>[], Abort[]] {
		// @ts-expect-error
		return this.g().flatten(abortList, acc, accAbort)
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
	return new Communication((performed, _condition, idx) => {
		return {
			poll: () => {
				performed.set(idx)
				return true
			},
			suspend: () => {},
			result: () => data,
		}
	})
}
export function never<T>(): Op<T> {
	return new Communication((_performed, _condition, _idx) => {
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
	return new Communication((performed, condition, idx) => {
		let fulfilled = false
		p.finally(() => {
			fulfilled = true
		})
		return {
			poll: () => {
				if (fulfilled) {
					performed.set(idx)
					return true
				} else {
					return false
				}
			},
			suspend: () => {
				p.finally(() => {
					if (performed.get() === -1) {
						performed.set(idx)
						condition.signal()
					}
				})
			},
			result: () => p,
		}
	})
}

///

const masterlock = new Mutex()

async function basicSync<T>(abortEnv: Abort[], genOp: GenOp<T>[]): Promise<T> {
	const performed = new Box(-1)
	const cond = new Condition()
	const ops = genOp.map(({ gen }, idx) => {
		return gen(performed, cond, idx)
	})
	const pollOps = (idx: number): boolean => {
		if (idx >= ops.length) return false
		return ops[idx]!.poll() || pollOps(idx + 1)
	}

	await masterlock.lock()

	const ready = pollOps(0)
	if (!ready) {
		ops.forEach((x) => x.suspend())
		await cond.wait(masterlock)
		while (performed.get() === -1) {
			await cond.wait(masterlock)
		}
	}

	masterlock.unlock()

	const result = ops[performed.get()]!.result()
	if (abortEnv.length > 0) {
		doAborts(abortEnv, genOp, performed.get())
	}
	return result
}

function basicPoll<T>(abortEnv: Abort[], genOp: GenOp<T>[]): Option<T> {
	const performed = new Box(-1)
	const cond = new Condition()
	const ops = genOp.map(({ gen }, idx) => {
		return gen(performed, cond, idx)
	})
	const pollOps = (idx: number): boolean => {
		if (idx >= ops.length) return false
		return ops[idx]!.poll() || pollOps(idx + 1)
	}

	const locked = masterlock.tryLock()
	if (!locked) return none

	const ready = pollOps(0)

	masterlock.unlock()

	if (ready) {
		const result = ops[performed.get()]!.result()
		doAborts(abortEnv, genOp, performed.get())
		return some(result)
	} else {
		doAborts(abortEnv, genOp, -1)
		return none
	}
}

function doAborts<T>(abortEnv: Abort[], genOp: GenOp<T>[], performed: number) {
	if (abortEnv.length === 0) return
	if (performed >= 0) {
		const idsDone = genOp[performed]!.abortList
		abortEnv.forEach(({ id, onAbort }) => {
			if (!idsDone.includes(id)) {
				onAbort()
			}
		})
	} else {
		abortEnv.forEach(({ onAbort }) => onAbort())
	}
}

///

type Sender<T> = {
	performed: Box<number>
	condition: Condition
	idx: number
	data: Option<T>
	sent: boolean
}
type Receiver<T> = {
	performed: Box<number>
	condition: Condition
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
			this._receivers[0]!.condition.signal()
		}
	}
	isClosed(): boolean {
		return this._closed
	}

	send(data: T): Op<boolean> {
		if (this._closed) return always(false)
		return new Communication((performed, condition, idx) => {
			const sender: Sender<T> = {
				performed,
				condition,
				idx,
				data: some(data),
				sent: false,
			}
			return {
				poll: () => {
					while (this._receivers.length > 0) {
						const receiver = this._receivers.shift()!
						if (receiver.performed.get() >= 0) continue
						receiver.data = sender.data
						performed.set(idx)
						sender.sent = true
						receiver.performed.set(receiver.idx)
						receiver.condition.signal()
						return true
					}
					return false
				},
				suspend: () => {
					const senders = this._senders.filter(
						(x) => x.performed.get() === -1,
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
		return new Communication((performed, condition, idx) => {
			const receiver: Receiver<T> = {
				performed,
				condition,
				idx,
				data: none,
			}
			return {
				poll: () => {
					while (this._senders.length > 0) {
						const sender = this._senders.shift()!
						if (sender.performed.get() >= 0) continue
						receiver.data = sender.data
						performed.set(idx)
						sender.sent = true
						sender.performed.set(sender.idx)
						sender.condition.signal()
						return true
					}
					if (this._closed) {
						performed.set(idx)
						return true
					}
					return false
				},
				suspend: () => {
					const receivers = this._receivers.filter(
						(x) => x.performed.get() === -1,
					)
					receivers.push(receiver)
					this._receivers = receivers
				},
				result: () => receiver.data,
			}
		})
	}
}

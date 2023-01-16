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

///

type BasicEvent<T> = {
	poll(): boolean
	suspend(): void
	result(): T
}

type Behavior<T> = (
	performed: Box<number>,
	cond: Condition,
	idx: number,
) => BasicEvent<T>

type GenEv<T> = { gen: Behavior<T>; abortList: number[] }
type Abort = { id: number; onAbort: () => void }

///

abstract class Op<T> {
	sync(): Promise<T> {
		const [ops, abortEnv] = this.flatten([], [], [])
		return basicSync(abortEnv, scramble(ops))
	}
	poll(): Option<T> {
		const [ops, abortEnv] = this.flatten([], [], [])
		return basicPoll(abortEnv, scramble(ops))
	}
	abstract wrap<R>(fn: (v: T) => R): Op<R>
	protected abstract flatten(
		abortList: number[],
		acc: GenEv<T>[],
		accAbort: Abort[],
	): [GenEv<T>[], Abort[]]
}
class Communication<T> extends Op<T> {
	private behavior: Behavior<T>
	constructor(behavior: Behavior<T>) {
		super()
		this.behavior = behavior
	}
	wrap<R>(fn: (v: T) => R): Op<R> {
		return new Communication((performed, condition, evnum) => {
			const bev = this.behavior(performed, condition, evnum)
			return {
				poll: () => bev.poll(),
				suspend: () => bev.suspend(),
				result: () => fn(bev.result()),
			}
		})
	}
	flatten(
		abortList: number[],
		acc: GenEv<T>[],
		accAbort: Abort[],
	): [GenEv<T>[], Abort[]] {
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
		acc: GenEv<T>[],
		accAbort: Abort[],
	): [GenEv<T>[], Abort[]] {
		return this.ops.reduce(
			(prev: [GenEv<T>[], Abort[]], curr: Op<T>) => {
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
		acc: GenEv<T>[],
		accAbort: Abort[],
	): [GenEv<T>[], Abort[]] {
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
		acc: GenEv<T>[],
		accAbort: Abort[],
	): [GenEv<T>[], Abort[]] {
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
export function wrapAbort<T>(ev: Op<T>, onAbort: () => void): Op<T> {
	return new WrapAbort(ev, onAbort)
}
export function guard<T>(fn: () => Op<T>): Op<T> {
	return new Guard(fn)
}

///

export function always<T>(data: T): Op<T> {
	const genEv: Behavior<T> = (performed, _condition, evnum) => {
		return {
			poll: () => {
				performed.set(evnum)
				return true
			},
			suspend: () => {},
			result: () => data,
		}
	}
	return new Communication(genEv)
}
export function never<T>(): Op<T> {
	const genEv: Behavior<T> = (_performed, _condition, _evnum) => {
		return {
			poll: () => false,
			suspend: () => {},
			result: () => {
				throw new Error("never")
			},
		}
	}
	return new Communication<T>(genEv)
}

///

function scramble<T>(arr: T[]): T[] {
	return [...arr].sort(() => Math.random() - 0.5)
}

///

const masterlock = new Mutex()

function doAborts<T>(abortEnv: Abort[], genEv: GenEv<T>[], performed: number) {
	if (abortEnv.length === 0) return
	if (performed >= 0) {
		const idsDone = genEv[performed]!.abortList
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

async function basicSync<T>(abortEnv: Abort[], genEv: GenEv<T>[]): Promise<T> {
	const performed = new Box(-1)
	const cond = new Condition()
	const bev = genEv.map(({ gen }, idx) => {
		return gen(performed, cond, idx)
	})
	const pollEvents = (idx: number): boolean => {
		if (idx >= bev.length) return false
		return bev[idx]!.poll() || pollEvents(idx + 1)
	}

	await masterlock.lock()

	const ready = pollEvents(0)
	if (!ready) {
		bev.forEach((x) => x.suspend())
		await cond.wait(masterlock)
		while (performed.get() < 0) {
			await cond.wait(masterlock)
		}
	}

	masterlock.unlock()

	const result = bev[performed.get()]!.result()
	if (abortEnv.length > 0) {
		doAborts(abortEnv, genEv, performed.get())
	}
	return result
}

///

function basicPoll<T>(abortEnv: Abort[], genEv: GenEv<T>[]): Option<T> {
	const performed = new Box(-1)
	const cond = new Condition()
	const bev = genEv.map(({ gen }, idx) => {
		return gen(performed, cond, idx)
	})
	const pollEvents = (idx: number): boolean => {
		if (idx >= bev.length) return false
		return bev[idx]!.poll() || pollEvents(idx + 1)
	}

	const locked = masterlock.tryLock()
	if (!locked) return none

	const ready = pollEvents(0)
	if (ready) {
		masterlock.unlock()
		const result = bev[performed.get()]!.result()
		doAborts(abortEnv, genEv, performed.get())
		return some(result)
	} else {
		performed.set(0)
		masterlock.unlock()
		doAborts(abortEnv, genEv, -1)
		return none
	}
}

///

type CommunicationC<T> = {
	performed: Box<number>
	condition: Condition
	data: Option<T>
	eventNumber: number
}

export class Channel<T> {
	private writesPending: CommunicationC<T>[]
	private readsPending: CommunicationC<T>[]
	constructor() {
		this.writesPending = []
		this.readsPending = []
	}
	send(data: T): Op<boolean> {
		const genEv: Behavior<boolean> = (performed, cond, evnum) => {
			const wcomm: CommunicationC<T> = {
				performed: performed,
				condition: cond,
				data: some(data),
				eventNumber: evnum,
			}
			return {
				poll: () => {
					while (this.readsPending.length > 0) {
						const rcomm = this.readsPending.shift()!
						if (rcomm.performed.get() >= 0) continue
						rcomm.data = wcomm.data
						performed.set(evnum)
						rcomm.performed.set(rcomm.eventNumber)
						rcomm.condition.signal()
						return true
					}
					return false
				},
				suspend: () => {
					const q = this.writesPending.filter(
						(x) => x.performed.get() === -1,
					)
					q.push(wcomm)
					this.writesPending = q
				},
				result: () => true,
			}
		}
		return new Communication(genEv)
	}
	receive(): Op<T> {
		const genEv: Behavior<T> = (performed, cond, evnum) => {
			const rcomm: CommunicationC<T> = {
				performed: performed,
				condition: cond,
				data: none,
				eventNumber: evnum,
			}
			return {
				poll: () => {
					while (this.writesPending.length > 0) {
						const wcomm = this.writesPending.shift()!
						if (wcomm.performed.get() >= 0) continue
						rcomm.data = wcomm.data
						performed.set(evnum)
						wcomm.performed.set(wcomm.eventNumber)
						wcomm.condition.signal()
						return true
					}
					return false
				},
				suspend: () => {
					const q = this.readsPending.filter(
						(x) => x.performed.get() === -1,
					)
					q.push(rcomm)
					this.readsPending = q
				},
				result: () => rcomm.data.unwrap(),
			}
		}
		return new Communication(genEv)
	}
}

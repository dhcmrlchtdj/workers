// based on https://github.com/ocaml/ocaml/blob/4.12.0/otherlibs/systhreads/event.ml
// which is distributed with LGPL-2.1

import { Option, none, some } from "./option.js"
import { Condition, Mutex } from "./sync.js"

type Ref<T> = {
	val: T
}

type BasisEvent<T> = {
	poll(): boolean
	suspend(): void
	result(): T
}

type Behavior<T> = (
	performed: Ref<number>,
	cond: Condition,
	idx: number,
) => BasisEvent<T>

type GenEv<T> = [Behavior<T>, number[]]
type Abort = [number, () => void]

const genSym = (() => {
	let id = 0
	return () => id++
})()

///

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface Op<T> {
	wrap<R>(fn: (v: T) => R): Op<R>
	flatten(
		abortList: number[],
		acc: GenEv<T>[],
		accAbort: Abort[],
	): [GenEv<T>[], Abort[]]
}
class Communication<T> implements Op<T> {
	private behavior: Behavior<T>
	constructor(behavior: Behavior<T>) {
		this.behavior = behavior
	}
	wrap<R>(fn: (v: T) => R): Op<R> {
		const genEv: Behavior<R> = (performed, condition, evnum) => {
			const bev = this.behavior(performed, condition, evnum)
			return {
				poll: () => bev.poll(),
				suspend: () => bev.suspend(),
				result: () => fn(bev.result()),
			}
		}
		return new Communication(genEv)
	}
	flatten(
		abortList: number[],
		acc: GenEv<T>[],
		accAbort: Abort[],
	): [GenEv<T>[], Abort[]] {
		return [[[this.behavior, abortList], ...acc], accAbort]
	}
}
class Choose<T> implements Op<T> {
	private ops: Op<T>[]
	constructor(ops: Op<T>[]) {
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
				return curr.flatten(abortList, prev[0], prev[1])
			},
			[acc, accAbort],
		)
	}
}
class WrapAbort<T> implements Op<T> {
	private op: Op<T>
	private onAbort: () => void
	constructor(op: Op<T>, onAbort: () => void) {
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
		return this.op.flatten([id, ...abortList], acc, [
			[id, this.onAbort],
			...accAbort,
		])
	}
}
class Guard<T> implements Op<T> {
	private g: () => Op<T>
	constructor(g: () => Op<T>) {
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
		return this.g().flatten(abortList, acc, accAbort)
	}
}

///

export function select<T>(...ops: Op<T>[]): Promise<T> {
	return sync(new Choose(ops))
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
				performed.val = evnum
				return true
			},
			suspend: () => {},
			result: () => data,
		}
	}
	return new Communication(genEv)
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
		const idsDone = genEv[performed]![1]
		abortEnv.forEach(([id, f]) => {
			if (!idsDone.includes(id)) {
				f()
			}
		})
	} else {
		abortEnv.forEach(([_, f]) => f())
	}
}

///

export function sync<T>(op: Op<T>): Promise<T> {
	const [ops, abortEnv] = op.flatten([], [], [])
	return basicSync(abortEnv, scramble(ops))
}

async function basicSync<T>(abortEnv: Abort[], genEv: GenEv<T>[]): Promise<T> {
	const performed: Ref<number> = { val: -1 }
	const cond = new Condition()
	const bev = genEv.map(([f, _], idx) => {
		return f(performed, cond, idx)
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
		while (performed.val < 0) {
			await cond.wait(masterlock)
		}
	}

	masterlock.unlock()

	const result = bev[performed.val]!.result()
	if (abortEnv.length > 0) {
		doAborts(abortEnv, genEv, performed.val)
	}
	return result
}

///

export function poll<T>(op: Op<T>): Option<T> {
	const [ops, abortEnv] = op.flatten([], [], [])
	return basicPoll(abortEnv, scramble(ops))
}

function basicPoll<T>(abortEnv: Abort[], genEv: GenEv<T>[]): Option<T> {
	const performed: Ref<number> = { val: -1 }
	const cond = new Condition()
	const bev = genEv.map(([f, _], idx) => {
		return f(performed, cond, idx)
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
		const result = bev[performed.val]!.result()
		doAborts(abortEnv, genEv, performed.val)
		return some(result)
	} else {
		performed.val = 0
		masterlock.unlock()
		doAborts(abortEnv, genEv, -1)
		return none
	}
}

///

type CommunicationC<T> = {
	performed: Ref<number>
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
						if (rcomm.performed.val >= 0) continue
						rcomm.data = wcomm.data
						performed.val = evnum
						rcomm.performed.val = rcomm.eventNumber
						rcomm.condition.signal()
						return true
					}
					return false
				},
				suspend: () => {
					const q = this.writesPending.filter(
						(x) => x.performed.val === -1,
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
						if (wcomm.performed.val >= 0) continue
						rcomm.data = wcomm.data
						performed.val = evnum
						wcomm.performed.val = wcomm.eventNumber
						wcomm.condition.signal()
						return true
					}
					return false
				},
				suspend: () => {
					const q = this.readsPending.filter(
						(x) => x.performed.val === -1,
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

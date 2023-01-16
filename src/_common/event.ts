import { none, Option, some } from "./option.js"
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

type Event<T> =
	| { tag: "Communication"; val: Behavior<T> }
	| { tag: "Choose"; val: Event<T>[] }
	| { tag: "WrapAbort"; val: [Event<T>, () => void] }
	| { tag: "Guard"; val: () => Event<T> }

type GenEv<T> = [Behavior<T>, number[]]
type Abort = [number, () => void]

///

const genSym = (() => {
	let id = 0
	return () => id++
})()

export function select<T>(...events: Event<T>[]): Promise<T> {
	return sync(choose(...events))
}

export function wrap<T, R>(ev: Event<T>, fn: (v: T) => R): Event<R> {
	switch (ev.tag) {
		case "Communication": {
			const genEv = ev.val
			const genEv2: Behavior<R> = (performed, condition, evnum) => {
				const bev = genEv(performed, condition, evnum)
				return {
					poll: () => bev.poll(),
					suspend: () => bev.suspend(),
					result: () => fn(bev.result()),
				}
			}
			return communication(genEv2)
		}
		case "Choose": {
			const xx = ev.val.map((e) => wrap(e, fn))
			return choose(...xx)
		}
		case "WrapAbort": {
			const [e, f] = ev.val
			return wrapAbort(wrap(e, fn), f)
		}
		case "Guard": {
			const g = ev.val
			return guard(() => wrap(g(), fn))
		}
	}
}

export function choose<T>(...events: Event<T>[]): Event<T> {
	return { tag: "Choose", val: events }
}
export function wrapAbort<T>(ev: Event<T>, fn: () => void): Event<T> {
	return { tag: "WrapAbort", val: [ev, fn] }
}
export function guard<T>(fn: () => Event<T>): Event<T> {
	return { tag: "Guard", val: fn }
}
export function communication<T>(genEv: Behavior<T>): Event<T> {
	return { tag: "Communication", val: genEv }
}

export function always<T>(data: T): Event<T> {
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
	return communication(genEv)
}

export function flattenEvent<T>(
	abortList: number[],
	accu: GenEv<T>[],
	accuAbort: Abort[],
	ev: Event<T>,
): [GenEv<T>[], Abort[]] {
	switch (ev.tag) {
		case "Communication": {
			const bev = ev.val
			return [[[bev, abortList], ...accu], accuAbort]
		}
		case "Choose": {
			const events = ev.val
			return events.reduce(
				(prev: [GenEv<T>[], Abort[]], curr: Event<T>) => {
					return flattenEvent(abortList, prev[0], prev[1], curr)
				},
				[accu, accuAbort],
			)
		}
		case "WrapAbort": {
			const [e, f] = ev.val
			const id = genSym()
			return flattenEvent(
				[id, ...abortList],
				accu,
				[[id, f], ...accuAbort],
				e,
			)
		}
		case "Guard": {
			const g = ev.val
			return flattenEvent(abortList, accu, accuAbort, g())
		}
	}
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

export function sync<T>(event: Event<T>): Promise<T> {
	const [events, abortEnv] = flattenEvent([], [], [], event)
	return basicSync(abortEnv, scramble(events))
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

export function poll<T>(ev: Event<T>): Option<T> {
	const [events, abortEnv] = flattenEvent([], [], [], ev)
	return basicPoll(abortEnv, scramble(events))
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

type Communication<T> = {
	performed: Ref<number>
	condition: Condition
	data: Option<T>
	eventNumber: number
}

export class Channel<T> {
	private writesPending: Communication<T>[]
	private readsPending: Communication<T>[]
	constructor() {
		this.writesPending = []
		this.readsPending = []
	}
	send(data: T): Event<boolean> {
		const genEv: Behavior<boolean> = (performed, cond, evnum) => {
			const wcomm: Communication<T> = {
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
		return communication(genEv)
	}
	receive(): Event<T> {
		const genEv: Behavior<T> = (performed, cond, evnum) => {
			const rcomm: Communication<T> = {
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
		return communication(genEv)
	}
}

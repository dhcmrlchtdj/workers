/*
export interface HKT<_F, _A> {}
export abstract class Type1<F, A> {
	inject(a: A): HKT<F, A> {
		return a as unknown as HKT<F, A>
	}
	project(fa: HKT<F, A>): A {
		return fa as unknown as A
	}
}

//

const IsFunctor = Symbol()
export type IsFunctor = typeof IsFunctor
export interface Functor<A> {
	map<B>(fn: (_: A) => B): HKT<IsFunctor, B>
}

export abstract class Option<T> implements Functor<T> {
	abstract map<B>(fn: (_: T) => B): Option<B>
}
class Some<T> extends Option<T> {
	private val: T
	constructor(val: T) {
		super()
		this.val = val
	}
	map<B>(fn: (_: T) => B): Option<B> {
		return new Some(fn(this.val))
	}
}
class None extends Option<never> {
	map<B>(_fn: (_: never) => B): Option<B> {
		return new None()
	}
}
export const none = new None()
export const some = <T>(a: T) => new Some(a)

//

export function fold<T>(f: (a: T, b: T) => T, zero: T, arr: T[]): T {
	return arr.reduce(f, zero)
}

interface Monoid<T> {
	unit(): T
	op(a: T, b: T): T
}
export function foldM<T>(m: Monoid<T>, arr: T[]): T {
	return arr.reduce((a, b) => m.op(a, b), m.unit())
}

//

interface Seq<F, T> {
	decon(_: HKT<F, T>): [T, HKT<F, T>] | null
}
export function foldS<T, F>(m: Monoid<T>, seq: Seq<F, T>, c: HKT<F, T>): T {
	const r = seq.decon(c)
	if (r === null) return m.unit()
	return m.op(r[0], foldS(m, seq, r[1]))
}

interface Mappable<T> {
	map<A, B>(fn: (_: A) => B, x: HKT<T, A>): HKT<T, B>
}
function inject<F, A>(a: A): HKT<F, A> {
	return a as unknown as HKT<F, A>
}
function project<F, A>(fa: HKT<F, A>): A {
	return fa as unknown as A
}
export const ListT = Symbol()
export type ListT = typeof ListT
export class ListApply<T> {}
export const ArrayT = Symbol()
export type ArrayT = typeof ArrayT
export class ArrayApply<T> {}

export class MapList<T> implements Mappable<ListApply<T>> {
	map<A, B>(fn: (_: A) => B, x: HKT<ListApply<T>, A>): HKT<ListApply<T>, B> {
		return inject(fn(project(x)))
	}
}
//

interface Monad<T> {
	return(): T
}

interface App<_F, _A> {}

const IsList = Symbol("List")
type IsList = typeof IsList
// interface List<T> {
//     inj(_: T): App<IsList, T>
//     prj(_: App<IsList, T>): T
// }

function when<T>(d: Monad<T>, b: boolean, m: App<unknown, T>): App<unknown, T> {
	if (b) {
		return m
	} else {
		return d.return()
	}
}
function unless<T>(
	d: Monad<T>,
	b: boolean,
	m: App<unknown, T>,
): App<unknown, T> {
	return when(d, !b, m)
}

//

abstract class NewType1<F, T> {
	inj(a: T): App<F, T> {
		return a as unknown as App<F, T>
	}
	prj(fa: App<F, T>): T {
		return fa as unknown as T
	}
}
class List<T> extends NewType1<IsList, T> {
	private buf: T[]
	constructor(init: T[]) {
		super()
		this.buf = init
	}
}

*/

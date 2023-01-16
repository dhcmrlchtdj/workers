export type Option<T> = None | Some<T>

class None {
	isNone(): this is None {
		return true
	}
	isSome<T>(): this is Some<T> {
		return false
	}
	unwrap(): never {
		throw new Error("None.unwrap()")
	}
	map(): this {
		return this
	}
	bind(): this {
		return this
	}
}

class Some<T> {
	v: T
	constructor(v: T) {
		this.v = v
	}
	isNone(): this is None {
		return false
	}
	isSome(): this is Some<T> {
		return true
	}
	unwrap(): T {
		return this.v
	}
	map<K>(f: (x: T) => K): Option<K> {
		return new Some(f(this.v))
	}
	bind<K>(f: (x: T) => Option<K>): Option<K> {
		return f(this.v)
	}
}

export const none = new None()

export function some<T>(v: T): Some<T> {
	return new Some(v)
}

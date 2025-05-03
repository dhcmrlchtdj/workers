export type Result<T> = Ok<T> | Err

class Ok<T> {
	v: T
	constructor(v: T) {
		this.v = v
	}
	isOk(): this is Ok<T> {
		return true
	}
	isErr(): this is Err {
		return false
	}
	unwrap(): T {
		return this.v
	}
	map<K>(f: (x: T) => K): Result<K> {
		return new Ok(f(this.v))
	}
	bind<K>(f: (x: T) => Result<K>): Result<K> {
		return f(this.v)
	}
	unwrapErr(): Error {
		throw new Error("Ok.unwrapErr()")
	}
	mapErr(): Result<T> {
		return this
	}
	bindErr(): Result<T> {
		return this
	}
}
class Err {
	e: Error
	constructor(e: Error) {
		this.e = e
	}
	isOk(): this is Ok<unknown> {
		return false
	}
	isErr(): this is Err {
		return true
	}
	unwrap(): never {
		throw new Error("Err.unwrap()")
	}
	map<K>(): Result<K> {
		return this as unknown as Result<K>
	}
	bind<K>(): Result<K> {
		return this as unknown as Result<K>
	}
	unwrapErr(): Error {
		return this.e
	}
	mapErr<K>(f: (e: Error) => Error): Result<K> {
		return new Err(f(this.e))
	}
	bindErr<K>(f: (e: Error) => Result<K>): Result<K> {
		return f(this.e)
	}
}

export function ok<T>(v: T): Ok<T> {
	return new Ok(v)
}

export function err(e: Error | string): Err {
	if (e instanceof Error) {
		return new Err(e)
	} else {
		return new Err(new Error(e))
	}
}

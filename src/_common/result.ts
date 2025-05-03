export type Result<T> = Ok<T> | Err<T>

class Ok<T> {
	v: T
	constructor(v: T) {
		this.v = v
	}
	isOk(): this is Ok<T> {
		return true
	}
	isErr(): this is Err<T> {
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
class Err<T> {
	e: Error
	constructor(e: Error) {
		this.e = e
	}
	isOk(): this is Ok<T> {
		return false
	}
	isErr(): this is Err<T> {
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
	mapErr(f: (e: Error) => Error): Result<T> {
		return new Err(f(this.e))
	}
	bindErr(f: (e: Error) => Result<T>): Result<T> {
		return f(this.e)
	}
}

export function ok<T>(v: T): Ok<T> {
	return new Ok(v)
}

export function err<T>(e: Error | string): Err<T> {
	if (e instanceof Error) {
		return new Err(e)
	} else {
		return new Err(new Error(e))
	}
}

import { Deferred } from "../ds/deferred"

export interface SyncReader {
	peek(): string | undefined
	peek(n: number): string | undefined
	advance(): void
	advance(n: number): void
	mark: () => number
	unmark: (m: number) => void
	backTo(m: number): void
}

export interface AsyncReader {
	peek(): Promise<string | undefined>
	peek(n: number): Promise<string | undefined>
	advance(): void
	advance(n: number): void
	mark: () => number
	unmark: (m: number) => void
	backTo(m: number): void
}

export class Buffered implements SyncReader {
	private str: string
	private idx: number
	constructor(s: string) {
		this.str = s
		this.idx = 0
	}
	peek(n = 1) {
		if (n === 1) {
			return this.str[this.idx]
		} else if (this.idx + n <= this.str.length) {
			return this.str.slice(this.idx, this.idx + n)
		} else {
			return undefined
		}
	}
	advance(n = 1) {
		this.idx += n
	}
	mark() {
		return this.idx
	}
	unmark() {}
	backTo(m: number) {
		this.idx = m
	}
}

export class Streaming implements AsyncReader {
	private eof: boolean
	private buf: string
	private idx: number
	private start: number
	private marks: Map<number, number>
	private peekDeferred: Deferred<string | undefined> | null
	private peekSize: number
	constructor() {
		this.eof = false
		this.buf = ""
		this.idx = 0
		this.start = 0
		this.marks = new Map()
		this.peekDeferred = null
		this.peekSize = 0
	}
	write(data: string) {
		this.buf += data
		if (this.peekDeferred === null) return
		if (this.idx + this.peekSize <= this.buf.length) {
			const chunk = this.buf.slice(this.idx, this.idx + this.peekSize)
			this.peekDeferred.resolve(chunk)
			this.peekDeferred = null
		}
	}
	end() {
		this.eof = true
		if (this.peekDeferred !== null) {
			this.peekDeferred.resolve(undefined)
			this.peekDeferred = null
		}
	}
	async peek(n = 1) {
		if (this.idx + n <= this.buf.length) {
			if (n === 1) {
				return this.buf[this.idx]
			}
			const chunk = this.buf.slice(this.idx, this.idx + n)
			return chunk
		} else if (this.eof) {
			return undefined
		} else {
			this.peekDeferred = new Deferred()
			this.peekSize = n
			return this.peekDeferred.promise
		}
	}
	advance(n = 1) {
		this.idx += n
		this._cleanup()
	}
	mark() {
		const pos = this.start + this.idx
		const count = (this.marks.get(pos) ?? 0) + 1
		this.marks.set(pos, count)
		return pos
	}
	unmark(m: number) {
		const count = (this.marks.get(m) ?? 1) - 1
		if (count > 0) {
			this.marks.set(m, count)
		} else {
			this.marks.delete(m)
			this._cleanup()
		}
	}
	backTo(m: number) {
		this.idx = m - this.start
	}
	private _cleanup() {
		if (Math.random() > 0.2) return
		const minPos = Math.min(this.start + this.idx, ...this.marks.keys())
		const shift = minPos - this.start
		if (shift > 20) {
			this.buf = this.buf.slice(shift)
			this.idx -= shift
			this.start = minPos
		}
	}
}

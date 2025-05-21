import { Deferred } from "../ds/deferred"

export interface SyncReader {
	read(): string | undefined
	advance(): void
	mark: () => number
	drop: (pos: number) => void
	reset(pos: number): void
}

export interface AsyncReader {
	read(): Promise<string | undefined>
	advance(): void
	mark: () => number
	drop: (pos: number) => void
	reset(pos: number): void
}

export class Buffered implements SyncReader {
	private str: string
	private idx: number
	constructor(s: string) {
		this.str = s
		this.idx = 0
	}
	read() {
		return this.str[this.idx]
	}
	advance() {
		this.idx++
	}
	mark() {
		return this.idx
	}
	drop() {}
	reset(pos: number) {
		this.idx = pos
	}
}

export class Streaming implements AsyncReader {
	private eof: boolean
	private buf: string
	private idx: number
	private start: number
	private marks: number[]
	private peekDeferred: Deferred<string | undefined> | null
	constructor() {
		this.eof = false
		this.buf = ""
		this.idx = 0
		this.start = 0
		this.marks = []
		this.peekDeferred = null
	}
	write(data: string) {
		this.buf += data
		if (this.peekDeferred === null) return
		if (this.idx < this.buf.length) {
			const char = this.buf[this.idx]
			this.peekDeferred.resolve(char)
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
	async read() {
		if (this.idx < this.buf.length) {
			return this.buf[this.idx]
		} else if (this.eof) {
			return undefined
		} else {
			this.peekDeferred = new Deferred()
			return this.peekDeferred.promise
		}
	}
	advance() {
		this.idx++
		this._cleanup()
	}
	mark() {
		const pos = this.start + this.idx
		this.marks.push(pos)
		return pos
	}
	drop(_: number) {
		this.marks.pop()
		this._cleanup()
	}
	reset(pos: number) {
		this.idx = pos - this.start
		this.marks.pop()
		this._cleanup()
	}
	private _cleanup() {
		if (this.marks.length === 0) {
			this.buf = this.buf.slice(this.idx)
			this.start = this.idx
			this.idx = 0
		}
	}
}

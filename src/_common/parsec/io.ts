export interface IOReader {
	peek(): Promise<string | undefined>
	peek(n: number): Promise<string | undefined>
	advance(): Promise<void>
	advance(n: number): Promise<void>
	mark: () => Promise<number>
	unmark: (m: number) => Promise<void>
	backTo(m: number): Promise<void>
}
export interface IOWriter<T> {
	write?(data: T): Promise<void>
	close?(): Promise<void>
	error?(err: Error): Promise<void>
}
export interface IO<T> {
	reader: IOReader
	writer: IOWriter<T>
}

///

export class StrIO<T> implements IO<T> {
	public reader: IOReader
	public writer: IOWriter<T>
	constructor(s: string, writer: IOWriter<T> = {}) {
		this.reader = new BufferedStr(s)
		this.writer = writer
	}
}

class BufferedStr implements IOReader {
	private str: string
	private idx: number
	constructor(s: string) {
		this.str = s
		this.idx = 0
	}
	async peek(n = 1) {
		if (n === 1) {
			return this.str[this.idx]
		} else if (this.idx + n <= this.str.length) {
			return this.str.slice(this.idx, this.idx + n)
		} else {
			return undefined
		}
	}
	async advance(n = 1) {
		this.idx += n
	}
	async mark() {
		return this.idx
	}
	async unmark() {}
	async backTo(m: number) {
		this.idx = m
	}
}

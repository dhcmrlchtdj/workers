export interface Device {
	lineWidth: number
	space(n: number): void
	indent(n: number): void
	newline(): void
	lineBreak(n: number): void
	text(s: string): void
}

export class PlainDevice implements Device {
	private buf: string
	public lineWidth: number
	constructor(lineWidth = 80) {
		this.buf = ""
		this.lineWidth = lineWidth
	}
	space(n: number) {
		this.buf += " ".repeat(n)
	}
	indent(n: number) {
		this.buf += " ".repeat(n)
	}
	newline() {
		this.buf += "\n"
	}
	lineBreak(n: number) {
		this.buf += "\n" + " ".repeat(n)
	}
	text(s: string) {
		this.buf += s
	}
	getOutput(): string {
		return this.buf
	}
}

export type Config = {
	width: number
	tabWidth: number
	writeSpace: (n: number) => void
	writeNewline: () => void
	writeIndent: (n: number) => void
	writeText: (s: string) => void
}

export function config(
	write: (s: string) => void,
	width: number = 80,
	lineBreak: "\n" | "\r" | "\r\n" = "\n",
	indent: "\t" | " " = "\t",
	tabWidth: number = 4,
): Config {
	return {
		width,
		tabWidth,
		writeSpace: (n) => write(" ".repeat(n)),
		writeNewline: () => write(lineBreak),
		writeIndent:
			indent === "\t"
				? (n) => write("\t".repeat(n))
				: (n) => write(" ".repeat(n * tabWidth)),
		writeText: write,
	}
}

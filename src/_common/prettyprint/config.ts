export type Config = {
	width: number
	tabWidth: number
	writeSpace: (n: number) => void
	writeNewline: (indent: number, space: number) => void
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
	const writeSpace: Config["writeSpace"] = (n) => write(" ".repeat(n))
	const writeIndent: Config["writeIndent"] =
		indent === "\t"
			? (n) => write("\t".repeat(n))
			: (n) => write(" ".repeat(n * tabWidth))
	const writeNewline: Config["writeNewline"] = (i = 0, s = 0) => {
		write(lineBreak)
		writeIndent(i)
		writeSpace(s)
	}
	return {
		width,
		tabWidth,
		writeSpace,
		writeNewline,
		writeIndent,
		writeText: write,
	}
}

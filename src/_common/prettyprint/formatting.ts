export type Alignment = "horizontal" | "vertical" | "packed" | "compact"

export type Break =
	| { type: "space"; space: number }
	| { type: "hard" }
	| { type: "soft"; space: number }
	| { type: "null" }

export type Format =
	| { type: "empty" }
	| { type: "text"; text: string; size: number }
	| { type: "block"; elems: Element[]; size: number }
	| { type: "ablock"; fmts: Format[]; align: Alignment; size: number }
	| { type: "indent"; indent: number; fmt: Format }
	| { type: "flat"; fmt: Format }
	| { type: "alt"; fmt1: Format; fmt2: Format }

export type Element = Break | Format

///

export function measure(fmt: Format): number {
	switch (fmt.type) {
		case "empty":
			return 0
		case "text":
			return fmt.size
		case "block":
			return fmt.size
		case "ablock":
			return fmt.size
		case "indent":
			return measure(fmt.fmt)
		case "flat":
			return measure(fmt.fmt)
		case "alt":
			return measure(fmt.fmt1)
	}
}

function measureElement(elem: Element): number {
	switch (elem.type) {
		case "hard":
			return 1
		case "null":
			return 0
		case "space":
			return elem.space
		case "soft":
			return elem.space
		default:
			return measure(elem)
	}
}
export function measureElements(elems: Element[]): number {
	let total = 0
	for (const el of elems) {
		total += measureElement(el)
	}
	return total
}
export function measureFormats(breakSize: number, fmts: Format[]): number {
	let total = 0
	for (const fmt of fmts) {
		total += measure(fmt) + breakSize
	}
	return total
}

export function alignmentToBreak(align: Alignment): Break {
	switch (align) {
		case "horizontal":
			return { type: "space", space: 1 }
		case "vertical":
			return { type: "hard" }
		case "packed":
			return { type: "soft", space: 1 }
		case "compact":
			return { type: "null" }
	}
}

///

export function empty(): Format {
	return { type: "empty" }
}

export function text(s: string): Format {
	return { type: "text", text: s, size: s.length }
}

export function fancyText(s: string, size: number): Format {
	return { type: "text", text: s, size: size }
}

export function indent(n: number, fmt: Format): Format {
	switch (fmt.type) {
		case "empty":
			return fmt
		default:
			return { type: "indent", indent: n, fmt }
	}
}

export function block(elems: Element[]): Format {
	const xs = elems.filter((x) => x.type !== "empty")
	if (xs.length === 0) return empty()
	return { type: "block", elems: xs, size: measureElements(elems) }
}

export function aBlock(align: Alignment, fmts: Format[]): Format {
	const xs = fmts.filter((x) => x.type !== "empty")
	if (xs.length === 0) return empty()
	if (xs.length === 1) return fmts[0]!
	const breakSize = align === "compact" ? 0 : 1
	return {
		type: "ablock",
		fmts: xs,
		align,
		size: measureFormats(breakSize, fmts),
	}
}
export const hBlock = (fmts: Format[]) => aBlock("horizontal", fmts)
export const pBlock = (fmts: Format[]) => aBlock("packed", fmts)
export const vBlock = (fmts: Format[]) => aBlock("vertical", fmts)
export const cBlock = (fmts: Format[]) => aBlock("compact", fmts)

export function alt(fmt1: Format, fmt2: Format): Format {
	return { type: "alt", fmt1, fmt2 }
}

export function tryFlat(fmt: Format): Format {
	return alt({ type: "flat", fmt }, fmt)
}

export function hvBlock(fmts: Format[]): Format {
	return tryFlat(vBlock(fmts))
}

export function spaces(n: number): Format {
	return text(" ".repeat(n))
}

export function sequence(
	align: Alignment,
	sep: Format,
	fmts: Format[],
): Format {
	const elems = []
	const brk = alignmentToBreak(align)
	const pushSep =
		align === "compact" ? () => elems.push(sep) : () => elems.push(sep, brk)
	const len = fmts.length
	for (let i = 0; i < len; i++) {
		elems.push(fmts[i]!)
		if (i + 1 < len) pushSep()
	}
	return block(elems)
}
export const hSequence = (sep: Format, fmts: Format[]) =>
	sequence("horizontal", sep, fmts)
export const pSequence = (sep: Format, fmts: Format[]) =>
	sequence("packed", sep, fmts)
export const vSequence = (sep: Format, fmts: Format[]) =>
	sequence("vertical", sep, fmts)
export const cSequence = (sep: Format, fmts: Format[]) =>
	sequence("compact", sep, fmts)

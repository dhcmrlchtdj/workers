import type { Config } from "./config"
import {
	measure,
	type Alignment,
	type Element,
	type Format,
} from "./formatting"

type RenderState = [indent: number, occupied: number, newline: boolean]

export function render(fmt: Format, cfg: Config): void {
	render1(fmt, [0, 0, true], cfg)
}

function render1(fmt: Format, state: RenderState, cfg: Config): RenderState {
	const [indent, occupied, newline] = state
	switch (fmt.type) {
		case "empty":
			return state
		case "text": {
			cfg.writeText(fmt.text)
			return [indent, occupied + measure(fmt), false]
		}
		case "block":
			return renderBlock(fmt.elems, state, cfg)
		case "ablock":
			return renderABlock(fmt.align, fmt.fmts, state, cfg)
		case "indent": {
			if (newline) {
				cfg.writeIndent(fmt.indent)
				return render1(
					fmt.fmt,
					[
						indent + fmt.indent,
						occupied + fmt.indent * cfg.tabWidth,
						true,
					],
					cfg,
				)
			} else {
				return render1(fmt.fmt, [indent, occupied, false], cfg)
			}
		}
		case "flat": {
			flatRender(fmt.fmt, cfg)
			return [indent, occupied + measure(fmt.fmt), false]
		}
		case "alt": {
			if (measure(fmt.fmt1) <= cfg.width - occupied) {
				return render1(fmt.fmt1, state, cfg)
			} else {
				return render1(fmt.fmt2, state, cfg)
			}
		}
	}
}

function renderBlock(
	elems: Element[],
	state: RenderState,
	cfg: Config,
): RenderState {
	let [indent, occupied, newline] = state
	const blm = occupied
	const preSpace = blm - indent * cfg.tabWidth

	let len = elems.length
	for (let i = 0; i < len; i++) {
		const elem = elems[i]!
		switch (elem.type) {
			case "null": {
				newline = false
				break
			}
			case "hard": {
				cfg.writeNewline(indent, preSpace)
				occupied = blm
				newline = true
				break
			}
			case "space": {
				cfg.writeSpace(elem.space)
				occupied += elem.space
				break
			}
			case "soft": {
				if (i === len - 1) {
					throw new Error(
						"Soft break cannot be the last element in a non-flat structure.",
					)
				}
				const nextElem = elems[i + 1]!
				if (
					nextElem.type === "space" ||
					nextElem.type === "hard" ||
					nextElem.type === "soft" ||
					nextElem.type === "null"
				) {
					throw new Error(
						"Soft break must be immediately followed by a Format element in a non-flat structure.",
					)
				}
				const sp = elem.space
				if (measure(nextElem) <= cfg.width - (occupied + sp)) {
					cfg.writeSpace(elem.space)
					occupied += sp
					newline = false
				} else {
					cfg.writeNewline(indent, preSpace)
					occupied = blm
					newline = true
				}
				break
			}
			default: {
				const rstate = render1(elem, [indent, occupied, newline], cfg)
				occupied = rstate[1]
				newline = rstate[2]
			}
		}
	}

	return [indent, occupied, newline]
}

function renderABlock(
	align: Alignment,
	fmts: Format[],
	state: RenderState,
	cfg: Config,
): RenderState {
	let indent = state[0]
	const blm = state[1]
	const preSpace = blm - indent * cfg.tabWidth

	let renderBreak: (state: RenderState, nextSize: number) => RenderState
	switch (align) {
		case "compact":
			renderBreak = (s, _m) => [s[0], s[1], false]
			break
		case "horizontal":
			renderBreak = (s, _m) => {
				cfg.writeSpace(1)
				return [s[0], s[1] + 1, false]
			}
			break
		case "vertical":
			renderBreak = (s, _m) => {
				cfg.writeNewline(s[0], preSpace)
				cfg.writeSpace(preSpace)
				return [s[0], blm, true]
			}
			break
		case "packed":
			renderBreak = (s, m) => {
				if (m <= cfg.width - s[1] - 1) {
					cfg.writeSpace(1)
					return [s[0], s[1] + 1, false]
				} else {
					cfg.writeNewline(s[0], preSpace)
					return [s[0], blm, true]
				}
			}
			break
	}

	let rstate = state
	let len = fmts.length
	for (let i = 0; i < len; i++) {
		const fmt = fmts[i]!
		rstate = render1(fmt, rstate, cfg)
		rstate[0] = indent
		if (i + 1 < len) {
			const nextFmt = fmts[i + 1]!
			rstate = renderBreak(rstate, measure(nextFmt))
		}
	}
	return rstate
}

///

function flatRender(fmt: Format, cfg: Config): void {
	switch (fmt.type) {
		case "empty":
			return
		case "text":
			return cfg.writeText(fmt.text)
		case "block": {
			for (const elem of fmt.elems) {
				flatRenderElement(elem, cfg)
			}
			return
		}
		case "ablock":
			return flatRenderABlock(fmt.fmts, cfg)
		case "indent":
			return flatRender(fmt.fmt, cfg)
		case "flat":
			return flatRender(fmt.fmt, cfg)
		case "alt":
			return flatRender(fmt.fmt1, cfg)
	}
}
function flatRenderABlock(fmts: Format[], cfg: Config): void {
	const len = fmts.length
	for (let i = 0; i <= len; i++) {
		flatRender(fmts[i]!, cfg)
		if (i + 1 < len) cfg.writeSpace(1)
	}
}
function flatRenderElement(elem: Element, cfg: Config): void {
	switch (elem.type) {
		case "hard":
			return cfg.writeSpace(1)
		case "space":
			return cfg.writeSpace(elem.space)
		case "soft":
			return cfg.writeSpace(elem.space)
		case "null":
			return
		default:
			return flatRender(elem, cfg)
	}
}

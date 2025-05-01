import type { Device } from "./device"
import {
	measure,
	type Alignment,
	type Element,
	type Format,
} from "./formatting"

type RenderState = [number, boolean]

export function render(fmt: Format, device: Device): void {
	render1(fmt, [0, false], device)
}

function render1(
	fmt: Format,
	inputState: RenderState,
	device: Device,
): RenderState {
	const [cc, newlinep] = inputState
	switch (fmt.type) {
		case "empty":
			return inputState
		case "text": {
			device.text(fmt.text)
			return [cc + measure(fmt), false]
		}
		case "block":
			return renderBlock(fmt.elems, inputState, device)
		case "ablock":
			return renderABlock(fmt.align, fmt.fmts, inputState, device)
		case "indent": {
			if (newlinep) {
				device.space(fmt.indent)
				return render1(fmt.fmt, [cc + fmt.indent, true], device)
			} else {
				return render1(fmt.fmt, [cc, false], device)
			}
		}
		case "flat": {
			flatRender(fmt.fmt, device)
			return [cc + measure(fmt.fmt), false]
		}
		case "alt": {
			if (measure(fmt.fmt1) <= device.lineWidth - cc) {
				return render1(fmt.fmt1, inputState, device)
			} else {
				return render1(fmt.fmt2, inputState, device)
			}
		}
	}
}

function renderBlock(
	elems: Element[],
	state: RenderState,
	device: Device,
): RenderState {
	let blm = state[0]
	let rstate = state

	let len = elems.length
	for (let i = 0; i < len; i++) {
		const elem = elems[i]!
		switch (elem.type) {
			case "FMT": {
				rstate = render1(elem.fmt, rstate, device)
				break
			}
			case "BRK": {
				const brk = elem.brk
				switch (brk.type) {
					case "null": {
						rstate[1] = false
						break
					}
					case "hard": {
						device.lineBreak(blm)
						rstate = [blm, true]
						break
					}
					case "space": {
						device.space(brk.space)
						rstate[0] += brk.space
						break
					}
					case "soft": {
						if (i + 1 === len) {
							throw new Error(
								"Soft break cannot be the last element in a non-flat structure.",
							)
						}
						const nextElem = elems[i + 1]!
						if (nextElem.type !== "FMT") {
							throw new Error(
								"soft break must be immediately followed by a Format element in a non-flat structure.",
							)
						}
						const cc = rstate[0]
						const sp = brk.space
						if (
							measure(nextElem.fmt) <=
							device.lineWidth - (cc + sp)
						) {
							device.space(brk.space)
							rstate = [cc + sp, false]
						} else {
							device.lineBreak(blm)
							rstate = [blm, true]
						}
						break
					}
				}
				break
			}
		}
	}

	return rstate
}

function renderABlock(
	align: Alignment,
	fmts: Format[],
	state: RenderState,
	device: Device,
): RenderState {
	let blm = state[0]
	let renderBreak: (cc: number, m: number) => RenderState
	switch (align) {
		case "compact":
			renderBreak = (cc, _m) => [cc, false]
			break
		case "horizontal":
			renderBreak = (cc, _m) => {
				device.space(1)
				return [cc + 1, false]
			}
			break
		case "vertical":
			renderBreak = (_cc, _m) => {
				device.lineBreak(blm)
				return [blm, true]
			}
			break
		case "packed":
			renderBreak = (cc, m) => {
				if (m <= device.lineWidth - cc - 1) {
					device.space(1)
					return [cc + 1, false]
				} else {
					device.lineBreak(blm)
					return [blm, true]
				}
			}
			break
	}

	let rstate = state
	let len = fmts.length
	for (let i = 0; i < len; i++) {
		const fmt = fmts[i]!
		rstate = render1(fmt, rstate, device)
		if (i + 1 < len) {
			const nextFmt = fmts[i + 1]!
			rstate = renderBreak(rstate[0], measure(nextFmt))
		}
	}
	return rstate
}

///

function flatRender(fmt: Format, device: Device): void {
	switch (fmt.type) {
		case "empty":
			return
		case "text":
			return device.text(fmt.text)
		case "block": {
			for (const elem of fmt.elems) {
				flatRenderElement(elem, device)
			}
			return
		}
		case "ablock":
			return flatRenderABlock(fmt.fmts, device)
		case "indent":
			return flatRender(fmt.fmt, device)
		case "flat":
			return flatRender(fmt.fmt, device)
		case "alt":
			return flatRender(fmt.fmt1, device)
	}
}
function flatRenderABlock(fmts: Format[], device: Device): void {
	const len = fmts.length
	for (let i = 0; i <= len; i++) {
		flatRender(fmts[i]!, device)
		if (i + 1 < len) device.space(1)
	}
}
function flatRenderElement(elem: Element, device: Device): void {
	switch (elem.type) {
		case "FMT": {
			return flatRender(elem.fmt, device)
		}
		case "BRK": {
			const brk = elem.brk
			switch (brk.type) {
				case "hard":
					return device.space(1)
				case "space":
					return device.space(brk.space)
				case "soft":
					return device.space(brk.space)
				case "null":
					return
			}
		}
	}
}

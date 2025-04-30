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
			return [cc + fmt.text.length, false]
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
	let i = 0
	let len = elems.length
	while (i < len) {
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
								"renderBlock: soft break should not be the latest Element",
							)
						}
						const nextElem = elems[i + 1]!
						if (nextElem.type !== "FMT") {
							throw new Error(
								"renderBlock: soft break should be followed by Format",
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
		i++
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
	const renderBreak = (cc: number, m: number): RenderState => {
		switch (align) {
			case "compact":
				return [cc, false]
			case "horizontal":
				device.space(1)
				return [cc + 1, false]
			case "vertical":
				device.lineBreak(blm)
				return [blm, true]
			case "packed": {
				if (m <= device.lineWidth - cc - 1) {
					device.space(1)
					return [cc + 1, false]
				} else {
					device.lineBreak(blm)
					return [blm, true]
				}
			}
		}
	}

	let rstate = state
	let i = 0
	let len = fmts.length
	while (i < len) {
		const fmt = fmts[i]!
		const [cc, _] = render1(fmt, rstate, device)
		if (i + 1 === len) {
			break
		}
		const nextFmt = fmts[i + 1]!
		rstate = renderBreak(cc, measure(nextFmt))
		i++
	}
	return rstate
}

///

function flatRender(fmt: Format, device: Device): void {
	switch (fmt.type) {
		case "empty":
			break
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
	const last = fmts.length - 1
	for (let i = 0; i <= fmts.length; i++) {
		flatRender(fmts[i]!, device)
		if (i < last) device.space(1)
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

export type OP =
	| { t: "read" }
	| { t: "advance" }
	| { t: "mark" }
	| { t: "drop"; pos: number }
	| { t: "reset"; pos: number }

export const read = (): OP => ({ t: "read" })
export const advance = (): OP => ({ t: "advance" })
export const mark = (): OP => ({ t: "mark" })
export const drop = (pos: number): OP => ({ t: "drop", pos })
export const reset = (pos: number): OP => ({ t: "reset", pos })

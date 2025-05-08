export type OP =
	| { t: "peek"; n: number }
	| { t: "advance"; n: number }
	| { t: "mark" }
	| { t: "unmark"; pos: number }
	| { t: "backTo"; pos: number }

export const peek = (n: number = 1): OP => ({ t: "peek", n })
export const advance = (n: number = 1): OP => ({ t: "advance", n })
export const mark = (): OP => ({ t: "mark" })
export const unmark = (pos: number): OP => ({ t: "unmark", pos })
export const backTo = (pos: number): OP => ({ t: "backTo", pos })

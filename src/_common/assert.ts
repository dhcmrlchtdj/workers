export const assert = (c: boolean, msg?: string): void => {
	if (!c) throw new Error(msg)
}

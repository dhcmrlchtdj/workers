export function compose<T>(...builders: ((x: T) => void)[]): (x: T) => void {
	return (x) => {
		for (const builder of builders) {
			builder(x)
		}
	}
}

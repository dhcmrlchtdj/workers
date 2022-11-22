export type Monitor = {
	error(err: unknown, req?: Request): Promise<void>
	warn(err: unknown, req?: Request): Promise<void>
}

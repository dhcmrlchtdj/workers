export type Monitor = {
    error(err: unknown, req?: Request): Promise<Response>
    warn(err: unknown, req?: Request): Promise<Response>
}

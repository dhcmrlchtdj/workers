export type Monitor = {
    error(err: Error, req?: Request): Promise<Response>
    warn(err: Error, req?: Request): Promise<Response>
}

export async function check(resp: Response): Promise<void> {
    if (resp.status !== 200) {
        const text = await resp.text()
        throw new Error(resp.statusText + '\n' + text)
    }
}

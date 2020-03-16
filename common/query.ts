import {} from '@cloudflare/workers-types'

export const getQuery = (request: Request): URLSearchParams => {
    const url = new URL(request.url)
    const query = url.searchParams
    return query
}

type item = number | string | null | undefined
export const encodeQuery = (
    pairs: Record<string, item | Array<item>>,
): string => {
    return Object.entries(pairs)
        .flatMap(pair => {
            if (Array.isArray(pair[1])) {
                const [key, items] = pair
                return items.map(item => [key, item]) as Array<[string, item]>
            } else {
                return [pair] as Array<[string, item]>
            }
        })
        .map(([key, val]) => {
            if (val === undefined) {
                return ''
            } else if (val === null) {
                return encodeURIComponent(key) + '='
            } else {
                return encodeURIComponent(key) + '=' + encodeURIComponent(val)
            }
        })
        .filter(Boolean)
        .join('&')
}

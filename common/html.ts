export const encodeHtmlEntities = (raw: string): string => {
    const pairs: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
    }
    return raw.replace(/[&<>]/g, matched => pairs[matched])
}

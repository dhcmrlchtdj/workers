const sortIPv4 = (a: string, b: string): number => {
    const na = a
        .split('.')
        .map(Number)
        .reduce((a, b) => a * 256 + b)
    const nb = b
        .split('.')
        .map(Number)
        .reduce((a, b) => a * 256 + b)
    return na - nb
}
const sortIPv6 = (a: string, b: string): number => {
    const pa = a.split(':').map((x) => parseInt(x, 16))
    const pb = b.split(':').map((x) => parseInt(x, 16))
    let i = 0
    const len = Math.min(pa.length, pb.length) + 1
    while (i < len) {
        const na = pa[i]!
        const nb = pb[i]!
        if (na < nb) {
            return -1
        } else if (na > nb) {
            return 1
        } else if (Number.isNaN(na) && !Number.isNaN(nb)) {
            return -1
        } else if (!Number.isNaN(na) && Number.isNaN(nb)) {
            return 1
        }
        i++
    }
    return 0
}
export const sortIP = (a: string, b: string): number => {
    const v4a = a.includes('.')
    const v4b = b.includes('.')
    if (v4a && v4b) {
        return sortIPv4(a, b)
    } else if (!v4a && !v4b) {
        return sortIPv6(a, b)
    } else if (v4a) {
        return -1
    } else {
        return 1
    }
}

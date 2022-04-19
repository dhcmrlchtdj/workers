export interface Option<T> {
    isNone: boolean
    isSome: boolean
    unwrap(): T
    map<K>(f: (x: T) => K): Option<K>
    bind<K>(f: (x: T) => Option<K>): Option<K>
}

export const None: Option<never> = {
    isNone: true,
    isSome: false,
    unwrap: () => {
        throw new Error("Option.unwrap")
    },
    map: (_) => None,
    bind: (_) => None,
}

export const Some = <T>(x: T): Option<T> => ({
    isNone: false,
    isSome: true,
    unwrap: () => x,
    map: (f) => Some(f(x)),
    bind: (f) => f(x),
})

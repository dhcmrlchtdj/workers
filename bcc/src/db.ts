import { execute } from './service/fauna'

export const addTags = async (chat_id: number, tags: string[]) => {
    /*
    If(
        Exists(Match(Index('bcc-get-tags-by-chat_id-sort_by-tag'), -1001450758329))
        Update(
            Select('ref',Get(Match(Index('bcc-get-tags-by-chat_id-sort_by-tag'), -1001450758329))),
            {
                data: {
                    tags: Distinct(Union(
                        Select(["data","tags"], Get(Match(Index('bcc-get-tags-by-chat_id-sort_by-tag'), -1001450758329))),
                        ['#ocaml', '#gc', '#type']
                    ))
                }
            }
        ),
        Create(
            Collection('bcc'),
            { data: { chat_id: -1001450758329, tags: ['#ocaml', '#gc', '#type'] } }
        )
    )
    */
    const stmt = JSON.stringify({
        if: {
            exists: {
                match: { index: 'bcc-get-tags-by-chat_id-sort_by-tag' },
                terms: chat_id,
            },
        },
        then: {
            update: {
                select: 'ref',
                from: {
                    get: {
                        match: { index: 'bcc-get-tags-by-chat_id-sort_by-tag' },
                        terms: chat_id,
                    },
                },
            },
            params: {
                object: {
                    data: {
                        object: {
                            tags: {
                                distinct: {
                                    union: [
                                        {
                                            select: ['data', 'tags'],
                                            from: {
                                                get: {
                                                    match: {
                                                        index:
                                                            'bcc-get-tags-by-chat_id-sort_by-tag',
                                                    },
                                                    terms: chat_id,
                                                },
                                            },
                                        },
                                        tags,
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        },
        else: {
            create: { collection: 'bcc' },
            params: {
                object: {
                    data: {
                        object: {
                            chat_id,
                            tags,
                        },
                    },
                },
            },
        },
    })
    await execute(stmt)
}

export const getTags = async (chat_id: number): Promise<string[]> => {
    /*
    If(
        Exists(Match(Index('bcc-get-tags-by-chat_id-sort_by-tag'), -1001450758329)),
        Select(
            ["data"],
            Paginate(Match(Index('bcc-get-tags-by-chat_id-sort_by-tag'), -1001450758329), {size:100000})
        ),
        []
    )
    */
    const stmt = JSON.stringify({
        if: {
            exists: {
                match: { index: 'bcc-get-tags-by-chat_id-sort_by-tag' },
                terms: chat_id,
            },
        },
        then: {
            select: ['data'],
            from: {
                paginate: {
                    match: { index: 'bcc-get-tags-by-chat_id-sort_by-tag' },
                    terms: chat_id,
                },
                size: 100000,
            },
        },
        else: [],
    })
    const tags = await execute<string[]>(stmt)
    return tags
}

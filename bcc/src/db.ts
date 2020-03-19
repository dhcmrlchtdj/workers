import { execute } from './service/fauna'

/*
{
    name: "get_tags",
    body: Query(
        Lambda(
            "chat_id",
            Let(
                { x: Match(Index("bcc-get-tags-by-chat_id-sort_by-tag"), Var("chat_id")) },
                If(
                    Exists(Var('x')),
                    Select(["data"], Paginate(Var('x'), {size: 100000})),
                    []
                )
            )
        )
    )
}

{
    name: "add_tags",
    body: Query(
        Lambda(
            ["chat_id", "tags"],
            Let(
                { x: Match(Index("bcc-get-tags-by-chat_id-sort_by-tag"), Var("chat_id")) },
                If(
                    Exists(Var('x')),
                    Update(Select("ref", Get(Var('x'))), {
                        data: {
                            tags: Distinct(
                                Union(
                                    Select(["data", "tags"], Get(Var('x'))),
                                    Var("tags")
                                )
                            )
                        }
                    }),
                    Create(Collection("bcc"), {
                        data: { chat_id: Var("chat_id"), tags: Var("tags") }
                    })
                )
            )
        )
    )
}
*/

export const addTags = async (chat_id: number, tags: string[]) => {
    const stmt = JSON.stringify({
        call: { function: 'add_tags' },
        arguments: [chat_id, tags],
    })
    await execute(stmt)
}

export const getTags = async (chat_id: number): Promise<string[]> => {
    const stmt = JSON.stringify({
        call: { function: 'get_tags' },
        arguments: chat_id,
    })
    const tags = await execute<string[]>(stmt)
    return tags
}

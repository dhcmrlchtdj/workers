import { execute } from './service/fauna'

/*
{
    name: "get_tags",
    body: Query(
        Lambda(
            "chat_id",
            If(
                Exists(
                    Match(Index("bcc-get-tags-by-chat_id-sort_by-tag"), Var("chat_id"))
                ),
                Select(
                    ["data"],
                    Paginate(
                        Match(Index("bcc-get-tags-by-chat_id-sort_by-tag"), Var("chat_id")),
                        100000
                    )
                ),
                []
            )
        )
    )
}

{
    name: "add_tags",
    body: Query(
        Lambda(
            ["chat_id", "tags"],
            If(
                Exists(
                    Match(Index("bcc-get-tags-by-chat_id-sort_by-tag"), Var("chat_id"))
                ),
                Update(
                    Select(
                        "ref",
                        Get(
                            Match(Index("bcc-get-tags-by-chat_id-sort_by-tag"), Var("chat_id"))
                        )
                    ),
                    {
                        data: {
                            tags: Distinct(
                                Union(
                                    Select(
                                        ["data", "tags"],
                                        Get(
                                            Match(Index("bcc-get-tags-by-chat_id-sort_by-tag"), Var("chat_id"))
                                        )
                                    ),
                                    Var("tags")
                                )
                            )
                        }
                    }
                ),
                Create(Collection("bcc"), {
                    data: { chat_id: Var("chat_id"), tags: Var("tags") }
                })
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

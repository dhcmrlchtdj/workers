import { execute } from '../_common/fauna'

/*
{
    name: "bcc_get_tags",
    body: Query(
        Lambda(
            "chat_id",
            Let(
                {
                    tags: Match(
                        Index("bcc-get-tags-by-chat_id-sort_by-tag"),
                        Var("chat_id")
                    )
                },
                If(
                    Exists(Var("tags")),
                    Select(["data"], Paginate(Var("tags"), {size:100000})),
                    []
                )
            )
        )
    )
}

{
    name: "bcc_add_tags",
    body: Query(
        Lambda(
            ["chat_id", "tags"],
            Let(
                {
                    x: Match(Index("bcc-get-tags-by-chat_id-sort_by-tag"), Var("chat_id"))
                },
                Select(
                    ["ts"],
                    If(
                        Exists(Var("x")),
                        Update(Select("ref", Get(Var("x"))), {
                            data: {
                                tags: Distinct(
                                Union(Select(["data", "tags"], Get(Var("x"))), Var("tags"))
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
    )
}
*/

declare const FAUNA_KEY: string

export const addTags = async (chat_id: number, tags: string[]) => {
    const stmt = JSON.stringify({
        call: { function: 'bcc_add_tags' },
        arguments: [chat_id, tags],
    })
    await execute(FAUNA_KEY, stmt)
}

export const getTags = async (chat_id: number): Promise<string[]> => {
    const stmt = JSON.stringify({
        call: { function: 'bcc_get_tags' },
        arguments: chat_id,
    })
    const tags = await execute<string[]>(FAUNA_KEY, stmt)
    return tags
}

export type Update = {
    update_id: number
    message?: Message
    edited_message?: Message
    channel_post?: Message
    edited_channel_post?: Message
}

export type ChatMember = {
    status: string
}

export type Message = {
    message_id: number
    from?: User
    sender_chat?: Chat
    date: number
    chat: Chat
    forward_from?: User
    forward_from_chat?: Chat
    forward_from_message_id?: number
    forward_signature?: string
    forward_sender_name?: string
    forward_date?: number
    reply_to_message?: Message
    via_bot?: User
    edit_date?: number
    text?: string
    entities?: MessageEntity[]
    caption?: string
    caption_entities?: MessageEntity[]
    reply_markup?: InlineKeyboardMarkup
}

export type User = {
    id: number
    is_bot: boolean
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    can_join_groups?: boolean
    can_read_all_group_messages?: boolean
    supports_inline_queries?: boolean
}

export type Chat = {
    id: number
    type: string
    title?: string
    username?: string
    first_name?: string
    last_name?: string
    bio?: string
    description?: string
    invite_link?: string
    pinned_message?: Message
    slow_mode_delay?: number
    message_auto_delete_time?: number
    sticker_set_name?: string
    can_set_sticker_set?: boolean
    linked_chat_id?: number
}

export type MessageEntity = {
    type:
        | "mention"
        | "hashtag"
        | "cashtag"
        | "bot_command"
        | "url"
        | "email"
        | "phone_number"
        | "bold"
        | "italic"
        | "underline"
        | "strikethrough"
        | "code"
        | "pre"
        | "text_link"
        | "text_mention"
    offset: number
    length: number
    url?: string
    user?: User
    language?: string
}

export type InlineKeyboardMarkup = {
    inline_keyboard: InlineKeyboardButton[][]
}

export type InlineKeyboardButton = {
    text: string
    url?: string
}

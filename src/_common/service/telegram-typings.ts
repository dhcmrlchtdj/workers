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

///

export type SendMessage = {
	chat_id: number
	text: string
	parse_mode?: "MarkdownV2" | "HTML"
	disable_web_page_preview?: boolean
	disable_notification?: boolean
	reply_to_message_id?: number
	reply_markup?: InlineKeyboardMarkup
}
export type SendPhoto = {
	chat_id: number
	photo: string // file_id
	caption?: string
	parse_mode?: "MarkdownV2" | "HTML"
	disable_notification?: boolean
	reply_to_message_id?: number
	reply_markup?: InlineKeyboardMarkup
}
export type SendAnimation = {
	chat_id: number
	animation: string // file_id
	duration?: number
	width?: number
	height?: number
	thumb?: string // file_id
	caption?: string
	parse_mode?: "MarkdownV2" | "HTML"
	disable_notification?: boolean
	reply_to_message_id?: number
	reply_markup?: InlineKeyboardMarkup
}
export type SendVideo = {
	chat_id: number
	video: string // file_id
	duration?: number
	width?: number
	height?: number
	thumb?: string // file_id
	caption?: string
	parse_mode?: "MarkdownV2" | "HTML"
	supports_streaming?: boolean
	disable_notification?: boolean
	reply_to_message_id?: number
	reply_markup?: InlineKeyboardMarkup
}
export type EditMessageText =
	| {
			chat_id: number
			message_id: number
			text: string
			parse_mode?: "MarkdownV2" | "HTML"
			disable_web_page_preview?: boolean
			reply_markup?: InlineKeyboardMarkup
	  }
	| {
			inline_message_id: string
			text: string
			parse_mode?: "MarkdownV2" | "HTML"
			disable_web_page_preview?: boolean
			reply_markup?: InlineKeyboardMarkup
	  }
export type AnswerCallbackQuery = {
	callback_query_id: string
	text?: string
	show_alert?: boolean
	url?: string
	cache_time?: number
}
export type GetChatMember = {
	chat_id: number
	user_id: number
}

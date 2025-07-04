export type Update = {
	update_id: number
	message?: Message
	edited_message?: Message
	channel_post?: Message
	edited_channel_post?: Message
	callback_query?: CallbackQuery
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
	forward_origin?: MessageOrigin
	reply_to_message?: Message
	via_bot?: User
	edit_date?: number
	text?: string
	entities?: MessageEntity[]
	caption?: string
	caption_entities?: MessageEntity[]
	reply_markup?: InlineKeyboardMarkup
	document?: Document
	photo?: PhotoSize[]
	audio?: Audio
	video?: Video
	voice?: Voice
	sticker?: Sticker
	video_note?: VideoNote
	animation?: Animation
}

export type MessageOrigin =
	| {
			type: "user"
			date: number
			sender_user: User
	  }
	| {
			type: "hidden_user"
			date: number
			sender_user_name: string
	  }
	| {
			type: "chat"
			date: number
			sender_chat: Chat
			author_signature?: string
	  }
	| {
			type: "channel"
			date: number
			chat: Chat
			message_id: number
			author_signature?: string
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
		| "spoiler"
		| "code"
		| "pre"
		| "text_link"
		| "text_mention"
		| "custom_emoji"
	offset: number
	length: number
	url?: string
	user?: User
	language?: string
	custom_emoji_id?: string
}

export type InlineKeyboardMarkup = {
	inline_keyboard: InlineKeyboardButton[][]
}

export type InlineKeyboardButton = {
	text: string
	url?: string
	callback_data?: string // 1~64 bytes
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

export type File = {
	file_id: string
	file_unique_id: string
	file_size?: number
	file_path?: string
}
export type Document = {
	file_id: string
	file_unique_id: string
	thumbnail?: PhotoSize
	file_name?: string
	mime_type?: string
	file_size?: number
}
export type PhotoSize = {
	file_id: string
	file_unique_id: string
	width: number
	height: number
	file_size?: number
}
export type Audio = {
	file_id: string
	file_unique_id: string
	duration: number
	performer?: string
	title?: string
	file_name?: string
	mime_type?: string
	file_size?: number
	thumbnail?: PhotoSize
}
export type Video = {
	file_id: string
	file_unique_id: string
	width: number
	height: number
	duration: number
	thumbnail?: PhotoSize
	file_name?: string
	mime_type?: string
	file_size?: number
}
export type Voice = {
	file_id: string
	file_unique_id: string
	duration: number
	mime_type?: string
	file_size?: number
}
export type Sticker = {
	file_id: string
	file_unique_id: string
	type: "regular" | "mask" | "custom_emoji"
	width: number
	height: number
	is_animated: boolean
	is_video: boolean
	thumbnail?: PhotoSize
	emoji?: string
	set_name?: string
	premium_animation?: File
	mask_position?: MaskPosition
	custom_emoji_id?: string
	needs_repainting?: true
	file_size?: number
}
export type VideoNote = {
	file_id: string
	file_unique_id: string
	length: number
	duration: number
	thumbnail?: PhotoSize
	file_size?: number
}
export type Animation = {
	file_id: string
	file_unique_id: string
	width: number
	height: null
	duration: null
	thumbnail?: PhotoSize
	file_name?: string
	mime_type?: string
	file_size?: number
}
export type MaskPosition = {
	point: string
	x_shift: number
	y_shift: number
	scale: number
}

export type CallbackQuery = {
	id: string
	from: User
	message?: Message
	inline_message_id?: string
	chat_instance?: string
	data?: string
	game_short_name?: string
}

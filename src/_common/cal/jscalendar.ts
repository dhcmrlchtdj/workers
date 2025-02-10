// https://datatracker.ietf.org/doc/html/rfc8984

export type Event = CommonProperties & {
	"@type": "Event"
	start: LocalDateTime
	duration?: Duration
	status?: "confirmed" | "cancelled" | "tentative"
}

export type Task = CommonProperties & {
	"@type": "Task"
	due?: LocalDateTime
	start?: LocalDateTime
	estimatedDuration?: Duration
	percentComplete?: UnsignedInt
	progress?:
		| "completed"
		| "failed"
		| "in-process"
		| "needs-action"
		| "cancelled"
	progressUpdated?: UTCDateTime
}

export type Group = {
	"@type": "Group"
	uid: string
	prodId?: string
	createId: string
	title?: string
	description?: string
	descriptionContentType?: string
	links?: Record<Id, Link>
	locale?: string
	keywords?: Record<string, true>
	categories?: Record<string, true>
	color?: string
	timeZones?: Record<TimeZoneId, TimeZone>
} & {
	entries: (Task | Event)[]
	source?: string
}

///

type CommonProperties = {
	uid: string
	// relatedTo?:
	prodId?: string
	created?: UTCDateTime
	updated: UTCDateTime
	sequence?: UnsignedInt
	method?: string
} & {
	title?: string
	description?: string
	descriptionContentType?: string
	showWithoutTime?: boolean
	localtions?: Record<Id, Location>
	virtualLocations?: Record<Id, VirtualLocation>
	links?: Record<Id, Link>
	locale?: string
	keywords?: Record<string, true>
	categories?: Record<string, true>
	color?: string
} & {
	recurrenceId?: LocalDateTime
	recurrenceIdTimeZone?: TimeZoneId | null
	recurrenceRules?: RecurrenceRule[]
	excludedRecurrenceRules?: RecurrenceRule[]
	recurrenceOverrides?: Map<LocalDateTime, PatchObject>
	excluded?: boolean
} & {
	priority?: Int
	freeBusyStatus?: "free" | "busy"
	privacy?: "public" | "private" | "secret"
	replyTo?: Record<"imip" | "web" | "other", string>
	sentBy?: string
	participants?: Record<Id, Participant>
	requestStatus?: string
} & {
	useDefaultAlerts?: boolean
	alerts?: Record<Id, Alert>
} & {
	localizations?: Record<string, PatchObject>
} & {
	timeZone?: TimeZoneId | null
	timeZones?: Record<TimeZoneId, TimeZone>
}

///

type RecurrenceRule = {
	"@type": "RecurrenceRule"
	frequency:
		| "yearly"
		| "monthly"
		| "weekly"
		| "daily"
		| "hourly"
		| "minutely"
		| "secondly"
	interval?: UnsignedInt
	rscale?: "gregorian"
	skip?: "omit" | "backward" | "forward"
	firstDayOfWeek?: "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su"
	byDay?: NDay[]
	byMonthDay?: Int[]
	byMonth?: string[]
	byYearDay?: Int[]
	byWeekNo?: Int[]
	byHour?: UnsignedInt[]
	byMinue?: UnsignedInt[]
	bySecond?: UnsignedInt[]
	bySetPosition?: Int[]
	count?: UnsignedInt[]
	until?: LocalDateTime
}

type NDay = {
	"@type": "NDay"
	day: string
	nthOfPeroid?: Int
}

type Location = {
	"@type": "Location"
	name?: string
	description?: string
	locationTypes?: Record<string, true>
	relativeTo?: "start" | "end"
	timeZone?: TimeZoneId
	coordinates?: string
	links?: Record<Id, Link>
}

type VirtualLocation = {
	"@type": "VirtualLocation"
	name?: string
	description?: string
	uri: string
	features: Record<
		"audio" | "chat" | "feed" | "moderator" | "phone" | "screen" | "video",
		true
	>
	links?: Record<Id, Link>
	locale?: string
	keywords?: Record<string, true>
	categories?: Record<string, true>
	color?: string
}

type Participant = {
	"@type": "Participant"
	name?: string
	email?: string
	description?: string
	sendTo?: Record<"imip" | "other", string>
	kind?: "individual" | "group" | "location" | "resource"
	roles: Record<
		| "owner"
		| "attendee"
		| "optional"
		| "informational"
		| "chair"
		| "contact",
		true
	>
	locationId?: Id
	language?: string
	participationStatus?:
		| "needs-action"
		| "accepted"
		| "declined"
		| "tentative"
		| "delegated"
	participationComment?: string
	expectReply?: boolean
	scheduleAgent?: "server" | "client" | "none"
	scheduleForceSend?: boolean
	scheduleSequence?: UnsignedInt
	scheduleStatus?: string[]
	scheduleUpdated?: UTCDateTime
	sentBy?: string
	invitedBy?: Id
	delegatedTo?: Record<Id, true>
	delegatedFrom?: Record<Id, true>
	memberOf?: Record<Id, true>
	links?: Record<Id, Link>
	progress?: string
	progressUpdated?: UTCDateTime
	percentComplete?: UnsignedInt
}

type Alert = {
	"@type": "Alert"
	trigger: OffsetTrigger | AbsoluteTrigger
	acknowledged?: UTCDateTime
	relatedTo?: Record<string, Relation>
	action?: "display" | "email"
}

type OffsetTrigger = {
	"@type": "OffsetTrigger"
	offset: SignedDuration
	relativeTo?: "start" | "end"
}

type AbsoluteTrigger = {
	"@type": "AbsoluteTrigger"
	when: UTCDateTime
}

type TimeZone = {
	"@type": "TimeZone"
	tzId: string
	updated?: UTCDateTime
	url: string
	validUtil?: UTCDateTime
	alias?: Record<string, true>
	standard?: TimeZoneRule[]
	daylight?: TimeZoneRule[]
}

type TimeZoneRule = {
	"@type": "TimeZoneRule"
	start: LocalDateTime
	offsetFrom: string
	offsetTo: string
	recurrenceRules?: RecurrenceRule[]
	recurrenceOverrides?: Map<LocalDateTime, PatchObject>
	names?: Record<string, true>
	comments?: string[]
}

///

type Id = string
type Int = number
type UnsignedInt = number
type UTCDateTime = string
type LocalDateTime = string
type Duration = string
type SignedDuration = string
type TimeZoneId = string
type PatchObject = Record<string, unknown>
type Relation = {
	"@type": "Relation"
	relation?: Record<"first" | "next" | "child" | "parent", true>
}
type Link = {
	"@type": "Link"
	href: string
	cid?: string
	contentType?: string
	size?: UnsignedInt
	rel?: string
	display?: "badge" | "graphic" | "fullsize" | "thumbnail"
	title?: string
}

export type RouterContext<ENV> = {
	req: Request
	env: ENV
	ec: ExecutionContext
	param: Map<string, string>
}

export type Matcher<ENV> = (
	ctx: RouterContext<ENV>,
) => null | Map<string, string>

export type Handler<ENV> = (
	ctx: RouterContext<ENV>,
	next: NextFn<ENV>,
) => Response | Promise<Response>

export type NextFn<ENV> = (
	ctx: RouterContext<ENV>,
) => Response | Promise<Response>

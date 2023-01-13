SHELL := bash
.SHELLFLAGS = -O globstar -c
PATH := ./node_modules/.bin:$(PATH)

targets := $(filter-out src/_%, $(wildcard src/*))
test_compiled := $(addsuffix .test.js, $(wildcard test/**/*.ts))

###

.PHONY: dev build fmt lint test clean outdated upgrade

# dev:

build: $(targets)

fmt:
	prettier --write .

lint:
	eslint --ext=".ts" src test

test: $(test_compiled)
	jest --rootDir=./test $^

# clean:

outdated:
	pnpm outdated

upgrade:
	pnpm update --latest # --interactive

###

.PHONY: check force $(targets) $(test_compiled) update_compatibility_date

force: check build

$(targets): node_modules/tsconfig.tsbuildinfo
	esbuild --bundle --format=esm --target=es2020 --platform=neutral --outfile=$@/index.js $@/index.ts

node_modules/tsconfig.tsbuildinfo: node_modules $(shell ls {src,test}/**/*.ts)
	@$(MAKE) --no-print-directory check

check:
	tsc --noEmit
	@touch -cm node_modules/tsconfig.tsbuildinfo # force update mtime

node_modules:
	pnpm install

$(test_compiled): node_modules/tsconfig.tsbuildinfo
	esbuild --bundle --format=esm --target=es2020 --platform=node --outfile=$@ ${@:.test.js=}

# https://developers.cloudflare.com/workers/platform/compatibility-dates/#change-history
update_compatibility_date:
	@for t in $(targets); do \
		gsed -i \
		"s/compatibility_date =.*/compatibility_date = \"$(shell date '+%Y-%m-%d')\"/" \
		"$$t/wrangler.toml"; \
		done

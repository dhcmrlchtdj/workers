SHELL := bash
.SHELLFLAGS := -O globstar -e -u -o pipefail -c
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules
MAKEFLAGS += --no-builtin-variables

PATH := ./node_modules/.bin:$(PATH)

targets := $(filter-out src/_%, $(wildcard src/*))
test_compiled := $(addsuffix .test.js, $(wildcard test/**/*.ts))

###

.PHONY: dev build fmt lint test clean outdated upgrade

# dev:

build: $(targets)

fmt:
	prettier --write "./**/*.{html,js,ts,json,css}" "./.github/**"

lint:
	eslint --ext=".ts" src test

t :=
test: $(test_compiled)
	@echo "filter test with 'make test t=xxx'"
	NODE_OPTIONS="--experimental-vm-modules --no-warnings" jest --rootDir=./test --verbose=true -t=$(t)

# clean:

outdated:
	pnpm outdated

upgrade:
	pnpm update --latest # --interactive

deploy: on_ci
	cd ./src/backup && wrangler --experimental-json-config deploy
	cd ./src/bot-share && wrangler --experimental-json-config deploy
	cd ./src/current-ip && wrangler --experimental-json-config deploy
	cd ./src/feedbox && wrangler --experimental-json-config deploy
	cd ./src/proxy-list && wrangler --experimental-json-config deploy
	cd ./src/r2-share && wrangler --experimental-json-config deploy
	cd ./src/under-construction && wrangler --experimental-json-config deploy

###

.PHONY: check force $(targets) $(test_compiled) update_compatibility_date on_ci

on_ci:
ifndef CI
	$(error This command can only be executed within a CI environment)
endif

force: check build

$(targets): node_modules/tsconfig.tsbuildinfo
	esbuild --bundle --format=esm --target=esnext --platform=node --outfile=$@/index.js $@/index.ts

node_modules/tsconfig.tsbuildinfo: node_modules $(shell ls {src,test}/**/*.ts)
	@make --no-print-directory check

check:
	tsc --noEmit
	@touch -cm node_modules/tsconfig.tsbuildinfo # force update mtime

node_modules:
	pnpm install

$(test_compiled): node_modules/tsconfig.tsbuildinfo
	esbuild --bundle --format=esm --target=esnext --platform=node --outfile=$@ ${@:.test.js=}

# https://developers.cloudflare.com/workers/platform/compatibility-dates/#change-history
update_compatibility_date:
	@for t in $(targets); do \
		gsed -i \
		"s/\"compatibility_date\":.*/\"compatibility_date\": \"$(shell date '+%Y-%m-%d')\",/" \
		"$$t/wrangler.json"; \
		done

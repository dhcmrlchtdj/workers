SHELL := bash
.SHELLFLAGS = -O globstar -c
PATH := ./node_modules/.bin:$(PATH)

targets := $(filter-out src/_%, $(wildcard src/*))
test_targets := $(addsuffix .test.js,$(wildcard test/**/*.ts))

build: $(targets)

check:
	tsc --noEmit
	@touch -cm node_modules/tsconfig.tsbuildinfo # force update mtime

force: check build

fmt:
	prettier --write .

$(targets): node_modules/tsconfig.tsbuildinfo
	esbuild --bundle --format=esm --target=es2020 --platform=neutral --outfile=$@/index.js $@/index.ts

node_modules:
	pnpm install

node_modules/tsconfig.tsbuildinfo: node_modules $(shell ls {src,test}/**/*.ts)
	@$(MAKE) --no-print-directory check

upgrade:
	pnpm update --latest # --interactive

update_compatibility_date:
	@for t in $(targets); do \
		gsed -i \
		"s/compatibility_date =.*/compatibility_date = \"$(shell date '+%Y-%m-%d')\"/" \
		"$$t/wrangler.toml"; \
		done

test: $(test_targets)

$(test_targets): node_modules/tsconfig.tsbuildinfo
	esbuild --bundle --format=esm --target=es2020 --platform=node --outfile=$@ ${@:.test.js=}
	jest $@

.PHONY: build check force fmt $(targets) test $(test_targets)

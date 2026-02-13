SHELL := bash
.SHELLFLAGS := -O globstar -e -u -o pipefail -c
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules
MAKEFLAGS += --no-builtin-variables

PATH := ./node_modules/.bin:$(PATH)

targets := $(filter-out src/_%, $(wildcard src/*))
test_compiled := $(wildcard src/_common/**/*.test.ts)
bench_compiled := $(wildcard src/_common/**/*.bench.ts)

###

COLOR ?= true

ifeq ($(COLOR),true)
GREEN := \033[32m
BGREEN := \033[1;32m
RESET := \033[0m
else
GREEN :=
BGREEN :=
RESET :=
endif


###

.PHONY: dev build fmt lint test bench clean outdated upgrade

# dev:

build: $(targets)

fmt:
	prettier --write . "!pnpm-lock.yaml"

lint:
	@echo "Linting..."
	@oxlint --deny-warnings \
		-D=correctness \
		-D=suspicious \
		-D=pedantic \
		-A=ban-ts-comment \
		-A=max-classes-per-file \
		-A=max-dependencies \
		-A=max-depth \
		-A=max-lines \
		-A=max-lines-per-function \
		-A=max-nested-callbacks \
		-A=no-else-return \
		-A=no-hex-escape \
		-A=no-negated-condition \
		-A=no-new-array \
		-A=no-useless-undefined \
		-A=prefer-code-point \
		-A=prefer-math-trunc \
		-A=require-await \
		-A=no-async-endpoint-handlers \
		--promise-plugin \
		--import-plugin
	@echo ""
	@prettier --check . "!pnpm-lock.yaml"

t :=
test: $(test_compiled)
	@echo ""
	@echo "filter test with 'make test t=xxx'"
	@NODE_OPTIONS="--experimental-vm-modules --no-warnings" jest --rootDir=./test --verbose=true -t=$(t)

bench: $(bench_compiled)
	$(foreach js,$(patsubst src/%.ts,bench/%.js,$^),echo "node --expose-gc --allow-natives-syntax $(js)";)

# clean:

outdated:
	pnpm outdated

upgrade:
	pnpm update --latest # --interactive

deploy: on_ci
	cd ./src/backup && pnpx wrangler deploy
	cd ./src/bot-share && pnpx wrangler deploy
	cd ./src/current-ip && pnpx wrangler deploy
	cd ./src/proxy-list && pnpx wrangler deploy
	cd ./src/r2-share && pnpx wrangler deploy
	cd ./src/poetry && pnpx wrangler deploy
	cd ./src/errlog && pnpx wrangler deploy
	cd ./src/openai && pnpx wrangler deploy

###

.PHONY: check force $(targets) $(test_compiled) $(bench_compiled) update_compatibility_date on_ci

on_ci:
ifndef CI
	$(error This command can only be executed within a CI environment)
endif

force: check build

$(targets): node_modules/tsconfig.tsbuildinfo
	@echo -e "Building $(GREEN)$@/index.ts$(RESET) => $(BGREEN)$@/index.js$(RESET)"
	@esbuild \
		--log-level=warning \
		--bundle \
		--format=esm \
		--target=esnext \
		--platform=browser \
		--external:'node:*' \
		--outfile=$@/index.js \
		$@/index.ts

node_modules/tsconfig.tsbuildinfo:
	@make --no-print-directory check

check:
	@echo "Checking"
	@tsgo --noEmit
	@touch -cm node_modules/tsconfig.tsbuildinfo # force update mtime

node_modules:
	pnpm install

$(test_compiled):
	@echo -e "Building $(GREEN)$@$(RESET) => $(BGREEN)$(patsubst src/%.ts,test/%.js,$@)$(RESET)"
	@esbuild \
		--log-level=warning \
		--bundle \
		--format=esm \
		--target=esnext \
		--platform=browser \
		--external:'node:*' \
		--external:'@jest/globals' \
		--outfile=$(patsubst src/%.ts,test/%.js,$@) \
		$@

$(bench_compiled):
	@echo -e "Building $(GREEN)$@$(RESET) => $(BGREEN)$(patsubst src/%.ts,bench/%.js,$@)$(RESET)"
	@esbuild \
		--log-level=warning \
		--bundle \
		--format=esm \
		--target=esnext \
		--platform=browser \
		--external:'node:*' \
		--external:'mitata' \
		--outfile=$(patsubst src/%.ts,bench/%.js,$@) \
		$@

# https://developers.cloudflare.com/workers/platform/compatibility-dates/#change-history
update_compatibility_date:
	@for t in $(targets); do \
		gsed -i \
		"s/\"compatibility_date\":.*/\"compatibility_date\": \"$(shell date '+%Y-%m-%d')\",/" \
		"$$t/wrangler.json"; \
		done

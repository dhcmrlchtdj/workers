SHELL := bash
.SHELLFLAGS = -O globstar -c
PATH := ./node_modules/.bin:$(PATH)

targets := $(filter-out src/_%, $(wildcard src/*))

all: $(targets)

check:
	tsc --noEmit
	@touch node_modules/tsconfig.tsbuildinfo # force update for make

force:
	@$(MAKE) --no-print-directory check
	@$(MAKE) --no-print-directory all

fmt:
	prettier --write .

$(targets): node_modules/tsconfig.tsbuildinfo
	esbuild --bundle --format=esm --target=es2020 --platform=browser --outfile=$@/index.js $@/index.ts

node_modules:
	pnpm install

node_modules/tsconfig.tsbuildinfo: node_modules $(shell ls src/**/*.ts)
	@$(MAKE) --no-print-directory check

.PHONY: all check force fmt $(targets)

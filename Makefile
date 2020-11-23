SHELL := bash
PATH := ./node_modules/.bin:$(PATH)

ignore := _% %.json %.yaml Makefile node_modules
targets := $(filter-out $(ignore), $(wildcard *))

all: $(targets)

fmt:
	prettier --write .

$(targets): node_modules/tsconfig.tsbuildinfo
	esbuild --bundle --format=esm --target=es2018 --platform=browser --outfile=$@/index.js $@/index.ts

node_modules/tsconfig.tsbuildinfo: $(wildcard **/*.ts)
	tsc --noEmit

.PHONY: all fmt $(targets)

SHELL := bash
PATH := ./node_modules/.bin:$(PATH)

ignore := _% %.json %.yaml Makefile node_modules
targets := $(filter-out $(ignore), $(wildcard *))

all: $(targets)

fmt:
	prettier --write .

$(targets):
	@tsc
	@rollup --format=es --no-esModule \
		--plugin=node-resolve \
		--input=_build/$@/index.js \
		--file=$@/index.js

.PHONY: all fmt $(targets)

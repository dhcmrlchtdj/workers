SHELL := bash
PATH := ./node_modules/.bin:$(PATH)

ignore := _% %.json %.yaml Makefile node_modules
targets := $(filter-out $(ignore), $(wildcard *))

all: $(targets)

fmt:
	prettier --write .

$(targets):
	@rollup --format=es --no-esModule \
		--input=$@/index.ts \
		--file=$@/index.js \
		--plugin=typescript

.PHONY: all fmt $(targets)

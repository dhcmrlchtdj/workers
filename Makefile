SHELL := bash
PATH := ./node_modules/.bin:$(PATH)

all:
	@$(MAKE) --no-print-directory build PROJ='badip bcc rollbar'

build:
	@for p in $(PROJ); do \
		rollup --format=es --input=$${p}/index.ts --file=$${p}/index.js --plugin=typescript --no-esModule; \
		done

.PHONY: build

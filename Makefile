SHELL := bash
PATH := ./node_modules/.bin:$(PATH)

all:
	$(MAKE) --no-print-directory build PROJ=badip
	$(MAKE) --no-print-directory build PROJ=bcc
	$(MAKE) --no-print-directory build PROJ=mzbot
	$(MAKE) --no-print-directory build PROJ=sentry

build:
	@rollup --format=es --input=$(PROJ)/index.ts --file=$(PROJ)/index.js --plugin=typescript --no-esModule
	@echo ""

.PHONY: all build

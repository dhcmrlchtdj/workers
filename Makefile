SHELL := bash
PATH := ./node_modules/.bin:$(PATH)

all:
	$(MAKE) --no-print-directory build PROJ=backup
	$(MAKE) --no-print-directory build PROJ=backup-heroku-pg
	$(MAKE) --no-print-directory build PROJ=backup-papertrail
	$(MAKE) --no-print-directory build PROJ=bcc
	$(MAKE) --no-print-directory build PROJ=feedbox
	$(MAKE) --no-print-directory build PROJ=rollbar

build:
	@rollup --format=es --input=$(PROJ)/index.ts --file=$(PROJ)/index.js --plugin=typescript --no-esModule
	@echo ""

fmt:
	prettier --write .

.PHONY: all build fmt

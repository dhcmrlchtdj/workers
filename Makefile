SHELL := bash
PATH := ./node_modules/.bin:$(PATH)

build:
	for i in */index.ts; do \
		rollup --input=$$i --file=$${i%ts}js --format=es --plugin=typescript ; \
		done

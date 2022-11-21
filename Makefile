build:
	node build.js
	mkdir -p dist
	./node_modules/.bin/tsc -p tsconfig.lib.json

watch: build
	WATCH=true node build.js

.PHONY: build watch
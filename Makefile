build:
	node build.js

watch: build
	WATCH=true node build.js

.PHONY: build watch
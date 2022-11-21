const { build, formatMessagesSync, serve } = require("esbuild")
const { writeFileSync } = require("fs")
const { resolve } = require("path")
const { typecheckPlugin } = require("@jgoz/esbuild-plugin-typecheck")

const WATCH = !!process.env.WATCH
const PRODUCTION = !!process.env.CI

const messages = []

const define = {
  global: "globalThis",
  "process.env.NODE_ENV": JSON.stringify(PRODUCTION ? "production" : "development"),
}

async function buildWorker(entry, out) {
  console.log("> buildWorker", entry)
  const res = await build({
    entryPoints: [entry],
    absWorkingDir: resolve("opusWorklet"),
    tsconfig: resolve("opusWorklet/tsconfig.json"),
    bundle: true,
    sourcemap: PRODUCTION ? undefined : "inline",
    minify: PRODUCTION,
    outfile: out,
    treeShaking: true,
    plugins: [typecheckPlugin()],
    write: false,
    define,
  })

  for (let out of res.outputFiles) {
    if (out.path.endsWith(".json")) {
      writeFileSync(out.path, JSON.stringify(out.text))
    } else {
      writeFileSync(out.path, out.text)
    }
  }
  for (let warning of res.warnings) {
    messages.push(warning)
  }

  for (let error of res.errors) {
    messages.push(error)
    process.exitCode = 1
  }
}

async function buildWebapp() {
  console.log("> buildWebapp")

  const opt = {
    entryPoints: ["src/index.tsx"],
    bundle: true,
    sourcemap: "both",
    minify: false,
    write: true,
    tsconfig: resolve("tsconfig.json"),
    outfile: "./public/assets/app.js",
    treeShaking: true,
    format: "esm",
    loader: {
      ".js": "jsx",
      ".ts": "tsx",
    },
    plugins: [typecheckPlugin()],
    define,
  }

  const res = await build(opt)

  for (let warning of res.warnings) {
    messages.push(warning)
  }

  for (let error of res.errors) {
    messages.push(error)
    process.exitCode = 1
  }

  if (WATCH) {
    const server = await serve({ servedir: resolve("public") }, opt)
    console.log(`http://${server.host}:${server.port}`)
  }
}

async function main() {
  await buildWorker("worker.ts", resolve("src/lib/voice/worker.json"))
  await buildWorker("audioWorkletProcessors.ts", resolve("src/lib/voice/audioWorkletProcessors.json"))

  await buildWebapp()

  if (messages.length) {
    for (const m of formatMessagesSync(messages, { terminalWidth: 120 })) {
      console.log(m)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

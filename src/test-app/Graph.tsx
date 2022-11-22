import { Graphviz } from "@hpcc-js/wasm"
import events from "events"
import { useState, useEffect, useRef, ReactNode } from "react"
import { audioGraphEvents, BaseNode, currentGraphState, Graph } from "../debug-helpers/audioDebugger"

const graphVizPromise = Graphviz.load()

export async function renderDotSVG(text: string) {
  return (await graphVizPromise).dot(text, "svg")
}

export function Dot(props: { code: string }) {
  const [html, setHtml] = useState("Loading...")
  const [error, setError] = useState<string>()

  useEffect(() => {
    renderDotSVG(props.code)
      .then(($) => {
        setError("")
        setHtml($)
      })
      .catch((e) => {
        setError(e.message)
      })
  }, [props.code])

  return (
    <>
      {error && <pre>{error}</pre>}
      <div style={{ display: "flex" }}>
        <DownloadSvg dangerouslySetInnerHTML={{ __html: html }} />
        {/* <PositionalCanvas /> */}
      </div>
    </>
  )
}

const canvasSize = 512
const canvasHalfSize = 0

function drawCanvas(ctx: CanvasRenderingContext2D, graph: Graph) {
  ctx.clearRect(0, 0, canvasSize, canvasSize)
  for (const node of Object.values(graph.nodes) as Iterable<AudioNode & BaseNode>) {
    if (node instanceof PannerNode) {
      ctx.beginPath()
      ctx.arc(canvasHalfSize + node.positionX.value, canvasHalfSize + node.positionZ.value, 4, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.font = "16px Arial"
      ctx.fillText((node as any).cyId || 'panner', canvasHalfSize + node.positionX.value + 8, canvasHalfSize + node.positionZ.value)
    } else if (node instanceof AudioListener) {
      // eslint-disable-next-line
      ctx.beginPath()
      ctx.arc(canvasHalfSize + node.positionX.value, canvasHalfSize + node.positionZ.value, 4, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
      ctx.font = "16px Arial"
      ctx.fillText(node.nodeName, canvasHalfSize + node.positionX.value + 8, canvasHalfSize + node.positionZ.value)
    }
  }
}

export function PositionalCanvas() {
  const canvas = useRef<HTMLCanvasElement | null>(null)

  const [graph, setGraph] = useState<Graph>(currentGraphState)

  useEffect(() => {
    audioGraphEvents.on("graphChanged", setGraph)
  }, [])

  useEffect(() => {
    if (canvas.current) {
      const context = canvas.current.getContext("2d")
      drawCanvas(context!, graph)
    }
  }, [graph])

  return <canvas style={{ border: "1px solid" }} ref={canvas} height={512} width={512} />
}

export function DownloadSvg(props: { children: ReactNode[] | ReactNode } | { dangerouslySetInnerHTML: any }) {
  const theRef = useRef<HTMLDivElement | null>(null)

  return (
    <>
      {"dangerouslySetInnerHTML" in props ? (
        <div ref={theRef} dangerouslySetInnerHTML={props.dangerouslySetInnerHTML} />
      ) : (
        <div ref={theRef}>{props.children}</div>
      )}
    </>
  )
}

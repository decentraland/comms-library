import { commsPerfObservable } from "../lib/performance"
import { TimelineDataSeries, TimelineGraphView } from "./lines"

let div: any = null
export function debugCommsGraph() {
  if (div) {
    div.remove()
    return
  }
  div = document.createElement("div")
  const canvas = document.createElement("canvas")

  div.style.position = "relative"

  canvas.style.position = "relative"
  canvas.style.width = "auto"
  canvas.style.height = "auto"

  document.getElementById("messages")!.append(div)
  div.append(canvas)

  const timeseries = new TimelineGraphView(div, canvas)

  const colors: Partial<Record<string, string>> = {
    position: "blue",
    message: "grey",
    voiceMessage: "green",
    profileMessage: "purple",
    profileResponse: "red",
    profileRequest: "magenta",
    sceneMessageBus: "cyan",
  }

  timeseries.repaint()
  const series = new Map<string, TimelineDataSeries>()
  function getTimeSeries(name: string) {
    if (!series.get(name)) {
      const serie = new TimelineDataSeries(name)
      series.set(name, serie)
      timeseries.addDataSeries(serie)
      const orig = serie.addPoint
      const legend = document.createElement("div")
      serie.setColor((colors[name] as any) || "black")
      legend.style.color = (colors[name] as any) || "black"
      legend.innerText = name
      serie.addPoint = function (time, value) {
        legend.innerText = name + ": " + value + "/sec"
        return orig.call(this, time, value)
      }
      div.append(legend)
    }
    return series.get(name)!
  }

  commsPerfObservable.on("*", (event, { value }) => {
    if (!isNaN(value)) getTimeSeries(event as any).stash += value
    else getTimeSeries(event as any).stash++
  })

  setInterval(() => {
    const msgs: string[] = []

    for (const [name, serie] of series) {
      serie.addPoint(new Date(), serie.stash)
      if (serie.stash) {
        msgs.push(`${name}=${serie.stash}`)
      }
      serie.stash = 0
    }

    if (msgs.length) console.log("stats", msgs.join("\t"))

    timeseries.updateEndDate()

    timeseries.repaint()
  }, 1000)
}

;(globalThis as any).toogleCommsGraph = debugCommsGraph

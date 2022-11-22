import React from "react"
import ReactDOM from "react-dom/client"
import "./test-app/index.css"
import App from "./test-app/App"
import { startSagas, store } from "./test-app/store"
import { Provider } from "react-redux"
import { debugCommsGraph } from "./debug-helpers/commsGraph"
import { initP2pGraph } from "./debug-helpers/p2p"

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)

startSagas()

root.render(
  <Provider store={store}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </Provider>
)

debugCommsGraph()

initP2pGraph()
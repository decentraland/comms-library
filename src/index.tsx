import React from "react"
import ReactDOM from "react-dom/client"
import "./test-app/index.css"
import App from "./test-app/App"
import { startSagas, store } from "./test-app/store"
import { Provider } from "react-redux"

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)

startSagas()

root.render(
  <Provider store={store}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </Provider>
)

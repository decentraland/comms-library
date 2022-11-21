import { AnyAction, applyMiddleware, compose, createStore, Middleware, StoreEnhancer } from "redux"
import createSagaMiddleware from "@redux-saga/core"
import { reducers } from "./reducer"
import { rootSaga } from "./sagas"
import { composeWithDevTools } from "redux-devtools-extension"
import { createLogger } from "redux-logger"

export const buildStore = (..._enhancers: StoreEnhancer<any>[]) => {
  const sagaMiddleware = createSagaMiddleware({
    sagaMonitor: undefined,
    onError: (error: Error, { sagaStack }: { sagaStack: string }) => {
      console.error("SAGA-ERROR: ", error)
      debugger
    },
  })

  const middlewares: Middleware[] = [sagaMiddleware]

  middlewares.push((_store) => (next) => (action: AnyAction) => {
    // logTrace(action.type, action.payload, 'KK')
    return next(action)
  })

  const composeEnhancers =
    (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ||
    composeWithDevTools({ trace: true, traceLimit: 25 }) ||
    compose

  const enhancers: StoreEnhancer<any>[] = [applyMiddleware(...middlewares)]

  enhancers.unshift(
    applyMiddleware(
      createLogger({
        collapsed: () => true,
        predicate: (_, _action) => true
      })
    )
  )

  enhancers.push(..._enhancers)

  const store = createStore(reducers, composeEnhancers(...enhancers))
  const startSagas = () => sagaMiddleware.run(rootSaga)

  return { store, startSagas }
}

export const { store, startSagas } = buildStore()

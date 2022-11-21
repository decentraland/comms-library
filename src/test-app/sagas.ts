import { fork } from "redux-saga/effects";
import { commsSaga } from "../lib/sagas";

export function * rootSaga() {
  yield fork(commsSaga)
}
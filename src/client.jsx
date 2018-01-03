/* eslint react/display-name:0 */
import "babel-polyfill";

import React from "react";
import {render} from "react-dom";
import {Provider} from "react-redux";
import {applyRouterMiddleware, browserHistory, Route, Router, RouterContext} from "react-router";
import {syncHistoryWithStore} from "react-router-redux";
import {animateScroll} from "react-scroll";
import createRoutes from "routes";
import configureStore from "./storeConfig";
import {LOADING_END, LOADING_START} from "./consts";
import preRenderMiddleware from "./middlewares/preRenderMiddleware";

const store = configureStore(window.__INITIAL_STATE__, browserHistory);
const history = syncHistoryWithStore(browserHistory, store);
const routes = createRoutes(store);

import {I18nextProvider} from "react-i18next";
import i18n from "i18next";
import yn from "yn";

import defaultTranslations from "./locale";
import Canon from "./Canon";

const {locale, resources} = window.__INITIAL_STATE__.i18n;
const {CANON_LOGLOCALE, NODE_ENV} = window.__INITIAL_STATE__.env;

i18n
  .init({
    fallbackLng: "canon",
    lng: locale,
    debug: NODE_ENV !== "production" ? yn(CANON_LOGLOCALE) : false,
    ns: [window.__APP_NAME__],
    defaultNS: window.__APP_NAME__,
    interpolation: {
      escapeValue: false // not needed for react!!
    },
    react: {
      wait: true
    }
  });

i18n.addResourceBundle("canon", window.__APP_NAME__, defaultTranslations, true, true);
i18n.addResourceBundle(locale, window.__APP_NAME__, resources, true, true);

function scrollToHash(hash) {
  const elem = hash && hash.indexOf("#") === 0 ? document.getElementById(hash.slice(1)) : false;
  if (elem) {
    const offset = elem.getBoundingClientRect().top;
    if (offset) animateScroll.scrollMore(offset);
  }
}

function renderMiddleware() {

  return {
    renderRouterContext: (child, props) => {

      if (window.__SSR__) {
        window.__SSR__ = false;
        scrollToHash(props.location.hash);
      }
      else if (!props.location.key && props.location.hash) {
        scrollToHash(props.location.hash);
      }
      else {
        store.dispatch({type: LOADING_START});
        document.body.scrollTop = document.documentElement.scrollTop = 0;
        preRenderMiddleware(store, props)
          .then(() => {
            store.dispatch({type: LOADING_END});
            scrollToHash(props.location.hash);
          });
      }

      return <RouterContext {...props}/>;

    }

  };

}

render(
  <I18nextProvider i18n={i18n}>
    <Provider store={store}>
      <Canon locale={window.__INITIAL_STATE__.i18n.locale} config={window.__HELMET_DEFAULT__}>
        <Router history={history} render={applyRouterMiddleware(renderMiddleware())}>
          {routes}
        </Router>
      </Canon>
    </Provider>
  </I18nextProvider>, document.getElementById("app"));

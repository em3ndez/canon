const bodyParser = require("body-parser"),
      cookieParser = require("cookie-parser"),
      cookieSession = require("cookie-session"),
      express = require("express"),
      gzip = require("compression"),
      helmet = require("helmet"),
      path = require("path"),
      shell = require("shelljs"),
      {Server} = require("socket.io"),
      yn = require("yn");

let everDetect = false;

/**
 * @name api
 * @desc detects express api routes in a module's "api/" directory
 * @param {Object} app
 */
module.exports = function(config) {

  const {modules, name, opbeat, paths, store} = config;
  const {appPath, canonPath, rootPath, serverPath, staticPath} = paths;
  const {CANON_LANGUAGE_DEFAULT, CANON_LANGUAGES, CANON_LOGINS, CANON_PORT, NODE_ENV} = store.env;
  const files = [];

  const moduleName = require(path.join(serverPath, "helpers/moduleName")),
        readFiles = require(path.join(serverPath, "helpers/readFiles")),
        resolve = require(path.join(serverPath, "helpers/resolve")),
        title = require(path.join(serverPath, "helpers/title"));

  const userConfig = resolve(rootPath, "canon.js");
  if (userConfig) files.push(path.join(rootPath, "canon.js"));
  const canonConfig = userConfig || {};

  const userHelmet = resolve(appPath, "helmet.js");
  if (userHelmet) files.push(path.join(appPath, "helmet.js"));
  const headerConfig = userHelmet || {};

  title(`${everDetect ? "Restarting" : "Starting"} Express Server`, "🌐");
  shell.echo(`Environment: ${NODE_ENV}`);
  shell.echo(`Port: ${CANON_PORT}`);

  const router = express();

  if (NODE_ENV === "production") {
    router.use(gzip());
    const FRAMEGUARD = yn(process.env.CANON_HELMET_FRAMEGUARD);
    router.use(helmet({frameguard: FRAMEGUARD === null ? false : FRAMEGUARD}));
  }

  router.set("trust proxy", "loopback");
  router.use(cookieParser());

  const {json, urlencoded} = (canonConfig.express || {}).bodyParser || {};
  const jsonConfig = Object.assign({limit: "50mb"}, json);
  router.use(bodyParser.json(jsonConfig));
  const urlConfig = Object.assign({extended: true, limit: "50mb"}, urlencoded);
  router.use(bodyParser.urlencoded(urlConfig));

  router.use(express.static(staticPath));

  /* Brings over app-level settings for user-defined routes */
  router.set("db", config.db);
  router.set("cache", config.cache);

  const i18n = require("i18next");
  const Backend = require("i18next-node-fs-backend");
  const i18nMiddleware = require("i18next-express-middleware");

  const lngDetector = new i18nMiddleware.LanguageDetector();
  readFiles(path.join(canonPath, "src/i18n/detection/"))
    .forEach(file => {
      lngDetector.addDetector(require(file));
    });

  let namespace = name.split("/");
  namespace = namespace[namespace.length - 1];

  const i18nConfig = {
    fallbackLng: CANON_LANGUAGE_DEFAULT,
    lng: CANON_LANGUAGE_DEFAULT,
    preload: CANON_LANGUAGES ? CANON_LANGUAGES.split(",") : CANON_LANGUAGE_DEFAULT,
    whitelist: CANON_LANGUAGES ? CANON_LANGUAGES.split(",") : CANON_LANGUAGE_DEFAULT,
    ns: [namespace],
    defaultNS: namespace,
    debug: process.env.NODE_ENV !== "production" ? yn(process.env.CANON_LOGLOCALE) : false,
    react: {
      wait: true,
      withRef: true
    },
    detection: {
      order: ["domain", "query", "path"]
    }
  };

  if (CANON_LANGUAGE_DEFAULT === "canon") {
    const fallbackResources = resolve(canonPath, "src/i18n/canon.js");
    i18nConfig.resources = {canon: {[namespace]: fallbackResources}};
  }
  else {
    i18n.use(Backend);
    i18nConfig.backend = {
      loadPath: path.join(rootPath, "locales/{{lng}}/{{ns}}.json"),
      jsonIndent: 2
    };
  }

  i18n.use(lngDetector).init(i18nConfig);
  router.use(i18nMiddleware.handle(i18n));

  if (CANON_LOGINS) {

    const secret = process.env.CANON_SESSION_SECRET || name;
    const maxAge = process.env.CANON_SESSION_TIMEOUT || 60 * 60 * 1000; // one hour
    router.use(cookieSession({maxAge, name, secret}));

    const passport = require("passport");
    router.use(passport.initialize());
    router.use(passport.session());

    router.set("passport", passport);
    router.set("social", []);
    require(path.join(canonPath, "src/auth/auth"))(router);
    store.social = router.settings.social;
    store.mailgun = router.settings.mailgun || false;
    store.legal = {
      privacy: process.env.CANON_LEGAL_PRIVACY || false,
      terms: process.env.CANON_LEGAL_TERMS || false
    };

    shell.echo("User Authentication: ON");

  }

  if (NODE_ENV === "production" && opbeat) {
    router.use(opbeat.middleware.express());
    shell.echo("Opbeat Initialized");
  }

  let detectApi = false;
  for (let i = 0; i < modules.length; i++) {
    const folder = modules[i];
    const apiFolder = path.join(folder, "api/");
    if (shell.test("-d", apiFolder)) {
      if (!detectApi) {
        title(`${everDetect ? "Re-r" : "R"}egistering API Routes`, "📡");
        everDetect = true;
        detectApi = true;
      }
      files.push(apiFolder);
      readFiles(apiFolder).forEach(file => {
        const module = moduleName(file) || moduleName(name) || name;
        const parts = file.replace(/\\/g, "/").split("/");
        const apiName = parts[parts.length - 1].replace(".js", "");
        shell.echo(`${module}: ${apiName}`);
        return require(file)(router);
      });
    }
  }

  if (NODE_ENV === "development") {

    if (!config.webpackDevMiddleware || config.change && config.change.includes("style.yml")) {

      title("Bundling Client Webpack", "🔷");
      const webpack = require("webpack");
      const configPath = path.join(canonPath, "webpack/dev-client.js");
      delete require.cache[configPath];
      const webpackDevConfig = require(configPath);
      const compiler = webpack(webpackDevConfig);

      config.webpackDevMiddleware = require("webpack-dev-middleware")(compiler, {
        logLevel: "silent",
        publicPath: webpackDevConfig.output.publicPath
      });
      config.webpackHotMiddleware = require("webpack-hot-middleware")(compiler);

    }

    router.use(config.webpackDevMiddleware);
    router.use(config.webpackHotMiddleware);

  }

  // user overrides of router keys
  if (canonConfig.express && canonConfig.express.set) {
    Object.keys(canonConfig.express.set).forEach(k => {
      router.set(k, canonConfig.express.set[k]);
    });
  }

  const reduxMiddleware = canonConfig.reduxMiddleware || false;
  const App = require(path.join(staticPath, "assets/server"));
  router.get("*", App.default(store, headerConfig, reduxMiddleware));

  const server = router.listen(CANON_PORT);

  // pass the Express HTTP server to socket.io to enable sockets
  const io = new Server(server);
  router.set("io", io);

  // create an Object in memory to manage active socket connections
  const sockets = {};
  router.set("sockets", sockets);

  // init and diconnect actions for socket connections
  io.on("connection", socket => {

    // client-emitted "init" event used to store a shared sessionId
    // between the client and browser
    socket.on("init", sessionId => {
      sockets[sessionId] = socket.id;
      socket.emit("init", sessionId);
      if (NODE_ENV === "development") shell.echo(`[Socket] Connected (${socket.id})`);
    });

    // when client diconnects, remove their session from the socket lookup in memory
    socket.on("disconnect", reason => {
      const sessionID = Object.keys(sockets).find(d => sockets[d] === socket.id);
      delete sockets[sessionID];
      if (NODE_ENV === "development") shell.echo(`[Socket] Disconnected (${socket.id}): ${reason}`);
    });

  });

  if (NODE_ENV === "development") {

    const connections = {};

    server.on("connection", conn => {
      const key = `${conn.remoteAddress}:${conn.remotePort}`;
      connections[key] = conn;
      conn.on("close", () => {
        delete connections[key];
      });
    });

    server.destroy = cb => {
      server.close(cb);
      for (const key in connections) {
        if (Object.prototype.hasOwnProperty.call(connections, key)) {
          connections[key].destroy();
        }
      }
    };

  }

  return {files, router, server};

};

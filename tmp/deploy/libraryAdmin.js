var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
import { createRequire as __deno_internal_createRequire } from "node:module";
var __require = __deno_internal_createRequire(import.meta.url);

var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  1 ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/fetch/cookies.js
var require_cookies = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/fetch/cookies.js"(exports, module) {
    "use strict";
    var urllib = __require("node:url");
    var SESSION_TIMEOUT = 1800;
    var Cookies = class {
      constructor(options) {
        this.options = options || {};
        this.cookies = [];
      }
      /**
         * Stores a cookie string to the cookie storage
         *
         * @param {String} cookieStr Value from the 'Set-Cookie:' header
         * @param {String} url Current URL
         */
      set(cookieStr, url) {
        let urlparts = urllib.parse(url || "");
        let cookie = this.parse(cookieStr);
        let domain;
        if (cookie.domain) {
          domain = cookie.domain.replace(/^\./, "");
          if (
            // can't be valid if the requested domain is shorter than current hostname
            urlparts.hostname.length < domain.length || // prefix domains with dot to be sure that partial matches are not used
            ("." + urlparts.hostname).substr(-domain.length + 1) !== "." + domain
          ) {
            cookie.domain = urlparts.hostname;
          }
        } else {
          cookie.domain = urlparts.hostname;
        }
        if (!cookie.path) {
          cookie.path = this.getPath(urlparts.pathname);
        }
        if (!cookie.expires) {
          cookie.expires = new Date(Date.now() + (Number(this.options.sessionTimeout || SESSION_TIMEOUT) || SESSION_TIMEOUT) * 1e3);
        }
        return this.add(cookie);
      }
      /**
         * Returns cookie string for the 'Cookie:' header.
         *
         * @param {String} url URL to check for
         * @returns {String} Cookie header or empty string if no matches were found
         */
      get(url) {
        return this.list(url).map((cookie) => cookie.name + "=" + cookie.value).join("; ");
      }
      /**
         * Lists all valied cookie objects for the specified URL
         *
         * @param {String} url URL to check for
         * @returns {Array} An array of cookie objects
         */
      list(url) {
        let result = [];
        let i;
        let cookie;
        for (i = this.cookies.length - 1; i >= 0; i--) {
          cookie = this.cookies[i];
          if (this.isExpired(cookie)) {
            this.cookies.splice(i, i);
            continue;
          }
          if (this.match(cookie, url)) {
            result.unshift(cookie);
          }
        }
        return result;
      }
      /**
         * Parses cookie string from the 'Set-Cookie:' header
         *
         * @param {String} cookieStr String from the 'Set-Cookie:' header
         * @returns {Object} Cookie object
         */
      parse(cookieStr) {
        let cookie = {};
        (cookieStr || "").toString().split(";").forEach((cookiePart) => {
          let valueParts = cookiePart.split("=");
          let key = valueParts.shift().trim().toLowerCase();
          let value = valueParts.join("=").trim();
          let domain;
          if (!key) {
            return;
          }
          switch (key) {
            case "expires":
              value = new Date(value);
              if (value.toString() !== "Invalid Date") {
                cookie.expires = value;
              }
              break;
            case "path":
              cookie.path = value;
              break;
            case "domain":
              domain = value.toLowerCase();
              if (domain.length && domain.charAt(0) !== ".") {
                domain = "." + domain;
              }
              cookie.domain = domain;
              break;
            case "max-age":
              cookie.expires = new Date(Date.now() + (Number(value) || 0) * 1e3);
              break;
            case "secure":
              cookie.secure = true;
              break;
            case "httponly":
              cookie.httponly = true;
              break;
            default:
              if (!cookie.name) {
                cookie.name = key;
                cookie.value = value;
              }
          }
        });
        return cookie;
      }
      /**
         * Checks if a cookie object is valid for a specified URL
         *
         * @param {Object} cookie Cookie object
         * @param {String} url URL to check for
         * @returns {Boolean} true if cookie is valid for specifiec URL
         */
      match(cookie, url) {
        let urlparts = urllib.parse(url || "");
        if (urlparts.hostname !== cookie.domain && (cookie.domain.charAt(0) !== "." || ("." + urlparts.hostname).substr(-cookie.domain.length) !== cookie.domain)) {
          return false;
        }
        let path = this.getPath(urlparts.pathname);
        if (path.substr(0, cookie.path.length) !== cookie.path) {
          return false;
        }
        if (cookie.secure && urlparts.protocol !== "https:") {
          return false;
        }
        return true;
      }
      /**
         * Adds (or updates/removes if needed) a cookie object to the cookie storage
         *
         * @param {Object} cookie Cookie value to be stored
         */
      add(cookie) {
        let i;
        let len;
        if (!cookie || !cookie.name) {
          return false;
        }
        for (i = 0, len = this.cookies.length; i < len; i++) {
          if (this.compare(this.cookies[i], cookie)) {
            if (this.isExpired(cookie)) {
              this.cookies.splice(i, 1);
              return false;
            }
            this.cookies[i] = cookie;
            return true;
          }
        }
        if (!this.isExpired(cookie)) {
          this.cookies.push(cookie);
        }
        return true;
      }
      /**
         * Checks if two cookie objects are the same
         *
         * @param {Object} a Cookie to check against
         * @param {Object} b Cookie to check against
         * @returns {Boolean} True, if the cookies are the same
         */
      compare(a, b) {
        return a.name === b.name && a.path === b.path && a.domain === b.domain && a.secure === b.secure && a.httponly === a.httponly;
      }
      /**
         * Checks if a cookie is expired
         *
         * @param {Object} cookie Cookie object to check against
         * @returns {Boolean} True, if the cookie is expired
         */
      isExpired(cookie) {
        return cookie.expires && cookie.expires < /* @__PURE__ */ new Date() || !cookie.value;
      }
      /**
         * Returns normalized cookie path for an URL path argument
         *
         * @param {String} pathname
         * @returns {String} Normalized path
         */
      getPath(pathname) {
        let path = (pathname || "/").split("/");
        path.pop();
        path = path.join("/").trim();
        if (path.charAt(0) !== "/") {
          path = "/" + path;
        }
        if (path.substr(-1) !== "/") {
          path += "/";
        }
        return path;
      }
    };
    module.exports = Cookies;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/package.json
var require_package = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/package.json"(exports, module) {
    module.exports = {
      name: "nodemailer",
      version: "6.9.13",
      description: "Easy as cake e-mail sending from your Node.js applications",
      main: "lib/nodemailer.js",
      scripts: {
        test: "node --test --test-concurrency=1 test/**/*.test.js test/**/*-test.js",
        "test:coverage": "c8 node --test --test-concurrency=1 test/**/*.test.js test/**/*-test.js",
        lint: "eslint .",
        update: "rm -rf node_modules/ package-lock.json && ncu -u && npm install"
      },
      repository: {
        type: "git",
        url: "https://github.com/nodemailer/nodemailer.git"
      },
      keywords: [
        "Nodemailer"
      ],
      author: "Andris Reinman",
      license: "MIT-0",
      bugs: {
        url: "https://github.com/nodemailer/nodemailer/issues"
      },
      homepage: "https://nodemailer.com/",
      devDependencies: {
        "@aws-sdk/client-ses": "3.529.1",
        bunyan: "1.8.15",
        c8: "9.1.0",
        eslint: "8.57.0",
        "eslint-config-nodemailer": "1.2.0",
        "eslint-config-prettier": "9.1.0",
        libbase64: "1.3.0",
        libmime: "5.3.4",
        libqp: "2.1.0",
        "nodemailer-ntlm-auth": "1.0.4",
        proxy: "1.0.2",
        "proxy-test-server": "1.0.0",
        "smtp-server": "3.13.3"
      },
      engines: {
        node: ">=6.0.0"
      }
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/fetch/index.js
var require_fetch = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/fetch/index.js"(exports, module) {
    "use strict";
    var http = __require("node:http");
    var https = __require("node:https");
    var urllib = __require("node:url");
    var zlib = __require("node:zlib");
    var PassThrough = __require("node:stream").PassThrough;
    var Cookies = require_cookies();
    var packageData = require_package();
    var net = __require("node:net");
    var MAX_REDIRECTS = 5;
    module.exports = function(url, options) {
      return nmfetch(url, options);
    };
    module.exports.Cookies = Cookies;
    function nmfetch(url, options) {
      options = options || {};
      options.fetchRes = options.fetchRes || new PassThrough();
      options.cookies = options.cookies || new Cookies();
      options.redirects = options.redirects || 0;
      options.maxRedirects = isNaN(options.maxRedirects) ? MAX_REDIRECTS : options.maxRedirects;
      if (options.cookie) {
        [].concat(options.cookie || []).forEach((cookie) => {
          options.cookies.set(cookie, url);
        });
        options.cookie = false;
      }
      let fetchRes = options.fetchRes;
      let parsed = urllib.parse(url);
      let method = (options.method || "").toString().trim().toUpperCase() || "GET";
      let finished = false;
      let cookies;
      let body;
      let handler2 = parsed.protocol === "https:" ? https : http;
      let headers = {
        "accept-encoding": "gzip,deflate",
        "user-agent": "nodemailer/" + packageData.version
      };
      Object.keys(options.headers || {}).forEach((key) => {
        headers[key.toLowerCase().trim()] = options.headers[key];
      });
      if (options.userAgent) {
        headers["user-agent"] = options.userAgent;
      }
      if (parsed.auth) {
        headers.Authorization = "Basic " + Buffer.from(parsed.auth).toString("base64");
      }
      if (cookies = options.cookies.get(url)) {
        headers.cookie = cookies;
      }
      if (options.body) {
        if (options.contentType !== false) {
          headers["Content-Type"] = options.contentType || "application/x-www-form-urlencoded";
        }
        if (typeof options.body.pipe === "function") {
          headers["Transfer-Encoding"] = "chunked";
          body = options.body;
          body.on("error", (err) => {
            if (finished) {
              return;
            }
            finished = true;
            err.type = "FETCH";
            err.sourceUrl = url;
            fetchRes.emit("error", err);
          });
        } else {
          if (options.body instanceof Buffer) {
            body = options.body;
          } else if (typeof options.body === "object") {
            try {
              body = Buffer.from(Object.keys(options.body).map((key) => {
                let value = options.body[key].toString().trim();
                return encodeURIComponent(key) + "=" + encodeURIComponent(value);
              }).join("&"));
            } catch (E) {
              if (finished) {
                return;
              }
              finished = true;
              E.type = "FETCH";
              E.sourceUrl = url;
              fetchRes.emit("error", E);
              return;
            }
          } else {
            body = Buffer.from(options.body.toString().trim());
          }
          headers["Content-Type"] = options.contentType || "application/x-www-form-urlencoded";
          headers["Content-Length"] = body.length;
        }
        method = (options.method || "").toString().trim().toUpperCase() || "POST";
      }
      let req;
      let reqOptions = {
        method,
        host: parsed.hostname,
        path: parsed.path,
        port: parsed.port ? parsed.port : parsed.protocol === "https:" ? 443 : 80,
        headers,
        rejectUnauthorized: false,
        agent: false
      };
      if (options.tls) {
        Object.keys(options.tls).forEach((key) => {
          reqOptions[key] = options.tls[key];
        });
      }
      if (parsed.protocol === "https:" && parsed.hostname && parsed.hostname !== reqOptions.host && !net.isIP(parsed.hostname) && !reqOptions.servername) {
        reqOptions.servername = parsed.hostname;
      }
      try {
        req = handler2.request(reqOptions);
      } catch (E) {
        finished = true;
        setImmediate(() => {
          E.type = "FETCH";
          E.sourceUrl = url;
          fetchRes.emit("error", E);
        });
        return fetchRes;
      }
      if (options.timeout) {
        req.setTimeout(options.timeout, () => {
          if (finished) {
            return;
          }
          finished = true;
          req.abort();
          let err = new Error("Request Timeout");
          err.type = "FETCH";
          err.sourceUrl = url;
          fetchRes.emit("error", err);
        });
      }
      req.on("error", (err) => {
        if (finished) {
          return;
        }
        finished = true;
        err.type = "FETCH";
        err.sourceUrl = url;
        fetchRes.emit("error", err);
      });
      req.on("response", (res) => {
        let inflate;
        if (finished) {
          return;
        }
        switch (res.headers["content-encoding"]) {
          case "gzip":
          case "deflate":
            inflate = zlib.createUnzip();
            break;
        }
        if (res.headers["set-cookie"]) {
          [].concat(res.headers["set-cookie"] || []).forEach((cookie) => {
            options.cookies.set(cookie, url);
          });
        }
        if ([
          301,
          302,
          303,
          307,
          308
        ].includes(res.statusCode) && res.headers.location) {
          options.redirects++;
          if (options.redirects > options.maxRedirects) {
            finished = true;
            let err = new Error("Maximum redirect count exceeded");
            err.type = "FETCH";
            err.sourceUrl = url;
            fetchRes.emit("error", err);
            req.abort();
            return;
          }
          options.method = "GET";
          options.body = false;
          return nmfetch(urllib.resolve(url, res.headers.location), options);
        }
        fetchRes.statusCode = res.statusCode;
        fetchRes.headers = res.headers;
        if (res.statusCode >= 300 && !options.allowErrorResponse) {
          finished = true;
          let err = new Error("Invalid status code " + res.statusCode);
          err.type = "FETCH";
          err.sourceUrl = url;
          fetchRes.emit("error", err);
          req.abort();
          return;
        }
        res.on("error", (err) => {
          if (finished) {
            return;
          }
          finished = true;
          err.type = "FETCH";
          err.sourceUrl = url;
          fetchRes.emit("error", err);
          req.abort();
        });
        if (inflate) {
          res.pipe(inflate).pipe(fetchRes);
          inflate.on("error", (err) => {
            if (finished) {
              return;
            }
            finished = true;
            err.type = "FETCH";
            err.sourceUrl = url;
            fetchRes.emit("error", err);
            req.abort();
          });
        } else {
          res.pipe(fetchRes);
        }
      });
      setImmediate(() => {
        if (body) {
          try {
            if (typeof body.pipe === "function") {
              return body.pipe(req);
            } else {
              req.write(body);
            }
          } catch (err) {
            finished = true;
            err.type = "FETCH";
            err.sourceUrl = url;
            fetchRes.emit("error", err);
            return;
          }
        }
        req.end();
      });
      return fetchRes;
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/shared/index.js
var require_shared = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/shared/index.js"(exports, module) {
    "use strict";
    var urllib = __require("node:url");
    var util = __require("node:util");
    var fs = __require("node:fs");
    var nmfetch = require_fetch();
    var dns = __require("node:dns");
    var net = __require("node:net");
    var os = __require("node:os");
    var DNS_TTL = 5 * 60 * 1e3;
    var networkInterfaces;
    try {
      networkInterfaces = os.networkInterfaces();
    } catch (err) {
    }
    module.exports.networkInterfaces = networkInterfaces;
    var isFamilySupported = (family, allowInternal) => {
      let networkInterfaces2 = module.exports.networkInterfaces;
      if (!networkInterfaces2) {
        return true;
      }
      const familySupported = (
        // crux that replaces Object.values(networkInterfaces) as Object.values is not supported in nodejs v6
        Object.keys(networkInterfaces2).map((key) => networkInterfaces2[key]).reduce((acc, val2) => acc.concat(val2), []).filter((i) => !i.internal || allowInternal).filter((i) => i.family === "IPv" + family || i.family === family).length > 0
      );
      return familySupported;
    };
    var resolver = (family, hostname, options, callback) => {
      options = options || {};
      const familySupported = isFamilySupported(family, options.allowInternalNetworkInterfaces);
      if (!familySupported) {
        return callback(null, []);
      }
      const resolver2 = dns.Resolver ? new dns.Resolver(options) : dns;
      resolver2["resolve" + family](hostname, (err, addresses) => {
        if (err) {
          switch (err.code) {
            case dns.NODATA:
            case dns.NOTFOUND:
            case dns.NOTIMP:
            case dns.SERVFAIL:
            case dns.CONNREFUSED:
            case dns.REFUSED:
            case "EAI_AGAIN":
              return callback(null, []);
          }
          return callback(err);
        }
        return callback(null, Array.isArray(addresses) ? addresses : [].concat(addresses || []));
      });
    };
    var dnsCache = module.exports.dnsCache = /* @__PURE__ */ new Map();
    var formatDNSValue = (value, extra) => {
      if (!value) {
        return Object.assign({}, extra || {});
      }
      return Object.assign({
        servername: value.servername,
        host: !value.addresses || !value.addresses.length ? null : value.addresses.length === 1 ? value.addresses[0] : value.addresses[Math.floor(Math.random() * value.addresses.length)]
      }, extra || {});
    };
    module.exports.resolveHostname = (options, callback) => {
      options = options || {};
      if (!options.host && options.servername) {
        options.host = options.servername;
      }
      if (!options.host || net.isIP(options.host)) {
        let value = {
          addresses: [
            options.host
          ],
          servername: options.servername || false
        };
        return callback(null, formatDNSValue(value, {
          cached: false
        }));
      }
      let cached;
      if (dnsCache.has(options.host)) {
        cached = dnsCache.get(options.host);
        if (!cached.expires || cached.expires >= Date.now()) {
          return callback(null, formatDNSValue(cached.value, {
            cached: true
          }));
        }
      }
      resolver(4, options.host, options, (err, addresses) => {
        if (err) {
          if (cached) {
            return callback(null, formatDNSValue(cached.value, {
              cached: true,
              error: err
            }));
          }
          return callback(err);
        }
        if (addresses && addresses.length) {
          let value = {
            addresses,
            servername: options.servername || options.host
          };
          dnsCache.set(options.host, {
            value,
            expires: Date.now() + (options.dnsTtl || DNS_TTL)
          });
          return callback(null, formatDNSValue(value, {
            cached: false
          }));
        }
        resolver(6, options.host, options, (err2, addresses2) => {
          if (err2) {
            if (cached) {
              return callback(null, formatDNSValue(cached.value, {
                cached: true,
                error: err2
              }));
            }
            return callback(err2);
          }
          if (addresses2 && addresses2.length) {
            let value = {
              addresses: addresses2,
              servername: options.servername || options.host
            };
            dnsCache.set(options.host, {
              value,
              expires: Date.now() + (options.dnsTtl || DNS_TTL)
            });
            return callback(null, formatDNSValue(value, {
              cached: false
            }));
          }
          try {
            dns.lookup(options.host, {
              all: true
            }, (err3, addresses3) => {
              if (err3) {
                if (cached) {
                  return callback(null, formatDNSValue(cached.value, {
                    cached: true,
                    error: err3
                  }));
                }
                return callback(err3);
              }
              let address = addresses3 ? addresses3.filter((addr) => isFamilySupported(addr.family)).map((addr) => addr.address).shift() : false;
              if (addresses3 && addresses3.length && !address) {
                console.warn(`Failed to resolve IPv${addresses3[0].family} addresses with current network`);
              }
              if (!address && cached) {
                return callback(null, formatDNSValue(cached.value, {
                  cached: true
                }));
              }
              let value = {
                addresses: address ? [
                  address
                ] : [
                  options.host
                ],
                servername: options.servername || options.host
              };
              dnsCache.set(options.host, {
                value,
                expires: Date.now() + (options.dnsTtl || DNS_TTL)
              });
              return callback(null, formatDNSValue(value, {
                cached: false
              }));
            });
          } catch (err3) {
            if (cached) {
              return callback(null, formatDNSValue(cached.value, {
                cached: true,
                error: err3
              }));
            }
            return callback(err3);
          }
        });
      });
    };
    module.exports.parseConnectionUrl = (str) => {
      str = str || "";
      let options = {};
      [
        urllib.parse(str, true)
      ].forEach((url) => {
        let auth;
        switch (url.protocol) {
          case "smtp:":
            options.secure = false;
            break;
          case "smtps:":
            options.secure = true;
            break;
          case "direct:":
            options.direct = true;
            break;
        }
        if (!isNaN(url.port) && Number(url.port)) {
          options.port = Number(url.port);
        }
        if (url.hostname) {
          options.host = url.hostname;
        }
        if (url.auth) {
          auth = url.auth.split(":");
          if (!options.auth) {
            options.auth = {};
          }
          options.auth.user = auth.shift();
          options.auth.pass = auth.join(":");
        }
        Object.keys(url.query || {}).forEach((key) => {
          let obj = options;
          let lKey = key;
          let value = url.query[key];
          if (!isNaN(value)) {
            value = Number(value);
          }
          switch (value) {
            case "true":
              value = true;
              break;
            case "false":
              value = false;
              break;
          }
          if (key.indexOf("tls.") === 0) {
            lKey = key.substr(4);
            if (!options.tls) {
              options.tls = {};
            }
            obj = options.tls;
          } else if (key.indexOf(".") >= 0) {
            return;
          }
          if (!(lKey in obj)) {
            obj[lKey] = value;
          }
        });
      });
      return options;
    };
    module.exports._logFunc = (logger, level, defaults, data, message, ...args) => {
      let entry = {};
      Object.keys(defaults || {}).forEach((key) => {
        if (key !== "level") {
          entry[key] = defaults[key];
        }
      });
      Object.keys(data || {}).forEach((key) => {
        if (key !== "level") {
          entry[key] = data[key];
        }
      });
      logger[level](entry, message, ...args);
    };
    module.exports.getLogger = (options, defaults) => {
      options = options || {};
      let response = {};
      let levels = [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal"
      ];
      if (!options.logger) {
        levels.forEach((level) => {
          response[level] = () => false;
        });
        return response;
      }
      let logger = options.logger;
      if (options.logger === true) {
        logger = createDefaultLogger(levels);
      }
      levels.forEach((level) => {
        response[level] = (data, message, ...args) => {
          module.exports._logFunc(logger, level, defaults, data, message, ...args);
        };
      });
      return response;
    };
    module.exports.callbackPromise = (resolve, reject) => function() {
      let args = Array.from(arguments);
      let err = args.shift();
      if (err) {
        reject(err);
      } else {
        resolve(...args);
      }
    };
    module.exports.parseDataURI = (uri) => {
      let input = uri;
      let commaPos = input.indexOf(",");
      if (!commaPos) {
        return uri;
      }
      let data = input.substring(commaPos + 1);
      let metaStr = input.substring("data:".length, commaPos);
      let encoding;
      let metaEntries = metaStr.split(";");
      let lastMetaEntry = metaEntries.length > 1 ? metaEntries[metaEntries.length - 1] : false;
      if (lastMetaEntry && lastMetaEntry.indexOf("=") < 0) {
        encoding = lastMetaEntry.toLowerCase();
        metaEntries.pop();
      }
      let contentType = metaEntries.shift() || "application/octet-stream";
      let params = {};
      for (let entry of metaEntries) {
        let sep = entry.indexOf("=");
        if (sep >= 0) {
          let key = entry.substring(0, sep);
          let value = entry.substring(sep + 1);
          params[key] = value;
        }
      }
      switch (encoding) {
        case "base64":
          data = Buffer.from(data, "base64");
          break;
        case "utf8":
          data = Buffer.from(data);
          break;
        default:
          try {
            data = Buffer.from(decodeURIComponent(data));
          } catch (err) {
            data = Buffer.from(data);
          }
          data = Buffer.from(data);
      }
      return {
        data,
        encoding,
        contentType,
        params
      };
    };
    module.exports.resolveContent = (data, key, callback) => {
      let promise;
      if (!callback) {
        promise = new Promise((resolve, reject) => {
          callback = module.exports.callbackPromise(resolve, reject);
        });
      }
      let content = data && data[key] && data[key].content || data[key];
      let contentStream;
      let encoding = (typeof data[key] === "object" && data[key].encoding || "utf8").toString().toLowerCase().replace(/[-_\s]/g, "");
      if (!content) {
        return callback(null, content);
      }
      if (typeof content === "object") {
        if (typeof content.pipe === "function") {
          return resolveStream(content, (err, value) => {
            if (err) {
              return callback(err);
            }
            if (data[key].content) {
              data[key].content = value;
            } else {
              data[key] = value;
            }
            callback(null, value);
          });
        } else if (/^https?:\/\//i.test(content.path || content.href)) {
          contentStream = nmfetch(content.path || content.href);
          return resolveStream(contentStream, callback);
        } else if (/^data:/i.test(content.path || content.href)) {
          let parsedDataUri = module.exports.parseDataURI(content.path || content.href);
          if (!parsedDataUri || !parsedDataUri.data) {
            return callback(null, Buffer.from(0));
          }
          return callback(null, parsedDataUri.data);
        } else if (content.path) {
          return resolveStream(fs.createReadStream(content.path), callback);
        }
      }
      if (typeof data[key].content === "string" && ![
        "utf8",
        "usascii",
        "ascii"
      ].includes(encoding)) {
        content = Buffer.from(data[key].content, encoding);
      }
      setImmediate(() => callback(null, content));
      return promise;
    };
    module.exports.assign = function() {
      let args = Array.from(arguments);
      let target = args.shift() || {};
      args.forEach((source) => {
        Object.keys(source || {}).forEach((key) => {
          if ([
            "tls",
            "auth"
          ].includes(key) && source[key] && typeof source[key] === "object") {
            if (!target[key]) {
              target[key] = {};
            }
            Object.keys(source[key]).forEach((subKey) => {
              target[key][subKey] = source[key][subKey];
            });
          } else {
            target[key] = source[key];
          }
        });
      });
      return target;
    };
    module.exports.encodeXText = (str) => {
      if (!/[^\x21-\x2A\x2C-\x3C\x3E-\x7E]/.test(str)) {
        return str;
      }
      let buf = Buffer.from(str);
      let result = "";
      for (let i = 0, len = buf.length; i < len; i++) {
        let c = buf[i];
        if (c < 33 || c > 126 || c === 43 || c === 61) {
          result += "+" + (c < 16 ? "0" : "") + c.toString(16).toUpperCase();
        } else {
          result += String.fromCharCode(c);
        }
      }
      return result;
    };
    function resolveStream(stream, callback) {
      let responded = false;
      let chunks = [];
      let chunklen = 0;
      stream.on("error", (err) => {
        if (responded) {
          return;
        }
        responded = true;
        callback(err);
      });
      stream.on("readable", () => {
        let chunk;
        while ((chunk = stream.read()) !== null) {
          chunks.push(chunk);
          chunklen += chunk.length;
        }
      });
      stream.on("end", () => {
        if (responded) {
          return;
        }
        responded = true;
        let value;
        try {
          value = Buffer.concat(chunks, chunklen);
        } catch (E) {
          return callback(E);
        }
        callback(null, value);
      });
    }
    function createDefaultLogger(levels) {
      let levelMaxLen = 0;
      let levelNames = /* @__PURE__ */ new Map();
      levels.forEach((level) => {
        if (level.length > levelMaxLen) {
          levelMaxLen = level.length;
        }
      });
      levels.forEach((level) => {
        let levelName = level.toUpperCase();
        if (levelName.length < levelMaxLen) {
          levelName += " ".repeat(levelMaxLen - levelName.length);
        }
        levelNames.set(level, levelName);
      });
      let print = (level, entry, message, ...args) => {
        let prefix = "";
        if (entry) {
          if (entry.tnx === "server") {
            prefix = "S: ";
          } else if (entry.tnx === "client") {
            prefix = "C: ";
          }
          if (entry.sid) {
            prefix = "[" + entry.sid + "] " + prefix;
          }
          if (entry.cid) {
            prefix = "[#" + entry.cid + "] " + prefix;
          }
        }
        message = util.format(message, ...args);
        message.split(/\r?\n/).forEach((line) => {
          console.log("[%s] %s %s", (/* @__PURE__ */ new Date()).toISOString().substr(0, 19).replace(/T/, " "), levelNames.get(level), prefix + line);
        });
      };
      let logger = {};
      levels.forEach((level) => {
        logger[level] = print.bind(null, level);
      });
      return logger;
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-funcs/mime-types.js
var require_mime_types = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-funcs/mime-types.js"(exports, module) {
    "use strict";
    var path = __require("node:path");
    var defaultMimeType = "application/octet-stream";
    var defaultExtension = "bin";
    var mimeTypes = /* @__PURE__ */ new Map([
      [
        "application/acad",
        "dwg"
      ],
      [
        "application/applixware",
        "aw"
      ],
      [
        "application/arj",
        "arj"
      ],
      [
        "application/atom+xml",
        "xml"
      ],
      [
        "application/atomcat+xml",
        "atomcat"
      ],
      [
        "application/atomsvc+xml",
        "atomsvc"
      ],
      [
        "application/base64",
        [
          "mm",
          "mme"
        ]
      ],
      [
        "application/binhex",
        "hqx"
      ],
      [
        "application/binhex4",
        "hqx"
      ],
      [
        "application/book",
        [
          "book",
          "boo"
        ]
      ],
      [
        "application/ccxml+xml,",
        "ccxml"
      ],
      [
        "application/cdf",
        "cdf"
      ],
      [
        "application/cdmi-capability",
        "cdmia"
      ],
      [
        "application/cdmi-container",
        "cdmic"
      ],
      [
        "application/cdmi-domain",
        "cdmid"
      ],
      [
        "application/cdmi-object",
        "cdmio"
      ],
      [
        "application/cdmi-queue",
        "cdmiq"
      ],
      [
        "application/clariscad",
        "ccad"
      ],
      [
        "application/commonground",
        "dp"
      ],
      [
        "application/cu-seeme",
        "cu"
      ],
      [
        "application/davmount+xml",
        "davmount"
      ],
      [
        "application/drafting",
        "drw"
      ],
      [
        "application/dsptype",
        "tsp"
      ],
      [
        "application/dssc+der",
        "dssc"
      ],
      [
        "application/dssc+xml",
        "xdssc"
      ],
      [
        "application/dxf",
        "dxf"
      ],
      [
        "application/ecmascript",
        [
          "js",
          "es"
        ]
      ],
      [
        "application/emma+xml",
        "emma"
      ],
      [
        "application/envoy",
        "evy"
      ],
      [
        "application/epub+zip",
        "epub"
      ],
      [
        "application/excel",
        [
          "xls",
          "xl",
          "xla",
          "xlb",
          "xlc",
          "xld",
          "xlk",
          "xll",
          "xlm",
          "xlt",
          "xlv",
          "xlw"
        ]
      ],
      [
        "application/exi",
        "exi"
      ],
      [
        "application/font-tdpfr",
        "pfr"
      ],
      [
        "application/fractals",
        "fif"
      ],
      [
        "application/freeloader",
        "frl"
      ],
      [
        "application/futuresplash",
        "spl"
      ],
      [
        "application/gnutar",
        "tgz"
      ],
      [
        "application/groupwise",
        "vew"
      ],
      [
        "application/hlp",
        "hlp"
      ],
      [
        "application/hta",
        "hta"
      ],
      [
        "application/hyperstudio",
        "stk"
      ],
      [
        "application/i-deas",
        "unv"
      ],
      [
        "application/iges",
        [
          "iges",
          "igs"
        ]
      ],
      [
        "application/inf",
        "inf"
      ],
      [
        "application/internet-property-stream",
        "acx"
      ],
      [
        "application/ipfix",
        "ipfix"
      ],
      [
        "application/java",
        "class"
      ],
      [
        "application/java-archive",
        "jar"
      ],
      [
        "application/java-byte-code",
        "class"
      ],
      [
        "application/java-serialized-object",
        "ser"
      ],
      [
        "application/java-vm",
        "class"
      ],
      [
        "application/javascript",
        "js"
      ],
      [
        "application/json",
        "json"
      ],
      [
        "application/lha",
        "lha"
      ],
      [
        "application/lzx",
        "lzx"
      ],
      [
        "application/mac-binary",
        "bin"
      ],
      [
        "application/mac-binhex",
        "hqx"
      ],
      [
        "application/mac-binhex40",
        "hqx"
      ],
      [
        "application/mac-compactpro",
        "cpt"
      ],
      [
        "application/macbinary",
        "bin"
      ],
      [
        "application/mads+xml",
        "mads"
      ],
      [
        "application/marc",
        "mrc"
      ],
      [
        "application/marcxml+xml",
        "mrcx"
      ],
      [
        "application/mathematica",
        "ma"
      ],
      [
        "application/mathml+xml",
        "mathml"
      ],
      [
        "application/mbedlet",
        "mbd"
      ],
      [
        "application/mbox",
        "mbox"
      ],
      [
        "application/mcad",
        "mcd"
      ],
      [
        "application/mediaservercontrol+xml",
        "mscml"
      ],
      [
        "application/metalink4+xml",
        "meta4"
      ],
      [
        "application/mets+xml",
        "mets"
      ],
      [
        "application/mime",
        "aps"
      ],
      [
        "application/mods+xml",
        "mods"
      ],
      [
        "application/mp21",
        "m21"
      ],
      [
        "application/mp4",
        "mp4"
      ],
      [
        "application/mspowerpoint",
        [
          "ppt",
          "pot",
          "pps",
          "ppz"
        ]
      ],
      [
        "application/msword",
        [
          "doc",
          "dot",
          "w6w",
          "wiz",
          "word"
        ]
      ],
      [
        "application/mswrite",
        "wri"
      ],
      [
        "application/mxf",
        "mxf"
      ],
      [
        "application/netmc",
        "mcp"
      ],
      [
        "application/octet-stream",
        [
          "*"
        ]
      ],
      [
        "application/oda",
        "oda"
      ],
      [
        "application/oebps-package+xml",
        "opf"
      ],
      [
        "application/ogg",
        "ogx"
      ],
      [
        "application/olescript",
        "axs"
      ],
      [
        "application/onenote",
        "onetoc"
      ],
      [
        "application/patch-ops-error+xml",
        "xer"
      ],
      [
        "application/pdf",
        "pdf"
      ],
      [
        "application/pgp-encrypted",
        "asc"
      ],
      [
        "application/pgp-signature",
        "pgp"
      ],
      [
        "application/pics-rules",
        "prf"
      ],
      [
        "application/pkcs-12",
        "p12"
      ],
      [
        "application/pkcs-crl",
        "crl"
      ],
      [
        "application/pkcs10",
        "p10"
      ],
      [
        "application/pkcs7-mime",
        [
          "p7c",
          "p7m"
        ]
      ],
      [
        "application/pkcs7-signature",
        "p7s"
      ],
      [
        "application/pkcs8",
        "p8"
      ],
      [
        "application/pkix-attr-cert",
        "ac"
      ],
      [
        "application/pkix-cert",
        [
          "cer",
          "crt"
        ]
      ],
      [
        "application/pkix-crl",
        "crl"
      ],
      [
        "application/pkix-pkipath",
        "pkipath"
      ],
      [
        "application/pkixcmp",
        "pki"
      ],
      [
        "application/plain",
        "text"
      ],
      [
        "application/pls+xml",
        "pls"
      ],
      [
        "application/postscript",
        [
          "ps",
          "ai",
          "eps"
        ]
      ],
      [
        "application/powerpoint",
        "ppt"
      ],
      [
        "application/pro_eng",
        [
          "part",
          "prt"
        ]
      ],
      [
        "application/prs.cww",
        "cww"
      ],
      [
        "application/pskc+xml",
        "pskcxml"
      ],
      [
        "application/rdf+xml",
        "rdf"
      ],
      [
        "application/reginfo+xml",
        "rif"
      ],
      [
        "application/relax-ng-compact-syntax",
        "rnc"
      ],
      [
        "application/resource-lists+xml",
        "rl"
      ],
      [
        "application/resource-lists-diff+xml",
        "rld"
      ],
      [
        "application/ringing-tones",
        "rng"
      ],
      [
        "application/rls-services+xml",
        "rs"
      ],
      [
        "application/rsd+xml",
        "rsd"
      ],
      [
        "application/rss+xml",
        "xml"
      ],
      [
        "application/rtf",
        [
          "rtf",
          "rtx"
        ]
      ],
      [
        "application/sbml+xml",
        "sbml"
      ],
      [
        "application/scvp-cv-request",
        "scq"
      ],
      [
        "application/scvp-cv-response",
        "scs"
      ],
      [
        "application/scvp-vp-request",
        "spq"
      ],
      [
        "application/scvp-vp-response",
        "spp"
      ],
      [
        "application/sdp",
        "sdp"
      ],
      [
        "application/sea",
        "sea"
      ],
      [
        "application/set",
        "set"
      ],
      [
        "application/set-payment-initiation",
        "setpay"
      ],
      [
        "application/set-registration-initiation",
        "setreg"
      ],
      [
        "application/shf+xml",
        "shf"
      ],
      [
        "application/sla",
        "stl"
      ],
      [
        "application/smil",
        [
          "smi",
          "smil"
        ]
      ],
      [
        "application/smil+xml",
        "smi"
      ],
      [
        "application/solids",
        "sol"
      ],
      [
        "application/sounder",
        "sdr"
      ],
      [
        "application/sparql-query",
        "rq"
      ],
      [
        "application/sparql-results+xml",
        "srx"
      ],
      [
        "application/srgs",
        "gram"
      ],
      [
        "application/srgs+xml",
        "grxml"
      ],
      [
        "application/sru+xml",
        "sru"
      ],
      [
        "application/ssml+xml",
        "ssml"
      ],
      [
        "application/step",
        [
          "step",
          "stp"
        ]
      ],
      [
        "application/streamingmedia",
        "ssm"
      ],
      [
        "application/tei+xml",
        "tei"
      ],
      [
        "application/thraud+xml",
        "tfi"
      ],
      [
        "application/timestamped-data",
        "tsd"
      ],
      [
        "application/toolbook",
        "tbk"
      ],
      [
        "application/vda",
        "vda"
      ],
      [
        "application/vnd.3gpp.pic-bw-large",
        "plb"
      ],
      [
        "application/vnd.3gpp.pic-bw-small",
        "psb"
      ],
      [
        "application/vnd.3gpp.pic-bw-var",
        "pvb"
      ],
      [
        "application/vnd.3gpp2.tcap",
        "tcap"
      ],
      [
        "application/vnd.3m.post-it-notes",
        "pwn"
      ],
      [
        "application/vnd.accpac.simply.aso",
        "aso"
      ],
      [
        "application/vnd.accpac.simply.imp",
        "imp"
      ],
      [
        "application/vnd.acucobol",
        "acu"
      ],
      [
        "application/vnd.acucorp",
        "atc"
      ],
      [
        "application/vnd.adobe.air-application-installer-package+zip",
        "air"
      ],
      [
        "application/vnd.adobe.fxp",
        "fxp"
      ],
      [
        "application/vnd.adobe.xdp+xml",
        "xdp"
      ],
      [
        "application/vnd.adobe.xfdf",
        "xfdf"
      ],
      [
        "application/vnd.ahead.space",
        "ahead"
      ],
      [
        "application/vnd.airzip.filesecure.azf",
        "azf"
      ],
      [
        "application/vnd.airzip.filesecure.azs",
        "azs"
      ],
      [
        "application/vnd.amazon.ebook",
        "azw"
      ],
      [
        "application/vnd.americandynamics.acc",
        "acc"
      ],
      [
        "application/vnd.amiga.ami",
        "ami"
      ],
      [
        "application/vnd.android.package-archive",
        "apk"
      ],
      [
        "application/vnd.anser-web-certificate-issue-initiation",
        "cii"
      ],
      [
        "application/vnd.anser-web-funds-transfer-initiation",
        "fti"
      ],
      [
        "application/vnd.antix.game-component",
        "atx"
      ],
      [
        "application/vnd.apple.installer+xml",
        "mpkg"
      ],
      [
        "application/vnd.apple.mpegurl",
        "m3u8"
      ],
      [
        "application/vnd.aristanetworks.swi",
        "swi"
      ],
      [
        "application/vnd.audiograph",
        "aep"
      ],
      [
        "application/vnd.blueice.multipass",
        "mpm"
      ],
      [
        "application/vnd.bmi",
        "bmi"
      ],
      [
        "application/vnd.businessobjects",
        "rep"
      ],
      [
        "application/vnd.chemdraw+xml",
        "cdxml"
      ],
      [
        "application/vnd.chipnuts.karaoke-mmd",
        "mmd"
      ],
      [
        "application/vnd.cinderella",
        "cdy"
      ],
      [
        "application/vnd.claymore",
        "cla"
      ],
      [
        "application/vnd.cloanto.rp9",
        "rp9"
      ],
      [
        "application/vnd.clonk.c4group",
        "c4g"
      ],
      [
        "application/vnd.cluetrust.cartomobile-config",
        "c11amc"
      ],
      [
        "application/vnd.cluetrust.cartomobile-config-pkg",
        "c11amz"
      ],
      [
        "application/vnd.commonspace",
        "csp"
      ],
      [
        "application/vnd.contact.cmsg",
        "cdbcmsg"
      ],
      [
        "application/vnd.cosmocaller",
        "cmc"
      ],
      [
        "application/vnd.crick.clicker",
        "clkx"
      ],
      [
        "application/vnd.crick.clicker.keyboard",
        "clkk"
      ],
      [
        "application/vnd.crick.clicker.palette",
        "clkp"
      ],
      [
        "application/vnd.crick.clicker.template",
        "clkt"
      ],
      [
        "application/vnd.crick.clicker.wordbank",
        "clkw"
      ],
      [
        "application/vnd.criticaltools.wbs+xml",
        "wbs"
      ],
      [
        "application/vnd.ctc-posml",
        "pml"
      ],
      [
        "application/vnd.cups-ppd",
        "ppd"
      ],
      [
        "application/vnd.curl.car",
        "car"
      ],
      [
        "application/vnd.curl.pcurl",
        "pcurl"
      ],
      [
        "application/vnd.data-vision.rdz",
        "rdz"
      ],
      [
        "application/vnd.denovo.fcselayout-link",
        "fe_launch"
      ],
      [
        "application/vnd.dna",
        "dna"
      ],
      [
        "application/vnd.dolby.mlp",
        "mlp"
      ],
      [
        "application/vnd.dpgraph",
        "dpg"
      ],
      [
        "application/vnd.dreamfactory",
        "dfac"
      ],
      [
        "application/vnd.dvb.ait",
        "ait"
      ],
      [
        "application/vnd.dvb.service",
        "svc"
      ],
      [
        "application/vnd.dynageo",
        "geo"
      ],
      [
        "application/vnd.ecowin.chart",
        "mag"
      ],
      [
        "application/vnd.enliven",
        "nml"
      ],
      [
        "application/vnd.epson.esf",
        "esf"
      ],
      [
        "application/vnd.epson.msf",
        "msf"
      ],
      [
        "application/vnd.epson.quickanime",
        "qam"
      ],
      [
        "application/vnd.epson.salt",
        "slt"
      ],
      [
        "application/vnd.epson.ssf",
        "ssf"
      ],
      [
        "application/vnd.eszigno3+xml",
        "es3"
      ],
      [
        "application/vnd.ezpix-album",
        "ez2"
      ],
      [
        "application/vnd.ezpix-package",
        "ez3"
      ],
      [
        "application/vnd.fdf",
        "fdf"
      ],
      [
        "application/vnd.fdsn.seed",
        "seed"
      ],
      [
        "application/vnd.flographit",
        "gph"
      ],
      [
        "application/vnd.fluxtime.clip",
        "ftc"
      ],
      [
        "application/vnd.framemaker",
        "fm"
      ],
      [
        "application/vnd.frogans.fnc",
        "fnc"
      ],
      [
        "application/vnd.frogans.ltf",
        "ltf"
      ],
      [
        "application/vnd.fsc.weblaunch",
        "fsc"
      ],
      [
        "application/vnd.fujitsu.oasys",
        "oas"
      ],
      [
        "application/vnd.fujitsu.oasys2",
        "oa2"
      ],
      [
        "application/vnd.fujitsu.oasys3",
        "oa3"
      ],
      [
        "application/vnd.fujitsu.oasysgp",
        "fg5"
      ],
      [
        "application/vnd.fujitsu.oasysprs",
        "bh2"
      ],
      [
        "application/vnd.fujixerox.ddd",
        "ddd"
      ],
      [
        "application/vnd.fujixerox.docuworks",
        "xdw"
      ],
      [
        "application/vnd.fujixerox.docuworks.binder",
        "xbd"
      ],
      [
        "application/vnd.fuzzysheet",
        "fzs"
      ],
      [
        "application/vnd.genomatix.tuxedo",
        "txd"
      ],
      [
        "application/vnd.geogebra.file",
        "ggb"
      ],
      [
        "application/vnd.geogebra.tool",
        "ggt"
      ],
      [
        "application/vnd.geometry-explorer",
        "gex"
      ],
      [
        "application/vnd.geonext",
        "gxt"
      ],
      [
        "application/vnd.geoplan",
        "g2w"
      ],
      [
        "application/vnd.geospace",
        "g3w"
      ],
      [
        "application/vnd.gmx",
        "gmx"
      ],
      [
        "application/vnd.google-earth.kml+xml",
        "kml"
      ],
      [
        "application/vnd.google-earth.kmz",
        "kmz"
      ],
      [
        "application/vnd.grafeq",
        "gqf"
      ],
      [
        "application/vnd.groove-account",
        "gac"
      ],
      [
        "application/vnd.groove-help",
        "ghf"
      ],
      [
        "application/vnd.groove-identity-message",
        "gim"
      ],
      [
        "application/vnd.groove-injector",
        "grv"
      ],
      [
        "application/vnd.groove-tool-message",
        "gtm"
      ],
      [
        "application/vnd.groove-tool-template",
        "tpl"
      ],
      [
        "application/vnd.groove-vcard",
        "vcg"
      ],
      [
        "application/vnd.hal+xml",
        "hal"
      ],
      [
        "application/vnd.handheld-entertainment+xml",
        "zmm"
      ],
      [
        "application/vnd.hbci",
        "hbci"
      ],
      [
        "application/vnd.hhe.lesson-player",
        "les"
      ],
      [
        "application/vnd.hp-hpgl",
        [
          "hgl",
          "hpg",
          "hpgl"
        ]
      ],
      [
        "application/vnd.hp-hpid",
        "hpid"
      ],
      [
        "application/vnd.hp-hps",
        "hps"
      ],
      [
        "application/vnd.hp-jlyt",
        "jlt"
      ],
      [
        "application/vnd.hp-pcl",
        "pcl"
      ],
      [
        "application/vnd.hp-pclxl",
        "pclxl"
      ],
      [
        "application/vnd.hydrostatix.sof-data",
        "sfd-hdstx"
      ],
      [
        "application/vnd.hzn-3d-crossword",
        "x3d"
      ],
      [
        "application/vnd.ibm.minipay",
        "mpy"
      ],
      [
        "application/vnd.ibm.modcap",
        "afp"
      ],
      [
        "application/vnd.ibm.rights-management",
        "irm"
      ],
      [
        "application/vnd.ibm.secure-container",
        "sc"
      ],
      [
        "application/vnd.iccprofile",
        "icc"
      ],
      [
        "application/vnd.igloader",
        "igl"
      ],
      [
        "application/vnd.immervision-ivp",
        "ivp"
      ],
      [
        "application/vnd.immervision-ivu",
        "ivu"
      ],
      [
        "application/vnd.insors.igm",
        "igm"
      ],
      [
        "application/vnd.intercon.formnet",
        "xpw"
      ],
      [
        "application/vnd.intergeo",
        "i2g"
      ],
      [
        "application/vnd.intu.qbo",
        "qbo"
      ],
      [
        "application/vnd.intu.qfx",
        "qfx"
      ],
      [
        "application/vnd.ipunplugged.rcprofile",
        "rcprofile"
      ],
      [
        "application/vnd.irepository.package+xml",
        "irp"
      ],
      [
        "application/vnd.is-xpr",
        "xpr"
      ],
      [
        "application/vnd.isac.fcs",
        "fcs"
      ],
      [
        "application/vnd.jam",
        "jam"
      ],
      [
        "application/vnd.jcp.javame.midlet-rms",
        "rms"
      ],
      [
        "application/vnd.jisp",
        "jisp"
      ],
      [
        "application/vnd.joost.joda-archive",
        "joda"
      ],
      [
        "application/vnd.kahootz",
        "ktz"
      ],
      [
        "application/vnd.kde.karbon",
        "karbon"
      ],
      [
        "application/vnd.kde.kchart",
        "chrt"
      ],
      [
        "application/vnd.kde.kformula",
        "kfo"
      ],
      [
        "application/vnd.kde.kivio",
        "flw"
      ],
      [
        "application/vnd.kde.kontour",
        "kon"
      ],
      [
        "application/vnd.kde.kpresenter",
        "kpr"
      ],
      [
        "application/vnd.kde.kspread",
        "ksp"
      ],
      [
        "application/vnd.kde.kword",
        "kwd"
      ],
      [
        "application/vnd.kenameaapp",
        "htke"
      ],
      [
        "application/vnd.kidspiration",
        "kia"
      ],
      [
        "application/vnd.kinar",
        "kne"
      ],
      [
        "application/vnd.koan",
        "skp"
      ],
      [
        "application/vnd.kodak-descriptor",
        "sse"
      ],
      [
        "application/vnd.las.las+xml",
        "lasxml"
      ],
      [
        "application/vnd.llamagraphics.life-balance.desktop",
        "lbd"
      ],
      [
        "application/vnd.llamagraphics.life-balance.exchange+xml",
        "lbe"
      ],
      [
        "application/vnd.lotus-1-2-3",
        "123"
      ],
      [
        "application/vnd.lotus-approach",
        "apr"
      ],
      [
        "application/vnd.lotus-freelance",
        "pre"
      ],
      [
        "application/vnd.lotus-notes",
        "nsf"
      ],
      [
        "application/vnd.lotus-organizer",
        "org"
      ],
      [
        "application/vnd.lotus-screencam",
        "scm"
      ],
      [
        "application/vnd.lotus-wordpro",
        "lwp"
      ],
      [
        "application/vnd.macports.portpkg",
        "portpkg"
      ],
      [
        "application/vnd.mcd",
        "mcd"
      ],
      [
        "application/vnd.medcalcdata",
        "mc1"
      ],
      [
        "application/vnd.mediastation.cdkey",
        "cdkey"
      ],
      [
        "application/vnd.mfer",
        "mwf"
      ],
      [
        "application/vnd.mfmp",
        "mfm"
      ],
      [
        "application/vnd.micrografx.flo",
        "flo"
      ],
      [
        "application/vnd.micrografx.igx",
        "igx"
      ],
      [
        "application/vnd.mif",
        "mif"
      ],
      [
        "application/vnd.mobius.daf",
        "daf"
      ],
      [
        "application/vnd.mobius.dis",
        "dis"
      ],
      [
        "application/vnd.mobius.mbk",
        "mbk"
      ],
      [
        "application/vnd.mobius.mqy",
        "mqy"
      ],
      [
        "application/vnd.mobius.msl",
        "msl"
      ],
      [
        "application/vnd.mobius.plc",
        "plc"
      ],
      [
        "application/vnd.mobius.txf",
        "txf"
      ],
      [
        "application/vnd.mophun.application",
        "mpn"
      ],
      [
        "application/vnd.mophun.certificate",
        "mpc"
      ],
      [
        "application/vnd.mozilla.xul+xml",
        "xul"
      ],
      [
        "application/vnd.ms-artgalry",
        "cil"
      ],
      [
        "application/vnd.ms-cab-compressed",
        "cab"
      ],
      [
        "application/vnd.ms-excel",
        [
          "xls",
          "xla",
          "xlc",
          "xlm",
          "xlt",
          "xlw",
          "xlb",
          "xll"
        ]
      ],
      [
        "application/vnd.ms-excel.addin.macroenabled.12",
        "xlam"
      ],
      [
        "application/vnd.ms-excel.sheet.binary.macroenabled.12",
        "xlsb"
      ],
      [
        "application/vnd.ms-excel.sheet.macroenabled.12",
        "xlsm"
      ],
      [
        "application/vnd.ms-excel.template.macroenabled.12",
        "xltm"
      ],
      [
        "application/vnd.ms-fontobject",
        "eot"
      ],
      [
        "application/vnd.ms-htmlhelp",
        "chm"
      ],
      [
        "application/vnd.ms-ims",
        "ims"
      ],
      [
        "application/vnd.ms-lrm",
        "lrm"
      ],
      [
        "application/vnd.ms-officetheme",
        "thmx"
      ],
      [
        "application/vnd.ms-outlook",
        "msg"
      ],
      [
        "application/vnd.ms-pki.certstore",
        "sst"
      ],
      [
        "application/vnd.ms-pki.pko",
        "pko"
      ],
      [
        "application/vnd.ms-pki.seccat",
        "cat"
      ],
      [
        "application/vnd.ms-pki.stl",
        "stl"
      ],
      [
        "application/vnd.ms-pkicertstore",
        "sst"
      ],
      [
        "application/vnd.ms-pkiseccat",
        "cat"
      ],
      [
        "application/vnd.ms-pkistl",
        "stl"
      ],
      [
        "application/vnd.ms-powerpoint",
        [
          "ppt",
          "pot",
          "pps",
          "ppa",
          "pwz"
        ]
      ],
      [
        "application/vnd.ms-powerpoint.addin.macroenabled.12",
        "ppam"
      ],
      [
        "application/vnd.ms-powerpoint.presentation.macroenabled.12",
        "pptm"
      ],
      [
        "application/vnd.ms-powerpoint.slide.macroenabled.12",
        "sldm"
      ],
      [
        "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
        "ppsm"
      ],
      [
        "application/vnd.ms-powerpoint.template.macroenabled.12",
        "potm"
      ],
      [
        "application/vnd.ms-project",
        "mpp"
      ],
      [
        "application/vnd.ms-word.document.macroenabled.12",
        "docm"
      ],
      [
        "application/vnd.ms-word.template.macroenabled.12",
        "dotm"
      ],
      [
        "application/vnd.ms-works",
        [
          "wks",
          "wcm",
          "wdb",
          "wps"
        ]
      ],
      [
        "application/vnd.ms-wpl",
        "wpl"
      ],
      [
        "application/vnd.ms-xpsdocument",
        "xps"
      ],
      [
        "application/vnd.mseq",
        "mseq"
      ],
      [
        "application/vnd.musician",
        "mus"
      ],
      [
        "application/vnd.muvee.style",
        "msty"
      ],
      [
        "application/vnd.neurolanguage.nlu",
        "nlu"
      ],
      [
        "application/vnd.noblenet-directory",
        "nnd"
      ],
      [
        "application/vnd.noblenet-sealer",
        "nns"
      ],
      [
        "application/vnd.noblenet-web",
        "nnw"
      ],
      [
        "application/vnd.nokia.configuration-message",
        "ncm"
      ],
      [
        "application/vnd.nokia.n-gage.data",
        "ngdat"
      ],
      [
        "application/vnd.nokia.n-gage.symbian.install",
        "n-gage"
      ],
      [
        "application/vnd.nokia.radio-preset",
        "rpst"
      ],
      [
        "application/vnd.nokia.radio-presets",
        "rpss"
      ],
      [
        "application/vnd.nokia.ringing-tone",
        "rng"
      ],
      [
        "application/vnd.novadigm.edm",
        "edm"
      ],
      [
        "application/vnd.novadigm.edx",
        "edx"
      ],
      [
        "application/vnd.novadigm.ext",
        "ext"
      ],
      [
        "application/vnd.oasis.opendocument.chart",
        "odc"
      ],
      [
        "application/vnd.oasis.opendocument.chart-template",
        "otc"
      ],
      [
        "application/vnd.oasis.opendocument.database",
        "odb"
      ],
      [
        "application/vnd.oasis.opendocument.formula",
        "odf"
      ],
      [
        "application/vnd.oasis.opendocument.formula-template",
        "odft"
      ],
      [
        "application/vnd.oasis.opendocument.graphics",
        "odg"
      ],
      [
        "application/vnd.oasis.opendocument.graphics-template",
        "otg"
      ],
      [
        "application/vnd.oasis.opendocument.image",
        "odi"
      ],
      [
        "application/vnd.oasis.opendocument.image-template",
        "oti"
      ],
      [
        "application/vnd.oasis.opendocument.presentation",
        "odp"
      ],
      [
        "application/vnd.oasis.opendocument.presentation-template",
        "otp"
      ],
      [
        "application/vnd.oasis.opendocument.spreadsheet",
        "ods"
      ],
      [
        "application/vnd.oasis.opendocument.spreadsheet-template",
        "ots"
      ],
      [
        "application/vnd.oasis.opendocument.text",
        "odt"
      ],
      [
        "application/vnd.oasis.opendocument.text-master",
        "odm"
      ],
      [
        "application/vnd.oasis.opendocument.text-template",
        "ott"
      ],
      [
        "application/vnd.oasis.opendocument.text-web",
        "oth"
      ],
      [
        "application/vnd.olpc-sugar",
        "xo"
      ],
      [
        "application/vnd.oma.dd2+xml",
        "dd2"
      ],
      [
        "application/vnd.openofficeorg.extension",
        "oxt"
      ],
      [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx"
      ],
      [
        "application/vnd.openxmlformats-officedocument.presentationml.slide",
        "sldx"
      ],
      [
        "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
        "ppsx"
      ],
      [
        "application/vnd.openxmlformats-officedocument.presentationml.template",
        "potx"
      ],
      [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx"
      ],
      [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
        "xltx"
      ],
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx"
      ],
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
        "dotx"
      ],
      [
        "application/vnd.osgeo.mapguide.package",
        "mgp"
      ],
      [
        "application/vnd.osgi.dp",
        "dp"
      ],
      [
        "application/vnd.palm",
        "pdb"
      ],
      [
        "application/vnd.pawaafile",
        "paw"
      ],
      [
        "application/vnd.pg.format",
        "str"
      ],
      [
        "application/vnd.pg.osasli",
        "ei6"
      ],
      [
        "application/vnd.picsel",
        "efif"
      ],
      [
        "application/vnd.pmi.widget",
        "wg"
      ],
      [
        "application/vnd.pocketlearn",
        "plf"
      ],
      [
        "application/vnd.powerbuilder6",
        "pbd"
      ],
      [
        "application/vnd.previewsystems.box",
        "box"
      ],
      [
        "application/vnd.proteus.magazine",
        "mgz"
      ],
      [
        "application/vnd.publishare-delta-tree",
        "qps"
      ],
      [
        "application/vnd.pvi.ptid1",
        "ptid"
      ],
      [
        "application/vnd.quark.quarkxpress",
        "qxd"
      ],
      [
        "application/vnd.realvnc.bed",
        "bed"
      ],
      [
        "application/vnd.recordare.musicxml",
        "mxl"
      ],
      [
        "application/vnd.recordare.musicxml+xml",
        "musicxml"
      ],
      [
        "application/vnd.rig.cryptonote",
        "cryptonote"
      ],
      [
        "application/vnd.rim.cod",
        "cod"
      ],
      [
        "application/vnd.rn-realmedia",
        "rm"
      ],
      [
        "application/vnd.rn-realplayer",
        "rnx"
      ],
      [
        "application/vnd.route66.link66+xml",
        "link66"
      ],
      [
        "application/vnd.sailingtracker.track",
        "st"
      ],
      [
        "application/vnd.seemail",
        "see"
      ],
      [
        "application/vnd.sema",
        "sema"
      ],
      [
        "application/vnd.semd",
        "semd"
      ],
      [
        "application/vnd.semf",
        "semf"
      ],
      [
        "application/vnd.shana.informed.formdata",
        "ifm"
      ],
      [
        "application/vnd.shana.informed.formtemplate",
        "itp"
      ],
      [
        "application/vnd.shana.informed.interchange",
        "iif"
      ],
      [
        "application/vnd.shana.informed.package",
        "ipk"
      ],
      [
        "application/vnd.simtech-mindmapper",
        "twd"
      ],
      [
        "application/vnd.smaf",
        "mmf"
      ],
      [
        "application/vnd.smart.teacher",
        "teacher"
      ],
      [
        "application/vnd.solent.sdkm+xml",
        "sdkm"
      ],
      [
        "application/vnd.spotfire.dxp",
        "dxp"
      ],
      [
        "application/vnd.spotfire.sfs",
        "sfs"
      ],
      [
        "application/vnd.stardivision.calc",
        "sdc"
      ],
      [
        "application/vnd.stardivision.draw",
        "sda"
      ],
      [
        "application/vnd.stardivision.impress",
        "sdd"
      ],
      [
        "application/vnd.stardivision.math",
        "smf"
      ],
      [
        "application/vnd.stardivision.writer",
        "sdw"
      ],
      [
        "application/vnd.stardivision.writer-global",
        "sgl"
      ],
      [
        "application/vnd.stepmania.stepchart",
        "sm"
      ],
      [
        "application/vnd.sun.xml.calc",
        "sxc"
      ],
      [
        "application/vnd.sun.xml.calc.template",
        "stc"
      ],
      [
        "application/vnd.sun.xml.draw",
        "sxd"
      ],
      [
        "application/vnd.sun.xml.draw.template",
        "std"
      ],
      [
        "application/vnd.sun.xml.impress",
        "sxi"
      ],
      [
        "application/vnd.sun.xml.impress.template",
        "sti"
      ],
      [
        "application/vnd.sun.xml.math",
        "sxm"
      ],
      [
        "application/vnd.sun.xml.writer",
        "sxw"
      ],
      [
        "application/vnd.sun.xml.writer.global",
        "sxg"
      ],
      [
        "application/vnd.sun.xml.writer.template",
        "stw"
      ],
      [
        "application/vnd.sus-calendar",
        "sus"
      ],
      [
        "application/vnd.svd",
        "svd"
      ],
      [
        "application/vnd.symbian.install",
        "sis"
      ],
      [
        "application/vnd.syncml+xml",
        "xsm"
      ],
      [
        "application/vnd.syncml.dm+wbxml",
        "bdm"
      ],
      [
        "application/vnd.syncml.dm+xml",
        "xdm"
      ],
      [
        "application/vnd.tao.intent-module-archive",
        "tao"
      ],
      [
        "application/vnd.tmobile-livetv",
        "tmo"
      ],
      [
        "application/vnd.trid.tpt",
        "tpt"
      ],
      [
        "application/vnd.triscape.mxs",
        "mxs"
      ],
      [
        "application/vnd.trueapp",
        "tra"
      ],
      [
        "application/vnd.ufdl",
        "ufd"
      ],
      [
        "application/vnd.uiq.theme",
        "utz"
      ],
      [
        "application/vnd.umajin",
        "umj"
      ],
      [
        "application/vnd.unity",
        "unityweb"
      ],
      [
        "application/vnd.uoml+xml",
        "uoml"
      ],
      [
        "application/vnd.vcx",
        "vcx"
      ],
      [
        "application/vnd.visio",
        "vsd"
      ],
      [
        "application/vnd.visionary",
        "vis"
      ],
      [
        "application/vnd.vsf",
        "vsf"
      ],
      [
        "application/vnd.wap.wbxml",
        "wbxml"
      ],
      [
        "application/vnd.wap.wmlc",
        "wmlc"
      ],
      [
        "application/vnd.wap.wmlscriptc",
        "wmlsc"
      ],
      [
        "application/vnd.webturbo",
        "wtb"
      ],
      [
        "application/vnd.wolfram.player",
        "nbp"
      ],
      [
        "application/vnd.wordperfect",
        "wpd"
      ],
      [
        "application/vnd.wqd",
        "wqd"
      ],
      [
        "application/vnd.wt.stf",
        "stf"
      ],
      [
        "application/vnd.xara",
        [
          "web",
          "xar"
        ]
      ],
      [
        "application/vnd.xfdl",
        "xfdl"
      ],
      [
        "application/vnd.yamaha.hv-dic",
        "hvd"
      ],
      [
        "application/vnd.yamaha.hv-script",
        "hvs"
      ],
      [
        "application/vnd.yamaha.hv-voice",
        "hvp"
      ],
      [
        "application/vnd.yamaha.openscoreformat",
        "osf"
      ],
      [
        "application/vnd.yamaha.openscoreformat.osfpvg+xml",
        "osfpvg"
      ],
      [
        "application/vnd.yamaha.smaf-audio",
        "saf"
      ],
      [
        "application/vnd.yamaha.smaf-phrase",
        "spf"
      ],
      [
        "application/vnd.yellowriver-custom-menu",
        "cmp"
      ],
      [
        "application/vnd.zul",
        "zir"
      ],
      [
        "application/vnd.zzazz.deck+xml",
        "zaz"
      ],
      [
        "application/vocaltec-media-desc",
        "vmd"
      ],
      [
        "application/vocaltec-media-file",
        "vmf"
      ],
      [
        "application/voicexml+xml",
        "vxml"
      ],
      [
        "application/widget",
        "wgt"
      ],
      [
        "application/winhlp",
        "hlp"
      ],
      [
        "application/wordperfect",
        [
          "wp",
          "wp5",
          "wp6",
          "wpd"
        ]
      ],
      [
        "application/wordperfect6.0",
        [
          "w60",
          "wp5"
        ]
      ],
      [
        "application/wordperfect6.1",
        "w61"
      ],
      [
        "application/wsdl+xml",
        "wsdl"
      ],
      [
        "application/wspolicy+xml",
        "wspolicy"
      ],
      [
        "application/x-123",
        "wk1"
      ],
      [
        "application/x-7z-compressed",
        "7z"
      ],
      [
        "application/x-abiword",
        "abw"
      ],
      [
        "application/x-ace-compressed",
        "ace"
      ],
      [
        "application/x-aim",
        "aim"
      ],
      [
        "application/x-authorware-bin",
        "aab"
      ],
      [
        "application/x-authorware-map",
        "aam"
      ],
      [
        "application/x-authorware-seg",
        "aas"
      ],
      [
        "application/x-bcpio",
        "bcpio"
      ],
      [
        "application/x-binary",
        "bin"
      ],
      [
        "application/x-binhex40",
        "hqx"
      ],
      [
        "application/x-bittorrent",
        "torrent"
      ],
      [
        "application/x-bsh",
        [
          "bsh",
          "sh",
          "shar"
        ]
      ],
      [
        "application/x-bytecode.elisp",
        "elc"
      ],
      [
        "application/x-bytecode.python",
        "pyc"
      ],
      [
        "application/x-bzip",
        "bz"
      ],
      [
        "application/x-bzip2",
        [
          "boz",
          "bz2"
        ]
      ],
      [
        "application/x-cdf",
        "cdf"
      ],
      [
        "application/x-cdlink",
        "vcd"
      ],
      [
        "application/x-chat",
        [
          "cha",
          "chat"
        ]
      ],
      [
        "application/x-chess-pgn",
        "pgn"
      ],
      [
        "application/x-cmu-raster",
        "ras"
      ],
      [
        "application/x-cocoa",
        "cco"
      ],
      [
        "application/x-compactpro",
        "cpt"
      ],
      [
        "application/x-compress",
        "z"
      ],
      [
        "application/x-compressed",
        [
          "tgz",
          "gz",
          "z",
          "zip"
        ]
      ],
      [
        "application/x-conference",
        "nsc"
      ],
      [
        "application/x-cpio",
        "cpio"
      ],
      [
        "application/x-cpt",
        "cpt"
      ],
      [
        "application/x-csh",
        "csh"
      ],
      [
        "application/x-debian-package",
        "deb"
      ],
      [
        "application/x-deepv",
        "deepv"
      ],
      [
        "application/x-director",
        [
          "dir",
          "dcr",
          "dxr"
        ]
      ],
      [
        "application/x-doom",
        "wad"
      ],
      [
        "application/x-dtbncx+xml",
        "ncx"
      ],
      [
        "application/x-dtbook+xml",
        "dtb"
      ],
      [
        "application/x-dtbresource+xml",
        "res"
      ],
      [
        "application/x-dvi",
        "dvi"
      ],
      [
        "application/x-elc",
        "elc"
      ],
      [
        "application/x-envoy",
        [
          "env",
          "evy"
        ]
      ],
      [
        "application/x-esrehber",
        "es"
      ],
      [
        "application/x-excel",
        [
          "xls",
          "xla",
          "xlb",
          "xlc",
          "xld",
          "xlk",
          "xll",
          "xlm",
          "xlt",
          "xlv",
          "xlw"
        ]
      ],
      [
        "application/x-font-bdf",
        "bdf"
      ],
      [
        "application/x-font-ghostscript",
        "gsf"
      ],
      [
        "application/x-font-linux-psf",
        "psf"
      ],
      [
        "application/x-font-otf",
        "otf"
      ],
      [
        "application/x-font-pcf",
        "pcf"
      ],
      [
        "application/x-font-snf",
        "snf"
      ],
      [
        "application/x-font-ttf",
        "ttf"
      ],
      [
        "application/x-font-type1",
        "pfa"
      ],
      [
        "application/x-font-woff",
        "woff"
      ],
      [
        "application/x-frame",
        "mif"
      ],
      [
        "application/x-freelance",
        "pre"
      ],
      [
        "application/x-futuresplash",
        "spl"
      ],
      [
        "application/x-gnumeric",
        "gnumeric"
      ],
      [
        "application/x-gsp",
        "gsp"
      ],
      [
        "application/x-gss",
        "gss"
      ],
      [
        "application/x-gtar",
        "gtar"
      ],
      [
        "application/x-gzip",
        [
          "gz",
          "gzip"
        ]
      ],
      [
        "application/x-hdf",
        "hdf"
      ],
      [
        "application/x-helpfile",
        [
          "help",
          "hlp"
        ]
      ],
      [
        "application/x-httpd-imap",
        "imap"
      ],
      [
        "application/x-ima",
        "ima"
      ],
      [
        "application/x-internet-signup",
        [
          "ins",
          "isp"
        ]
      ],
      [
        "application/x-internett-signup",
        "ins"
      ],
      [
        "application/x-inventor",
        "iv"
      ],
      [
        "application/x-ip2",
        "ip"
      ],
      [
        "application/x-iphone",
        "iii"
      ],
      [
        "application/x-java-class",
        "class"
      ],
      [
        "application/x-java-commerce",
        "jcm"
      ],
      [
        "application/x-java-jnlp-file",
        "jnlp"
      ],
      [
        "application/x-javascript",
        "js"
      ],
      [
        "application/x-koan",
        [
          "skd",
          "skm",
          "skp",
          "skt"
        ]
      ],
      [
        "application/x-ksh",
        "ksh"
      ],
      [
        "application/x-latex",
        [
          "latex",
          "ltx"
        ]
      ],
      [
        "application/x-lha",
        "lha"
      ],
      [
        "application/x-lisp",
        "lsp"
      ],
      [
        "application/x-livescreen",
        "ivy"
      ],
      [
        "application/x-lotus",
        "wq1"
      ],
      [
        "application/x-lotusscreencam",
        "scm"
      ],
      [
        "application/x-lzh",
        "lzh"
      ],
      [
        "application/x-lzx",
        "lzx"
      ],
      [
        "application/x-mac-binhex40",
        "hqx"
      ],
      [
        "application/x-macbinary",
        "bin"
      ],
      [
        "application/x-magic-cap-package-1.0",
        "mc$"
      ],
      [
        "application/x-mathcad",
        "mcd"
      ],
      [
        "application/x-meme",
        "mm"
      ],
      [
        "application/x-midi",
        [
          "mid",
          "midi"
        ]
      ],
      [
        "application/x-mif",
        "mif"
      ],
      [
        "application/x-mix-transfer",
        "nix"
      ],
      [
        "application/x-mobipocket-ebook",
        "prc"
      ],
      [
        "application/x-mplayer2",
        "asx"
      ],
      [
        "application/x-ms-application",
        "application"
      ],
      [
        "application/x-ms-wmd",
        "wmd"
      ],
      [
        "application/x-ms-wmz",
        "wmz"
      ],
      [
        "application/x-ms-xbap",
        "xbap"
      ],
      [
        "application/x-msaccess",
        "mdb"
      ],
      [
        "application/x-msbinder",
        "obd"
      ],
      [
        "application/x-mscardfile",
        "crd"
      ],
      [
        "application/x-msclip",
        "clp"
      ],
      [
        "application/x-msdownload",
        [
          "exe",
          "dll"
        ]
      ],
      [
        "application/x-msexcel",
        [
          "xls",
          "xla",
          "xlw"
        ]
      ],
      [
        "application/x-msmediaview",
        [
          "mvb",
          "m13",
          "m14"
        ]
      ],
      [
        "application/x-msmetafile",
        "wmf"
      ],
      [
        "application/x-msmoney",
        "mny"
      ],
      [
        "application/x-mspowerpoint",
        "ppt"
      ],
      [
        "application/x-mspublisher",
        "pub"
      ],
      [
        "application/x-msschedule",
        "scd"
      ],
      [
        "application/x-msterminal",
        "trm"
      ],
      [
        "application/x-mswrite",
        "wri"
      ],
      [
        "application/x-navi-animation",
        "ani"
      ],
      [
        "application/x-navidoc",
        "nvd"
      ],
      [
        "application/x-navimap",
        "map"
      ],
      [
        "application/x-navistyle",
        "stl"
      ],
      [
        "application/x-netcdf",
        [
          "cdf",
          "nc"
        ]
      ],
      [
        "application/x-newton-compatible-pkg",
        "pkg"
      ],
      [
        "application/x-nokia-9000-communicator-add-on-software",
        "aos"
      ],
      [
        "application/x-omc",
        "omc"
      ],
      [
        "application/x-omcdatamaker",
        "omcd"
      ],
      [
        "application/x-omcregerator",
        "omcr"
      ],
      [
        "application/x-pagemaker",
        [
          "pm4",
          "pm5"
        ]
      ],
      [
        "application/x-pcl",
        "pcl"
      ],
      [
        "application/x-perfmon",
        [
          "pma",
          "pmc",
          "pml",
          "pmr",
          "pmw"
        ]
      ],
      [
        "application/x-pixclscript",
        "plx"
      ],
      [
        "application/x-pkcs10",
        "p10"
      ],
      [
        "application/x-pkcs12",
        [
          "p12",
          "pfx"
        ]
      ],
      [
        "application/x-pkcs7-certificates",
        [
          "p7b",
          "spc"
        ]
      ],
      [
        "application/x-pkcs7-certreqresp",
        "p7r"
      ],
      [
        "application/x-pkcs7-mime",
        [
          "p7m",
          "p7c"
        ]
      ],
      [
        "application/x-pkcs7-signature",
        [
          "p7s",
          "p7a"
        ]
      ],
      [
        "application/x-pointplus",
        "css"
      ],
      [
        "application/x-portable-anymap",
        "pnm"
      ],
      [
        "application/x-project",
        [
          "mpc",
          "mpt",
          "mpv",
          "mpx"
        ]
      ],
      [
        "application/x-qpro",
        "wb1"
      ],
      [
        "application/x-rar-compressed",
        "rar"
      ],
      [
        "application/x-rtf",
        "rtf"
      ],
      [
        "application/x-sdp",
        "sdp"
      ],
      [
        "application/x-sea",
        "sea"
      ],
      [
        "application/x-seelogo",
        "sl"
      ],
      [
        "application/x-sh",
        "sh"
      ],
      [
        "application/x-shar",
        [
          "shar",
          "sh"
        ]
      ],
      [
        "application/x-shockwave-flash",
        "swf"
      ],
      [
        "application/x-silverlight-app",
        "xap"
      ],
      [
        "application/x-sit",
        "sit"
      ],
      [
        "application/x-sprite",
        [
          "spr",
          "sprite"
        ]
      ],
      [
        "application/x-stuffit",
        "sit"
      ],
      [
        "application/x-stuffitx",
        "sitx"
      ],
      [
        "application/x-sv4cpio",
        "sv4cpio"
      ],
      [
        "application/x-sv4crc",
        "sv4crc"
      ],
      [
        "application/x-tar",
        "tar"
      ],
      [
        "application/x-tbook",
        [
          "sbk",
          "tbk"
        ]
      ],
      [
        "application/x-tcl",
        "tcl"
      ],
      [
        "application/x-tex",
        "tex"
      ],
      [
        "application/x-tex-tfm",
        "tfm"
      ],
      [
        "application/x-texinfo",
        [
          "texi",
          "texinfo"
        ]
      ],
      [
        "application/x-troff",
        [
          "roff",
          "t",
          "tr"
        ]
      ],
      [
        "application/x-troff-man",
        "man"
      ],
      [
        "application/x-troff-me",
        "me"
      ],
      [
        "application/x-troff-ms",
        "ms"
      ],
      [
        "application/x-troff-msvideo",
        "avi"
      ],
      [
        "application/x-ustar",
        "ustar"
      ],
      [
        "application/x-visio",
        [
          "vsd",
          "vst",
          "vsw"
        ]
      ],
      [
        "application/x-vnd.audioexplosion.mzz",
        "mzz"
      ],
      [
        "application/x-vnd.ls-xpix",
        "xpix"
      ],
      [
        "application/x-vrml",
        "vrml"
      ],
      [
        "application/x-wais-source",
        [
          "src",
          "wsrc"
        ]
      ],
      [
        "application/x-winhelp",
        "hlp"
      ],
      [
        "application/x-wintalk",
        "wtk"
      ],
      [
        "application/x-world",
        [
          "wrl",
          "svr"
        ]
      ],
      [
        "application/x-wpwin",
        "wpd"
      ],
      [
        "application/x-wri",
        "wri"
      ],
      [
        "application/x-x509-ca-cert",
        [
          "cer",
          "crt",
          "der"
        ]
      ],
      [
        "application/x-x509-user-cert",
        "crt"
      ],
      [
        "application/x-xfig",
        "fig"
      ],
      [
        "application/x-xpinstall",
        "xpi"
      ],
      [
        "application/x-zip-compressed",
        "zip"
      ],
      [
        "application/xcap-diff+xml",
        "xdf"
      ],
      [
        "application/xenc+xml",
        "xenc"
      ],
      [
        "application/xhtml+xml",
        "xhtml"
      ],
      [
        "application/xml",
        "xml"
      ],
      [
        "application/xml-dtd",
        "dtd"
      ],
      [
        "application/xop+xml",
        "xop"
      ],
      [
        "application/xslt+xml",
        "xslt"
      ],
      [
        "application/xspf+xml",
        "xspf"
      ],
      [
        "application/xv+xml",
        "mxml"
      ],
      [
        "application/yang",
        "yang"
      ],
      [
        "application/yin+xml",
        "yin"
      ],
      [
        "application/ynd.ms-pkipko",
        "pko"
      ],
      [
        "application/zip",
        "zip"
      ],
      [
        "audio/adpcm",
        "adp"
      ],
      [
        "audio/aiff",
        [
          "aiff",
          "aif",
          "aifc"
        ]
      ],
      [
        "audio/basic",
        [
          "snd",
          "au"
        ]
      ],
      [
        "audio/it",
        "it"
      ],
      [
        "audio/make",
        [
          "funk",
          "my",
          "pfunk"
        ]
      ],
      [
        "audio/make.my.funk",
        "pfunk"
      ],
      [
        "audio/mid",
        [
          "mid",
          "rmi"
        ]
      ],
      [
        "audio/midi",
        [
          "midi",
          "kar",
          "mid"
        ]
      ],
      [
        "audio/mod",
        "mod"
      ],
      [
        "audio/mp4",
        "mp4a"
      ],
      [
        "audio/mpeg",
        [
          "mpga",
          "mp3",
          "m2a",
          "mp2",
          "mpa",
          "mpg"
        ]
      ],
      [
        "audio/mpeg3",
        "mp3"
      ],
      [
        "audio/nspaudio",
        [
          "la",
          "lma"
        ]
      ],
      [
        "audio/ogg",
        "oga"
      ],
      [
        "audio/s3m",
        "s3m"
      ],
      [
        "audio/tsp-audio",
        "tsi"
      ],
      [
        "audio/tsplayer",
        "tsp"
      ],
      [
        "audio/vnd.dece.audio",
        "uva"
      ],
      [
        "audio/vnd.digital-winds",
        "eol"
      ],
      [
        "audio/vnd.dra",
        "dra"
      ],
      [
        "audio/vnd.dts",
        "dts"
      ],
      [
        "audio/vnd.dts.hd",
        "dtshd"
      ],
      [
        "audio/vnd.lucent.voice",
        "lvp"
      ],
      [
        "audio/vnd.ms-playready.media.pya",
        "pya"
      ],
      [
        "audio/vnd.nuera.ecelp4800",
        "ecelp4800"
      ],
      [
        "audio/vnd.nuera.ecelp7470",
        "ecelp7470"
      ],
      [
        "audio/vnd.nuera.ecelp9600",
        "ecelp9600"
      ],
      [
        "audio/vnd.qcelp",
        "qcp"
      ],
      [
        "audio/vnd.rip",
        "rip"
      ],
      [
        "audio/voc",
        "voc"
      ],
      [
        "audio/voxware",
        "vox"
      ],
      [
        "audio/wav",
        "wav"
      ],
      [
        "audio/webm",
        "weba"
      ],
      [
        "audio/x-aac",
        "aac"
      ],
      [
        "audio/x-adpcm",
        "snd"
      ],
      [
        "audio/x-aiff",
        [
          "aiff",
          "aif",
          "aifc"
        ]
      ],
      [
        "audio/x-au",
        "au"
      ],
      [
        "audio/x-gsm",
        [
          "gsd",
          "gsm"
        ]
      ],
      [
        "audio/x-jam",
        "jam"
      ],
      [
        "audio/x-liveaudio",
        "lam"
      ],
      [
        "audio/x-mid",
        [
          "mid",
          "midi"
        ]
      ],
      [
        "audio/x-midi",
        [
          "midi",
          "mid"
        ]
      ],
      [
        "audio/x-mod",
        "mod"
      ],
      [
        "audio/x-mpeg",
        "mp2"
      ],
      [
        "audio/x-mpeg-3",
        "mp3"
      ],
      [
        "audio/x-mpegurl",
        "m3u"
      ],
      [
        "audio/x-mpequrl",
        "m3u"
      ],
      [
        "audio/x-ms-wax",
        "wax"
      ],
      [
        "audio/x-ms-wma",
        "wma"
      ],
      [
        "audio/x-nspaudio",
        [
          "la",
          "lma"
        ]
      ],
      [
        "audio/x-pn-realaudio",
        [
          "ra",
          "ram",
          "rm",
          "rmm",
          "rmp"
        ]
      ],
      [
        "audio/x-pn-realaudio-plugin",
        [
          "ra",
          "rmp",
          "rpm"
        ]
      ],
      [
        "audio/x-psid",
        "sid"
      ],
      [
        "audio/x-realaudio",
        "ra"
      ],
      [
        "audio/x-twinvq",
        "vqf"
      ],
      [
        "audio/x-twinvq-plugin",
        [
          "vqe",
          "vql"
        ]
      ],
      [
        "audio/x-vnd.audioexplosion.mjuicemediafile",
        "mjf"
      ],
      [
        "audio/x-voc",
        "voc"
      ],
      [
        "audio/x-wav",
        "wav"
      ],
      [
        "audio/xm",
        "xm"
      ],
      [
        "chemical/x-cdx",
        "cdx"
      ],
      [
        "chemical/x-cif",
        "cif"
      ],
      [
        "chemical/x-cmdf",
        "cmdf"
      ],
      [
        "chemical/x-cml",
        "cml"
      ],
      [
        "chemical/x-csml",
        "csml"
      ],
      [
        "chemical/x-pdb",
        [
          "pdb",
          "xyz"
        ]
      ],
      [
        "chemical/x-xyz",
        "xyz"
      ],
      [
        "drawing/x-dwf",
        "dwf"
      ],
      [
        "i-world/i-vrml",
        "ivr"
      ],
      [
        "image/bmp",
        [
          "bmp",
          "bm"
        ]
      ],
      [
        "image/cgm",
        "cgm"
      ],
      [
        "image/cis-cod",
        "cod"
      ],
      [
        "image/cmu-raster",
        [
          "ras",
          "rast"
        ]
      ],
      [
        "image/fif",
        "fif"
      ],
      [
        "image/florian",
        [
          "flo",
          "turbot"
        ]
      ],
      [
        "image/g3fax",
        "g3"
      ],
      [
        "image/gif",
        "gif"
      ],
      [
        "image/ief",
        [
          "ief",
          "iefs"
        ]
      ],
      [
        "image/jpeg",
        [
          "jpeg",
          "jpe",
          "jpg",
          "jfif",
          "jfif-tbnl"
        ]
      ],
      [
        "image/jutvision",
        "jut"
      ],
      [
        "image/ktx",
        "ktx"
      ],
      [
        "image/naplps",
        [
          "nap",
          "naplps"
        ]
      ],
      [
        "image/pict",
        [
          "pic",
          "pict"
        ]
      ],
      [
        "image/pipeg",
        "jfif"
      ],
      [
        "image/pjpeg",
        [
          "jfif",
          "jpe",
          "jpeg",
          "jpg"
        ]
      ],
      [
        "image/png",
        [
          "png",
          "x-png"
        ]
      ],
      [
        "image/prs.btif",
        "btif"
      ],
      [
        "image/svg+xml",
        "svg"
      ],
      [
        "image/tiff",
        [
          "tif",
          "tiff"
        ]
      ],
      [
        "image/vasa",
        "mcf"
      ],
      [
        "image/vnd.adobe.photoshop",
        "psd"
      ],
      [
        "image/vnd.dece.graphic",
        "uvi"
      ],
      [
        "image/vnd.djvu",
        "djvu"
      ],
      [
        "image/vnd.dvb.subtitle",
        "sub"
      ],
      [
        "image/vnd.dwg",
        [
          "dwg",
          "dxf",
          "svf"
        ]
      ],
      [
        "image/vnd.dxf",
        "dxf"
      ],
      [
        "image/vnd.fastbidsheet",
        "fbs"
      ],
      [
        "image/vnd.fpx",
        "fpx"
      ],
      [
        "image/vnd.fst",
        "fst"
      ],
      [
        "image/vnd.fujixerox.edmics-mmr",
        "mmr"
      ],
      [
        "image/vnd.fujixerox.edmics-rlc",
        "rlc"
      ],
      [
        "image/vnd.ms-modi",
        "mdi"
      ],
      [
        "image/vnd.net-fpx",
        [
          "fpx",
          "npx"
        ]
      ],
      [
        "image/vnd.rn-realflash",
        "rf"
      ],
      [
        "image/vnd.rn-realpix",
        "rp"
      ],
      [
        "image/vnd.wap.wbmp",
        "wbmp"
      ],
      [
        "image/vnd.xiff",
        "xif"
      ],
      [
        "image/webp",
        "webp"
      ],
      [
        "image/x-cmu-raster",
        "ras"
      ],
      [
        "image/x-cmx",
        "cmx"
      ],
      [
        "image/x-dwg",
        [
          "dwg",
          "dxf",
          "svf"
        ]
      ],
      [
        "image/x-freehand",
        "fh"
      ],
      [
        "image/x-icon",
        "ico"
      ],
      [
        "image/x-jg",
        "art"
      ],
      [
        "image/x-jps",
        "jps"
      ],
      [
        "image/x-niff",
        [
          "niff",
          "nif"
        ]
      ],
      [
        "image/x-pcx",
        "pcx"
      ],
      [
        "image/x-pict",
        [
          "pct",
          "pic"
        ]
      ],
      [
        "image/x-portable-anymap",
        "pnm"
      ],
      [
        "image/x-portable-bitmap",
        "pbm"
      ],
      [
        "image/x-portable-graymap",
        "pgm"
      ],
      [
        "image/x-portable-greymap",
        "pgm"
      ],
      [
        "image/x-portable-pixmap",
        "ppm"
      ],
      [
        "image/x-quicktime",
        [
          "qif",
          "qti",
          "qtif"
        ]
      ],
      [
        "image/x-rgb",
        "rgb"
      ],
      [
        "image/x-tiff",
        [
          "tif",
          "tiff"
        ]
      ],
      [
        "image/x-windows-bmp",
        "bmp"
      ],
      [
        "image/x-xbitmap",
        "xbm"
      ],
      [
        "image/x-xbm",
        "xbm"
      ],
      [
        "image/x-xpixmap",
        [
          "xpm",
          "pm"
        ]
      ],
      [
        "image/x-xwd",
        "xwd"
      ],
      [
        "image/x-xwindowdump",
        "xwd"
      ],
      [
        "image/xbm",
        "xbm"
      ],
      [
        "image/xpm",
        "xpm"
      ],
      [
        "message/rfc822",
        [
          "eml",
          "mht",
          "mhtml",
          "nws",
          "mime"
        ]
      ],
      [
        "model/iges",
        [
          "iges",
          "igs"
        ]
      ],
      [
        "model/mesh",
        "msh"
      ],
      [
        "model/vnd.collada+xml",
        "dae"
      ],
      [
        "model/vnd.dwf",
        "dwf"
      ],
      [
        "model/vnd.gdl",
        "gdl"
      ],
      [
        "model/vnd.gtw",
        "gtw"
      ],
      [
        "model/vnd.mts",
        "mts"
      ],
      [
        "model/vnd.vtu",
        "vtu"
      ],
      [
        "model/vrml",
        [
          "vrml",
          "wrl",
          "wrz"
        ]
      ],
      [
        "model/x-pov",
        "pov"
      ],
      [
        "multipart/x-gzip",
        "gzip"
      ],
      [
        "multipart/x-ustar",
        "ustar"
      ],
      [
        "multipart/x-zip",
        "zip"
      ],
      [
        "music/crescendo",
        [
          "mid",
          "midi"
        ]
      ],
      [
        "music/x-karaoke",
        "kar"
      ],
      [
        "paleovu/x-pv",
        "pvu"
      ],
      [
        "text/asp",
        "asp"
      ],
      [
        "text/calendar",
        "ics"
      ],
      [
        "text/css",
        "css"
      ],
      [
        "text/csv",
        "csv"
      ],
      [
        "text/ecmascript",
        "js"
      ],
      [
        "text/h323",
        "323"
      ],
      [
        "text/html",
        [
          "html",
          "htm",
          "stm",
          "acgi",
          "htmls",
          "htx",
          "shtml"
        ]
      ],
      [
        "text/iuls",
        "uls"
      ],
      [
        "text/javascript",
        "js"
      ],
      [
        "text/mcf",
        "mcf"
      ],
      [
        "text/n3",
        "n3"
      ],
      [
        "text/pascal",
        "pas"
      ],
      [
        "text/plain",
        [
          "txt",
          "bas",
          "c",
          "h",
          "c++",
          "cc",
          "com",
          "conf",
          "cxx",
          "def",
          "f",
          "f90",
          "for",
          "g",
          "hh",
          "idc",
          "jav",
          "java",
          "list",
          "log",
          "lst",
          "m",
          "mar",
          "pl",
          "sdml",
          "text"
        ]
      ],
      [
        "text/plain-bas",
        "par"
      ],
      [
        "text/prs.lines.tag",
        "dsc"
      ],
      [
        "text/richtext",
        [
          "rtx",
          "rt",
          "rtf"
        ]
      ],
      [
        "text/scriplet",
        "wsc"
      ],
      [
        "text/scriptlet",
        "sct"
      ],
      [
        "text/sgml",
        [
          "sgm",
          "sgml"
        ]
      ],
      [
        "text/tab-separated-values",
        "tsv"
      ],
      [
        "text/troff",
        "t"
      ],
      [
        "text/turtle",
        "ttl"
      ],
      [
        "text/uri-list",
        [
          "uni",
          "unis",
          "uri",
          "uris"
        ]
      ],
      [
        "text/vnd.abc",
        "abc"
      ],
      [
        "text/vnd.curl",
        "curl"
      ],
      [
        "text/vnd.curl.dcurl",
        "dcurl"
      ],
      [
        "text/vnd.curl.mcurl",
        "mcurl"
      ],
      [
        "text/vnd.curl.scurl",
        "scurl"
      ],
      [
        "text/vnd.fly",
        "fly"
      ],
      [
        "text/vnd.fmi.flexstor",
        "flx"
      ],
      [
        "text/vnd.graphviz",
        "gv"
      ],
      [
        "text/vnd.in3d.3dml",
        "3dml"
      ],
      [
        "text/vnd.in3d.spot",
        "spot"
      ],
      [
        "text/vnd.rn-realtext",
        "rt"
      ],
      [
        "text/vnd.sun.j2me.app-descriptor",
        "jad"
      ],
      [
        "text/vnd.wap.wml",
        "wml"
      ],
      [
        "text/vnd.wap.wmlscript",
        "wmls"
      ],
      [
        "text/webviewhtml",
        "htt"
      ],
      [
        "text/x-asm",
        [
          "asm",
          "s"
        ]
      ],
      [
        "text/x-audiosoft-intra",
        "aip"
      ],
      [
        "text/x-c",
        [
          "c",
          "cc",
          "cpp"
        ]
      ],
      [
        "text/x-component",
        "htc"
      ],
      [
        "text/x-fortran",
        [
          "for",
          "f",
          "f77",
          "f90"
        ]
      ],
      [
        "text/x-h",
        [
          "h",
          "hh"
        ]
      ],
      [
        "text/x-java-source",
        [
          "java",
          "jav"
        ]
      ],
      [
        "text/x-java-source,java",
        "java"
      ],
      [
        "text/x-la-asf",
        "lsx"
      ],
      [
        "text/x-m",
        "m"
      ],
      [
        "text/x-pascal",
        "p"
      ],
      [
        "text/x-script",
        "hlb"
      ],
      [
        "text/x-script.csh",
        "csh"
      ],
      [
        "text/x-script.elisp",
        "el"
      ],
      [
        "text/x-script.guile",
        "scm"
      ],
      [
        "text/x-script.ksh",
        "ksh"
      ],
      [
        "text/x-script.lisp",
        "lsp"
      ],
      [
        "text/x-script.perl",
        "pl"
      ],
      [
        "text/x-script.perl-module",
        "pm"
      ],
      [
        "text/x-script.phyton",
        "py"
      ],
      [
        "text/x-script.rexx",
        "rexx"
      ],
      [
        "text/x-script.scheme",
        "scm"
      ],
      [
        "text/x-script.sh",
        "sh"
      ],
      [
        "text/x-script.tcl",
        "tcl"
      ],
      [
        "text/x-script.tcsh",
        "tcsh"
      ],
      [
        "text/x-script.zsh",
        "zsh"
      ],
      [
        "text/x-server-parsed-html",
        [
          "shtml",
          "ssi"
        ]
      ],
      [
        "text/x-setext",
        "etx"
      ],
      [
        "text/x-sgml",
        [
          "sgm",
          "sgml"
        ]
      ],
      [
        "text/x-speech",
        [
          "spc",
          "talk"
        ]
      ],
      [
        "text/x-uil",
        "uil"
      ],
      [
        "text/x-uuencode",
        [
          "uu",
          "uue"
        ]
      ],
      [
        "text/x-vcalendar",
        "vcs"
      ],
      [
        "text/x-vcard",
        "vcf"
      ],
      [
        "text/xml",
        "xml"
      ],
      [
        "video/3gpp",
        "3gp"
      ],
      [
        "video/3gpp2",
        "3g2"
      ],
      [
        "video/animaflex",
        "afl"
      ],
      [
        "video/avi",
        "avi"
      ],
      [
        "video/avs-video",
        "avs"
      ],
      [
        "video/dl",
        "dl"
      ],
      [
        "video/fli",
        "fli"
      ],
      [
        "video/gl",
        "gl"
      ],
      [
        "video/h261",
        "h261"
      ],
      [
        "video/h263",
        "h263"
      ],
      [
        "video/h264",
        "h264"
      ],
      [
        "video/jpeg",
        "jpgv"
      ],
      [
        "video/jpm",
        "jpm"
      ],
      [
        "video/mj2",
        "mj2"
      ],
      [
        "video/mp4",
        "mp4"
      ],
      [
        "video/mpeg",
        [
          "mpeg",
          "mp2",
          "mpa",
          "mpe",
          "mpg",
          "mpv2",
          "m1v",
          "m2v",
          "mp3"
        ]
      ],
      [
        "video/msvideo",
        "avi"
      ],
      [
        "video/ogg",
        "ogv"
      ],
      [
        "video/quicktime",
        [
          "mov",
          "qt",
          "moov"
        ]
      ],
      [
        "video/vdo",
        "vdo"
      ],
      [
        "video/vivo",
        [
          "viv",
          "vivo"
        ]
      ],
      [
        "video/vnd.dece.hd",
        "uvh"
      ],
      [
        "video/vnd.dece.mobile",
        "uvm"
      ],
      [
        "video/vnd.dece.pd",
        "uvp"
      ],
      [
        "video/vnd.dece.sd",
        "uvs"
      ],
      [
        "video/vnd.dece.video",
        "uvv"
      ],
      [
        "video/vnd.fvt",
        "fvt"
      ],
      [
        "video/vnd.mpegurl",
        "mxu"
      ],
      [
        "video/vnd.ms-playready.media.pyv",
        "pyv"
      ],
      [
        "video/vnd.rn-realvideo",
        "rv"
      ],
      [
        "video/vnd.uvvu.mp4",
        "uvu"
      ],
      [
        "video/vnd.vivo",
        [
          "viv",
          "vivo"
        ]
      ],
      [
        "video/vosaic",
        "vos"
      ],
      [
        "video/webm",
        "webm"
      ],
      [
        "video/x-amt-demorun",
        "xdr"
      ],
      [
        "video/x-amt-showrun",
        "xsr"
      ],
      [
        "video/x-atomic3d-feature",
        "fmf"
      ],
      [
        "video/x-dl",
        "dl"
      ],
      [
        "video/x-dv",
        [
          "dif",
          "dv"
        ]
      ],
      [
        "video/x-f4v",
        "f4v"
      ],
      [
        "video/x-fli",
        "fli"
      ],
      [
        "video/x-flv",
        "flv"
      ],
      [
        "video/x-gl",
        "gl"
      ],
      [
        "video/x-isvideo",
        "isu"
      ],
      [
        "video/x-la-asf",
        [
          "lsf",
          "lsx"
        ]
      ],
      [
        "video/x-m4v",
        "m4v"
      ],
      [
        "video/x-motion-jpeg",
        "mjpg"
      ],
      [
        "video/x-mpeg",
        [
          "mp3",
          "mp2"
        ]
      ],
      [
        "video/x-mpeq2a",
        "mp2"
      ],
      [
        "video/x-ms-asf",
        [
          "asf",
          "asr",
          "asx"
        ]
      ],
      [
        "video/x-ms-asf-plugin",
        "asx"
      ],
      [
        "video/x-ms-wm",
        "wm"
      ],
      [
        "video/x-ms-wmv",
        "wmv"
      ],
      [
        "video/x-ms-wmx",
        "wmx"
      ],
      [
        "video/x-ms-wvx",
        "wvx"
      ],
      [
        "video/x-msvideo",
        "avi"
      ],
      [
        "video/x-qtc",
        "qtc"
      ],
      [
        "video/x-scm",
        "scm"
      ],
      [
        "video/x-sgi-movie",
        [
          "movie",
          "mv"
        ]
      ],
      [
        "windows/metafile",
        "wmf"
      ],
      [
        "www/mime",
        "mime"
      ],
      [
        "x-conference/x-cooltalk",
        "ice"
      ],
      [
        "x-music/x-midi",
        [
          "mid",
          "midi"
        ]
      ],
      [
        "x-world/x-3dmf",
        [
          "3dm",
          "3dmf",
          "qd3",
          "qd3d"
        ]
      ],
      [
        "x-world/x-svr",
        "svr"
      ],
      [
        "x-world/x-vrml",
        [
          "flr",
          "vrml",
          "wrl",
          "wrz",
          "xaf",
          "xof"
        ]
      ],
      [
        "x-world/x-vrt",
        "vrt"
      ],
      [
        "xgl/drawing",
        "xgz"
      ],
      [
        "xgl/movie",
        "xmz"
      ]
    ]);
    var extensions = /* @__PURE__ */ new Map([
      [
        "123",
        "application/vnd.lotus-1-2-3"
      ],
      [
        "323",
        "text/h323"
      ],
      [
        "*",
        "application/octet-stream"
      ],
      [
        "3dm",
        "x-world/x-3dmf"
      ],
      [
        "3dmf",
        "x-world/x-3dmf"
      ],
      [
        "3dml",
        "text/vnd.in3d.3dml"
      ],
      [
        "3g2",
        "video/3gpp2"
      ],
      [
        "3gp",
        "video/3gpp"
      ],
      [
        "7z",
        "application/x-7z-compressed"
      ],
      [
        "a",
        "application/octet-stream"
      ],
      [
        "aab",
        "application/x-authorware-bin"
      ],
      [
        "aac",
        "audio/x-aac"
      ],
      [
        "aam",
        "application/x-authorware-map"
      ],
      [
        "aas",
        "application/x-authorware-seg"
      ],
      [
        "abc",
        "text/vnd.abc"
      ],
      [
        "abw",
        "application/x-abiword"
      ],
      [
        "ac",
        "application/pkix-attr-cert"
      ],
      [
        "acc",
        "application/vnd.americandynamics.acc"
      ],
      [
        "ace",
        "application/x-ace-compressed"
      ],
      [
        "acgi",
        "text/html"
      ],
      [
        "acu",
        "application/vnd.acucobol"
      ],
      [
        "acx",
        "application/internet-property-stream"
      ],
      [
        "adp",
        "audio/adpcm"
      ],
      [
        "aep",
        "application/vnd.audiograph"
      ],
      [
        "afl",
        "video/animaflex"
      ],
      [
        "afp",
        "application/vnd.ibm.modcap"
      ],
      [
        "ahead",
        "application/vnd.ahead.space"
      ],
      [
        "ai",
        "application/postscript"
      ],
      [
        "aif",
        [
          "audio/aiff",
          "audio/x-aiff"
        ]
      ],
      [
        "aifc",
        [
          "audio/aiff",
          "audio/x-aiff"
        ]
      ],
      [
        "aiff",
        [
          "audio/aiff",
          "audio/x-aiff"
        ]
      ],
      [
        "aim",
        "application/x-aim"
      ],
      [
        "aip",
        "text/x-audiosoft-intra"
      ],
      [
        "air",
        "application/vnd.adobe.air-application-installer-package+zip"
      ],
      [
        "ait",
        "application/vnd.dvb.ait"
      ],
      [
        "ami",
        "application/vnd.amiga.ami"
      ],
      [
        "ani",
        "application/x-navi-animation"
      ],
      [
        "aos",
        "application/x-nokia-9000-communicator-add-on-software"
      ],
      [
        "apk",
        "application/vnd.android.package-archive"
      ],
      [
        "application",
        "application/x-ms-application"
      ],
      [
        "apr",
        "application/vnd.lotus-approach"
      ],
      [
        "aps",
        "application/mime"
      ],
      [
        "arc",
        "application/octet-stream"
      ],
      [
        "arj",
        [
          "application/arj",
          "application/octet-stream"
        ]
      ],
      [
        "art",
        "image/x-jg"
      ],
      [
        "asf",
        "video/x-ms-asf"
      ],
      [
        "asm",
        "text/x-asm"
      ],
      [
        "aso",
        "application/vnd.accpac.simply.aso"
      ],
      [
        "asp",
        "text/asp"
      ],
      [
        "asr",
        "video/x-ms-asf"
      ],
      [
        "asx",
        [
          "video/x-ms-asf",
          "application/x-mplayer2",
          "video/x-ms-asf-plugin"
        ]
      ],
      [
        "atc",
        "application/vnd.acucorp"
      ],
      [
        "atomcat",
        "application/atomcat+xml"
      ],
      [
        "atomsvc",
        "application/atomsvc+xml"
      ],
      [
        "atx",
        "application/vnd.antix.game-component"
      ],
      [
        "au",
        [
          "audio/basic",
          "audio/x-au"
        ]
      ],
      [
        "avi",
        [
          "video/avi",
          "video/msvideo",
          "application/x-troff-msvideo",
          "video/x-msvideo"
        ]
      ],
      [
        "avs",
        "video/avs-video"
      ],
      [
        "aw",
        "application/applixware"
      ],
      [
        "axs",
        "application/olescript"
      ],
      [
        "azf",
        "application/vnd.airzip.filesecure.azf"
      ],
      [
        "azs",
        "application/vnd.airzip.filesecure.azs"
      ],
      [
        "azw",
        "application/vnd.amazon.ebook"
      ],
      [
        "bas",
        "text/plain"
      ],
      [
        "bcpio",
        "application/x-bcpio"
      ],
      [
        "bdf",
        "application/x-font-bdf"
      ],
      [
        "bdm",
        "application/vnd.syncml.dm+wbxml"
      ],
      [
        "bed",
        "application/vnd.realvnc.bed"
      ],
      [
        "bh2",
        "application/vnd.fujitsu.oasysprs"
      ],
      [
        "bin",
        [
          "application/octet-stream",
          "application/mac-binary",
          "application/macbinary",
          "application/x-macbinary",
          "application/x-binary"
        ]
      ],
      [
        "bm",
        "image/bmp"
      ],
      [
        "bmi",
        "application/vnd.bmi"
      ],
      [
        "bmp",
        [
          "image/bmp",
          "image/x-windows-bmp"
        ]
      ],
      [
        "boo",
        "application/book"
      ],
      [
        "book",
        "application/book"
      ],
      [
        "box",
        "application/vnd.previewsystems.box"
      ],
      [
        "boz",
        "application/x-bzip2"
      ],
      [
        "bsh",
        "application/x-bsh"
      ],
      [
        "btif",
        "image/prs.btif"
      ],
      [
        "bz",
        "application/x-bzip"
      ],
      [
        "bz2",
        "application/x-bzip2"
      ],
      [
        "c",
        [
          "text/plain",
          "text/x-c"
        ]
      ],
      [
        "c++",
        "text/plain"
      ],
      [
        "c11amc",
        "application/vnd.cluetrust.cartomobile-config"
      ],
      [
        "c11amz",
        "application/vnd.cluetrust.cartomobile-config-pkg"
      ],
      [
        "c4g",
        "application/vnd.clonk.c4group"
      ],
      [
        "cab",
        "application/vnd.ms-cab-compressed"
      ],
      [
        "car",
        "application/vnd.curl.car"
      ],
      [
        "cat",
        [
          "application/vnd.ms-pkiseccat",
          "application/vnd.ms-pki.seccat"
        ]
      ],
      [
        "cc",
        [
          "text/plain",
          "text/x-c"
        ]
      ],
      [
        "ccad",
        "application/clariscad"
      ],
      [
        "cco",
        "application/x-cocoa"
      ],
      [
        "ccxml",
        "application/ccxml+xml,"
      ],
      [
        "cdbcmsg",
        "application/vnd.contact.cmsg"
      ],
      [
        "cdf",
        [
          "application/cdf",
          "application/x-cdf",
          "application/x-netcdf"
        ]
      ],
      [
        "cdkey",
        "application/vnd.mediastation.cdkey"
      ],
      [
        "cdmia",
        "application/cdmi-capability"
      ],
      [
        "cdmic",
        "application/cdmi-container"
      ],
      [
        "cdmid",
        "application/cdmi-domain"
      ],
      [
        "cdmio",
        "application/cdmi-object"
      ],
      [
        "cdmiq",
        "application/cdmi-queue"
      ],
      [
        "cdx",
        "chemical/x-cdx"
      ],
      [
        "cdxml",
        "application/vnd.chemdraw+xml"
      ],
      [
        "cdy",
        "application/vnd.cinderella"
      ],
      [
        "cer",
        [
          "application/pkix-cert",
          "application/x-x509-ca-cert"
        ]
      ],
      [
        "cgm",
        "image/cgm"
      ],
      [
        "cha",
        "application/x-chat"
      ],
      [
        "chat",
        "application/x-chat"
      ],
      [
        "chm",
        "application/vnd.ms-htmlhelp"
      ],
      [
        "chrt",
        "application/vnd.kde.kchart"
      ],
      [
        "cif",
        "chemical/x-cif"
      ],
      [
        "cii",
        "application/vnd.anser-web-certificate-issue-initiation"
      ],
      [
        "cil",
        "application/vnd.ms-artgalry"
      ],
      [
        "cla",
        "application/vnd.claymore"
      ],
      [
        "class",
        [
          "application/octet-stream",
          "application/java",
          "application/java-byte-code",
          "application/java-vm",
          "application/x-java-class"
        ]
      ],
      [
        "clkk",
        "application/vnd.crick.clicker.keyboard"
      ],
      [
        "clkp",
        "application/vnd.crick.clicker.palette"
      ],
      [
        "clkt",
        "application/vnd.crick.clicker.template"
      ],
      [
        "clkw",
        "application/vnd.crick.clicker.wordbank"
      ],
      [
        "clkx",
        "application/vnd.crick.clicker"
      ],
      [
        "clp",
        "application/x-msclip"
      ],
      [
        "cmc",
        "application/vnd.cosmocaller"
      ],
      [
        "cmdf",
        "chemical/x-cmdf"
      ],
      [
        "cml",
        "chemical/x-cml"
      ],
      [
        "cmp",
        "application/vnd.yellowriver-custom-menu"
      ],
      [
        "cmx",
        "image/x-cmx"
      ],
      [
        "cod",
        [
          "image/cis-cod",
          "application/vnd.rim.cod"
        ]
      ],
      [
        "com",
        [
          "application/octet-stream",
          "text/plain"
        ]
      ],
      [
        "conf",
        "text/plain"
      ],
      [
        "cpio",
        "application/x-cpio"
      ],
      [
        "cpp",
        "text/x-c"
      ],
      [
        "cpt",
        [
          "application/mac-compactpro",
          "application/x-compactpro",
          "application/x-cpt"
        ]
      ],
      [
        "crd",
        "application/x-mscardfile"
      ],
      [
        "crl",
        [
          "application/pkix-crl",
          "application/pkcs-crl"
        ]
      ],
      [
        "crt",
        [
          "application/pkix-cert",
          "application/x-x509-user-cert",
          "application/x-x509-ca-cert"
        ]
      ],
      [
        "cryptonote",
        "application/vnd.rig.cryptonote"
      ],
      [
        "csh",
        [
          "text/x-script.csh",
          "application/x-csh"
        ]
      ],
      [
        "csml",
        "chemical/x-csml"
      ],
      [
        "csp",
        "application/vnd.commonspace"
      ],
      [
        "css",
        [
          "text/css",
          "application/x-pointplus"
        ]
      ],
      [
        "csv",
        "text/csv"
      ],
      [
        "cu",
        "application/cu-seeme"
      ],
      [
        "curl",
        "text/vnd.curl"
      ],
      [
        "cww",
        "application/prs.cww"
      ],
      [
        "cxx",
        "text/plain"
      ],
      [
        "dae",
        "model/vnd.collada+xml"
      ],
      [
        "daf",
        "application/vnd.mobius.daf"
      ],
      [
        "davmount",
        "application/davmount+xml"
      ],
      [
        "dcr",
        "application/x-director"
      ],
      [
        "dcurl",
        "text/vnd.curl.dcurl"
      ],
      [
        "dd2",
        "application/vnd.oma.dd2+xml"
      ],
      [
        "ddd",
        "application/vnd.fujixerox.ddd"
      ],
      [
        "deb",
        "application/x-debian-package"
      ],
      [
        "deepv",
        "application/x-deepv"
      ],
      [
        "def",
        "text/plain"
      ],
      [
        "der",
        "application/x-x509-ca-cert"
      ],
      [
        "dfac",
        "application/vnd.dreamfactory"
      ],
      [
        "dif",
        "video/x-dv"
      ],
      [
        "dir",
        "application/x-director"
      ],
      [
        "dis",
        "application/vnd.mobius.dis"
      ],
      [
        "djvu",
        "image/vnd.djvu"
      ],
      [
        "dl",
        [
          "video/dl",
          "video/x-dl"
        ]
      ],
      [
        "dll",
        "application/x-msdownload"
      ],
      [
        "dms",
        "application/octet-stream"
      ],
      [
        "dna",
        "application/vnd.dna"
      ],
      [
        "doc",
        "application/msword"
      ],
      [
        "docm",
        "application/vnd.ms-word.document.macroenabled.12"
      ],
      [
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ],
      [
        "dot",
        "application/msword"
      ],
      [
        "dotm",
        "application/vnd.ms-word.template.macroenabled.12"
      ],
      [
        "dotx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.template"
      ],
      [
        "dp",
        [
          "application/commonground",
          "application/vnd.osgi.dp"
        ]
      ],
      [
        "dpg",
        "application/vnd.dpgraph"
      ],
      [
        "dra",
        "audio/vnd.dra"
      ],
      [
        "drw",
        "application/drafting"
      ],
      [
        "dsc",
        "text/prs.lines.tag"
      ],
      [
        "dssc",
        "application/dssc+der"
      ],
      [
        "dtb",
        "application/x-dtbook+xml"
      ],
      [
        "dtd",
        "application/xml-dtd"
      ],
      [
        "dts",
        "audio/vnd.dts"
      ],
      [
        "dtshd",
        "audio/vnd.dts.hd"
      ],
      [
        "dump",
        "application/octet-stream"
      ],
      [
        "dv",
        "video/x-dv"
      ],
      [
        "dvi",
        "application/x-dvi"
      ],
      [
        "dwf",
        [
          "model/vnd.dwf",
          "drawing/x-dwf"
        ]
      ],
      [
        "dwg",
        [
          "application/acad",
          "image/vnd.dwg",
          "image/x-dwg"
        ]
      ],
      [
        "dxf",
        [
          "application/dxf",
          "image/vnd.dwg",
          "image/vnd.dxf",
          "image/x-dwg"
        ]
      ],
      [
        "dxp",
        "application/vnd.spotfire.dxp"
      ],
      [
        "dxr",
        "application/x-director"
      ],
      [
        "ecelp4800",
        "audio/vnd.nuera.ecelp4800"
      ],
      [
        "ecelp7470",
        "audio/vnd.nuera.ecelp7470"
      ],
      [
        "ecelp9600",
        "audio/vnd.nuera.ecelp9600"
      ],
      [
        "edm",
        "application/vnd.novadigm.edm"
      ],
      [
        "edx",
        "application/vnd.novadigm.edx"
      ],
      [
        "efif",
        "application/vnd.picsel"
      ],
      [
        "ei6",
        "application/vnd.pg.osasli"
      ],
      [
        "el",
        "text/x-script.elisp"
      ],
      [
        "elc",
        [
          "application/x-elc",
          "application/x-bytecode.elisp"
        ]
      ],
      [
        "eml",
        "message/rfc822"
      ],
      [
        "emma",
        "application/emma+xml"
      ],
      [
        "env",
        "application/x-envoy"
      ],
      [
        "eol",
        "audio/vnd.digital-winds"
      ],
      [
        "eot",
        "application/vnd.ms-fontobject"
      ],
      [
        "eps",
        "application/postscript"
      ],
      [
        "epub",
        "application/epub+zip"
      ],
      [
        "es",
        [
          "application/ecmascript",
          "application/x-esrehber"
        ]
      ],
      [
        "es3",
        "application/vnd.eszigno3+xml"
      ],
      [
        "esf",
        "application/vnd.epson.esf"
      ],
      [
        "etx",
        "text/x-setext"
      ],
      [
        "evy",
        [
          "application/envoy",
          "application/x-envoy"
        ]
      ],
      [
        "exe",
        [
          "application/octet-stream",
          "application/x-msdownload"
        ]
      ],
      [
        "exi",
        "application/exi"
      ],
      [
        "ext",
        "application/vnd.novadigm.ext"
      ],
      [
        "ez2",
        "application/vnd.ezpix-album"
      ],
      [
        "ez3",
        "application/vnd.ezpix-package"
      ],
      [
        "f",
        [
          "text/plain",
          "text/x-fortran"
        ]
      ],
      [
        "f4v",
        "video/x-f4v"
      ],
      [
        "f77",
        "text/x-fortran"
      ],
      [
        "f90",
        [
          "text/plain",
          "text/x-fortran"
        ]
      ],
      [
        "fbs",
        "image/vnd.fastbidsheet"
      ],
      [
        "fcs",
        "application/vnd.isac.fcs"
      ],
      [
        "fdf",
        "application/vnd.fdf"
      ],
      [
        "fe_launch",
        "application/vnd.denovo.fcselayout-link"
      ],
      [
        "fg5",
        "application/vnd.fujitsu.oasysgp"
      ],
      [
        "fh",
        "image/x-freehand"
      ],
      [
        "fif",
        [
          "application/fractals",
          "image/fif"
        ]
      ],
      [
        "fig",
        "application/x-xfig"
      ],
      [
        "fli",
        [
          "video/fli",
          "video/x-fli"
        ]
      ],
      [
        "flo",
        [
          "image/florian",
          "application/vnd.micrografx.flo"
        ]
      ],
      [
        "flr",
        "x-world/x-vrml"
      ],
      [
        "flv",
        "video/x-flv"
      ],
      [
        "flw",
        "application/vnd.kde.kivio"
      ],
      [
        "flx",
        "text/vnd.fmi.flexstor"
      ],
      [
        "fly",
        "text/vnd.fly"
      ],
      [
        "fm",
        "application/vnd.framemaker"
      ],
      [
        "fmf",
        "video/x-atomic3d-feature"
      ],
      [
        "fnc",
        "application/vnd.frogans.fnc"
      ],
      [
        "for",
        [
          "text/plain",
          "text/x-fortran"
        ]
      ],
      [
        "fpx",
        [
          "image/vnd.fpx",
          "image/vnd.net-fpx"
        ]
      ],
      [
        "frl",
        "application/freeloader"
      ],
      [
        "fsc",
        "application/vnd.fsc.weblaunch"
      ],
      [
        "fst",
        "image/vnd.fst"
      ],
      [
        "ftc",
        "application/vnd.fluxtime.clip"
      ],
      [
        "fti",
        "application/vnd.anser-web-funds-transfer-initiation"
      ],
      [
        "funk",
        "audio/make"
      ],
      [
        "fvt",
        "video/vnd.fvt"
      ],
      [
        "fxp",
        "application/vnd.adobe.fxp"
      ],
      [
        "fzs",
        "application/vnd.fuzzysheet"
      ],
      [
        "g",
        "text/plain"
      ],
      [
        "g2w",
        "application/vnd.geoplan"
      ],
      [
        "g3",
        "image/g3fax"
      ],
      [
        "g3w",
        "application/vnd.geospace"
      ],
      [
        "gac",
        "application/vnd.groove-account"
      ],
      [
        "gdl",
        "model/vnd.gdl"
      ],
      [
        "geo",
        "application/vnd.dynageo"
      ],
      [
        "gex",
        "application/vnd.geometry-explorer"
      ],
      [
        "ggb",
        "application/vnd.geogebra.file"
      ],
      [
        "ggt",
        "application/vnd.geogebra.tool"
      ],
      [
        "ghf",
        "application/vnd.groove-help"
      ],
      [
        "gif",
        "image/gif"
      ],
      [
        "gim",
        "application/vnd.groove-identity-message"
      ],
      [
        "gl",
        [
          "video/gl",
          "video/x-gl"
        ]
      ],
      [
        "gmx",
        "application/vnd.gmx"
      ],
      [
        "gnumeric",
        "application/x-gnumeric"
      ],
      [
        "gph",
        "application/vnd.flographit"
      ],
      [
        "gqf",
        "application/vnd.grafeq"
      ],
      [
        "gram",
        "application/srgs"
      ],
      [
        "grv",
        "application/vnd.groove-injector"
      ],
      [
        "grxml",
        "application/srgs+xml"
      ],
      [
        "gsd",
        "audio/x-gsm"
      ],
      [
        "gsf",
        "application/x-font-ghostscript"
      ],
      [
        "gsm",
        "audio/x-gsm"
      ],
      [
        "gsp",
        "application/x-gsp"
      ],
      [
        "gss",
        "application/x-gss"
      ],
      [
        "gtar",
        "application/x-gtar"
      ],
      [
        "gtm",
        "application/vnd.groove-tool-message"
      ],
      [
        "gtw",
        "model/vnd.gtw"
      ],
      [
        "gv",
        "text/vnd.graphviz"
      ],
      [
        "gxt",
        "application/vnd.geonext"
      ],
      [
        "gz",
        [
          "application/x-gzip",
          "application/x-compressed"
        ]
      ],
      [
        "gzip",
        [
          "multipart/x-gzip",
          "application/x-gzip"
        ]
      ],
      [
        "h",
        [
          "text/plain",
          "text/x-h"
        ]
      ],
      [
        "h261",
        "video/h261"
      ],
      [
        "h263",
        "video/h263"
      ],
      [
        "h264",
        "video/h264"
      ],
      [
        "hal",
        "application/vnd.hal+xml"
      ],
      [
        "hbci",
        "application/vnd.hbci"
      ],
      [
        "hdf",
        "application/x-hdf"
      ],
      [
        "help",
        "application/x-helpfile"
      ],
      [
        "hgl",
        "application/vnd.hp-hpgl"
      ],
      [
        "hh",
        [
          "text/plain",
          "text/x-h"
        ]
      ],
      [
        "hlb",
        "text/x-script"
      ],
      [
        "hlp",
        [
          "application/winhlp",
          "application/hlp",
          "application/x-helpfile",
          "application/x-winhelp"
        ]
      ],
      [
        "hpg",
        "application/vnd.hp-hpgl"
      ],
      [
        "hpgl",
        "application/vnd.hp-hpgl"
      ],
      [
        "hpid",
        "application/vnd.hp-hpid"
      ],
      [
        "hps",
        "application/vnd.hp-hps"
      ],
      [
        "hqx",
        [
          "application/mac-binhex40",
          "application/binhex",
          "application/binhex4",
          "application/mac-binhex",
          "application/x-binhex40",
          "application/x-mac-binhex40"
        ]
      ],
      [
        "hta",
        "application/hta"
      ],
      [
        "htc",
        "text/x-component"
      ],
      [
        "htke",
        "application/vnd.kenameaapp"
      ],
      [
        "htm",
        "text/html"
      ],
      [
        "html",
        "text/html"
      ],
      [
        "htmls",
        "text/html"
      ],
      [
        "htt",
        "text/webviewhtml"
      ],
      [
        "htx",
        "text/html"
      ],
      [
        "hvd",
        "application/vnd.yamaha.hv-dic"
      ],
      [
        "hvp",
        "application/vnd.yamaha.hv-voice"
      ],
      [
        "hvs",
        "application/vnd.yamaha.hv-script"
      ],
      [
        "i2g",
        "application/vnd.intergeo"
      ],
      [
        "icc",
        "application/vnd.iccprofile"
      ],
      [
        "ice",
        "x-conference/x-cooltalk"
      ],
      [
        "ico",
        "image/x-icon"
      ],
      [
        "ics",
        "text/calendar"
      ],
      [
        "idc",
        "text/plain"
      ],
      [
        "ief",
        "image/ief"
      ],
      [
        "iefs",
        "image/ief"
      ],
      [
        "ifm",
        "application/vnd.shana.informed.formdata"
      ],
      [
        "iges",
        [
          "application/iges",
          "model/iges"
        ]
      ],
      [
        "igl",
        "application/vnd.igloader"
      ],
      [
        "igm",
        "application/vnd.insors.igm"
      ],
      [
        "igs",
        [
          "application/iges",
          "model/iges"
        ]
      ],
      [
        "igx",
        "application/vnd.micrografx.igx"
      ],
      [
        "iif",
        "application/vnd.shana.informed.interchange"
      ],
      [
        "iii",
        "application/x-iphone"
      ],
      [
        "ima",
        "application/x-ima"
      ],
      [
        "imap",
        "application/x-httpd-imap"
      ],
      [
        "imp",
        "application/vnd.accpac.simply.imp"
      ],
      [
        "ims",
        "application/vnd.ms-ims"
      ],
      [
        "inf",
        "application/inf"
      ],
      [
        "ins",
        [
          "application/x-internet-signup",
          "application/x-internett-signup"
        ]
      ],
      [
        "ip",
        "application/x-ip2"
      ],
      [
        "ipfix",
        "application/ipfix"
      ],
      [
        "ipk",
        "application/vnd.shana.informed.package"
      ],
      [
        "irm",
        "application/vnd.ibm.rights-management"
      ],
      [
        "irp",
        "application/vnd.irepository.package+xml"
      ],
      [
        "isp",
        "application/x-internet-signup"
      ],
      [
        "isu",
        "video/x-isvideo"
      ],
      [
        "it",
        "audio/it"
      ],
      [
        "itp",
        "application/vnd.shana.informed.formtemplate"
      ],
      [
        "iv",
        "application/x-inventor"
      ],
      [
        "ivp",
        "application/vnd.immervision-ivp"
      ],
      [
        "ivr",
        "i-world/i-vrml"
      ],
      [
        "ivu",
        "application/vnd.immervision-ivu"
      ],
      [
        "ivy",
        "application/x-livescreen"
      ],
      [
        "jad",
        "text/vnd.sun.j2me.app-descriptor"
      ],
      [
        "jam",
        [
          "application/vnd.jam",
          "audio/x-jam"
        ]
      ],
      [
        "jar",
        "application/java-archive"
      ],
      [
        "jav",
        [
          "text/plain",
          "text/x-java-source"
        ]
      ],
      [
        "java",
        [
          "text/plain",
          "text/x-java-source,java",
          "text/x-java-source"
        ]
      ],
      [
        "jcm",
        "application/x-java-commerce"
      ],
      [
        "jfif",
        [
          "image/pipeg",
          "image/jpeg",
          "image/pjpeg"
        ]
      ],
      [
        "jfif-tbnl",
        "image/jpeg"
      ],
      [
        "jisp",
        "application/vnd.jisp"
      ],
      [
        "jlt",
        "application/vnd.hp-jlyt"
      ],
      [
        "jnlp",
        "application/x-java-jnlp-file"
      ],
      [
        "joda",
        "application/vnd.joost.joda-archive"
      ],
      [
        "jpe",
        [
          "image/jpeg",
          "image/pjpeg"
        ]
      ],
      [
        "jpeg",
        [
          "image/jpeg",
          "image/pjpeg"
        ]
      ],
      [
        "jpg",
        [
          "image/jpeg",
          "image/pjpeg"
        ]
      ],
      [
        "jpgv",
        "video/jpeg"
      ],
      [
        "jpm",
        "video/jpm"
      ],
      [
        "jps",
        "image/x-jps"
      ],
      [
        "js",
        [
          "application/javascript",
          "application/ecmascript",
          "text/javascript",
          "text/ecmascript",
          "application/x-javascript"
        ]
      ],
      [
        "json",
        "application/json"
      ],
      [
        "jut",
        "image/jutvision"
      ],
      [
        "kar",
        [
          "audio/midi",
          "music/x-karaoke"
        ]
      ],
      [
        "karbon",
        "application/vnd.kde.karbon"
      ],
      [
        "kfo",
        "application/vnd.kde.kformula"
      ],
      [
        "kia",
        "application/vnd.kidspiration"
      ],
      [
        "kml",
        "application/vnd.google-earth.kml+xml"
      ],
      [
        "kmz",
        "application/vnd.google-earth.kmz"
      ],
      [
        "kne",
        "application/vnd.kinar"
      ],
      [
        "kon",
        "application/vnd.kde.kontour"
      ],
      [
        "kpr",
        "application/vnd.kde.kpresenter"
      ],
      [
        "ksh",
        [
          "application/x-ksh",
          "text/x-script.ksh"
        ]
      ],
      [
        "ksp",
        "application/vnd.kde.kspread"
      ],
      [
        "ktx",
        "image/ktx"
      ],
      [
        "ktz",
        "application/vnd.kahootz"
      ],
      [
        "kwd",
        "application/vnd.kde.kword"
      ],
      [
        "la",
        [
          "audio/nspaudio",
          "audio/x-nspaudio"
        ]
      ],
      [
        "lam",
        "audio/x-liveaudio"
      ],
      [
        "lasxml",
        "application/vnd.las.las+xml"
      ],
      [
        "latex",
        "application/x-latex"
      ],
      [
        "lbd",
        "application/vnd.llamagraphics.life-balance.desktop"
      ],
      [
        "lbe",
        "application/vnd.llamagraphics.life-balance.exchange+xml"
      ],
      [
        "les",
        "application/vnd.hhe.lesson-player"
      ],
      [
        "lha",
        [
          "application/octet-stream",
          "application/lha",
          "application/x-lha"
        ]
      ],
      [
        "lhx",
        "application/octet-stream"
      ],
      [
        "link66",
        "application/vnd.route66.link66+xml"
      ],
      [
        "list",
        "text/plain"
      ],
      [
        "lma",
        [
          "audio/nspaudio",
          "audio/x-nspaudio"
        ]
      ],
      [
        "log",
        "text/plain"
      ],
      [
        "lrm",
        "application/vnd.ms-lrm"
      ],
      [
        "lsf",
        "video/x-la-asf"
      ],
      [
        "lsp",
        [
          "application/x-lisp",
          "text/x-script.lisp"
        ]
      ],
      [
        "lst",
        "text/plain"
      ],
      [
        "lsx",
        [
          "video/x-la-asf",
          "text/x-la-asf"
        ]
      ],
      [
        "ltf",
        "application/vnd.frogans.ltf"
      ],
      [
        "ltx",
        "application/x-latex"
      ],
      [
        "lvp",
        "audio/vnd.lucent.voice"
      ],
      [
        "lwp",
        "application/vnd.lotus-wordpro"
      ],
      [
        "lzh",
        [
          "application/octet-stream",
          "application/x-lzh"
        ]
      ],
      [
        "lzx",
        [
          "application/lzx",
          "application/octet-stream",
          "application/x-lzx"
        ]
      ],
      [
        "m",
        [
          "text/plain",
          "text/x-m"
        ]
      ],
      [
        "m13",
        "application/x-msmediaview"
      ],
      [
        "m14",
        "application/x-msmediaview"
      ],
      [
        "m1v",
        "video/mpeg"
      ],
      [
        "m21",
        "application/mp21"
      ],
      [
        "m2a",
        "audio/mpeg"
      ],
      [
        "m2v",
        "video/mpeg"
      ],
      [
        "m3u",
        [
          "audio/x-mpegurl",
          "audio/x-mpequrl"
        ]
      ],
      [
        "m3u8",
        "application/vnd.apple.mpegurl"
      ],
      [
        "m4v",
        "video/x-m4v"
      ],
      [
        "ma",
        "application/mathematica"
      ],
      [
        "mads",
        "application/mads+xml"
      ],
      [
        "mag",
        "application/vnd.ecowin.chart"
      ],
      [
        "man",
        "application/x-troff-man"
      ],
      [
        "map",
        "application/x-navimap"
      ],
      [
        "mar",
        "text/plain"
      ],
      [
        "mathml",
        "application/mathml+xml"
      ],
      [
        "mbd",
        "application/mbedlet"
      ],
      [
        "mbk",
        "application/vnd.mobius.mbk"
      ],
      [
        "mbox",
        "application/mbox"
      ],
      [
        "mc$",
        "application/x-magic-cap-package-1.0"
      ],
      [
        "mc1",
        "application/vnd.medcalcdata"
      ],
      [
        "mcd",
        [
          "application/mcad",
          "application/vnd.mcd",
          "application/x-mathcad"
        ]
      ],
      [
        "mcf",
        [
          "image/vasa",
          "text/mcf"
        ]
      ],
      [
        "mcp",
        "application/netmc"
      ],
      [
        "mcurl",
        "text/vnd.curl.mcurl"
      ],
      [
        "mdb",
        "application/x-msaccess"
      ],
      [
        "mdi",
        "image/vnd.ms-modi"
      ],
      [
        "me",
        "application/x-troff-me"
      ],
      [
        "meta4",
        "application/metalink4+xml"
      ],
      [
        "mets",
        "application/mets+xml"
      ],
      [
        "mfm",
        "application/vnd.mfmp"
      ],
      [
        "mgp",
        "application/vnd.osgeo.mapguide.package"
      ],
      [
        "mgz",
        "application/vnd.proteus.magazine"
      ],
      [
        "mht",
        "message/rfc822"
      ],
      [
        "mhtml",
        "message/rfc822"
      ],
      [
        "mid",
        [
          "audio/mid",
          "audio/midi",
          "music/crescendo",
          "x-music/x-midi",
          "audio/x-midi",
          "application/x-midi",
          "audio/x-mid"
        ]
      ],
      [
        "midi",
        [
          "audio/midi",
          "music/crescendo",
          "x-music/x-midi",
          "audio/x-midi",
          "application/x-midi",
          "audio/x-mid"
        ]
      ],
      [
        "mif",
        [
          "application/vnd.mif",
          "application/x-mif",
          "application/x-frame"
        ]
      ],
      [
        "mime",
        [
          "message/rfc822",
          "www/mime"
        ]
      ],
      [
        "mj2",
        "video/mj2"
      ],
      [
        "mjf",
        "audio/x-vnd.audioexplosion.mjuicemediafile"
      ],
      [
        "mjpg",
        "video/x-motion-jpeg"
      ],
      [
        "mlp",
        "application/vnd.dolby.mlp"
      ],
      [
        "mm",
        [
          "application/base64",
          "application/x-meme"
        ]
      ],
      [
        "mmd",
        "application/vnd.chipnuts.karaoke-mmd"
      ],
      [
        "mme",
        "application/base64"
      ],
      [
        "mmf",
        "application/vnd.smaf"
      ],
      [
        "mmr",
        "image/vnd.fujixerox.edmics-mmr"
      ],
      [
        "mny",
        "application/x-msmoney"
      ],
      [
        "mod",
        [
          "audio/mod",
          "audio/x-mod"
        ]
      ],
      [
        "mods",
        "application/mods+xml"
      ],
      [
        "moov",
        "video/quicktime"
      ],
      [
        "mov",
        "video/quicktime"
      ],
      [
        "movie",
        "video/x-sgi-movie"
      ],
      [
        "mp2",
        [
          "video/mpeg",
          "audio/mpeg",
          "video/x-mpeg",
          "audio/x-mpeg",
          "video/x-mpeq2a"
        ]
      ],
      [
        "mp3",
        [
          "audio/mpeg",
          "audio/mpeg3",
          "video/mpeg",
          "audio/x-mpeg-3",
          "video/x-mpeg"
        ]
      ],
      [
        "mp4",
        [
          "video/mp4",
          "application/mp4"
        ]
      ],
      [
        "mp4a",
        "audio/mp4"
      ],
      [
        "mpa",
        [
          "video/mpeg",
          "audio/mpeg"
        ]
      ],
      [
        "mpc",
        [
          "application/vnd.mophun.certificate",
          "application/x-project"
        ]
      ],
      [
        "mpe",
        "video/mpeg"
      ],
      [
        "mpeg",
        "video/mpeg"
      ],
      [
        "mpg",
        [
          "video/mpeg",
          "audio/mpeg"
        ]
      ],
      [
        "mpga",
        "audio/mpeg"
      ],
      [
        "mpkg",
        "application/vnd.apple.installer+xml"
      ],
      [
        "mpm",
        "application/vnd.blueice.multipass"
      ],
      [
        "mpn",
        "application/vnd.mophun.application"
      ],
      [
        "mpp",
        "application/vnd.ms-project"
      ],
      [
        "mpt",
        "application/x-project"
      ],
      [
        "mpv",
        "application/x-project"
      ],
      [
        "mpv2",
        "video/mpeg"
      ],
      [
        "mpx",
        "application/x-project"
      ],
      [
        "mpy",
        "application/vnd.ibm.minipay"
      ],
      [
        "mqy",
        "application/vnd.mobius.mqy"
      ],
      [
        "mrc",
        "application/marc"
      ],
      [
        "mrcx",
        "application/marcxml+xml"
      ],
      [
        "ms",
        "application/x-troff-ms"
      ],
      [
        "mscml",
        "application/mediaservercontrol+xml"
      ],
      [
        "mseq",
        "application/vnd.mseq"
      ],
      [
        "msf",
        "application/vnd.epson.msf"
      ],
      [
        "msg",
        "application/vnd.ms-outlook"
      ],
      [
        "msh",
        "model/mesh"
      ],
      [
        "msl",
        "application/vnd.mobius.msl"
      ],
      [
        "msty",
        "application/vnd.muvee.style"
      ],
      [
        "mts",
        "model/vnd.mts"
      ],
      [
        "mus",
        "application/vnd.musician"
      ],
      [
        "musicxml",
        "application/vnd.recordare.musicxml+xml"
      ],
      [
        "mv",
        "video/x-sgi-movie"
      ],
      [
        "mvb",
        "application/x-msmediaview"
      ],
      [
        "mwf",
        "application/vnd.mfer"
      ],
      [
        "mxf",
        "application/mxf"
      ],
      [
        "mxl",
        "application/vnd.recordare.musicxml"
      ],
      [
        "mxml",
        "application/xv+xml"
      ],
      [
        "mxs",
        "application/vnd.triscape.mxs"
      ],
      [
        "mxu",
        "video/vnd.mpegurl"
      ],
      [
        "my",
        "audio/make"
      ],
      [
        "mzz",
        "application/x-vnd.audioexplosion.mzz"
      ],
      [
        "n-gage",
        "application/vnd.nokia.n-gage.symbian.install"
      ],
      [
        "n3",
        "text/n3"
      ],
      [
        "nap",
        "image/naplps"
      ],
      [
        "naplps",
        "image/naplps"
      ],
      [
        "nbp",
        "application/vnd.wolfram.player"
      ],
      [
        "nc",
        "application/x-netcdf"
      ],
      [
        "ncm",
        "application/vnd.nokia.configuration-message"
      ],
      [
        "ncx",
        "application/x-dtbncx+xml"
      ],
      [
        "ngdat",
        "application/vnd.nokia.n-gage.data"
      ],
      [
        "nif",
        "image/x-niff"
      ],
      [
        "niff",
        "image/x-niff"
      ],
      [
        "nix",
        "application/x-mix-transfer"
      ],
      [
        "nlu",
        "application/vnd.neurolanguage.nlu"
      ],
      [
        "nml",
        "application/vnd.enliven"
      ],
      [
        "nnd",
        "application/vnd.noblenet-directory"
      ],
      [
        "nns",
        "application/vnd.noblenet-sealer"
      ],
      [
        "nnw",
        "application/vnd.noblenet-web"
      ],
      [
        "npx",
        "image/vnd.net-fpx"
      ],
      [
        "nsc",
        "application/x-conference"
      ],
      [
        "nsf",
        "application/vnd.lotus-notes"
      ],
      [
        "nvd",
        "application/x-navidoc"
      ],
      [
        "nws",
        "message/rfc822"
      ],
      [
        "o",
        "application/octet-stream"
      ],
      [
        "oa2",
        "application/vnd.fujitsu.oasys2"
      ],
      [
        "oa3",
        "application/vnd.fujitsu.oasys3"
      ],
      [
        "oas",
        "application/vnd.fujitsu.oasys"
      ],
      [
        "obd",
        "application/x-msbinder"
      ],
      [
        "oda",
        "application/oda"
      ],
      [
        "odb",
        "application/vnd.oasis.opendocument.database"
      ],
      [
        "odc",
        "application/vnd.oasis.opendocument.chart"
      ],
      [
        "odf",
        "application/vnd.oasis.opendocument.formula"
      ],
      [
        "odft",
        "application/vnd.oasis.opendocument.formula-template"
      ],
      [
        "odg",
        "application/vnd.oasis.opendocument.graphics"
      ],
      [
        "odi",
        "application/vnd.oasis.opendocument.image"
      ],
      [
        "odm",
        "application/vnd.oasis.opendocument.text-master"
      ],
      [
        "odp",
        "application/vnd.oasis.opendocument.presentation"
      ],
      [
        "ods",
        "application/vnd.oasis.opendocument.spreadsheet"
      ],
      [
        "odt",
        "application/vnd.oasis.opendocument.text"
      ],
      [
        "oga",
        "audio/ogg"
      ],
      [
        "ogv",
        "video/ogg"
      ],
      [
        "ogx",
        "application/ogg"
      ],
      [
        "omc",
        "application/x-omc"
      ],
      [
        "omcd",
        "application/x-omcdatamaker"
      ],
      [
        "omcr",
        "application/x-omcregerator"
      ],
      [
        "onetoc",
        "application/onenote"
      ],
      [
        "opf",
        "application/oebps-package+xml"
      ],
      [
        "org",
        "application/vnd.lotus-organizer"
      ],
      [
        "osf",
        "application/vnd.yamaha.openscoreformat"
      ],
      [
        "osfpvg",
        "application/vnd.yamaha.openscoreformat.osfpvg+xml"
      ],
      [
        "otc",
        "application/vnd.oasis.opendocument.chart-template"
      ],
      [
        "otf",
        "application/x-font-otf"
      ],
      [
        "otg",
        "application/vnd.oasis.opendocument.graphics-template"
      ],
      [
        "oth",
        "application/vnd.oasis.opendocument.text-web"
      ],
      [
        "oti",
        "application/vnd.oasis.opendocument.image-template"
      ],
      [
        "otp",
        "application/vnd.oasis.opendocument.presentation-template"
      ],
      [
        "ots",
        "application/vnd.oasis.opendocument.spreadsheet-template"
      ],
      [
        "ott",
        "application/vnd.oasis.opendocument.text-template"
      ],
      [
        "oxt",
        "application/vnd.openofficeorg.extension"
      ],
      [
        "p",
        "text/x-pascal"
      ],
      [
        "p10",
        [
          "application/pkcs10",
          "application/x-pkcs10"
        ]
      ],
      [
        "p12",
        [
          "application/pkcs-12",
          "application/x-pkcs12"
        ]
      ],
      [
        "p7a",
        "application/x-pkcs7-signature"
      ],
      [
        "p7b",
        "application/x-pkcs7-certificates"
      ],
      [
        "p7c",
        [
          "application/pkcs7-mime",
          "application/x-pkcs7-mime"
        ]
      ],
      [
        "p7m",
        [
          "application/pkcs7-mime",
          "application/x-pkcs7-mime"
        ]
      ],
      [
        "p7r",
        "application/x-pkcs7-certreqresp"
      ],
      [
        "p7s",
        [
          "application/pkcs7-signature",
          "application/x-pkcs7-signature"
        ]
      ],
      [
        "p8",
        "application/pkcs8"
      ],
      [
        "par",
        "text/plain-bas"
      ],
      [
        "part",
        "application/pro_eng"
      ],
      [
        "pas",
        "text/pascal"
      ],
      [
        "paw",
        "application/vnd.pawaafile"
      ],
      [
        "pbd",
        "application/vnd.powerbuilder6"
      ],
      [
        "pbm",
        "image/x-portable-bitmap"
      ],
      [
        "pcf",
        "application/x-font-pcf"
      ],
      [
        "pcl",
        [
          "application/vnd.hp-pcl",
          "application/x-pcl"
        ]
      ],
      [
        "pclxl",
        "application/vnd.hp-pclxl"
      ],
      [
        "pct",
        "image/x-pict"
      ],
      [
        "pcurl",
        "application/vnd.curl.pcurl"
      ],
      [
        "pcx",
        "image/x-pcx"
      ],
      [
        "pdb",
        [
          "application/vnd.palm",
          "chemical/x-pdb"
        ]
      ],
      [
        "pdf",
        "application/pdf"
      ],
      [
        "pfa",
        "application/x-font-type1"
      ],
      [
        "pfr",
        "application/font-tdpfr"
      ],
      [
        "pfunk",
        [
          "audio/make",
          "audio/make.my.funk"
        ]
      ],
      [
        "pfx",
        "application/x-pkcs12"
      ],
      [
        "pgm",
        [
          "image/x-portable-graymap",
          "image/x-portable-greymap"
        ]
      ],
      [
        "pgn",
        "application/x-chess-pgn"
      ],
      [
        "pgp",
        "application/pgp-signature"
      ],
      [
        "pic",
        [
          "image/pict",
          "image/x-pict"
        ]
      ],
      [
        "pict",
        "image/pict"
      ],
      [
        "pkg",
        "application/x-newton-compatible-pkg"
      ],
      [
        "pki",
        "application/pkixcmp"
      ],
      [
        "pkipath",
        "application/pkix-pkipath"
      ],
      [
        "pko",
        [
          "application/ynd.ms-pkipko",
          "application/vnd.ms-pki.pko"
        ]
      ],
      [
        "pl",
        [
          "text/plain",
          "text/x-script.perl"
        ]
      ],
      [
        "plb",
        "application/vnd.3gpp.pic-bw-large"
      ],
      [
        "plc",
        "application/vnd.mobius.plc"
      ],
      [
        "plf",
        "application/vnd.pocketlearn"
      ],
      [
        "pls",
        "application/pls+xml"
      ],
      [
        "plx",
        "application/x-pixclscript"
      ],
      [
        "pm",
        [
          "text/x-script.perl-module",
          "image/x-xpixmap"
        ]
      ],
      [
        "pm4",
        "application/x-pagemaker"
      ],
      [
        "pm5",
        "application/x-pagemaker"
      ],
      [
        "pma",
        "application/x-perfmon"
      ],
      [
        "pmc",
        "application/x-perfmon"
      ],
      [
        "pml",
        [
          "application/vnd.ctc-posml",
          "application/x-perfmon"
        ]
      ],
      [
        "pmr",
        "application/x-perfmon"
      ],
      [
        "pmw",
        "application/x-perfmon"
      ],
      [
        "png",
        "image/png"
      ],
      [
        "pnm",
        [
          "application/x-portable-anymap",
          "image/x-portable-anymap"
        ]
      ],
      [
        "portpkg",
        "application/vnd.macports.portpkg"
      ],
      [
        "pot",
        [
          "application/vnd.ms-powerpoint",
          "application/mspowerpoint"
        ]
      ],
      [
        "potm",
        "application/vnd.ms-powerpoint.template.macroenabled.12"
      ],
      [
        "potx",
        "application/vnd.openxmlformats-officedocument.presentationml.template"
      ],
      [
        "pov",
        "model/x-pov"
      ],
      [
        "ppa",
        "application/vnd.ms-powerpoint"
      ],
      [
        "ppam",
        "application/vnd.ms-powerpoint.addin.macroenabled.12"
      ],
      [
        "ppd",
        "application/vnd.cups-ppd"
      ],
      [
        "ppm",
        "image/x-portable-pixmap"
      ],
      [
        "pps",
        [
          "application/vnd.ms-powerpoint",
          "application/mspowerpoint"
        ]
      ],
      [
        "ppsm",
        "application/vnd.ms-powerpoint.slideshow.macroenabled.12"
      ],
      [
        "ppsx",
        "application/vnd.openxmlformats-officedocument.presentationml.slideshow"
      ],
      [
        "ppt",
        [
          "application/vnd.ms-powerpoint",
          "application/mspowerpoint",
          "application/powerpoint",
          "application/x-mspowerpoint"
        ]
      ],
      [
        "pptm",
        "application/vnd.ms-powerpoint.presentation.macroenabled.12"
      ],
      [
        "pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ],
      [
        "ppz",
        "application/mspowerpoint"
      ],
      [
        "prc",
        "application/x-mobipocket-ebook"
      ],
      [
        "pre",
        [
          "application/vnd.lotus-freelance",
          "application/x-freelance"
        ]
      ],
      [
        "prf",
        "application/pics-rules"
      ],
      [
        "prt",
        "application/pro_eng"
      ],
      [
        "ps",
        "application/postscript"
      ],
      [
        "psb",
        "application/vnd.3gpp.pic-bw-small"
      ],
      [
        "psd",
        [
          "application/octet-stream",
          "image/vnd.adobe.photoshop"
        ]
      ],
      [
        "psf",
        "application/x-font-linux-psf"
      ],
      [
        "pskcxml",
        "application/pskc+xml"
      ],
      [
        "ptid",
        "application/vnd.pvi.ptid1"
      ],
      [
        "pub",
        "application/x-mspublisher"
      ],
      [
        "pvb",
        "application/vnd.3gpp.pic-bw-var"
      ],
      [
        "pvu",
        "paleovu/x-pv"
      ],
      [
        "pwn",
        "application/vnd.3m.post-it-notes"
      ],
      [
        "pwz",
        "application/vnd.ms-powerpoint"
      ],
      [
        "py",
        "text/x-script.phyton"
      ],
      [
        "pya",
        "audio/vnd.ms-playready.media.pya"
      ],
      [
        "pyc",
        "application/x-bytecode.python"
      ],
      [
        "pyv",
        "video/vnd.ms-playready.media.pyv"
      ],
      [
        "qam",
        "application/vnd.epson.quickanime"
      ],
      [
        "qbo",
        "application/vnd.intu.qbo"
      ],
      [
        "qcp",
        "audio/vnd.qcelp"
      ],
      [
        "qd3",
        "x-world/x-3dmf"
      ],
      [
        "qd3d",
        "x-world/x-3dmf"
      ],
      [
        "qfx",
        "application/vnd.intu.qfx"
      ],
      [
        "qif",
        "image/x-quicktime"
      ],
      [
        "qps",
        "application/vnd.publishare-delta-tree"
      ],
      [
        "qt",
        "video/quicktime"
      ],
      [
        "qtc",
        "video/x-qtc"
      ],
      [
        "qti",
        "image/x-quicktime"
      ],
      [
        "qtif",
        "image/x-quicktime"
      ],
      [
        "qxd",
        "application/vnd.quark.quarkxpress"
      ],
      [
        "ra",
        [
          "audio/x-realaudio",
          "audio/x-pn-realaudio",
          "audio/x-pn-realaudio-plugin"
        ]
      ],
      [
        "ram",
        "audio/x-pn-realaudio"
      ],
      [
        "rar",
        "application/x-rar-compressed"
      ],
      [
        "ras",
        [
          "image/cmu-raster",
          "application/x-cmu-raster",
          "image/x-cmu-raster"
        ]
      ],
      [
        "rast",
        "image/cmu-raster"
      ],
      [
        "rcprofile",
        "application/vnd.ipunplugged.rcprofile"
      ],
      [
        "rdf",
        "application/rdf+xml"
      ],
      [
        "rdz",
        "application/vnd.data-vision.rdz"
      ],
      [
        "rep",
        "application/vnd.businessobjects"
      ],
      [
        "res",
        "application/x-dtbresource+xml"
      ],
      [
        "rexx",
        "text/x-script.rexx"
      ],
      [
        "rf",
        "image/vnd.rn-realflash"
      ],
      [
        "rgb",
        "image/x-rgb"
      ],
      [
        "rif",
        "application/reginfo+xml"
      ],
      [
        "rip",
        "audio/vnd.rip"
      ],
      [
        "rl",
        "application/resource-lists+xml"
      ],
      [
        "rlc",
        "image/vnd.fujixerox.edmics-rlc"
      ],
      [
        "rld",
        "application/resource-lists-diff+xml"
      ],
      [
        "rm",
        [
          "application/vnd.rn-realmedia",
          "audio/x-pn-realaudio"
        ]
      ],
      [
        "rmi",
        "audio/mid"
      ],
      [
        "rmm",
        "audio/x-pn-realaudio"
      ],
      [
        "rmp",
        [
          "audio/x-pn-realaudio-plugin",
          "audio/x-pn-realaudio"
        ]
      ],
      [
        "rms",
        "application/vnd.jcp.javame.midlet-rms"
      ],
      [
        "rnc",
        "application/relax-ng-compact-syntax"
      ],
      [
        "rng",
        [
          "application/ringing-tones",
          "application/vnd.nokia.ringing-tone"
        ]
      ],
      [
        "rnx",
        "application/vnd.rn-realplayer"
      ],
      [
        "roff",
        "application/x-troff"
      ],
      [
        "rp",
        "image/vnd.rn-realpix"
      ],
      [
        "rp9",
        "application/vnd.cloanto.rp9"
      ],
      [
        "rpm",
        "audio/x-pn-realaudio-plugin"
      ],
      [
        "rpss",
        "application/vnd.nokia.radio-presets"
      ],
      [
        "rpst",
        "application/vnd.nokia.radio-preset"
      ],
      [
        "rq",
        "application/sparql-query"
      ],
      [
        "rs",
        "application/rls-services+xml"
      ],
      [
        "rsd",
        "application/rsd+xml"
      ],
      [
        "rt",
        [
          "text/richtext",
          "text/vnd.rn-realtext"
        ]
      ],
      [
        "rtf",
        [
          "application/rtf",
          "text/richtext",
          "application/x-rtf"
        ]
      ],
      [
        "rtx",
        [
          "text/richtext",
          "application/rtf"
        ]
      ],
      [
        "rv",
        "video/vnd.rn-realvideo"
      ],
      [
        "s",
        "text/x-asm"
      ],
      [
        "s3m",
        "audio/s3m"
      ],
      [
        "saf",
        "application/vnd.yamaha.smaf-audio"
      ],
      [
        "saveme",
        "application/octet-stream"
      ],
      [
        "sbk",
        "application/x-tbook"
      ],
      [
        "sbml",
        "application/sbml+xml"
      ],
      [
        "sc",
        "application/vnd.ibm.secure-container"
      ],
      [
        "scd",
        "application/x-msschedule"
      ],
      [
        "scm",
        [
          "application/vnd.lotus-screencam",
          "video/x-scm",
          "text/x-script.guile",
          "application/x-lotusscreencam",
          "text/x-script.scheme"
        ]
      ],
      [
        "scq",
        "application/scvp-cv-request"
      ],
      [
        "scs",
        "application/scvp-cv-response"
      ],
      [
        "sct",
        "text/scriptlet"
      ],
      [
        "scurl",
        "text/vnd.curl.scurl"
      ],
      [
        "sda",
        "application/vnd.stardivision.draw"
      ],
      [
        "sdc",
        "application/vnd.stardivision.calc"
      ],
      [
        "sdd",
        "application/vnd.stardivision.impress"
      ],
      [
        "sdkm",
        "application/vnd.solent.sdkm+xml"
      ],
      [
        "sdml",
        "text/plain"
      ],
      [
        "sdp",
        [
          "application/sdp",
          "application/x-sdp"
        ]
      ],
      [
        "sdr",
        "application/sounder"
      ],
      [
        "sdw",
        "application/vnd.stardivision.writer"
      ],
      [
        "sea",
        [
          "application/sea",
          "application/x-sea"
        ]
      ],
      [
        "see",
        "application/vnd.seemail"
      ],
      [
        "seed",
        "application/vnd.fdsn.seed"
      ],
      [
        "sema",
        "application/vnd.sema"
      ],
      [
        "semd",
        "application/vnd.semd"
      ],
      [
        "semf",
        "application/vnd.semf"
      ],
      [
        "ser",
        "application/java-serialized-object"
      ],
      [
        "set",
        "application/set"
      ],
      [
        "setpay",
        "application/set-payment-initiation"
      ],
      [
        "setreg",
        "application/set-registration-initiation"
      ],
      [
        "sfd-hdstx",
        "application/vnd.hydrostatix.sof-data"
      ],
      [
        "sfs",
        "application/vnd.spotfire.sfs"
      ],
      [
        "sgl",
        "application/vnd.stardivision.writer-global"
      ],
      [
        "sgm",
        [
          "text/sgml",
          "text/x-sgml"
        ]
      ],
      [
        "sgml",
        [
          "text/sgml",
          "text/x-sgml"
        ]
      ],
      [
        "sh",
        [
          "application/x-shar",
          "application/x-bsh",
          "application/x-sh",
          "text/x-script.sh"
        ]
      ],
      [
        "shar",
        [
          "application/x-bsh",
          "application/x-shar"
        ]
      ],
      [
        "shf",
        "application/shf+xml"
      ],
      [
        "shtml",
        [
          "text/html",
          "text/x-server-parsed-html"
        ]
      ],
      [
        "sid",
        "audio/x-psid"
      ],
      [
        "sis",
        "application/vnd.symbian.install"
      ],
      [
        "sit",
        [
          "application/x-stuffit",
          "application/x-sit"
        ]
      ],
      [
        "sitx",
        "application/x-stuffitx"
      ],
      [
        "skd",
        "application/x-koan"
      ],
      [
        "skm",
        "application/x-koan"
      ],
      [
        "skp",
        [
          "application/vnd.koan",
          "application/x-koan"
        ]
      ],
      [
        "skt",
        "application/x-koan"
      ],
      [
        "sl",
        "application/x-seelogo"
      ],
      [
        "sldm",
        "application/vnd.ms-powerpoint.slide.macroenabled.12"
      ],
      [
        "sldx",
        "application/vnd.openxmlformats-officedocument.presentationml.slide"
      ],
      [
        "slt",
        "application/vnd.epson.salt"
      ],
      [
        "sm",
        "application/vnd.stepmania.stepchart"
      ],
      [
        "smf",
        "application/vnd.stardivision.math"
      ],
      [
        "smi",
        [
          "application/smil",
          "application/smil+xml"
        ]
      ],
      [
        "smil",
        "application/smil"
      ],
      [
        "snd",
        [
          "audio/basic",
          "audio/x-adpcm"
        ]
      ],
      [
        "snf",
        "application/x-font-snf"
      ],
      [
        "sol",
        "application/solids"
      ],
      [
        "spc",
        [
          "text/x-speech",
          "application/x-pkcs7-certificates"
        ]
      ],
      [
        "spf",
        "application/vnd.yamaha.smaf-phrase"
      ],
      [
        "spl",
        [
          "application/futuresplash",
          "application/x-futuresplash"
        ]
      ],
      [
        "spot",
        "text/vnd.in3d.spot"
      ],
      [
        "spp",
        "application/scvp-vp-response"
      ],
      [
        "spq",
        "application/scvp-vp-request"
      ],
      [
        "spr",
        "application/x-sprite"
      ],
      [
        "sprite",
        "application/x-sprite"
      ],
      [
        "src",
        "application/x-wais-source"
      ],
      [
        "sru",
        "application/sru+xml"
      ],
      [
        "srx",
        "application/sparql-results+xml"
      ],
      [
        "sse",
        "application/vnd.kodak-descriptor"
      ],
      [
        "ssf",
        "application/vnd.epson.ssf"
      ],
      [
        "ssi",
        "text/x-server-parsed-html"
      ],
      [
        "ssm",
        "application/streamingmedia"
      ],
      [
        "ssml",
        "application/ssml+xml"
      ],
      [
        "sst",
        [
          "application/vnd.ms-pkicertstore",
          "application/vnd.ms-pki.certstore"
        ]
      ],
      [
        "st",
        "application/vnd.sailingtracker.track"
      ],
      [
        "stc",
        "application/vnd.sun.xml.calc.template"
      ],
      [
        "std",
        "application/vnd.sun.xml.draw.template"
      ],
      [
        "step",
        "application/step"
      ],
      [
        "stf",
        "application/vnd.wt.stf"
      ],
      [
        "sti",
        "application/vnd.sun.xml.impress.template"
      ],
      [
        "stk",
        "application/hyperstudio"
      ],
      [
        "stl",
        [
          "application/vnd.ms-pkistl",
          "application/sla",
          "application/vnd.ms-pki.stl",
          "application/x-navistyle"
        ]
      ],
      [
        "stm",
        "text/html"
      ],
      [
        "stp",
        "application/step"
      ],
      [
        "str",
        "application/vnd.pg.format"
      ],
      [
        "stw",
        "application/vnd.sun.xml.writer.template"
      ],
      [
        "sub",
        "image/vnd.dvb.subtitle"
      ],
      [
        "sus",
        "application/vnd.sus-calendar"
      ],
      [
        "sv4cpio",
        "application/x-sv4cpio"
      ],
      [
        "sv4crc",
        "application/x-sv4crc"
      ],
      [
        "svc",
        "application/vnd.dvb.service"
      ],
      [
        "svd",
        "application/vnd.svd"
      ],
      [
        "svf",
        [
          "image/vnd.dwg",
          "image/x-dwg"
        ]
      ],
      [
        "svg",
        "image/svg+xml"
      ],
      [
        "svr",
        [
          "x-world/x-svr",
          "application/x-world"
        ]
      ],
      [
        "swf",
        "application/x-shockwave-flash"
      ],
      [
        "swi",
        "application/vnd.aristanetworks.swi"
      ],
      [
        "sxc",
        "application/vnd.sun.xml.calc"
      ],
      [
        "sxd",
        "application/vnd.sun.xml.draw"
      ],
      [
        "sxg",
        "application/vnd.sun.xml.writer.global"
      ],
      [
        "sxi",
        "application/vnd.sun.xml.impress"
      ],
      [
        "sxm",
        "application/vnd.sun.xml.math"
      ],
      [
        "sxw",
        "application/vnd.sun.xml.writer"
      ],
      [
        "t",
        [
          "text/troff",
          "application/x-troff"
        ]
      ],
      [
        "talk",
        "text/x-speech"
      ],
      [
        "tao",
        "application/vnd.tao.intent-module-archive"
      ],
      [
        "tar",
        "application/x-tar"
      ],
      [
        "tbk",
        [
          "application/toolbook",
          "application/x-tbook"
        ]
      ],
      [
        "tcap",
        "application/vnd.3gpp2.tcap"
      ],
      [
        "tcl",
        [
          "text/x-script.tcl",
          "application/x-tcl"
        ]
      ],
      [
        "tcsh",
        "text/x-script.tcsh"
      ],
      [
        "teacher",
        "application/vnd.smart.teacher"
      ],
      [
        "tei",
        "application/tei+xml"
      ],
      [
        "tex",
        "application/x-tex"
      ],
      [
        "texi",
        "application/x-texinfo"
      ],
      [
        "texinfo",
        "application/x-texinfo"
      ],
      [
        "text",
        [
          "application/plain",
          "text/plain"
        ]
      ],
      [
        "tfi",
        "application/thraud+xml"
      ],
      [
        "tfm",
        "application/x-tex-tfm"
      ],
      [
        "tgz",
        [
          "application/gnutar",
          "application/x-compressed"
        ]
      ],
      [
        "thmx",
        "application/vnd.ms-officetheme"
      ],
      [
        "tif",
        [
          "image/tiff",
          "image/x-tiff"
        ]
      ],
      [
        "tiff",
        [
          "image/tiff",
          "image/x-tiff"
        ]
      ],
      [
        "tmo",
        "application/vnd.tmobile-livetv"
      ],
      [
        "torrent",
        "application/x-bittorrent"
      ],
      [
        "tpl",
        "application/vnd.groove-tool-template"
      ],
      [
        "tpt",
        "application/vnd.trid.tpt"
      ],
      [
        "tr",
        "application/x-troff"
      ],
      [
        "tra",
        "application/vnd.trueapp"
      ],
      [
        "trm",
        "application/x-msterminal"
      ],
      [
        "tsd",
        "application/timestamped-data"
      ],
      [
        "tsi",
        "audio/tsp-audio"
      ],
      [
        "tsp",
        [
          "application/dsptype",
          "audio/tsplayer"
        ]
      ],
      [
        "tsv",
        "text/tab-separated-values"
      ],
      [
        "ttf",
        "application/x-font-ttf"
      ],
      [
        "ttl",
        "text/turtle"
      ],
      [
        "turbot",
        "image/florian"
      ],
      [
        "twd",
        "application/vnd.simtech-mindmapper"
      ],
      [
        "txd",
        "application/vnd.genomatix.tuxedo"
      ],
      [
        "txf",
        "application/vnd.mobius.txf"
      ],
      [
        "txt",
        "text/plain"
      ],
      [
        "ufd",
        "application/vnd.ufdl"
      ],
      [
        "uil",
        "text/x-uil"
      ],
      [
        "uls",
        "text/iuls"
      ],
      [
        "umj",
        "application/vnd.umajin"
      ],
      [
        "uni",
        "text/uri-list"
      ],
      [
        "unis",
        "text/uri-list"
      ],
      [
        "unityweb",
        "application/vnd.unity"
      ],
      [
        "unv",
        "application/i-deas"
      ],
      [
        "uoml",
        "application/vnd.uoml+xml"
      ],
      [
        "uri",
        "text/uri-list"
      ],
      [
        "uris",
        "text/uri-list"
      ],
      [
        "ustar",
        [
          "application/x-ustar",
          "multipart/x-ustar"
        ]
      ],
      [
        "utz",
        "application/vnd.uiq.theme"
      ],
      [
        "uu",
        [
          "application/octet-stream",
          "text/x-uuencode"
        ]
      ],
      [
        "uue",
        "text/x-uuencode"
      ],
      [
        "uva",
        "audio/vnd.dece.audio"
      ],
      [
        "uvh",
        "video/vnd.dece.hd"
      ],
      [
        "uvi",
        "image/vnd.dece.graphic"
      ],
      [
        "uvm",
        "video/vnd.dece.mobile"
      ],
      [
        "uvp",
        "video/vnd.dece.pd"
      ],
      [
        "uvs",
        "video/vnd.dece.sd"
      ],
      [
        "uvu",
        "video/vnd.uvvu.mp4"
      ],
      [
        "uvv",
        "video/vnd.dece.video"
      ],
      [
        "vcd",
        "application/x-cdlink"
      ],
      [
        "vcf",
        "text/x-vcard"
      ],
      [
        "vcg",
        "application/vnd.groove-vcard"
      ],
      [
        "vcs",
        "text/x-vcalendar"
      ],
      [
        "vcx",
        "application/vnd.vcx"
      ],
      [
        "vda",
        "application/vda"
      ],
      [
        "vdo",
        "video/vdo"
      ],
      [
        "vew",
        "application/groupwise"
      ],
      [
        "vis",
        "application/vnd.visionary"
      ],
      [
        "viv",
        [
          "video/vivo",
          "video/vnd.vivo"
        ]
      ],
      [
        "vivo",
        [
          "video/vivo",
          "video/vnd.vivo"
        ]
      ],
      [
        "vmd",
        "application/vocaltec-media-desc"
      ],
      [
        "vmf",
        "application/vocaltec-media-file"
      ],
      [
        "voc",
        [
          "audio/voc",
          "audio/x-voc"
        ]
      ],
      [
        "vos",
        "video/vosaic"
      ],
      [
        "vox",
        "audio/voxware"
      ],
      [
        "vqe",
        "audio/x-twinvq-plugin"
      ],
      [
        "vqf",
        "audio/x-twinvq"
      ],
      [
        "vql",
        "audio/x-twinvq-plugin"
      ],
      [
        "vrml",
        [
          "model/vrml",
          "x-world/x-vrml",
          "application/x-vrml"
        ]
      ],
      [
        "vrt",
        "x-world/x-vrt"
      ],
      [
        "vsd",
        [
          "application/vnd.visio",
          "application/x-visio"
        ]
      ],
      [
        "vsf",
        "application/vnd.vsf"
      ],
      [
        "vst",
        "application/x-visio"
      ],
      [
        "vsw",
        "application/x-visio"
      ],
      [
        "vtu",
        "model/vnd.vtu"
      ],
      [
        "vxml",
        "application/voicexml+xml"
      ],
      [
        "w60",
        "application/wordperfect6.0"
      ],
      [
        "w61",
        "application/wordperfect6.1"
      ],
      [
        "w6w",
        "application/msword"
      ],
      [
        "wad",
        "application/x-doom"
      ],
      [
        "wav",
        [
          "audio/wav",
          "audio/x-wav"
        ]
      ],
      [
        "wax",
        "audio/x-ms-wax"
      ],
      [
        "wb1",
        "application/x-qpro"
      ],
      [
        "wbmp",
        "image/vnd.wap.wbmp"
      ],
      [
        "wbs",
        "application/vnd.criticaltools.wbs+xml"
      ],
      [
        "wbxml",
        "application/vnd.wap.wbxml"
      ],
      [
        "wcm",
        "application/vnd.ms-works"
      ],
      [
        "wdb",
        "application/vnd.ms-works"
      ],
      [
        "web",
        "application/vnd.xara"
      ],
      [
        "weba",
        "audio/webm"
      ],
      [
        "webm",
        "video/webm"
      ],
      [
        "webp",
        "image/webp"
      ],
      [
        "wg",
        "application/vnd.pmi.widget"
      ],
      [
        "wgt",
        "application/widget"
      ],
      [
        "wiz",
        "application/msword"
      ],
      [
        "wk1",
        "application/x-123"
      ],
      [
        "wks",
        "application/vnd.ms-works"
      ],
      [
        "wm",
        "video/x-ms-wm"
      ],
      [
        "wma",
        "audio/x-ms-wma"
      ],
      [
        "wmd",
        "application/x-ms-wmd"
      ],
      [
        "wmf",
        [
          "windows/metafile",
          "application/x-msmetafile"
        ]
      ],
      [
        "wml",
        "text/vnd.wap.wml"
      ],
      [
        "wmlc",
        "application/vnd.wap.wmlc"
      ],
      [
        "wmls",
        "text/vnd.wap.wmlscript"
      ],
      [
        "wmlsc",
        "application/vnd.wap.wmlscriptc"
      ],
      [
        "wmv",
        "video/x-ms-wmv"
      ],
      [
        "wmx",
        "video/x-ms-wmx"
      ],
      [
        "wmz",
        "application/x-ms-wmz"
      ],
      [
        "woff",
        "application/x-font-woff"
      ],
      [
        "word",
        "application/msword"
      ],
      [
        "wp",
        "application/wordperfect"
      ],
      [
        "wp5",
        [
          "application/wordperfect",
          "application/wordperfect6.0"
        ]
      ],
      [
        "wp6",
        "application/wordperfect"
      ],
      [
        "wpd",
        [
          "application/wordperfect",
          "application/vnd.wordperfect",
          "application/x-wpwin"
        ]
      ],
      [
        "wpl",
        "application/vnd.ms-wpl"
      ],
      [
        "wps",
        "application/vnd.ms-works"
      ],
      [
        "wq1",
        "application/x-lotus"
      ],
      [
        "wqd",
        "application/vnd.wqd"
      ],
      [
        "wri",
        [
          "application/mswrite",
          "application/x-wri",
          "application/x-mswrite"
        ]
      ],
      [
        "wrl",
        [
          "model/vrml",
          "x-world/x-vrml",
          "application/x-world"
        ]
      ],
      [
        "wrz",
        [
          "model/vrml",
          "x-world/x-vrml"
        ]
      ],
      [
        "wsc",
        "text/scriplet"
      ],
      [
        "wsdl",
        "application/wsdl+xml"
      ],
      [
        "wspolicy",
        "application/wspolicy+xml"
      ],
      [
        "wsrc",
        "application/x-wais-source"
      ],
      [
        "wtb",
        "application/vnd.webturbo"
      ],
      [
        "wtk",
        "application/x-wintalk"
      ],
      [
        "wvx",
        "video/x-ms-wvx"
      ],
      [
        "x-png",
        "image/png"
      ],
      [
        "x3d",
        "application/vnd.hzn-3d-crossword"
      ],
      [
        "xaf",
        "x-world/x-vrml"
      ],
      [
        "xap",
        "application/x-silverlight-app"
      ],
      [
        "xar",
        "application/vnd.xara"
      ],
      [
        "xbap",
        "application/x-ms-xbap"
      ],
      [
        "xbd",
        "application/vnd.fujixerox.docuworks.binder"
      ],
      [
        "xbm",
        [
          "image/xbm",
          "image/x-xbm",
          "image/x-xbitmap"
        ]
      ],
      [
        "xdf",
        "application/xcap-diff+xml"
      ],
      [
        "xdm",
        "application/vnd.syncml.dm+xml"
      ],
      [
        "xdp",
        "application/vnd.adobe.xdp+xml"
      ],
      [
        "xdr",
        "video/x-amt-demorun"
      ],
      [
        "xdssc",
        "application/dssc+xml"
      ],
      [
        "xdw",
        "application/vnd.fujixerox.docuworks"
      ],
      [
        "xenc",
        "application/xenc+xml"
      ],
      [
        "xer",
        "application/patch-ops-error+xml"
      ],
      [
        "xfdf",
        "application/vnd.adobe.xfdf"
      ],
      [
        "xfdl",
        "application/vnd.xfdl"
      ],
      [
        "xgz",
        "xgl/drawing"
      ],
      [
        "xhtml",
        "application/xhtml+xml"
      ],
      [
        "xif",
        "image/vnd.xiff"
      ],
      [
        "xl",
        "application/excel"
      ],
      [
        "xla",
        [
          "application/vnd.ms-excel",
          "application/excel",
          "application/x-msexcel",
          "application/x-excel"
        ]
      ],
      [
        "xlam",
        "application/vnd.ms-excel.addin.macroenabled.12"
      ],
      [
        "xlb",
        [
          "application/excel",
          "application/vnd.ms-excel",
          "application/x-excel"
        ]
      ],
      [
        "xlc",
        [
          "application/vnd.ms-excel",
          "application/excel",
          "application/x-excel"
        ]
      ],
      [
        "xld",
        [
          "application/excel",
          "application/x-excel"
        ]
      ],
      [
        "xlk",
        [
          "application/excel",
          "application/x-excel"
        ]
      ],
      [
        "xll",
        [
          "application/excel",
          "application/vnd.ms-excel",
          "application/x-excel"
        ]
      ],
      [
        "xlm",
        [
          "application/vnd.ms-excel",
          "application/excel",
          "application/x-excel"
        ]
      ],
      [
        "xls",
        [
          "application/vnd.ms-excel",
          "application/excel",
          "application/x-msexcel",
          "application/x-excel"
        ]
      ],
      [
        "xlsb",
        "application/vnd.ms-excel.sheet.binary.macroenabled.12"
      ],
      [
        "xlsm",
        "application/vnd.ms-excel.sheet.macroenabled.12"
      ],
      [
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ],
      [
        "xlt",
        [
          "application/vnd.ms-excel",
          "application/excel",
          "application/x-excel"
        ]
      ],
      [
        "xltm",
        "application/vnd.ms-excel.template.macroenabled.12"
      ],
      [
        "xltx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.template"
      ],
      [
        "xlv",
        [
          "application/excel",
          "application/x-excel"
        ]
      ],
      [
        "xlw",
        [
          "application/vnd.ms-excel",
          "application/excel",
          "application/x-msexcel",
          "application/x-excel"
        ]
      ],
      [
        "xm",
        "audio/xm"
      ],
      [
        "xml",
        [
          "application/xml",
          "text/xml",
          "application/atom+xml",
          "application/rss+xml"
        ]
      ],
      [
        "xmz",
        "xgl/movie"
      ],
      [
        "xo",
        "application/vnd.olpc-sugar"
      ],
      [
        "xof",
        "x-world/x-vrml"
      ],
      [
        "xop",
        "application/xop+xml"
      ],
      [
        "xpi",
        "application/x-xpinstall"
      ],
      [
        "xpix",
        "application/x-vnd.ls-xpix"
      ],
      [
        "xpm",
        [
          "image/xpm",
          "image/x-xpixmap"
        ]
      ],
      [
        "xpr",
        "application/vnd.is-xpr"
      ],
      [
        "xps",
        "application/vnd.ms-xpsdocument"
      ],
      [
        "xpw",
        "application/vnd.intercon.formnet"
      ],
      [
        "xslt",
        "application/xslt+xml"
      ],
      [
        "xsm",
        "application/vnd.syncml+xml"
      ],
      [
        "xspf",
        "application/xspf+xml"
      ],
      [
        "xsr",
        "video/x-amt-showrun"
      ],
      [
        "xul",
        "application/vnd.mozilla.xul+xml"
      ],
      [
        "xwd",
        [
          "image/x-xwd",
          "image/x-xwindowdump"
        ]
      ],
      [
        "xyz",
        [
          "chemical/x-xyz",
          "chemical/x-pdb"
        ]
      ],
      [
        "yang",
        "application/yang"
      ],
      [
        "yin",
        "application/yin+xml"
      ],
      [
        "z",
        [
          "application/x-compressed",
          "application/x-compress"
        ]
      ],
      [
        "zaz",
        "application/vnd.zzazz.deck+xml"
      ],
      [
        "zip",
        [
          "application/zip",
          "multipart/x-zip",
          "application/x-zip-compressed",
          "application/x-compressed"
        ]
      ],
      [
        "zir",
        "application/vnd.zul"
      ],
      [
        "zmm",
        "application/vnd.handheld-entertainment+xml"
      ],
      [
        "zoo",
        "application/octet-stream"
      ],
      [
        "zsh",
        "text/x-script.zsh"
      ]
    ]);
    module.exports = {
      detectMimeType(filename) {
        if (!filename) {
          return defaultMimeType;
        }
        let parsed = path.parse(filename);
        let extension = (parsed.ext.substr(1) || parsed.name || "").split("?").shift().trim().toLowerCase();
        let value = defaultMimeType;
        if (extensions.has(extension)) {
          value = extensions.get(extension);
        }
        if (Array.isArray(value)) {
          return value[0];
        }
        return value;
      },
      detectExtension(mimeType) {
        if (!mimeType) {
          return defaultExtension;
        }
        let parts = (mimeType || "").toLowerCase().trim().split("/");
        let rootType = parts.shift().trim();
        let subType = parts.join("/").trim();
        if (mimeTypes.has(rootType + "/" + subType)) {
          let value = mimeTypes.get(rootType + "/" + subType);
          if (Array.isArray(value)) {
            return value[0];
          }
          return value;
        }
        switch (rootType) {
          case "text":
            return "txt";
          default:
            return "bin";
        }
      }
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/punycode/index.js
var require_punycode = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/punycode/index.js"(exports, module) {
    "use strict";
    var maxInt = 2147483647;
    var base = 36;
    var tMin = 1;
    var tMax = 26;
    var skew = 38;
    var damp = 700;
    var initialBias = 72;
    var initialN = 128;
    var delimiter = "-";
    var regexPunycode = /^xn--/;
    var regexNonASCII = /[^\0-\x7F]/;
    var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
    var errors = {
      overflow: "Overflow: input needs wider integers to process",
      "not-basic": "Illegal input >= 0x80 (not a basic code point)",
      "invalid-input": "Invalid input"
    };
    var baseMinusTMin = base - tMin;
    var floor = Math.floor;
    var stringFromCharCode = String.fromCharCode;
    function error(type) {
      throw new RangeError(errors[type]);
    }
    function map(array, callback) {
      const result = [];
      let length = array.length;
      while (length--) {
        result[length] = callback(array[length]);
      }
      return result;
    }
    function mapDomain(domain, callback) {
      const parts = domain.split("@");
      let result = "";
      if (parts.length > 1) {
        result = parts[0] + "@";
        domain = parts[1];
      }
      domain = domain.replace(regexSeparators, ".");
      const labels = domain.split(".");
      const encoded = map(labels, callback).join(".");
      return result + encoded;
    }
    function ucs2decode(string) {
      const output = [];
      let counter = 0;
      const length = string.length;
      while (counter < length) {
        const value = string.charCodeAt(counter++);
        if (value >= 55296 && value <= 56319 && counter < length) {
          const extra = string.charCodeAt(counter++);
          if ((extra & 64512) == 56320) {
            output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
          } else {
            output.push(value);
            counter--;
          }
        } else {
          output.push(value);
        }
      }
      return output;
    }
    var ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
    var basicToDigit = function(codePoint) {
      if (codePoint >= 48 && codePoint < 58) {
        return 26 + (codePoint - 48);
      }
      if (codePoint >= 65 && codePoint < 91) {
        return codePoint - 65;
      }
      if (codePoint >= 97 && codePoint < 123) {
        return codePoint - 97;
      }
      return base;
    };
    var digitToBasic = function(digit, flag) {
      return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
    };
    var adapt = function(delta, numPoints, firstTime) {
      let k = 0;
      delta = firstTime ? floor(delta / damp) : delta >> 1;
      delta += floor(delta / numPoints);
      for (; delta > baseMinusTMin * tMax >> 1; k += base) {
        delta = floor(delta / baseMinusTMin);
      }
      return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
    };
    var decode = function(input) {
      const output = [];
      const inputLength = input.length;
      let i = 0;
      let n = initialN;
      let bias = initialBias;
      let basic = input.lastIndexOf(delimiter);
      if (basic < 0) {
        basic = 0;
      }
      for (let j = 0; j < basic; ++j) {
        if (input.charCodeAt(j) >= 128) {
          error("not-basic");
        }
        output.push(input.charCodeAt(j));
      }
      for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
        const oldi = i;
        for (let w = 1, k = base; ; k += base) {
          if (index >= inputLength) {
            error("invalid-input");
          }
          const digit = basicToDigit(input.charCodeAt(index++));
          if (digit >= base) {
            error("invalid-input");
          }
          if (digit > floor((maxInt - i) / w)) {
            error("overflow");
          }
          i += digit * w;
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (digit < t) {
            break;
          }
          const baseMinusT = base - t;
          if (w > floor(maxInt / baseMinusT)) {
            error("overflow");
          }
          w *= baseMinusT;
        }
        const out = output.length + 1;
        bias = adapt(i - oldi, out, oldi == 0);
        if (floor(i / out) > maxInt - n) {
          error("overflow");
        }
        n += floor(i / out);
        i %= out;
        output.splice(i++, 0, n);
      }
      return String.fromCodePoint(...output);
    };
    var encode = function(input) {
      const output = [];
      input = ucs2decode(input);
      const inputLength = input.length;
      let n = initialN;
      let delta = 0;
      let bias = initialBias;
      for (const currentValue of input) {
        if (currentValue < 128) {
          output.push(stringFromCharCode(currentValue));
        }
      }
      const basicLength = output.length;
      let handledCPCount = basicLength;
      if (basicLength) {
        output.push(delimiter);
      }
      while (handledCPCount < inputLength) {
        let m = maxInt;
        for (const currentValue of input) {
          if (currentValue >= n && currentValue < m) {
            m = currentValue;
          }
        }
        const handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
          error("overflow");
        }
        delta += (m - n) * handledCPCountPlusOne;
        n = m;
        for (const currentValue of input) {
          if (currentValue < n && ++delta > maxInt) {
            error("overflow");
          }
          if (currentValue === n) {
            let q = delta;
            for (let k = base; ; k += base) {
              const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
              if (q < t) {
                break;
              }
              const qMinusT = q - t;
              const baseMinusT = base - t;
              output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
              q = floor(qMinusT / baseMinusT);
            }
            output.push(stringFromCharCode(digitToBasic(q, 0)));
            bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
            delta = 0;
            ++handledCPCount;
          }
        }
        ++delta;
        ++n;
      }
      return output.join("");
    };
    var toUnicode = function(input) {
      return mapDomain(input, function(string) {
        return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
      });
    };
    var toASCII = function(input) {
      return mapDomain(input, function(string) {
        return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
      });
    };
    var punycode = {
      /**
         * A string representing the current Punycode.js version number.
         * @memberOf punycode
         * @type String
         */
      version: "2.3.1",
      /**
         * An object of methods to convert from JavaScript's internal character
         * representation (UCS-2) to Unicode code points, and back.
         * @see <https://mathiasbynens.be/notes/javascript-encoding>
         * @memberOf punycode
         * @type Object
         */
      ucs2: {
        decode: ucs2decode,
        encode: ucs2encode
      },
      decode,
      encode,
      toASCII,
      toUnicode
    };
    module.exports = punycode;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/base64/index.js
var require_base64 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/base64/index.js"(exports, module) {
    "use strict";
    var Transform = __require("node:stream").Transform;
    function encode(buffer) {
      if (typeof buffer === "string") {
        buffer = Buffer.from(buffer, "utf-8");
      }
      return buffer.toString("base64");
    }
    function wrap2(str, lineLength) {
      str = (str || "").toString();
      lineLength = lineLength || 76;
      if (str.length <= lineLength) {
        return str;
      }
      let result = [];
      let pos = 0;
      let chunkLength = lineLength * 1024;
      while (pos < str.length) {
        let wrappedLines = str.substr(pos, chunkLength).replace(new RegExp(".{" + lineLength + "}", "g"), "$&\r\n").trim();
        result.push(wrappedLines);
        pos += chunkLength;
      }
      return result.join("\r\n").trim();
    }
    var Encoder = class extends Transform {
      constructor(options) {
        super();
        this.options = options || {};
        if (this.options.lineLength !== false) {
          this.options.lineLength = this.options.lineLength || 76;
        }
        this._curLine = "";
        this._remainingBytes = false;
        this.inputBytes = 0;
        this.outputBytes = 0;
      }
      _transform(chunk, encoding, done) {
        if (encoding !== "buffer") {
          chunk = Buffer.from(chunk, encoding);
        }
        if (!chunk || !chunk.length) {
          return setImmediate(done);
        }
        this.inputBytes += chunk.length;
        if (this._remainingBytes && this._remainingBytes.length) {
          chunk = Buffer.concat([
            this._remainingBytes,
            chunk
          ], this._remainingBytes.length + chunk.length);
          this._remainingBytes = false;
        }
        if (chunk.length % 3) {
          this._remainingBytes = chunk.slice(chunk.length - chunk.length % 3);
          chunk = chunk.slice(0, chunk.length - chunk.length % 3);
        } else {
          this._remainingBytes = false;
        }
        let b64 = this._curLine + encode(chunk);
        if (this.options.lineLength) {
          b64 = wrap2(b64, this.options.lineLength);
          let lastLF = b64.lastIndexOf("\n");
          if (lastLF < 0) {
            this._curLine = b64;
            b64 = "";
          } else if (lastLF === b64.length - 1) {
            this._curLine = "";
          } else {
            this._curLine = b64.substr(lastLF + 1);
            b64 = b64.substr(0, lastLF + 1);
          }
        }
        if (b64) {
          this.outputBytes += b64.length;
          this.push(Buffer.from(b64, "ascii"));
        }
        setImmediate(done);
      }
      _flush(done) {
        if (this._remainingBytes && this._remainingBytes.length) {
          this._curLine += encode(this._remainingBytes);
        }
        if (this._curLine) {
          this._curLine = wrap2(this._curLine, this.options.lineLength);
          this.outputBytes += this._curLine.length;
          this.push(this._curLine, "ascii");
          this._curLine = "";
        }
        done();
      }
    };
    module.exports = {
      encode,
      wrap: wrap2,
      Encoder
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/qp/index.js
var require_qp = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/qp/index.js"(exports, module) {
    "use strict";
    var Transform = __require("node:stream").Transform;
    function encode(buffer) {
      if (typeof buffer === "string") {
        buffer = Buffer.from(buffer, "utf-8");
      }
      let ranges = [
        // https://tools.ietf.org/html/rfc2045#section-6.7
        [
          9
        ],
        [
          10
        ],
        [
          13
        ],
        [
          32,
          60
        ],
        [
          62,
          126
        ]
        // >?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}
      ];
      let result = "";
      let ord;
      for (let i = 0, len = buffer.length; i < len; i++) {
        ord = buffer[i];
        if (checkRanges(ord, ranges) && !((ord === 32 || ord === 9) && (i === len - 1 || buffer[i + 1] === 10 || buffer[i + 1] === 13))) {
          result += String.fromCharCode(ord);
          continue;
        }
        result += "=" + (ord < 16 ? "0" : "") + ord.toString(16).toUpperCase();
      }
      return result;
    }
    function wrap2(str, lineLength) {
      str = (str || "").toString();
      lineLength = lineLength || 76;
      if (str.length <= lineLength) {
        return str;
      }
      let pos = 0;
      let len = str.length;
      let match, code, line;
      let lineMargin = Math.floor(lineLength / 3);
      let result = "";
      while (pos < len) {
        line = str.substr(pos, lineLength);
        if (match = line.match(/\r\n/)) {
          line = line.substr(0, match.index + match[0].length);
          result += line;
          pos += line.length;
          continue;
        }
        if (line.substr(-1) === "\n") {
          result += line;
          pos += line.length;
          continue;
        } else if (match = line.substr(-lineMargin).match(/\n.*?$/)) {
          line = line.substr(0, line.length - (match[0].length - 1));
          result += line;
          pos += line.length;
          continue;
        } else if (line.length > lineLength - lineMargin && (match = line.substr(-lineMargin).match(/[ \t.,!?][^ \t.,!?]*$/))) {
          line = line.substr(0, line.length - (match[0].length - 1));
        } else if (line.match(/[=][\da-f]{0,2}$/i)) {
          if (match = line.match(/[=][\da-f]{0,1}$/i)) {
            line = line.substr(0, line.length - match[0].length);
          }
          while (line.length > 3 && line.length < len - pos && !line.match(/^(?:=[\da-f]{2}){1,4}$/i) && (match = line.match(/[=][\da-f]{2}$/gi))) {
            code = parseInt(match[0].substr(1, 2), 16);
            if (code < 128) {
              break;
            }
            line = line.substr(0, line.length - 3);
            if (code >= 192) {
              break;
            }
          }
        }
        if (pos + line.length < len && line.substr(-1) !== "\n") {
          if (line.length === lineLength && line.match(/[=][\da-f]{2}$/i)) {
            line = line.substr(0, line.length - 3);
          } else if (line.length === lineLength) {
            line = line.substr(0, line.length - 1);
          }
          pos += line.length;
          line += "=\r\n";
        } else {
          pos += line.length;
        }
        result += line;
      }
      return result;
    }
    function checkRanges(nr, ranges) {
      for (let i = ranges.length - 1; i >= 0; i--) {
        if (!ranges[i].length) {
          continue;
        }
        if (ranges[i].length === 1 && nr === ranges[i][0]) {
          return true;
        }
        if (ranges[i].length === 2 && nr >= ranges[i][0] && nr <= ranges[i][1]) {
          return true;
        }
      }
      return false;
    }
    var Encoder = class extends Transform {
      constructor(options) {
        super();
        this.options = options || {};
        if (this.options.lineLength !== false) {
          this.options.lineLength = this.options.lineLength || 76;
        }
        this._curLine = "";
        this.inputBytes = 0;
        this.outputBytes = 0;
      }
      _transform(chunk, encoding, done) {
        let qp;
        if (encoding !== "buffer") {
          chunk = Buffer.from(chunk, encoding);
        }
        if (!chunk || !chunk.length) {
          return done();
        }
        this.inputBytes += chunk.length;
        if (this.options.lineLength) {
          qp = this._curLine + encode(chunk);
          qp = wrap2(qp, this.options.lineLength);
          qp = qp.replace(/(^|\n)([^\n]*)$/, (match, lineBreak, lastLine) => {
            this._curLine = lastLine;
            return lineBreak;
          });
          if (qp) {
            this.outputBytes += qp.length;
            this.push(qp);
          }
        } else {
          qp = encode(chunk);
          this.outputBytes += qp.length;
          this.push(qp, "ascii");
        }
        done();
      }
      _flush(done) {
        if (this._curLine) {
          this.outputBytes += this._curLine.length;
          this.push(this._curLine, "ascii");
        }
        done();
      }
    };
    module.exports = {
      encode,
      wrap: wrap2,
      Encoder
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-funcs/index.js
var require_mime_funcs = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-funcs/index.js"(exports, module) {
    "use strict";
    var base64 = require_base64();
    var qp = require_qp();
    var mimeTypes = require_mime_types();
    module.exports = {
      /**
         * Checks if a value is plaintext string (uses only printable 7bit chars)
         *
         * @param {String} value String to be tested
         * @returns {Boolean} true if it is a plaintext string
         */
      isPlainText(value, isParam) {
        const re = isParam ? /[\x00-\x08\x0b\x0c\x0e-\x1f"\u0080-\uFFFF]/ : /[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/;
        if (typeof value !== "string" || re.test(value)) {
          return false;
        } else {
          return true;
        }
      },
      /**
         * Checks if a multi line string containes lines longer than the selected value.
         *
         * Useful when detecting if a mail message needs any processing at all –
         * if only plaintext characters are used and lines are short, then there is
         * no need to encode the values in any way. If the value is plaintext but has
         * longer lines then allowed, then use format=flowed
         *
         * @param {Number} lineLength Max line length to check for
         * @returns {Boolean} Returns true if there is at least one line longer than lineLength chars
         */
      hasLongerLines(str, lineLength) {
        if (str.length > 128 * 1024) {
          return true;
        }
        return new RegExp("^.{" + (lineLength + 1) + ",}", "m").test(str);
      },
      /**
         * Encodes a string or an Buffer to an UTF-8 MIME Word (rfc2047)
         *
         * @param {String|Buffer} data String to be encoded
         * @param {String} mimeWordEncoding='Q' Encoding for the mime word, either Q or B
         * @param {Number} [maxLength=0] If set, split mime words into several chunks if needed
         * @return {String} Single or several mime words joined together
         */
      encodeWord(data, mimeWordEncoding, maxLength) {
        mimeWordEncoding = (mimeWordEncoding || "Q").toString().toUpperCase().trim().charAt(0);
        maxLength = maxLength || 0;
        let encodedStr;
        let toCharset = "UTF-8";
        if (maxLength && maxLength > 7 + toCharset.length) {
          maxLength -= 7 + toCharset.length;
        }
        if (mimeWordEncoding === "Q") {
          encodedStr = qp.encode(data).replace(/[^a-z0-9!*+\-/=]/gi, (chr) => {
            let ord = chr.charCodeAt(0).toString(16).toUpperCase();
            if (chr === " ") {
              return "_";
            } else {
              return "=" + (ord.length === 1 ? "0" + ord : ord);
            }
          });
        } else if (mimeWordEncoding === "B") {
          encodedStr = typeof data === "string" ? data : base64.encode(data);
          maxLength = maxLength ? Math.max(3, (maxLength - maxLength % 4) / 4 * 3) : 0;
        }
        if (maxLength && (mimeWordEncoding !== "B" ? encodedStr : base64.encode(data)).length > maxLength) {
          if (mimeWordEncoding === "Q") {
            encodedStr = this.splitMimeEncodedString(encodedStr, maxLength).join("?= =?" + toCharset + "?" + mimeWordEncoding + "?");
          } else {
            let parts = [];
            let lpart = "";
            for (let i = 0, len = encodedStr.length; i < len; i++) {
              let chr = encodedStr.charAt(i);
              if (/[\ud83c\ud83d\ud83e]/.test(chr) && i < len - 1) {
                chr += encodedStr.charAt(++i);
              }
              if (Buffer.byteLength(lpart + chr) <= maxLength || i === 0) {
                lpart += chr;
              } else {
                parts.push(base64.encode(lpart));
                lpart = chr;
              }
            }
            if (lpart) {
              parts.push(base64.encode(lpart));
            }
            if (parts.length > 1) {
              encodedStr = parts.join("?= =?" + toCharset + "?" + mimeWordEncoding + "?");
            } else {
              encodedStr = parts.join("");
            }
          }
        } else if (mimeWordEncoding === "B") {
          encodedStr = base64.encode(data);
        }
        return "=?" + toCharset + "?" + mimeWordEncoding + "?" + encodedStr + (encodedStr.substr(-2) === "?=" ? "" : "?=");
      },
      /**
         * Finds word sequences with non ascii text and converts these to mime words
         *
         * @param {String} value String to be encoded
         * @param {String} mimeWordEncoding='Q' Encoding for the mime word, either Q or B
         * @param {Number} [maxLength=0] If set, split mime words into several chunks if needed
         * @param {Boolean} [encodeAll=false] If true and the value needs encoding then encodes entire string, not just the smallest match
         * @return {String} String with possible mime words
         */
      encodeWords(value, mimeWordEncoding, maxLength, encodeAll) {
        maxLength = maxLength || 0;
        let encodedValue;
        let firstMatch = value.match(/(?:^|\s)([^\s]*["\u0080-\uFFFF])/);
        if (!firstMatch) {
          return value;
        }
        if (encodeAll) {
          return this.encodeWord(value, mimeWordEncoding, maxLength);
        }
        let lastMatch = value.match(/(["\u0080-\uFFFF][^\s]*)[^"\u0080-\uFFFF]*$/);
        if (!lastMatch) {
          return value;
        }
        let startIndex = firstMatch.index + (firstMatch[0].match(/[^\s]/) || {
          index: 0
        }).index;
        let endIndex = lastMatch.index + (lastMatch[1] || "").length;
        encodedValue = (startIndex ? value.substr(0, startIndex) : "") + this.encodeWord(value.substring(startIndex, endIndex), mimeWordEncoding || "Q", maxLength) + (endIndex < value.length ? value.substr(endIndex) : "");
        return encodedValue;
      },
      /**
         * Joins parsed header value together as 'value; param1=value1; param2=value2'
         * PS: We are following RFC 822 for the list of special characters that we need to keep in quotes.
         *      Refer: https://www.w3.org/Protocols/rfc1341/4_Content-Type.html
         * @param {Object} structured Parsed header value
         * @return {String} joined header value
         */
      buildHeaderValue(structured) {
        let paramsArray = [];
        Object.keys(structured.params || {}).forEach((param) => {
          let value = structured.params[param];
          if (!this.isPlainText(value, true) || value.length >= 75) {
            this.buildHeaderParam(param, value, 50).forEach((encodedParam) => {
              if (!/[\s"\\;:/=(),<>@[\]?]|^[-']|'$/.test(encodedParam.value) || encodedParam.key.substr(-1) === "*") {
                paramsArray.push(encodedParam.key + "=" + encodedParam.value);
              } else {
                paramsArray.push(encodedParam.key + "=" + JSON.stringify(encodedParam.value));
              }
            });
          } else if (/[\s'"\\;:/=(),<>@[\]?]|^-/.test(value)) {
            paramsArray.push(param + "=" + JSON.stringify(value));
          } else {
            paramsArray.push(param + "=" + value);
          }
        });
        return structured.value + (paramsArray.length ? "; " + paramsArray.join("; ") : "");
      },
      /**
         * Encodes a string or an Buffer to an UTF-8 Parameter Value Continuation encoding (rfc2231)
         * Useful for splitting long parameter values.
         *
         * For example
         *      title="unicode string"
         * becomes
         *     title*0*=utf-8''unicode
         *     title*1*=%20string
         *
         * @param {String|Buffer} data String to be encoded
         * @param {Number} [maxLength=50] Max length for generated chunks
         * @param {String} [fromCharset='UTF-8'] Source sharacter set
         * @return {Array} A list of encoded keys and headers
         */
      buildHeaderParam(key, data, maxLength) {
        let list = [];
        let encodedStr = typeof data === "string" ? data : (data || "").toString();
        let encodedStrArr;
        let chr, ord;
        let line;
        let startPos = 0;
        let i, len;
        maxLength = maxLength || 50;
        if (this.isPlainText(data, true)) {
          if (encodedStr.length <= maxLength) {
            return [
              {
                key,
                value: encodedStr
              }
            ];
          }
          encodedStr = encodedStr.replace(new RegExp(".{" + maxLength + "}", "g"), (str) => {
            list.push({
              line: str
            });
            return "";
          });
          if (encodedStr) {
            list.push({
              line: encodedStr
            });
          }
        } else {
          if (/[\uD800-\uDBFF]/.test(encodedStr)) {
            encodedStrArr = [];
            for (i = 0, len = encodedStr.length; i < len; i++) {
              chr = encodedStr.charAt(i);
              ord = chr.charCodeAt(0);
              if (ord >= 55296 && ord <= 56319 && i < len - 1) {
                chr += encodedStr.charAt(i + 1);
                encodedStrArr.push(chr);
                i++;
              } else {
                encodedStrArr.push(chr);
              }
            }
            encodedStr = encodedStrArr;
          }
          line = "utf-8''";
          let encoded = true;
          startPos = 0;
          for (i = 0, len = encodedStr.length; i < len; i++) {
            chr = encodedStr[i];
            if (encoded) {
              chr = this.safeEncodeURIComponent(chr);
            } else {
              chr = chr === " " ? chr : this.safeEncodeURIComponent(chr);
              if (chr !== encodedStr[i]) {
                if ((this.safeEncodeURIComponent(line) + chr).length >= maxLength) {
                  list.push({
                    line,
                    encoded
                  });
                  line = "";
                  startPos = i - 1;
                } else {
                  encoded = true;
                  i = startPos;
                  line = "";
                  continue;
                }
              }
            }
            if ((line + chr).length >= maxLength) {
              list.push({
                line,
                encoded
              });
              line = chr = encodedStr[i] === " " ? " " : this.safeEncodeURIComponent(encodedStr[i]);
              if (chr === encodedStr[i]) {
                encoded = false;
                startPos = i - 1;
              } else {
                encoded = true;
              }
            } else {
              line += chr;
            }
          }
          if (line) {
            list.push({
              line,
              encoded
            });
          }
        }
        return list.map((item, i2) => ({
          // encoded lines: {name}*{part}*
          // unencoded lines: {name}*{part}
          // if any line needs to be encoded then the first line (part==0) is always encoded
          key: key + "*" + i2 + (item.encoded ? "*" : ""),
          value: item.line
        }));
      },
      /**
         * Parses a header value with key=value arguments into a structured
         * object.
         *
         *   parseHeaderValue('content-type: text/plain; CHARSET='UTF-8'') ->
         *   {
         *     'value': 'text/plain',
         *     'params': {
         *       'charset': 'UTF-8'
         *     }
         *   }
         *
         * @param {String} str Header value
         * @return {Object} Header value as a parsed structure
         */
      parseHeaderValue(str) {
        let response = {
          value: false,
          params: {}
        };
        let key = false;
        let value = "";
        let type = "value";
        let quote = false;
        let escaped = false;
        let chr;
        for (let i = 0, len = str.length; i < len; i++) {
          chr = str.charAt(i);
          if (type === "key") {
            if (chr === "=") {
              key = value.trim().toLowerCase();
              type = "value";
              value = "";
              continue;
            }
            value += chr;
          } else {
            if (escaped) {
              value += chr;
            } else if (chr === "\\") {
              escaped = true;
              continue;
            } else if (quote && chr === quote) {
              quote = false;
            } else if (!quote && chr === '"') {
              quote = chr;
            } else if (!quote && chr === ";") {
              if (key === false) {
                response.value = value.trim();
              } else {
                response.params[key] = value.trim();
              }
              type = "key";
              value = "";
            } else {
              value += chr;
            }
            escaped = false;
          }
        }
        if (type === "value") {
          if (key === false) {
            response.value = value.trim();
          } else {
            response.params[key] = value.trim();
          }
        } else if (value.trim()) {
          response.params[value.trim().toLowerCase()] = "";
        }
        Object.keys(response.params).forEach((key2) => {
          let actualKey, nr, match, value2;
          if (match = key2.match(/(\*(\d+)|\*(\d+)\*|\*)$/)) {
            actualKey = key2.substr(0, match.index);
            nr = Number(match[2] || match[3]) || 0;
            if (!response.params[actualKey] || typeof response.params[actualKey] !== "object") {
              response.params[actualKey] = {
                charset: false,
                values: []
              };
            }
            value2 = response.params[key2];
            if (nr === 0 && match[0].substr(-1) === "*" && (match = value2.match(/^([^']*)'[^']*'(.*)$/))) {
              response.params[actualKey].charset = match[1] || "iso-8859-1";
              value2 = match[2];
            }
            response.params[actualKey].values[nr] = value2;
            delete response.params[key2];
          }
        });
        Object.keys(response.params).forEach((key2) => {
          let value2;
          if (response.params[key2] && Array.isArray(response.params[key2].values)) {
            value2 = response.params[key2].values.map((val2) => val2 || "").join("");
            if (response.params[key2].charset) {
              response.params[key2] = "=?" + response.params[key2].charset + "?Q?" + value2.replace(/[=?_\s]/g, (s) => {
                let c = s.charCodeAt(0).toString(16);
                if (s === " ") {
                  return "_";
                } else {
                  return "%" + (c.length < 2 ? "0" : "") + c;
                }
              }).replace(/%/g, "=") + "?=";
            } else {
              response.params[key2] = value2;
            }
          }
        });
        return response;
      },
      /**
         * Returns file extension for a content type string. If no suitable extensions
         * are found, 'bin' is used as the default extension
         *
         * @param {String} mimeType Content type to be checked for
         * @return {String} File extension
         */
      detectExtension: (mimeType) => mimeTypes.detectExtension(mimeType),
      /**
         * Returns content type for a file extension. If no suitable content types
         * are found, 'application/octet-stream' is used as the default content type
         *
         * @param {String} extension Extension to be checked for
         * @return {String} File extension
         */
      detectMimeType: (extension) => mimeTypes.detectMimeType(extension),
      /**
         * Folds long lines, useful for folding header lines (afterSpace=false) and
         * flowed text (afterSpace=true)
         *
         * @param {String} str String to be folded
         * @param {Number} [lineLength=76] Maximum length of a line
         * @param {Boolean} afterSpace If true, leave a space in th end of a line
         * @return {String} String with folded lines
         */
      foldLines(str, lineLength, afterSpace) {
        str = (str || "").toString();
        lineLength = lineLength || 76;
        let pos = 0, len = str.length, result = "", line, match;
        while (pos < len) {
          line = str.substr(pos, lineLength);
          if (line.length < lineLength) {
            result += line;
            break;
          }
          if (match = line.match(/^[^\n\r]*(\r?\n|\r)/)) {
            line = match[0];
            result += line;
            pos += line.length;
            continue;
          } else if ((match = line.match(/(\s+)[^\s]*$/)) && match[0].length - (afterSpace ? (match[1] || "").length : 0) < line.length) {
            line = line.substr(0, line.length - (match[0].length - (afterSpace ? (match[1] || "").length : 0)));
          } else if (match = str.substr(pos + line.length).match(/^[^\s]+(\s*)/)) {
            line = line + match[0].substr(0, match[0].length - (!afterSpace ? (match[1] || "").length : 0));
          }
          result += line;
          pos += line.length;
          if (pos < len) {
            result += "\r\n";
          }
        }
        return result;
      },
      /**
         * Splits a mime encoded string. Needed for dividing mime words into smaller chunks
         *
         * @param {String} str Mime encoded string to be split up
         * @param {Number} maxlen Maximum length of characters for one part (minimum 12)
         * @return {Array} Split string
         */
      splitMimeEncodedString: (str, maxlen) => {
        let curLine, match, chr, done, lines = [];
        maxlen = Math.max(maxlen || 0, 12);
        while (str.length) {
          curLine = str.substr(0, maxlen);
          if (match = curLine.match(/[=][0-9A-F]?$/i)) {
            curLine = curLine.substr(0, match.index);
          }
          done = false;
          while (!done) {
            done = true;
            if (match = str.substr(curLine.length).match(/^[=]([0-9A-F]{2})/i)) {
              chr = parseInt(match[1], 16);
              if (chr < 194 && chr > 127) {
                curLine = curLine.substr(0, curLine.length - 3);
                done = false;
              }
            }
          }
          if (curLine.length) {
            lines.push(curLine);
          }
          str = str.substr(curLine.length);
        }
        return lines;
      },
      encodeURICharComponent: (chr) => {
        let res = "";
        let ord = chr.charCodeAt(0).toString(16).toUpperCase();
        if (ord.length % 2) {
          ord = "0" + ord;
        }
        if (ord.length > 2) {
          for (let i = 0, len = ord.length / 2; i < len; i++) {
            res += "%" + ord.substr(i, 2);
          }
        } else {
          res += "%" + ord;
        }
        return res;
      },
      safeEncodeURIComponent(str) {
        str = (str || "").toString();
        try {
          str = encodeURIComponent(str);
        } catch (E) {
          return str.replace(/[^\x00-\x1F *'()<>@,;:\\"[\]?=\u007F-\uFFFF]+/g, "");
        }
        return str.replace(/[\x00-\x1F *'()<>@,;:\\"[\]?=\u007F-\uFFFF]/g, (chr) => this.encodeURICharComponent(chr));
      }
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/addressparser/index.js
var require_addressparser = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/addressparser/index.js"(exports, module) {
    "use strict";
    function _handleAddress(tokens) {
      let token;
      let isGroup = false;
      let state = "text";
      let address;
      let addresses = [];
      let data = {
        address: [],
        comment: [],
        group: [],
        text: []
      };
      let i;
      let len;
      for (i = 0, len = tokens.length; i < len; i++) {
        token = tokens[i];
        if (token.type === "operator") {
          switch (token.value) {
            case "<":
              state = "address";
              break;
            case "(":
              state = "comment";
              break;
            case ":":
              state = "group";
              isGroup = true;
              break;
            default:
              state = "text";
          }
        } else if (token.value) {
          if (state === "address") {
            token.value = token.value.replace(/^[^<]*<\s*/, "");
          }
          data[state].push(token.value);
        }
      }
      if (!data.text.length && data.comment.length) {
        data.text = data.comment;
        data.comment = [];
      }
      if (isGroup) {
        data.text = data.text.join(" ");
        addresses.push({
          name: data.text || address && address.name,
          group: data.group.length ? addressparser(data.group.join(",")) : []
        });
      } else {
        if (!data.address.length && data.text.length) {
          for (i = data.text.length - 1; i >= 0; i--) {
            if (data.text[i].match(/^[^@\s]+@[^@\s]+$/)) {
              data.address = data.text.splice(i, 1);
              break;
            }
          }
          let _regexHandler = function(address2) {
            if (!data.address.length) {
              data.address = [
                address2.trim()
              ];
              return " ";
            } else {
              return address2;
            }
          };
          if (!data.address.length) {
            for (i = data.text.length - 1; i >= 0; i--) {
              data.text[i] = data.text[i].replace(/\s*\b[^@\s]+@[^\s]+\b\s*/, _regexHandler).trim();
              if (data.address.length) {
                break;
              }
            }
          }
        }
        if (!data.text.length && data.comment.length) {
          data.text = data.comment;
          data.comment = [];
        }
        if (data.address.length > 1) {
          data.text = data.text.concat(data.address.splice(1));
        }
        data.text = data.text.join(" ");
        data.address = data.address.join(" ");
        if (!data.address && isGroup) {
          return [];
        } else {
          address = {
            address: data.address || data.text || "",
            name: data.text || data.address || ""
          };
          if (address.address === address.name) {
            if ((address.address || "").match(/@/)) {
              address.name = "";
            } else {
              address.address = "";
            }
          }
          addresses.push(address);
        }
      }
      return addresses;
    }
    var Tokenizer = class {
      constructor(str) {
        this.str = (str || "").toString();
        this.operatorCurrent = "";
        this.operatorExpecting = "";
        this.node = null;
        this.escaped = false;
        this.list = [];
        this.operators = {
          '"': '"',
          "(": ")",
          "<": ">",
          ",": "",
          ":": ";",
          // Semicolons are not a legal delimiter per the RFC2822 grammar other
          // than for terminating a group, but they are also not valid for any
          // other use in this context.  Given that some mail clients have
          // historically allowed the semicolon as a delimiter equivalent to the
          // comma in their UI, it makes sense to treat them the same as a comma
          // when used outside of a group.
          ";": ""
        };
      }
      /**
         * Tokenizes the original input string
         *
         * @return {Array} An array of operator|text tokens
         */
      tokenize() {
        let chr, list = [];
        for (let i = 0, len = this.str.length; i < len; i++) {
          chr = this.str.charAt(i);
          this.checkChar(chr);
        }
        this.list.forEach((node) => {
          node.value = (node.value || "").toString().trim();
          if (node.value) {
            list.push(node);
          }
        });
        return list;
      }
      /**
         * Checks if a character is an operator or text and acts accordingly
         *
         * @param {String} chr Character from the address field
         */
      checkChar(chr) {
        if (this.escaped) {
        } else if (chr === this.operatorExpecting) {
          this.node = {
            type: "operator",
            value: chr
          };
          this.list.push(this.node);
          this.node = null;
          this.operatorExpecting = "";
          this.escaped = false;
          return;
        } else if (!this.operatorExpecting && chr in this.operators) {
          this.node = {
            type: "operator",
            value: chr
          };
          this.list.push(this.node);
          this.node = null;
          this.operatorExpecting = this.operators[chr];
          this.escaped = false;
          return;
        } else if ([
          '"',
          "'"
        ].includes(this.operatorExpecting) && chr === "\\") {
          this.escaped = true;
          return;
        }
        if (!this.node) {
          this.node = {
            type: "text",
            value: ""
          };
          this.list.push(this.node);
        }
        if (chr === "\n") {
          chr = " ";
        }
        if (chr.charCodeAt(0) >= 33 || [
          " ",
          "	"
        ].includes(chr)) {
          this.node.value += chr;
        }
        this.escaped = false;
      }
    };
    function addressparser(str, options) {
      options = options || {};
      let tokenizer = new Tokenizer(str);
      let tokens = tokenizer.tokenize();
      let addresses = [];
      let address = [];
      let parsedAddresses = [];
      tokens.forEach((token) => {
        if (token.type === "operator" && (token.value === "," || token.value === ";")) {
          if (address.length) {
            addresses.push(address);
          }
          address = [];
        } else {
          address.push(token);
        }
      });
      if (address.length) {
        addresses.push(address);
      }
      addresses.forEach((address2) => {
        address2 = _handleAddress(address2);
        if (address2.length) {
          parsedAddresses = parsedAddresses.concat(address2);
        }
      });
      if (options.flatten) {
        let addresses2 = [];
        let walkAddressList = (list) => {
          list.forEach((address2) => {
            if (address2.group) {
              return walkAddressList(address2.group);
            } else {
              addresses2.push(address2);
            }
          });
        };
        walkAddressList(parsedAddresses);
        return addresses2;
      }
      return parsedAddresses;
    }
    module.exports = addressparser;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-node/last-newline.js
var require_last_newline = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-node/last-newline.js"(exports, module) {
    "use strict";
    var Transform = __require("node:stream").Transform;
    var LastNewline = class extends Transform {
      constructor() {
        super();
        this.lastByte = false;
      }
      _transform(chunk, encoding, done) {
        if (chunk.length) {
          this.lastByte = chunk[chunk.length - 1];
        }
        this.push(chunk);
        done();
      }
      _flush(done) {
        if (this.lastByte === 10) {
          return done();
        }
        if (this.lastByte === 13) {
          this.push(Buffer.from("\n"));
          return done();
        }
        this.push(Buffer.from("\r\n"));
        return done();
      }
    };
    module.exports = LastNewline;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-node/le-windows.js
var require_le_windows = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-node/le-windows.js"(exports, module) {
    "use strict";
    var stream = __require("node:stream");
    var Transform = stream.Transform;
    var LeWindows = class extends Transform {
      constructor(options) {
        super(options);
        this.options = options || {};
        this.lastByte = false;
      }
      /**
         * Escapes dots
         */
      _transform(chunk, encoding, done) {
        let buf;
        let lastPos = 0;
        for (let i = 0, len = chunk.length; i < len; i++) {
          if (chunk[i] === 10) {
            if (i && chunk[i - 1] !== 13 || !i && this.lastByte !== 13) {
              if (i > lastPos) {
                buf = chunk.slice(lastPos, i);
                this.push(buf);
              }
              this.push(Buffer.from("\r\n"));
              lastPos = i + 1;
            }
          }
        }
        if (lastPos && lastPos < chunk.length) {
          buf = chunk.slice(lastPos);
          this.push(buf);
        } else if (!lastPos) {
          this.push(chunk);
        }
        this.lastByte = chunk[chunk.length - 1];
        done();
      }
    };
    module.exports = LeWindows;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-node/le-unix.js
var require_le_unix = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-node/le-unix.js"(exports, module) {
    "use strict";
    var stream = __require("node:stream");
    var Transform = stream.Transform;
    var LeWindows = class extends Transform {
      constructor(options) {
        super(options);
        this.options = options || {};
      }
      /**
         * Escapes dots
         */
      _transform(chunk, encoding, done) {
        let buf;
        let lastPos = 0;
        for (let i = 0, len = chunk.length; i < len; i++) {
          if (chunk[i] === 13) {
            buf = chunk.slice(lastPos, i);
            lastPos = i + 1;
            this.push(buf);
          }
        }
        if (lastPos && lastPos < chunk.length) {
          buf = chunk.slice(lastPos);
          this.push(buf);
        } else if (!lastPos) {
          this.push(chunk);
        }
        done();
      }
    };
    module.exports = LeWindows;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-node/index.js
var require_mime_node = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mime-node/index.js"(exports, module) {
    "use strict";
    var crypto2 = __require("node:crypto");
    var fs = __require("node:fs");
    var punycode = require_punycode();
    var PassThrough = __require("node:stream").PassThrough;
    var shared = require_shared();
    var mimeFuncs = require_mime_funcs();
    var qp = require_qp();
    var base64 = require_base64();
    var addressparser = require_addressparser();
    var nmfetch = require_fetch();
    var LastNewline = require_last_newline();
    var LeWindows = require_le_windows();
    var LeUnix = require_le_unix();
    var MimeNode = class _MimeNode {
      constructor(contentType, options) {
        this.nodeCounter = 0;
        options = options || {};
        this.baseBoundary = options.baseBoundary || crypto2.randomBytes(8).toString("hex");
        this.boundaryPrefix = options.boundaryPrefix || "--_NmP";
        this.disableFileAccess = !!options.disableFileAccess;
        this.disableUrlAccess = !!options.disableUrlAccess;
        this.normalizeHeaderKey = options.normalizeHeaderKey;
        this.date = /* @__PURE__ */ new Date();
        this.rootNode = options.rootNode || this;
        this.keepBcc = !!options.keepBcc;
        if (options.filename) {
          this.filename = options.filename;
          if (!contentType) {
            contentType = mimeFuncs.detectMimeType(this.filename.split(".").pop());
          }
        }
        this.textEncoding = (options.textEncoding || "").toString().trim().charAt(0).toUpperCase();
        this.parentNode = options.parentNode;
        this.hostname = options.hostname;
        this.newline = options.newline;
        this.childNodes = [];
        this._nodeId = ++this.rootNode.nodeCounter;
        this._headers = [];
        this._isPlainText = false;
        this._hasLongLines = false;
        this._envelope = false;
        this._raw = false;
        this._transforms = [];
        this._processFuncs = [];
        if (contentType) {
          this.setHeader("Content-Type", contentType);
        }
      }
      /////// PUBLIC METHODS
      /**
         * Creates and appends a child node.Arguments provided are passed to MimeNode constructor
         *
         * @param {String} [contentType] Optional content type
         * @param {Object} [options] Optional options object
         * @return {Object} Created node object
         */
      createChild(contentType, options) {
        if (!options && typeof contentType === "object") {
          options = contentType;
          contentType = void 0;
        }
        let node = new _MimeNode(contentType, options);
        this.appendChild(node);
        return node;
      }
      /**
         * Appends an existing node to the mime tree. Removes the node from an existing
         * tree if needed
         *
         * @param {Object} childNode node to be appended
         * @return {Object} Appended node object
         */
      appendChild(childNode) {
        if (childNode.rootNode !== this.rootNode) {
          childNode.rootNode = this.rootNode;
          childNode._nodeId = ++this.rootNode.nodeCounter;
        }
        childNode.parentNode = this;
        this.childNodes.push(childNode);
        return childNode;
      }
      /**
         * Replaces current node with another node
         *
         * @param {Object} node Replacement node
         * @return {Object} Replacement node
         */
      replace(node) {
        if (node === this) {
          return this;
        }
        this.parentNode.childNodes.forEach((childNode, i) => {
          if (childNode === this) {
            node.rootNode = this.rootNode;
            node.parentNode = this.parentNode;
            node._nodeId = this._nodeId;
            this.rootNode = this;
            this.parentNode = void 0;
            node.parentNode.childNodes[i] = node;
          }
        });
        return node;
      }
      /**
         * Removes current node from the mime tree
         *
         * @return {Object} removed node
         */
      remove() {
        if (!this.parentNode) {
          return this;
        }
        for (let i = this.parentNode.childNodes.length - 1; i >= 0; i--) {
          if (this.parentNode.childNodes[i] === this) {
            this.parentNode.childNodes.splice(i, 1);
            this.parentNode = void 0;
            this.rootNode = this;
            return this;
          }
        }
      }
      /**
         * Sets a header value. If the value for selected key exists, it is overwritten.
         * You can set multiple values as well by using [{key:'', value:''}] or
         * {key: 'value'} as the first argument.
         *
         * @param {String|Array|Object} key Header key or a list of key value pairs
         * @param {String} value Header value
         * @return {Object} current node
         */
      setHeader(key, value) {
        let added = false, headerValue;
        if (!value && key && typeof key === "object") {
          if (key.key && "value" in key) {
            this.setHeader(key.key, key.value);
          } else if (Array.isArray(key)) {
            key.forEach((i) => {
              this.setHeader(i.key, i.value);
            });
          } else {
            Object.keys(key).forEach((i) => {
              this.setHeader(i, key[i]);
            });
          }
          return this;
        }
        key = this._normalizeHeaderKey(key);
        headerValue = {
          key,
          value
        };
        for (let i = 0, len = this._headers.length; i < len; i++) {
          if (this._headers[i].key === key) {
            if (!added) {
              this._headers[i] = headerValue;
              added = true;
            } else {
              this._headers.splice(i, 1);
              i--;
              len--;
            }
          }
        }
        if (!added) {
          this._headers.push(headerValue);
        }
        return this;
      }
      /**
         * Adds a header value. If the value for selected key exists, the value is appended
         * as a new field and old one is not touched.
         * You can set multiple values as well by using [{key:'', value:''}] or
         * {key: 'value'} as the first argument.
         *
         * @param {String|Array|Object} key Header key or a list of key value pairs
         * @param {String} value Header value
         * @return {Object} current node
         */
      addHeader(key, value) {
        if (!value && key && typeof key === "object") {
          if (key.key && key.value) {
            this.addHeader(key.key, key.value);
          } else if (Array.isArray(key)) {
            key.forEach((i) => {
              this.addHeader(i.key, i.value);
            });
          } else {
            Object.keys(key).forEach((i) => {
              this.addHeader(i, key[i]);
            });
          }
          return this;
        } else if (Array.isArray(value)) {
          value.forEach((val2) => {
            this.addHeader(key, val2);
          });
          return this;
        }
        this._headers.push({
          key: this._normalizeHeaderKey(key),
          value
        });
        return this;
      }
      /**
         * Retrieves the first mathcing value of a selected key
         *
         * @param {String} key Key to search for
         * @retun {String} Value for the key
         */
      getHeader(key) {
        key = this._normalizeHeaderKey(key);
        for (let i = 0, len = this._headers.length; i < len; i++) {
          if (this._headers[i].key === key) {
            return this._headers[i].value;
          }
        }
      }
      /**
         * Sets body content for current node. If the value is a string, charset is added automatically
         * to Content-Type (if it is text/*). If the value is a Buffer, you need to specify
         * the charset yourself
         *
         * @param (String|Buffer) content Body content
         * @return {Object} current node
         */
      setContent(content) {
        this.content = content;
        if (typeof this.content.pipe === "function") {
          this._contentErrorHandler = (err) => {
            this.content.removeListener("error", this._contentErrorHandler);
            this.content = err;
          };
          this.content.once("error", this._contentErrorHandler);
        } else if (typeof this.content === "string") {
          this._isPlainText = mimeFuncs.isPlainText(this.content);
          if (this._isPlainText && mimeFuncs.hasLongerLines(this.content, 76)) {
            this._hasLongLines = true;
          }
        }
        return this;
      }
      build(callback) {
        let promise;
        if (!callback) {
          promise = new Promise((resolve, reject) => {
            callback = shared.callbackPromise(resolve, reject);
          });
        }
        let stream = this.createReadStream();
        let buf = [];
        let buflen = 0;
        let returned = false;
        stream.on("readable", () => {
          let chunk;
          while ((chunk = stream.read()) !== null) {
            buf.push(chunk);
            buflen += chunk.length;
          }
        });
        stream.once("error", (err) => {
          if (returned) {
            return;
          }
          returned = true;
          return callback(err);
        });
        stream.once("end", (chunk) => {
          if (returned) {
            return;
          }
          returned = true;
          if (chunk && chunk.length) {
            buf.push(chunk);
            buflen += chunk.length;
          }
          return callback(null, Buffer.concat(buf, buflen));
        });
        return promise;
      }
      getTransferEncoding() {
        let transferEncoding = false;
        let contentType = (this.getHeader("Content-Type") || "").toString().toLowerCase().trim();
        if (this.content) {
          transferEncoding = (this.getHeader("Content-Transfer-Encoding") || "").toString().toLowerCase().trim();
          if (!transferEncoding || ![
            "base64",
            "quoted-printable"
          ].includes(transferEncoding)) {
            if (/^text\//i.test(contentType)) {
              if (this._isPlainText && !this._hasLongLines) {
                transferEncoding = "7bit";
              } else if (typeof this.content === "string" || this.content instanceof Buffer) {
                transferEncoding = this._getTextEncoding(this.content) === "Q" ? "quoted-printable" : "base64";
              } else {
                transferEncoding = this.textEncoding === "B" ? "base64" : "quoted-printable";
              }
            } else if (!/^(multipart|message)\//i.test(contentType)) {
              transferEncoding = transferEncoding || "base64";
            }
          }
        }
        return transferEncoding;
      }
      /**
         * Builds the header block for the mime node. Append \r\n\r\n before writing the content
         *
         * @returns {String} Headers
         */
      buildHeaders() {
        let transferEncoding = this.getTransferEncoding();
        let headers = [];
        if (transferEncoding) {
          this.setHeader("Content-Transfer-Encoding", transferEncoding);
        }
        if (this.filename && !this.getHeader("Content-Disposition")) {
          this.setHeader("Content-Disposition", "attachment");
        }
        if (this.rootNode === this) {
          if (!this.getHeader("Date")) {
            this.setHeader("Date", this.date.toUTCString().replace(/GMT/, "+0000"));
          }
          this.messageId();
          if (!this.getHeader("MIME-Version")) {
            this.setHeader("MIME-Version", "1.0");
          }
          for (let i = this._headers.length - 2; i >= 0; i--) {
            let header = this._headers[i];
            if (header.key === "Content-Type") {
              this._headers.splice(i, 1);
              this._headers.push(header);
            }
          }
        }
        this._headers.forEach((header) => {
          let key = header.key;
          let value = header.value;
          let structured;
          let param;
          let options = {};
          let formattedHeaders = [
            "From",
            "Sender",
            "To",
            "Cc",
            "Bcc",
            "Reply-To",
            "Date",
            "References"
          ];
          if (value && typeof value === "object" && !formattedHeaders.includes(key)) {
            Object.keys(value).forEach((key2) => {
              if (key2 !== "value") {
                options[key2] = value[key2];
              }
            });
            value = (value.value || "").toString();
            if (!value.trim()) {
              return;
            }
          }
          if (options.prepared) {
            if (options.foldLines) {
              headers.push(mimeFuncs.foldLines(key + ": " + value));
            } else {
              headers.push(key + ": " + value);
            }
            return;
          }
          switch (header.key) {
            case "Content-Disposition":
              structured = mimeFuncs.parseHeaderValue(value);
              if (this.filename) {
                structured.params.filename = this.filename;
              }
              value = mimeFuncs.buildHeaderValue(structured);
              break;
            case "Content-Type":
              structured = mimeFuncs.parseHeaderValue(value);
              this._handleContentType(structured);
              if (structured.value.match(/^text\/plain\b/) && typeof this.content === "string" && /[\u0080-\uFFFF]/.test(this.content)) {
                structured.params.charset = "utf-8";
              }
              value = mimeFuncs.buildHeaderValue(structured);
              if (this.filename) {
                param = this._encodeWords(this.filename);
                if (param !== this.filename || /[\s'"\\;:/=(),<>@[\]?]|^-/.test(param)) {
                  param = '"' + param + '"';
                }
                value += "; name=" + param;
              }
              break;
            case "Bcc":
              if (!this.keepBcc) {
                return;
              }
              break;
          }
          value = this._encodeHeaderValue(key, value);
          if (!(value || "").toString().trim()) {
            return;
          }
          if (typeof this.normalizeHeaderKey === "function") {
            let normalized = this.normalizeHeaderKey(key, value);
            if (normalized && typeof normalized === "string" && normalized.length) {
              key = normalized;
            }
          }
          headers.push(mimeFuncs.foldLines(key + ": " + value, 76));
        });
        return headers.join("\r\n");
      }
      /**
         * Streams the rfc2822 message from the current node. If this is a root node,
         * mandatory header fields are set if missing (Date, Message-Id, MIME-Version)
         *
         * @return {String} Compiled message
         */
      createReadStream(options) {
        options = options || {};
        let stream = new PassThrough(options);
        let outputStream = stream;
        let transform;
        this.stream(stream, options, (err) => {
          if (err) {
            outputStream.emit("error", err);
            return;
          }
          stream.end();
        });
        for (let i = 0, len = this._transforms.length; i < len; i++) {
          transform = typeof this._transforms[i] === "function" ? this._transforms[i]() : this._transforms[i];
          outputStream.once("error", (err) => {
            transform.emit("error", err);
          });
          outputStream = outputStream.pipe(transform);
        }
        transform = new LastNewline();
        outputStream.once("error", (err) => {
          transform.emit("error", err);
        });
        outputStream = outputStream.pipe(transform);
        for (let i = 0, len = this._processFuncs.length; i < len; i++) {
          transform = this._processFuncs[i];
          outputStream = transform(outputStream);
        }
        if (this.newline) {
          const winbreak = [
            "win",
            "windows",
            "dos",
            "\r\n"
          ].includes(this.newline.toString().toLowerCase());
          const newlineTransform = winbreak ? new LeWindows() : new LeUnix();
          const stream2 = outputStream.pipe(newlineTransform);
          outputStream.on("error", (err) => stream2.emit("error", err));
          return stream2;
        }
        return outputStream;
      }
      /**
         * Appends a transform stream object to the transforms list. Final output
         * is passed through this stream before exposing
         *
         * @param {Object} transform Read-Write stream
         */
      transform(transform) {
        this._transforms.push(transform);
      }
      /**
         * Appends a post process function. The functon is run after transforms and
         * uses the following syntax
         *
         *   processFunc(input) -> outputStream
         *
         * @param {Object} processFunc Read-Write stream
         */
      processFunc(processFunc) {
        this._processFuncs.push(processFunc);
      }
      stream(outputStream, options, done) {
        let transferEncoding = this.getTransferEncoding();
        let contentStream;
        let localStream;
        let returned = false;
        let callback = (err) => {
          if (returned) {
            return;
          }
          returned = true;
          done(err);
        };
        let finalize = () => {
          let childId = 0;
          let processChildNode = () => {
            if (childId >= this.childNodes.length) {
              outputStream.write("\r\n--" + this.boundary + "--\r\n");
              return callback();
            }
            let child = this.childNodes[childId++];
            outputStream.write((childId > 1 ? "\r\n" : "") + "--" + this.boundary + "\r\n");
            child.stream(outputStream, options, (err) => {
              if (err) {
                return callback(err);
              }
              setImmediate(processChildNode);
            });
          };
          if (this.multipart) {
            setImmediate(processChildNode);
          } else {
            return callback();
          }
        };
        let sendContent = () => {
          if (this.content) {
            if (Object.prototype.toString.call(this.content) === "[object Error]") {
              return callback(this.content);
            }
            if (typeof this.content.pipe === "function") {
              this.content.removeListener("error", this._contentErrorHandler);
              this._contentErrorHandler = (err) => callback(err);
              this.content.once("error", this._contentErrorHandler);
            }
            let createStream = () => {
              if ([
                "quoted-printable",
                "base64"
              ].includes(transferEncoding)) {
                contentStream = new (transferEncoding === "base64" ? base64 : qp).Encoder(options);
                contentStream.pipe(outputStream, {
                  end: false
                });
                contentStream.once("end", finalize);
                contentStream.once("error", (err) => callback(err));
                localStream = this._getStream(this.content);
                localStream.pipe(contentStream);
              } else {
                localStream = this._getStream(this.content);
                localStream.pipe(outputStream, {
                  end: false
                });
                localStream.once("end", finalize);
              }
              localStream.once("error", (err) => callback(err));
            };
            if (this.content._resolve) {
              let chunks = [];
              let chunklen = 0;
              let returned2 = false;
              let sourceStream = this._getStream(this.content);
              sourceStream.on("error", (err) => {
                if (returned2) {
                  return;
                }
                returned2 = true;
                callback(err);
              });
              sourceStream.on("readable", () => {
                let chunk;
                while ((chunk = sourceStream.read()) !== null) {
                  chunks.push(chunk);
                  chunklen += chunk.length;
                }
              });
              sourceStream.on("end", () => {
                if (returned2) {
                  return;
                }
                returned2 = true;
                this.content._resolve = false;
                this.content._resolvedValue = Buffer.concat(chunks, chunklen);
                setImmediate(createStream);
              });
            } else {
              setImmediate(createStream);
            }
            return;
          } else {
            return setImmediate(finalize);
          }
        };
        if (this._raw) {
          setImmediate(() => {
            if (Object.prototype.toString.call(this._raw) === "[object Error]") {
              return callback(this._raw);
            }
            if (typeof this._raw.pipe === "function") {
              this._raw.removeListener("error", this._contentErrorHandler);
            }
            let raw = this._getStream(this._raw);
            raw.pipe(outputStream, {
              end: false
            });
            raw.on("error", (err) => outputStream.emit("error", err));
            raw.on("end", finalize);
          });
        } else {
          outputStream.write(this.buildHeaders() + "\r\n\r\n");
          setImmediate(sendContent);
        }
      }
      /**
         * Sets envelope to be used instead of the generated one
         *
         * @return {Object} SMTP envelope in the form of {from: 'from@example.com', to: ['to@example.com']}
         */
      setEnvelope(envelope) {
        let list;
        this._envelope = {
          from: false,
          to: []
        };
        if (envelope.from) {
          list = [];
          this._convertAddresses(this._parseAddresses(envelope.from), list);
          list = list.filter((address) => address && address.address);
          if (list.length && list[0]) {
            this._envelope.from = list[0].address;
          }
        }
        [
          "to",
          "cc",
          "bcc"
        ].forEach((key) => {
          if (envelope[key]) {
            this._convertAddresses(this._parseAddresses(envelope[key]), this._envelope.to);
          }
        });
        this._envelope.to = this._envelope.to.map((to) => to.address).filter((address) => address);
        let standardFields = [
          "to",
          "cc",
          "bcc",
          "from"
        ];
        Object.keys(envelope).forEach((key) => {
          if (!standardFields.includes(key)) {
            this._envelope[key] = envelope[key];
          }
        });
        return this;
      }
      /**
         * Generates and returns an object with parsed address fields
         *
         * @return {Object} Address object
         */
      getAddresses() {
        let addresses = {};
        this._headers.forEach((header) => {
          let key = header.key.toLowerCase();
          if ([
            "from",
            "sender",
            "reply-to",
            "to",
            "cc",
            "bcc"
          ].includes(key)) {
            if (!Array.isArray(addresses[key])) {
              addresses[key] = [];
            }
            this._convertAddresses(this._parseAddresses(header.value), addresses[key]);
          }
        });
        return addresses;
      }
      /**
         * Generates and returns SMTP envelope with the sender address and a list of recipients addresses
         *
         * @return {Object} SMTP envelope in the form of {from: 'from@example.com', to: ['to@example.com']}
         */
      getEnvelope() {
        if (this._envelope) {
          return this._envelope;
        }
        let envelope = {
          from: false,
          to: []
        };
        this._headers.forEach((header) => {
          let list = [];
          if (header.key === "From" || !envelope.from && [
            "Reply-To",
            "Sender"
          ].includes(header.key)) {
            this._convertAddresses(this._parseAddresses(header.value), list);
            if (list.length && list[0]) {
              envelope.from = list[0].address;
            }
          } else if ([
            "To",
            "Cc",
            "Bcc"
          ].includes(header.key)) {
            this._convertAddresses(this._parseAddresses(header.value), envelope.to);
          }
        });
        envelope.to = envelope.to.map((to) => to.address);
        return envelope;
      }
      /**
         * Returns Message-Id value. If it does not exist, then creates one
         *
         * @return {String} Message-Id value
         */
      messageId() {
        let messageId = this.getHeader("Message-ID");
        if (!messageId) {
          messageId = this._generateMessageId();
          this.setHeader("Message-ID", messageId);
        }
        return messageId;
      }
      /**
         * Sets pregenerated content that will be used as the output of this node
         *
         * @param {String|Buffer|Stream} Raw MIME contents
         */
      setRaw(raw) {
        this._raw = raw;
        if (this._raw && typeof this._raw.pipe === "function") {
          this._contentErrorHandler = (err) => {
            this._raw.removeListener("error", this._contentErrorHandler);
            this._raw = err;
          };
          this._raw.once("error", this._contentErrorHandler);
        }
        return this;
      }
      /////// PRIVATE METHODS
      /**
         * Detects and returns handle to a stream related with the content.
         *
         * @param {Mixed} content Node content
         * @returns {Object} Stream object
         */
      _getStream(content) {
        let contentStream;
        if (content._resolvedValue) {
          contentStream = new PassThrough();
          setImmediate(() => {
            try {
              contentStream.end(content._resolvedValue);
            } catch (err) {
              contentStream.emit("error", err);
            }
          });
          return contentStream;
        } else if (typeof content.pipe === "function") {
          return content;
        } else if (content && typeof content.path === "string" && !content.href) {
          if (this.disableFileAccess) {
            contentStream = new PassThrough();
            setImmediate(() => contentStream.emit("error", new Error("File access rejected for " + content.path)));
            return contentStream;
          }
          return fs.createReadStream(content.path);
        } else if (content && typeof content.href === "string") {
          if (this.disableUrlAccess) {
            contentStream = new PassThrough();
            setImmediate(() => contentStream.emit("error", new Error("Url access rejected for " + content.href)));
            return contentStream;
          }
          return nmfetch(content.href, {
            headers: content.httpHeaders
          });
        } else {
          contentStream = new PassThrough();
          setImmediate(() => {
            try {
              contentStream.end(content || "");
            } catch (err) {
              contentStream.emit("error", err);
            }
          });
          return contentStream;
        }
      }
      /**
         * Parses addresses. Takes in a single address or an array or an
         * array of address arrays (eg. To: [[first group], [second group],...])
         *
         * @param {Mixed} addresses Addresses to be parsed
         * @return {Array} An array of address objects
         */
      _parseAddresses(addresses) {
        return [].concat.apply([], [].concat(addresses).map((address) => {
          if (address && address.address) {
            address.address = this._normalizeAddress(address.address);
            address.name = address.name || "";
            return [
              address
            ];
          }
          return addressparser(address);
        }));
      }
      /**
         * Normalizes a header key, uses Camel-Case form, except for uppercase MIME-
         *
         * @param {String} key Key to be normalized
         * @return {String} key in Camel-Case form
         */
      _normalizeHeaderKey(key) {
        key = (key || "").toString().replace(/\r?\n|\r/g, " ").trim().toLowerCase().replace(/^X-SMTPAPI$|^(MIME|DKIM|ARC|BIMI)\b|^[a-z]|-(SPF|FBL|ID|MD5)$|-[a-z]/gi, (c) => c.toUpperCase()).replace(/^Content-Features$/i, "Content-features");
        return key;
      }
      /**
         * Checks if the content type is multipart and defines boundary if needed.
         * Doesn't return anything, modifies object argument instead.
         *
         * @param {Object} structured Parsed header value for 'Content-Type' key
         */
      _handleContentType(structured) {
        this.contentType = structured.value.trim().toLowerCase();
        this.multipart = /^multipart\//i.test(this.contentType) ? this.contentType.substr(this.contentType.indexOf("/") + 1) : false;
        if (this.multipart) {
          this.boundary = structured.params.boundary = structured.params.boundary || this.boundary || this._generateBoundary();
        } else {
          this.boundary = false;
        }
      }
      /**
         * Generates a multipart boundary value
         *
         * @return {String} boundary value
         */
      _generateBoundary() {
        return this.rootNode.boundaryPrefix + "-" + this.rootNode.baseBoundary + "-Part_" + this._nodeId;
      }
      /**
         * Encodes a header value for use in the generated rfc2822 email.
         *
         * @param {String} key Header key
         * @param {String} value Header value
         */
      _encodeHeaderValue(key, value) {
        key = this._normalizeHeaderKey(key);
        switch (key) {
          // Structured headers
          case "From":
          case "Sender":
          case "To":
          case "Cc":
          case "Bcc":
          case "Reply-To":
            return this._convertAddresses(this._parseAddresses(value));
          // values enclosed in <>
          case "Message-ID":
          case "In-Reply-To":
          case "Content-Id":
            value = (value || "").toString().replace(/\r?\n|\r/g, " ");
            if (value.charAt(0) !== "<") {
              value = "<" + value;
            }
            if (value.charAt(value.length - 1) !== ">") {
              value = value + ">";
            }
            return value;
          // space separated list of values enclosed in <>
          case "References":
            value = [].concat.apply([], [].concat(value || "").map((elm) => {
              elm = (elm || "").toString().replace(/\r?\n|\r/g, " ").trim();
              return elm.replace(/<[^>]*>/g, (str) => str.replace(/\s/g, "")).split(/\s+/);
            })).map((elm) => {
              if (elm.charAt(0) !== "<") {
                elm = "<" + elm;
              }
              if (elm.charAt(elm.length - 1) !== ">") {
                elm = elm + ">";
              }
              return elm;
            });
            return value.join(" ").trim();
          case "Date":
            if (Object.prototype.toString.call(value) === "[object Date]") {
              return value.toUTCString().replace(/GMT/, "+0000");
            }
            value = (value || "").toString().replace(/\r?\n|\r/g, " ");
            return this._encodeWords(value);
          case "Content-Type":
          case "Content-Disposition":
            return (value || "").toString().replace(/\r?\n|\r/g, " ");
          default:
            value = (value || "").toString().replace(/\r?\n|\r/g, " ");
            return this._encodeWords(value);
        }
      }
      /**
         * Rebuilds address object using punycode and other adjustments
         *
         * @param {Array} addresses An array of address objects
         * @param {Array} [uniqueList] An array to be populated with addresses
         * @return {String} address string
         */
      _convertAddresses(addresses, uniqueList) {
        let values = [];
        uniqueList = uniqueList || [];
        [].concat(addresses || []).forEach((address) => {
          if (address.address) {
            address.address = this._normalizeAddress(address.address);
            if (!address.name) {
              values.push(address.address.indexOf(" ") >= 0 ? `<${address.address}>` : `${address.address}`);
            } else if (address.name) {
              values.push(`${this._encodeAddressName(address.name)} <${address.address}>`);
            }
            if (address.address) {
              if (!uniqueList.filter((a) => a.address === address.address).length) {
                uniqueList.push(address);
              }
            }
          } else if (address.group) {
            let groupListAddresses = (address.group.length ? this._convertAddresses(address.group, uniqueList) : "").trim();
            values.push(`${this._encodeAddressName(address.name)}:${groupListAddresses};`);
          }
        });
        return values.join(", ");
      }
      /**
         * Normalizes an email address
         *
         * @param {Array} address An array of address objects
         * @return {String} address string
         */
      _normalizeAddress(address) {
        address = (address || "").toString().replace(/[\x00-\x1F<>]+/g, " ").trim();
        let lastAt = address.lastIndexOf("@");
        if (lastAt < 0) {
          return address;
        }
        let user = address.substr(0, lastAt);
        let domain = address.substr(lastAt + 1);
        let encodedDomain;
        try {
          encodedDomain = punycode.toASCII(domain.toLowerCase());
        } catch (err) {
        }
        if (user.indexOf(" ") >= 0) {
          if (user.charAt(0) !== '"') {
            user = '"' + user;
          }
          if (user.substr(-1) !== '"') {
            user = user + '"';
          }
        }
        return `${user}@${encodedDomain}`;
      }
      /**
         * If needed, mime encodes the name part
         *
         * @param {String} name Name part of an address
         * @returns {String} Mime word encoded string if needed
         */
      _encodeAddressName(name) {
        if (!/^[\w ]*$/.test(name)) {
          if (/^[\x20-\x7e]*$/.test(name)) {
            return '"' + name.replace(/([\\"])/g, "\\$1") + '"';
          } else {
            return mimeFuncs.encodeWord(name, this._getTextEncoding(name), 52);
          }
        }
        return name;
      }
      /**
         * If needed, mime encodes the name part
         *
         * @param {String} name Name part of an address
         * @returns {String} Mime word encoded string if needed
         */
      _encodeWords(value) {
        return mimeFuncs.encodeWords(value, this._getTextEncoding(value), 52, true);
      }
      /**
         * Detects best mime encoding for a text value
         *
         * @param {String} value Value to check for
         * @return {String} either 'Q' or 'B'
         */
      _getTextEncoding(value) {
        value = (value || "").toString();
        let encoding = this.textEncoding;
        let latinLen;
        let nonLatinLen;
        if (!encoding) {
          nonLatinLen = (value.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\u0080-\uFFFF]/g) || []).length;
          latinLen = (value.match(/[a-z]/gi) || []).length;
          encoding = nonLatinLen < latinLen ? "Q" : "B";
        }
        return encoding;
      }
      /**
         * Generates a message id
         *
         * @return {String} Random Message-ID value
         */
      _generateMessageId() {
        return "<" + [
          2,
          2,
          2,
          6
        ].reduce(
          // crux to generate UUID-like random strings
          (prev, len) => prev + "-" + crypto2.randomBytes(len).toString("hex"),
          crypto2.randomBytes(4).toString("hex")
        ) + "@" + // try to use the domain of the FROM address or fallback to server hostname
        (this.getEnvelope().from || this.hostname || "localhost").split("@").pop() + ">";
      }
    };
    module.exports = MimeNode;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mail-composer/index.js
var require_mail_composer = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mail-composer/index.js"(exports, module) {
    "use strict";
    var MimeNode = require_mime_node();
    var mimeFuncs = require_mime_funcs();
    var parseDataURI = require_shared().parseDataURI;
    var MailComposer = class {
      constructor(mail) {
        this.mail = mail || {};
        this.message = false;
      }
      /**
         * Builds MimeNode instance
         */
      compile() {
        this._alternatives = this.getAlternatives();
        this._htmlNode = this._alternatives.filter((alternative) => /^text\/html\b/i.test(alternative.contentType)).pop();
        this._attachments = this.getAttachments(!!this._htmlNode);
        this._useRelated = !!(this._htmlNode && this._attachments.related.length);
        this._useAlternative = this._alternatives.length > 1;
        this._useMixed = this._attachments.attached.length > 1 || this._alternatives.length && this._attachments.attached.length === 1;
        if (this.mail.raw) {
          this.message = new MimeNode("message/rfc822", {
            newline: this.mail.newline
          }).setRaw(this.mail.raw);
        } else if (this._useMixed) {
          this.message = this._createMixed();
        } else if (this._useAlternative) {
          this.message = this._createAlternative();
        } else if (this._useRelated) {
          this.message = this._createRelated();
        } else {
          this.message = this._createContentNode(false, [].concat(this._alternatives || []).concat(this._attachments.attached || []).shift() || {
            contentType: "text/plain",
            content: ""
          });
        }
        if (this.mail.headers) {
          this.message.addHeader(this.mail.headers);
        }
        [
          "from",
          "sender",
          "to",
          "cc",
          "bcc",
          "reply-to",
          "in-reply-to",
          "references",
          "subject",
          "message-id",
          "date"
        ].forEach((header) => {
          let key = header.replace(/-(\w)/g, (o, c) => c.toUpperCase());
          if (this.mail[key]) {
            this.message.setHeader(header, this.mail[key]);
          }
        });
        if (this.mail.envelope) {
          this.message.setEnvelope(this.mail.envelope);
        }
        this.message.messageId();
        return this.message;
      }
      /**
         * List all attachments. Resulting attachment objects can be used as input for MimeNode nodes
         *
         * @param {Boolean} findRelated If true separate related attachments from attached ones
         * @returns {Object} An object of arrays (`related` and `attached`)
         */
      getAttachments(findRelated) {
        let icalEvent, eventObject;
        let attachments = [].concat(this.mail.attachments || []).map((attachment, i) => {
          let data;
          let isMessageNode = /^message\//i.test(attachment.contentType);
          if (/^data:/i.test(attachment.path || attachment.href)) {
            attachment = this._processDataUrl(attachment);
          }
          let contentType = attachment.contentType || mimeFuncs.detectMimeType(attachment.filename || attachment.path || attachment.href || "bin");
          let isImage = /^image\//i.test(contentType);
          let contentDisposition = attachment.contentDisposition || (isMessageNode || isImage && attachment.cid ? "inline" : "attachment");
          data = {
            contentType,
            contentDisposition,
            contentTransferEncoding: "contentTransferEncoding" in attachment ? attachment.contentTransferEncoding : "base64"
          };
          if (attachment.filename) {
            data.filename = attachment.filename;
          } else if (!isMessageNode && attachment.filename !== false) {
            data.filename = (attachment.path || attachment.href || "").split("/").pop().split("?").shift() || "attachment-" + (i + 1);
            if (data.filename.indexOf(".") < 0) {
              data.filename += "." + mimeFuncs.detectExtension(data.contentType);
            }
          }
          if (/^https?:\/\//i.test(attachment.path)) {
            attachment.href = attachment.path;
            attachment.path = void 0;
          }
          if (attachment.cid) {
            data.cid = attachment.cid;
          }
          if (attachment.raw) {
            data.raw = attachment.raw;
          } else if (attachment.path) {
            data.content = {
              path: attachment.path
            };
          } else if (attachment.href) {
            data.content = {
              href: attachment.href,
              httpHeaders: attachment.httpHeaders
            };
          } else {
            data.content = attachment.content || "";
          }
          if (attachment.encoding) {
            data.encoding = attachment.encoding;
          }
          if (attachment.headers) {
            data.headers = attachment.headers;
          }
          return data;
        });
        if (this.mail.icalEvent) {
          if (typeof this.mail.icalEvent === "object" && (this.mail.icalEvent.content || this.mail.icalEvent.path || this.mail.icalEvent.href || this.mail.icalEvent.raw)) {
            icalEvent = this.mail.icalEvent;
          } else {
            icalEvent = {
              content: this.mail.icalEvent
            };
          }
          eventObject = {};
          Object.keys(icalEvent).forEach((key) => {
            eventObject[key] = icalEvent[key];
          });
          eventObject.contentType = "application/ics";
          if (!eventObject.headers) {
            eventObject.headers = {};
          }
          eventObject.filename = eventObject.filename || "invite.ics";
          eventObject.headers["Content-Disposition"] = "attachment";
          eventObject.headers["Content-Transfer-Encoding"] = "base64";
        }
        if (!findRelated) {
          return {
            attached: attachments.concat(eventObject || []),
            related: []
          };
        } else {
          return {
            attached: attachments.filter((attachment) => !attachment.cid).concat(eventObject || []),
            related: attachments.filter((attachment) => !!attachment.cid)
          };
        }
      }
      /**
         * List alternatives. Resulting objects can be used as input for MimeNode nodes
         *
         * @returns {Array} An array of alternative elements. Includes the `text` and `html` values as well
         */
      getAlternatives() {
        let alternatives = [], text, html, watchHtml, amp, icalEvent, eventObject;
        if (this.mail.text) {
          if (typeof this.mail.text === "object" && (this.mail.text.content || this.mail.text.path || this.mail.text.href || this.mail.text.raw)) {
            text = this.mail.text;
          } else {
            text = {
              content: this.mail.text
            };
          }
          text.contentType = "text/plain; charset=utf-8";
        }
        if (this.mail.watchHtml) {
          if (typeof this.mail.watchHtml === "object" && (this.mail.watchHtml.content || this.mail.watchHtml.path || this.mail.watchHtml.href || this.mail.watchHtml.raw)) {
            watchHtml = this.mail.watchHtml;
          } else {
            watchHtml = {
              content: this.mail.watchHtml
            };
          }
          watchHtml.contentType = "text/watch-html; charset=utf-8";
        }
        if (this.mail.amp) {
          if (typeof this.mail.amp === "object" && (this.mail.amp.content || this.mail.amp.path || this.mail.amp.href || this.mail.amp.raw)) {
            amp = this.mail.amp;
          } else {
            amp = {
              content: this.mail.amp
            };
          }
          amp.contentType = "text/x-amp-html; charset=utf-8";
        }
        if (this.mail.icalEvent) {
          if (typeof this.mail.icalEvent === "object" && (this.mail.icalEvent.content || this.mail.icalEvent.path || this.mail.icalEvent.href || this.mail.icalEvent.raw)) {
            icalEvent = this.mail.icalEvent;
          } else {
            icalEvent = {
              content: this.mail.icalEvent
            };
          }
          eventObject = {};
          Object.keys(icalEvent).forEach((key) => {
            eventObject[key] = icalEvent[key];
          });
          if (eventObject.content && typeof eventObject.content === "object") {
            eventObject.content._resolve = true;
          }
          eventObject.filename = false;
          eventObject.contentType = "text/calendar; charset=utf-8; method=" + (eventObject.method || "PUBLISH").toString().trim().toUpperCase();
          if (!eventObject.headers) {
            eventObject.headers = {};
          }
        }
        if (this.mail.html) {
          if (typeof this.mail.html === "object" && (this.mail.html.content || this.mail.html.path || this.mail.html.href || this.mail.html.raw)) {
            html = this.mail.html;
          } else {
            html = {
              content: this.mail.html
            };
          }
          html.contentType = "text/html; charset=utf-8";
        }
        [].concat(text || []).concat(watchHtml || []).concat(amp || []).concat(html || []).concat(eventObject || []).concat(this.mail.alternatives || []).forEach((alternative) => {
          let data;
          if (/^data:/i.test(alternative.path || alternative.href)) {
            alternative = this._processDataUrl(alternative);
          }
          data = {
            contentType: alternative.contentType || mimeFuncs.detectMimeType(alternative.filename || alternative.path || alternative.href || "txt"),
            contentTransferEncoding: alternative.contentTransferEncoding
          };
          if (alternative.filename) {
            data.filename = alternative.filename;
          }
          if (/^https?:\/\//i.test(alternative.path)) {
            alternative.href = alternative.path;
            alternative.path = void 0;
          }
          if (alternative.raw) {
            data.raw = alternative.raw;
          } else if (alternative.path) {
            data.content = {
              path: alternative.path
            };
          } else if (alternative.href) {
            data.content = {
              href: alternative.href
            };
          } else {
            data.content = alternative.content || "";
          }
          if (alternative.encoding) {
            data.encoding = alternative.encoding;
          }
          if (alternative.headers) {
            data.headers = alternative.headers;
          }
          alternatives.push(data);
        });
        return alternatives;
      }
      /**
         * Builds multipart/mixed node. It should always contain different type of elements on the same level
         * eg. text + attachments
         *
         * @param {Object} parentNode Parent for this note. If it does not exist, a root node is created
         * @returns {Object} MimeNode node element
         */
      _createMixed(parentNode) {
        let node;
        if (!parentNode) {
          node = new MimeNode("multipart/mixed", {
            baseBoundary: this.mail.baseBoundary,
            textEncoding: this.mail.textEncoding,
            boundaryPrefix: this.mail.boundaryPrefix,
            disableUrlAccess: this.mail.disableUrlAccess,
            disableFileAccess: this.mail.disableFileAccess,
            normalizeHeaderKey: this.mail.normalizeHeaderKey,
            newline: this.mail.newline
          });
        } else {
          node = parentNode.createChild("multipart/mixed", {
            disableUrlAccess: this.mail.disableUrlAccess,
            disableFileAccess: this.mail.disableFileAccess,
            normalizeHeaderKey: this.mail.normalizeHeaderKey,
            newline: this.mail.newline
          });
        }
        if (this._useAlternative) {
          this._createAlternative(node);
        } else if (this._useRelated) {
          this._createRelated(node);
        }
        [].concat(!this._useAlternative && this._alternatives || []).concat(this._attachments.attached || []).forEach((element) => {
          if (!this._useRelated || element !== this._htmlNode) {
            this._createContentNode(node, element);
          }
        });
        return node;
      }
      /**
         * Builds multipart/alternative node. It should always contain same type of elements on the same level
         * eg. text + html view of the same data
         *
         * @param {Object} parentNode Parent for this note. If it does not exist, a root node is created
         * @returns {Object} MimeNode node element
         */
      _createAlternative(parentNode) {
        let node;
        if (!parentNode) {
          node = new MimeNode("multipart/alternative", {
            baseBoundary: this.mail.baseBoundary,
            textEncoding: this.mail.textEncoding,
            boundaryPrefix: this.mail.boundaryPrefix,
            disableUrlAccess: this.mail.disableUrlAccess,
            disableFileAccess: this.mail.disableFileAccess,
            normalizeHeaderKey: this.mail.normalizeHeaderKey,
            newline: this.mail.newline
          });
        } else {
          node = parentNode.createChild("multipart/alternative", {
            disableUrlAccess: this.mail.disableUrlAccess,
            disableFileAccess: this.mail.disableFileAccess,
            normalizeHeaderKey: this.mail.normalizeHeaderKey,
            newline: this.mail.newline
          });
        }
        this._alternatives.forEach((alternative) => {
          if (this._useRelated && this._htmlNode === alternative) {
            this._createRelated(node);
          } else {
            this._createContentNode(node, alternative);
          }
        });
        return node;
      }
      /**
         * Builds multipart/related node. It should always contain html node with related attachments
         *
         * @param {Object} parentNode Parent for this note. If it does not exist, a root node is created
         * @returns {Object} MimeNode node element
         */
      _createRelated(parentNode) {
        let node;
        if (!parentNode) {
          node = new MimeNode('multipart/related; type="text/html"', {
            baseBoundary: this.mail.baseBoundary,
            textEncoding: this.mail.textEncoding,
            boundaryPrefix: this.mail.boundaryPrefix,
            disableUrlAccess: this.mail.disableUrlAccess,
            disableFileAccess: this.mail.disableFileAccess,
            normalizeHeaderKey: this.mail.normalizeHeaderKey,
            newline: this.mail.newline
          });
        } else {
          node = parentNode.createChild('multipart/related; type="text/html"', {
            disableUrlAccess: this.mail.disableUrlAccess,
            disableFileAccess: this.mail.disableFileAccess,
            normalizeHeaderKey: this.mail.normalizeHeaderKey,
            newline: this.mail.newline
          });
        }
        this._createContentNode(node, this._htmlNode);
        this._attachments.related.forEach((alternative) => this._createContentNode(node, alternative));
        return node;
      }
      /**
         * Creates a regular node with contents
         *
         * @param {Object} parentNode Parent for this note. If it does not exist, a root node is created
         * @param {Object} element Node data
         * @returns {Object} MimeNode node element
         */
      _createContentNode(parentNode, element) {
        element = element || {};
        element.content = element.content || "";
        let node;
        let encoding = (element.encoding || "utf8").toString().toLowerCase().replace(/[-_\s]/g, "");
        if (!parentNode) {
          node = new MimeNode(element.contentType, {
            filename: element.filename,
            baseBoundary: this.mail.baseBoundary,
            textEncoding: this.mail.textEncoding,
            boundaryPrefix: this.mail.boundaryPrefix,
            disableUrlAccess: this.mail.disableUrlAccess,
            disableFileAccess: this.mail.disableFileAccess,
            normalizeHeaderKey: this.mail.normalizeHeaderKey,
            newline: this.mail.newline
          });
        } else {
          node = parentNode.createChild(element.contentType, {
            filename: element.filename,
            textEncoding: this.mail.textEncoding,
            disableUrlAccess: this.mail.disableUrlAccess,
            disableFileAccess: this.mail.disableFileAccess,
            normalizeHeaderKey: this.mail.normalizeHeaderKey,
            newline: this.mail.newline
          });
        }
        if (element.headers) {
          node.addHeader(element.headers);
        }
        if (element.cid) {
          node.setHeader("Content-Id", "<" + element.cid.replace(/[<>]/g, "") + ">");
        }
        if (element.contentTransferEncoding) {
          node.setHeader("Content-Transfer-Encoding", element.contentTransferEncoding);
        } else if (this.mail.encoding && /^text\//i.test(element.contentType)) {
          node.setHeader("Content-Transfer-Encoding", this.mail.encoding);
        }
        if (!/^text\//i.test(element.contentType) || element.contentDisposition) {
          node.setHeader("Content-Disposition", element.contentDisposition || (element.cid && /^image\//i.test(element.contentType) ? "inline" : "attachment"));
        }
        if (typeof element.content === "string" && ![
          "utf8",
          "usascii",
          "ascii"
        ].includes(encoding)) {
          element.content = Buffer.from(element.content, encoding);
        }
        if (element.raw) {
          node.setRaw(element.raw);
        } else {
          node.setContent(element.content);
        }
        return node;
      }
      /**
         * Parses data uri and converts it to a Buffer
         *
         * @param {Object} element Content element
         * @return {Object} Parsed element
         */
      _processDataUrl(element) {
        let parsedDataUri;
        if ((element.path || element.href).match(/^data:/)) {
          parsedDataUri = parseDataURI(element.path || element.href);
        }
        if (!parsedDataUri) {
          return element;
        }
        element.content = parsedDataUri.data;
        element.contentType = element.contentType || parsedDataUri.contentType;
        if ("path" in element) {
          element.path = false;
        }
        if ("href" in element) {
          element.href = false;
        }
        return element;
      }
    };
    module.exports = MailComposer;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/dkim/message-parser.js
var require_message_parser = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/dkim/message-parser.js"(exports, module) {
    "use strict";
    var Transform = __require("node:stream").Transform;
    var MessageParser = class extends Transform {
      constructor(options) {
        super(options);
        this.lastBytes = Buffer.alloc(4);
        this.headersParsed = false;
        this.headerBytes = 0;
        this.headerChunks = [];
        this.rawHeaders = false;
        this.bodySize = 0;
      }
      /**
         * Keeps count of the last 4 bytes in order to detect line breaks on chunk boundaries
         *
         * @param {Buffer} data Next data chunk from the stream
         */
      updateLastBytes(data) {
        let lblen = this.lastBytes.length;
        let nblen = Math.min(data.length, lblen);
        for (let i = 0, len = lblen - nblen; i < len; i++) {
          this.lastBytes[i] = this.lastBytes[i + nblen];
        }
        for (let i = 1; i <= nblen; i++) {
          this.lastBytes[lblen - i] = data[data.length - i];
        }
      }
      /**
         * Finds and removes message headers from the remaining body. We want to keep
         * headers separated until final delivery to be able to modify these
         *
         * @param {Buffer} data Next chunk of data
         * @return {Boolean} Returns true if headers are already found or false otherwise
         */
      checkHeaders(data) {
        if (this.headersParsed) {
          return true;
        }
        let lblen = this.lastBytes.length;
        let headerPos = 0;
        this.curLinePos = 0;
        for (let i = 0, len = this.lastBytes.length + data.length; i < len; i++) {
          let chr;
          if (i < lblen) {
            chr = this.lastBytes[i];
          } else {
            chr = data[i - lblen];
          }
          if (chr === 10 && i) {
            let pr1 = i - 1 < lblen ? this.lastBytes[i - 1] : data[i - 1 - lblen];
            let pr2 = i > 1 ? i - 2 < lblen ? this.lastBytes[i - 2] : data[i - 2 - lblen] : false;
            if (pr1 === 10) {
              this.headersParsed = true;
              headerPos = i - lblen + 1;
              this.headerBytes += headerPos;
              break;
            } else if (pr1 === 13 && pr2 === 10) {
              this.headersParsed = true;
              headerPos = i - lblen + 1;
              this.headerBytes += headerPos;
              break;
            }
          }
        }
        if (this.headersParsed) {
          this.headerChunks.push(data.slice(0, headerPos));
          this.rawHeaders = Buffer.concat(this.headerChunks, this.headerBytes);
          this.headerChunks = null;
          this.emit("headers", this.parseHeaders());
          if (data.length - 1 > headerPos) {
            let chunk = data.slice(headerPos);
            this.bodySize += chunk.length;
            setImmediate(() => this.push(chunk));
          }
          return false;
        } else {
          this.headerBytes += data.length;
          this.headerChunks.push(data);
        }
        this.updateLastBytes(data);
        return false;
      }
      _transform(chunk, encoding, callback) {
        if (!chunk || !chunk.length) {
          return callback();
        }
        if (typeof chunk === "string") {
          chunk = Buffer.from(chunk, encoding);
        }
        let headersFound;
        try {
          headersFound = this.checkHeaders(chunk);
        } catch (E) {
          return callback(E);
        }
        if (headersFound) {
          this.bodySize += chunk.length;
          this.push(chunk);
        }
        setImmediate(callback);
      }
      _flush(callback) {
        if (this.headerChunks) {
          let chunk = Buffer.concat(this.headerChunks, this.headerBytes);
          this.bodySize += chunk.length;
          this.push(chunk);
          this.headerChunks = null;
        }
        callback();
      }
      parseHeaders() {
        let lines = (this.rawHeaders || "").toString().split(/\r?\n/);
        for (let i = lines.length - 1; i > 0; i--) {
          if (/^\s/.test(lines[i])) {
            lines[i - 1] += "\n" + lines[i];
            lines.splice(i, 1);
          }
        }
        return lines.filter((line) => line.trim()).map((line) => ({
          key: line.substr(0, line.indexOf(":")).trim().toLowerCase(),
          line
        }));
      }
    };
    module.exports = MessageParser;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/dkim/relaxed-body.js
var require_relaxed_body = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/dkim/relaxed-body.js"(exports, module) {
    "use strict";
    var Transform = __require("node:stream").Transform;
    var crypto2 = __require("node:crypto");
    var RelaxedBody = class extends Transform {
      constructor(options) {
        super();
        options = options || {};
        this.chunkBuffer = [];
        this.chunkBufferLen = 0;
        this.bodyHash = crypto2.createHash(options.hashAlgo || "sha1");
        this.remainder = "";
        this.byteLength = 0;
        this.debug = options.debug;
        this._debugBody = options.debug ? [] : false;
      }
      updateHash(chunk) {
        let bodyStr;
        let nextRemainder = "";
        let state = "file";
        for (let i = chunk.length - 1; i >= 0; i--) {
          let c = chunk[i];
          if (state === "file" && (c === 10 || c === 13)) {
          } else if (state === "file" && (c === 9 || c === 32)) {
            state = "line";
          } else if (state === "line" && (c === 9 || c === 32)) {
          } else if (state === "file" || state === "line") {
            state = "body";
            if (i === chunk.length - 1) {
              break;
            }
          }
          if (i === 0) {
            if (state === "file" && (!this.remainder || /[\r\n]$/.test(this.remainder)) || state === "line" && (!this.remainder || /[ \t]$/.test(this.remainder))) {
              this.remainder += chunk.toString("binary");
              return;
            } else if (state === "line" || state === "file") {
              nextRemainder = chunk.toString("binary");
              chunk = false;
              break;
            }
          }
          if (state !== "body") {
            continue;
          }
          nextRemainder = chunk.slice(i + 1).toString("binary");
          chunk = chunk.slice(0, i + 1);
          break;
        }
        let needsFixing = !!this.remainder;
        if (chunk && !needsFixing) {
          for (let i = 0, len = chunk.length; i < len; i++) {
            if (i && chunk[i] === 10 && chunk[i - 1] !== 13) {
              needsFixing = true;
              break;
            } else if (i && chunk[i] === 13 && chunk[i - 1] === 32) {
              needsFixing = true;
              break;
            } else if (i && chunk[i] === 32 && chunk[i - 1] === 32) {
              needsFixing = true;
              break;
            } else if (chunk[i] === 9) {
              needsFixing = true;
              break;
            }
          }
        }
        if (needsFixing) {
          bodyStr = this.remainder + (chunk ? chunk.toString("binary") : "");
          this.remainder = nextRemainder;
          bodyStr = bodyStr.replace(/\r?\n/g, "\n").replace(/[ \t]*$/gm, "").replace(/[ \t]+/gm, " ").replace(/\n/g, "\r\n");
          chunk = Buffer.from(bodyStr, "binary");
        } else if (nextRemainder) {
          this.remainder = nextRemainder;
        }
        if (this.debug) {
          this._debugBody.push(chunk);
        }
        this.bodyHash.update(chunk);
      }
      _transform(chunk, encoding, callback) {
        if (!chunk || !chunk.length) {
          return callback();
        }
        if (typeof chunk === "string") {
          chunk = Buffer.from(chunk, encoding);
        }
        this.updateHash(chunk);
        this.byteLength += chunk.length;
        this.push(chunk);
        callback();
      }
      _flush(callback) {
        if (/[\r\n]$/.test(this.remainder) && this.byteLength > 2) {
          this.bodyHash.update(Buffer.from("\r\n"));
        }
        if (!this.byteLength) {
          this.push(Buffer.from("\r\n"));
        }
        this.emit("hash", this.bodyHash.digest("base64"), this.debug ? Buffer.concat(this._debugBody) : false);
        callback();
      }
    };
    module.exports = RelaxedBody;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/dkim/sign.js
var require_sign = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/dkim/sign.js"(exports, module) {
    "use strict";
    var punycode = require_punycode();
    var mimeFuncs = require_mime_funcs();
    var crypto2 = __require("node:crypto");
    module.exports = (headers, hashAlgo, bodyHash, options) => {
      options = options || {};
      let defaultFieldNames = "From:Sender:Reply-To:Subject:Date:Message-ID:To:Cc:MIME-Version:Content-Type:Content-Transfer-Encoding:Content-ID:Content-Description:Resent-Date:Resent-From:Resent-Sender:Resent-To:Resent-Cc:Resent-Message-ID:In-Reply-To:References:List-Id:List-Help:List-Unsubscribe:List-Subscribe:List-Post:List-Owner:List-Archive";
      let fieldNames = options.headerFieldNames || defaultFieldNames;
      let canonicalizedHeaderData = relaxedHeaders(headers, fieldNames, options.skipFields);
      let dkimHeader = generateDKIMHeader(options.domainName, options.keySelector, canonicalizedHeaderData.fieldNames, hashAlgo, bodyHash);
      let signer, signature;
      canonicalizedHeaderData.headers += "dkim-signature:" + relaxedHeaderLine(dkimHeader);
      signer = crypto2.createSign(("rsa-" + hashAlgo).toUpperCase());
      signer.update(canonicalizedHeaderData.headers);
      try {
        signature = signer.sign(options.privateKey, "base64");
      } catch (E) {
        return false;
      }
      return dkimHeader + signature.replace(/(^.{73}|.{75}(?!\r?\n|\r))/g, "$&\r\n ").trim();
    };
    module.exports.relaxedHeaders = relaxedHeaders;
    function generateDKIMHeader(domainName, keySelector, fieldNames, hashAlgo, bodyHash) {
      let dkim = [
        "v=1",
        "a=rsa-" + hashAlgo,
        "c=relaxed/relaxed",
        "d=" + punycode.toASCII(domainName),
        "q=dns/txt",
        "s=" + keySelector,
        "bh=" + bodyHash,
        "h=" + fieldNames
      ].join("; ");
      return mimeFuncs.foldLines("DKIM-Signature: " + dkim, 76) + ";\r\n b=";
    }
    function relaxedHeaders(headers, fieldNames, skipFields) {
      let includedFields = /* @__PURE__ */ new Set();
      let skip = /* @__PURE__ */ new Set();
      let headerFields = /* @__PURE__ */ new Map();
      (skipFields || "").toLowerCase().split(":").forEach((field) => {
        skip.add(field.trim());
      });
      (fieldNames || "").toLowerCase().split(":").filter((field) => !skip.has(field.trim())).forEach((field) => {
        includedFields.add(field.trim());
      });
      for (let i = headers.length - 1; i >= 0; i--) {
        let line = headers[i];
        if (includedFields.has(line.key) && !headerFields.has(line.key)) {
          headerFields.set(line.key, relaxedHeaderLine(line.line));
        }
      }
      let headersList = [];
      let fields = [];
      includedFields.forEach((field) => {
        if (headerFields.has(field)) {
          fields.push(field);
          headersList.push(field + ":" + headerFields.get(field));
        }
      });
      return {
        headers: headersList.join("\r\n") + "\r\n",
        fieldNames: fields.join(":")
      };
    }
    function relaxedHeaderLine(line) {
      return line.substr(line.indexOf(":") + 1).replace(/\r?\n/g, "").replace(/\s+/g, " ").trim();
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/dkim/index.js
var require_dkim = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/dkim/index.js"(exports, module) {
    "use strict";
    var MessageParser = require_message_parser();
    var RelaxedBody = require_relaxed_body();
    var sign = require_sign();
    var PassThrough = __require("node:stream").PassThrough;
    var fs = __require("node:fs");
    var path = __require("node:path");
    var crypto2 = __require("node:crypto");
    var DKIM_ALGO = "sha256";
    var MAX_MESSAGE_SIZE = 128 * 1024;
    var DKIMSigner = class {
      constructor(options, keys, input, output) {
        this.options = options || {};
        this.keys = keys;
        this.cacheTreshold = Number(this.options.cacheTreshold) || MAX_MESSAGE_SIZE;
        this.hashAlgo = this.options.hashAlgo || DKIM_ALGO;
        this.cacheDir = this.options.cacheDir || false;
        this.chunks = [];
        this.chunklen = 0;
        this.readPos = 0;
        this.cachePath = this.cacheDir ? path.join(this.cacheDir, "message." + Date.now() + "-" + crypto2.randomBytes(14).toString("hex")) : false;
        this.cache = false;
        this.headers = false;
        this.bodyHash = false;
        this.parser = false;
        this.relaxedBody = false;
        this.input = input;
        this.output = output;
        this.output.usingCache = false;
        this.hasErrored = false;
        this.input.on("error", (err) => {
          this.hasErrored = true;
          this.cleanup();
          output.emit("error", err);
        });
      }
      cleanup() {
        if (!this.cache || !this.cachePath) {
          return;
        }
        fs.unlink(this.cachePath, () => false);
      }
      createReadCache() {
        this.cache = fs.createReadStream(this.cachePath);
        this.cache.once("error", (err) => {
          this.cleanup();
          this.output.emit("error", err);
        });
        this.cache.once("close", () => {
          this.cleanup();
        });
        this.cache.pipe(this.output);
      }
      sendNextChunk() {
        if (this.hasErrored) {
          return;
        }
        if (this.readPos >= this.chunks.length) {
          if (!this.cache) {
            return this.output.end();
          }
          return this.createReadCache();
        }
        let chunk = this.chunks[this.readPos++];
        if (this.output.write(chunk) === false) {
          return this.output.once("drain", () => {
            this.sendNextChunk();
          });
        }
        setImmediate(() => this.sendNextChunk());
      }
      sendSignedOutput() {
        let keyPos = 0;
        let signNextKey = () => {
          if (keyPos >= this.keys.length) {
            this.output.write(this.parser.rawHeaders);
            return setImmediate(() => this.sendNextChunk());
          }
          let key = this.keys[keyPos++];
          let dkimField = sign(this.headers, this.hashAlgo, this.bodyHash, {
            domainName: key.domainName,
            keySelector: key.keySelector,
            privateKey: key.privateKey,
            headerFieldNames: this.options.headerFieldNames,
            skipFields: this.options.skipFields
          });
          if (dkimField) {
            this.output.write(Buffer.from(dkimField + "\r\n"));
          }
          return setImmediate(signNextKey);
        };
        if (this.bodyHash && this.headers) {
          return signNextKey();
        }
        this.output.write(this.parser.rawHeaders);
        this.sendNextChunk();
      }
      createWriteCache() {
        this.output.usingCache = true;
        this.cache = fs.createWriteStream(this.cachePath);
        this.cache.once("error", (err) => {
          this.cleanup();
          this.relaxedBody.unpipe(this.cache);
          this.relaxedBody.on("readable", () => {
            while (this.relaxedBody.read() !== null) {
            }
          });
          this.hasErrored = true;
          this.output.emit("error", err);
        });
        this.cache.once("close", () => {
          this.sendSignedOutput();
        });
        this.relaxedBody.removeAllListeners("readable");
        this.relaxedBody.pipe(this.cache);
      }
      signStream() {
        this.parser = new MessageParser();
        this.relaxedBody = new RelaxedBody({
          hashAlgo: this.hashAlgo
        });
        this.parser.on("headers", (value) => {
          this.headers = value;
        });
        this.relaxedBody.on("hash", (value) => {
          this.bodyHash = value;
        });
        this.relaxedBody.on("readable", () => {
          let chunk;
          if (this.cache) {
            return;
          }
          while ((chunk = this.relaxedBody.read()) !== null) {
            this.chunks.push(chunk);
            this.chunklen += chunk.length;
            if (this.chunklen >= this.cacheTreshold && this.cachePath) {
              return this.createWriteCache();
            }
          }
        });
        this.relaxedBody.on("end", () => {
          if (this.cache) {
            return;
          }
          this.sendSignedOutput();
        });
        this.parser.pipe(this.relaxedBody);
        setImmediate(() => this.input.pipe(this.parser));
      }
    };
    var DKIM = class {
      constructor(options) {
        this.options = options || {};
        this.keys = [].concat(this.options.keys || {
          domainName: options.domainName,
          keySelector: options.keySelector,
          privateKey: options.privateKey
        });
      }
      sign(input, extraOptions) {
        let output = new PassThrough();
        let inputStream = input;
        let writeValue = false;
        if (Buffer.isBuffer(input)) {
          writeValue = input;
          inputStream = new PassThrough();
        } else if (typeof input === "string") {
          writeValue = Buffer.from(input);
          inputStream = new PassThrough();
        }
        let options = this.options;
        if (extraOptions && Object.keys(extraOptions).length) {
          options = {};
          Object.keys(this.options || {}).forEach((key) => {
            options[key] = this.options[key];
          });
          Object.keys(extraOptions || {}).forEach((key) => {
            if (!(key in options)) {
              options[key] = extraOptions[key];
            }
          });
        }
        let signer = new DKIMSigner(options, this.keys, inputStream, output);
        setImmediate(() => {
          signer.signStream();
          if (writeValue) {
            setImmediate(() => {
              inputStream.end(writeValue);
            });
          }
        });
        return output;
      }
    };
    module.exports = DKIM;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-connection/http-proxy-client.js
var require_http_proxy_client = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-connection/http-proxy-client.js"(exports, module) {
    "use strict";
    var net = __require("node:net");
    var tls = __require("node:tls");
    var urllib = __require("node:url");
    function httpProxyClient(proxyUrl, destinationPort, destinationHost, callback) {
      let proxy = urllib.parse(proxyUrl);
      let options;
      let connect;
      let socket;
      options = {
        host: proxy.hostname,
        port: Number(proxy.port) ? Number(proxy.port) : proxy.protocol === "https:" ? 443 : 80
      };
      if (proxy.protocol === "https:") {
        options.rejectUnauthorized = false;
        connect = tls.connect.bind(tls);
      } else {
        connect = net.connect.bind(net);
      }
      let finished = false;
      let tempSocketErr = (err) => {
        if (finished) {
          return;
        }
        finished = true;
        try {
          socket.destroy();
        } catch (E) {
        }
        callback(err);
      };
      let timeoutErr = () => {
        let err = new Error("Proxy socket timed out");
        err.code = "ETIMEDOUT";
        tempSocketErr(err);
      };
      socket = connect(options, () => {
        if (finished) {
          return;
        }
        let reqHeaders = {
          Host: destinationHost + ":" + destinationPort,
          Connection: "close"
        };
        if (proxy.auth) {
          reqHeaders["Proxy-Authorization"] = "Basic " + Buffer.from(proxy.auth).toString("base64");
        }
        socket.write(
          // HTTP method
          "CONNECT " + destinationHost + ":" + destinationPort + " HTTP/1.1\r\n" + // HTTP request headers
          Object.keys(reqHeaders).map((key) => key + ": " + reqHeaders[key]).join("\r\n") + // End request
          "\r\n\r\n"
        );
        let headers = "";
        let onSocketData = (chunk) => {
          let match;
          let remainder;
          if (finished) {
            return;
          }
          headers += chunk.toString("binary");
          if (match = headers.match(/\r\n\r\n/)) {
            socket.removeListener("data", onSocketData);
            remainder = headers.substr(match.index + match[0].length);
            headers = headers.substr(0, match.index);
            if (remainder) {
              socket.unshift(Buffer.from(remainder, "binary"));
            }
            finished = true;
            match = headers.match(/^HTTP\/\d+\.\d+ (\d+)/i);
            if (!match || (match[1] || "").charAt(0) !== "2") {
              try {
                socket.destroy();
              } catch (E) {
              }
              return callback(new Error("Invalid response from proxy" + (match && ": " + match[1] || "")));
            }
            socket.removeListener("error", tempSocketErr);
            socket.removeListener("timeout", timeoutErr);
            socket.setTimeout(0);
            return callback(null, socket);
          }
        };
        socket.on("data", onSocketData);
      });
      socket.setTimeout(httpProxyClient.timeout || 30 * 1e3);
      socket.on("timeout", timeoutErr);
      socket.once("error", tempSocketErr);
    }
    module.exports = httpProxyClient;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mailer/mail-message.js
var require_mail_message = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mailer/mail-message.js"(exports, module) {
    "use strict";
    var shared = require_shared();
    var MimeNode = require_mime_node();
    var mimeFuncs = require_mime_funcs();
    var MailMessage = class {
      constructor(mailer, data) {
        this.mailer = mailer;
        this.data = {};
        this.message = null;
        data = data || {};
        let options = mailer.options || {};
        let defaults = mailer._defaults || {};
        Object.keys(data).forEach((key) => {
          this.data[key] = data[key];
        });
        this.data.headers = this.data.headers || {};
        Object.keys(defaults).forEach((key) => {
          if (!(key in this.data)) {
            this.data[key] = defaults[key];
          } else if (key === "headers") {
            Object.keys(defaults.headers).forEach((key2) => {
              if (!(key2 in this.data.headers)) {
                this.data.headers[key2] = defaults.headers[key2];
              }
            });
          }
        });
        [
          "disableFileAccess",
          "disableUrlAccess",
          "normalizeHeaderKey"
        ].forEach((key) => {
          if (key in options) {
            this.data[key] = options[key];
          }
        });
      }
      resolveContent(...args) {
        return shared.resolveContent(...args);
      }
      resolveAll(callback) {
        let keys = [
          [
            this.data,
            "html"
          ],
          [
            this.data,
            "text"
          ],
          [
            this.data,
            "watchHtml"
          ],
          [
            this.data,
            "amp"
          ],
          [
            this.data,
            "icalEvent"
          ]
        ];
        if (this.data.alternatives && this.data.alternatives.length) {
          this.data.alternatives.forEach((alternative, i) => {
            keys.push([
              this.data.alternatives,
              i
            ]);
          });
        }
        if (this.data.attachments && this.data.attachments.length) {
          this.data.attachments.forEach((attachment, i) => {
            if (!attachment.filename) {
              attachment.filename = (attachment.path || attachment.href || "").split("/").pop().split("?").shift() || "attachment-" + (i + 1);
              if (attachment.filename.indexOf(".") < 0) {
                attachment.filename += "." + mimeFuncs.detectExtension(attachment.contentType);
              }
            }
            if (!attachment.contentType) {
              attachment.contentType = mimeFuncs.detectMimeType(attachment.filename || attachment.path || attachment.href || "bin");
            }
            keys.push([
              this.data.attachments,
              i
            ]);
          });
        }
        let mimeNode = new MimeNode();
        let addressKeys = [
          "from",
          "to",
          "cc",
          "bcc",
          "sender",
          "replyTo"
        ];
        addressKeys.forEach((address) => {
          let value;
          if (this.message) {
            value = [].concat(mimeNode._parseAddresses(this.message.getHeader(address === "replyTo" ? "reply-to" : address)) || []);
          } else if (this.data[address]) {
            value = [].concat(mimeNode._parseAddresses(this.data[address]) || []);
          }
          if (value && value.length) {
            this.data[address] = value;
          } else if (address in this.data) {
            this.data[address] = null;
          }
        });
        let singleKeys = [
          "from",
          "sender"
        ];
        singleKeys.forEach((address) => {
          if (this.data[address]) {
            this.data[address] = this.data[address].shift();
          }
        });
        let pos = 0;
        let resolveNext = () => {
          if (pos >= keys.length) {
            return callback(null, this.data);
          }
          let args = keys[pos++];
          if (!args[0] || !args[0][args[1]]) {
            return resolveNext();
          }
          shared.resolveContent(...args, (err, value) => {
            if (err) {
              return callback(err);
            }
            let node = {
              content: value
            };
            if (args[0][args[1]] && typeof args[0][args[1]] === "object" && !Buffer.isBuffer(args[0][args[1]])) {
              Object.keys(args[0][args[1]]).forEach((key) => {
                if (!(key in node) && ![
                  "content",
                  "path",
                  "href",
                  "raw"
                ].includes(key)) {
                  node[key] = args[0][args[1]][key];
                }
              });
            }
            args[0][args[1]] = node;
            resolveNext();
          });
        };
        setImmediate(() => resolveNext());
      }
      normalize(callback) {
        let envelope = this.data.envelope || this.message.getEnvelope();
        let messageId = this.message.messageId();
        this.resolveAll((err, data) => {
          if (err) {
            return callback(err);
          }
          data.envelope = envelope;
          data.messageId = messageId;
          [
            "html",
            "text",
            "watchHtml",
            "amp"
          ].forEach((key) => {
            if (data[key] && data[key].content) {
              if (typeof data[key].content === "string") {
                data[key] = data[key].content;
              } else if (Buffer.isBuffer(data[key].content)) {
                data[key] = data[key].content.toString();
              }
            }
          });
          if (data.icalEvent && Buffer.isBuffer(data.icalEvent.content)) {
            data.icalEvent.content = data.icalEvent.content.toString("base64");
            data.icalEvent.encoding = "base64";
          }
          if (data.alternatives && data.alternatives.length) {
            data.alternatives.forEach((alternative) => {
              if (alternative && alternative.content && Buffer.isBuffer(alternative.content)) {
                alternative.content = alternative.content.toString("base64");
                alternative.encoding = "base64";
              }
            });
          }
          if (data.attachments && data.attachments.length) {
            data.attachments.forEach((attachment) => {
              if (attachment && attachment.content && Buffer.isBuffer(attachment.content)) {
                attachment.content = attachment.content.toString("base64");
                attachment.encoding = "base64";
              }
            });
          }
          data.normalizedHeaders = {};
          Object.keys(data.headers || {}).forEach((key) => {
            let value = [].concat(data.headers[key] || []).shift();
            value = value && value.value || value;
            if (value) {
              if ([
                "references",
                "in-reply-to",
                "message-id",
                "content-id"
              ].includes(key)) {
                value = this.message._encodeHeaderValue(key, value);
              }
              data.normalizedHeaders[key] = value;
            }
          });
          if (data.list && typeof data.list === "object") {
            let listHeaders = this._getListHeaders(data.list);
            listHeaders.forEach((entry) => {
              data.normalizedHeaders[entry.key] = entry.value.map((val2) => val2 && val2.value || val2).join(", ");
            });
          }
          if (data.references) {
            data.normalizedHeaders.references = this.message._encodeHeaderValue("references", data.references);
          }
          if (data.inReplyTo) {
            data.normalizedHeaders["in-reply-to"] = this.message._encodeHeaderValue("in-reply-to", data.inReplyTo);
          }
          return callback(null, data);
        });
      }
      setMailerHeader() {
        if (!this.message || !this.data.xMailer) {
          return;
        }
        this.message.setHeader("X-Mailer", this.data.xMailer);
      }
      setPriorityHeaders() {
        if (!this.message || !this.data.priority) {
          return;
        }
        switch ((this.data.priority || "").toString().toLowerCase()) {
          case "high":
            this.message.setHeader("X-Priority", "1 (Highest)");
            this.message.setHeader("X-MSMail-Priority", "High");
            this.message.setHeader("Importance", "High");
            break;
          case "low":
            this.message.setHeader("X-Priority", "5 (Lowest)");
            this.message.setHeader("X-MSMail-Priority", "Low");
            this.message.setHeader("Importance", "Low");
            break;
          default:
        }
      }
      setListHeaders() {
        if (!this.message || !this.data.list || typeof this.data.list !== "object") {
          return;
        }
        if (this.data.list && typeof this.data.list === "object") {
          this._getListHeaders(this.data.list).forEach((listHeader) => {
            listHeader.value.forEach((value) => {
              this.message.addHeader(listHeader.key, value);
            });
          });
        }
      }
      _getListHeaders(listData) {
        return Object.keys(listData).map((key) => ({
          key: "list-" + key.toLowerCase().trim(),
          value: [].concat(listData[key] || []).map((value) => ({
            prepared: true,
            foldLines: true,
            value: [].concat(value || []).map((value2) => {
              if (typeof value2 === "string") {
                value2 = {
                  url: value2
                };
              }
              if (value2 && value2.url) {
                if (key.toLowerCase().trim() === "id") {
                  let comment2 = value2.comment || "";
                  if (mimeFuncs.isPlainText(comment2)) {
                    comment2 = '"' + comment2 + '"';
                  } else {
                    comment2 = mimeFuncs.encodeWord(comment2);
                  }
                  return (value2.comment ? comment2 + " " : "") + this._formatListUrl(value2.url).replace(/^<[^:]+\/{,2}/, "");
                }
                let comment = value2.comment || "";
                if (!mimeFuncs.isPlainText(comment)) {
                  comment = mimeFuncs.encodeWord(comment);
                }
                return this._formatListUrl(value2.url) + (value2.comment ? " (" + comment + ")" : "");
              }
              return "";
            }).filter((value2) => value2).join(", ")
          }))
        }));
      }
      _formatListUrl(url) {
        url = url.replace(/[\s<]+|[\s>]+/g, "");
        if (/^(https?|mailto|ftp):/.test(url)) {
          return "<" + url + ">";
        }
        if (/^[^@]+@[^@]+$/.test(url)) {
          return "<mailto:" + url + ">";
        }
        return "<http://" + url + ">";
      }
    };
    module.exports = MailMessage;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mailer/index.js
var require_mailer = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/mailer/index.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events");
    var shared = require_shared();
    var mimeTypes = require_mime_types();
    var MailComposer = require_mail_composer();
    var DKIM = require_dkim();
    var httpProxyClient = require_http_proxy_client();
    var util = __require("node:util");
    var urllib = __require("node:url");
    var packageData = require_package();
    var MailMessage = require_mail_message();
    var net = __require("node:net");
    var dns = __require("node:dns");
    var crypto2 = __require("node:crypto");
    var Mail = class extends EventEmitter {
      constructor(transporter, options, defaults) {
        super();
        this.options = options || {};
        this._defaults = defaults || {};
        this._defaultPlugins = {
          compile: [
            (...args) => this._convertDataImages(...args)
          ],
          stream: []
        };
        this._userPlugins = {
          compile: [],
          stream: []
        };
        this.meta = /* @__PURE__ */ new Map();
        this.dkim = this.options.dkim ? new DKIM(this.options.dkim) : false;
        this.transporter = transporter;
        this.transporter.mailer = this;
        this.logger = shared.getLogger(this.options, {
          component: this.options.component || "mail"
        });
        this.logger.debug({
          tnx: "create"
        }, "Creating transport: %s", this.getVersionString());
        if (typeof this.transporter.on === "function") {
          this.transporter.on("log", (log) => {
            this.logger.debug({
              tnx: "transport"
            }, "%s: %s", log.type, log.message);
          });
          this.transporter.on("error", (err) => {
            this.logger.error({
              err,
              tnx: "transport"
            }, "Transport Error: %s", err.message);
            this.emit("error", err);
          });
          this.transporter.on("idle", (...args) => {
            this.emit("idle", ...args);
          });
        }
        [
          "close",
          "isIdle",
          "verify"
        ].forEach((method) => {
          this[method] = (...args) => {
            if (typeof this.transporter[method] === "function") {
              if (method === "verify" && typeof this.getSocket === "function") {
                this.transporter.getSocket = this.getSocket;
                this.getSocket = false;
              }
              return this.transporter[method](...args);
            } else {
              this.logger.warn({
                tnx: "transport",
                methodName: method
              }, "Non existing method %s called for transport", method);
              return false;
            }
          };
        });
        if (this.options.proxy && typeof this.options.proxy === "string") {
          this.setupProxy(this.options.proxy);
        }
      }
      use(step, plugin) {
        step = (step || "").toString();
        if (!this._userPlugins.hasOwnProperty(step)) {
          this._userPlugins[step] = [
            plugin
          ];
        } else {
          this._userPlugins[step].push(plugin);
        }
        return this;
      }
      /**
         * Sends an email using the preselected transport object
         *
         * @param {Object} data E-data description
         * @param {Function?} callback Callback to run once the sending succeeded or failed
         */
      sendMail(data, callback = null) {
        let promise;
        if (!callback) {
          promise = new Promise((resolve, reject) => {
            callback = shared.callbackPromise(resolve, reject);
          });
        }
        if (typeof this.getSocket === "function") {
          this.transporter.getSocket = this.getSocket;
          this.getSocket = false;
        }
        let mail = new MailMessage(this, data);
        this.logger.debug({
          tnx: "transport",
          name: this.transporter.name,
          version: this.transporter.version,
          action: "send"
        }, "Sending mail using %s/%s", this.transporter.name, this.transporter.version);
        this._processPlugins("compile", mail, (err) => {
          if (err) {
            this.logger.error({
              err,
              tnx: "plugin",
              action: "compile"
            }, "PluginCompile Error: %s", err.message);
            return callback(err);
          }
          mail.message = new MailComposer(mail.data).compile();
          mail.setMailerHeader();
          mail.setPriorityHeaders();
          mail.setListHeaders();
          this._processPlugins("stream", mail, (err2) => {
            if (err2) {
              this.logger.error({
                err: err2,
                tnx: "plugin",
                action: "stream"
              }, "PluginStream Error: %s", err2.message);
              return callback(err2);
            }
            if (mail.data.dkim || this.dkim) {
              mail.message.processFunc((input) => {
                let dkim = mail.data.dkim ? new DKIM(mail.data.dkim) : this.dkim;
                this.logger.debug({
                  tnx: "DKIM",
                  messageId: mail.message.messageId(),
                  dkimDomains: dkim.keys.map((key) => key.keySelector + "." + key.domainName).join(", ")
                }, "Signing outgoing message with %s keys", dkim.keys.length);
                return dkim.sign(input, mail.data._dkim);
              });
            }
            this.transporter.send(mail, (...args) => {
              if (args[0]) {
                this.logger.error({
                  err: args[0],
                  tnx: "transport",
                  action: "send"
                }, "Send Error: %s", args[0].message);
              }
              callback(...args);
            });
          });
        });
        return promise;
      }
      getVersionString() {
        return util.format("%s (%s; +%s; %s/%s)", packageData.name, packageData.version, packageData.homepage, this.transporter.name, this.transporter.version);
      }
      _processPlugins(step, mail, callback) {
        step = (step || "").toString();
        if (!this._userPlugins.hasOwnProperty(step)) {
          return callback();
        }
        let userPlugins = this._userPlugins[step] || [];
        let defaultPlugins = this._defaultPlugins[step] || [];
        if (userPlugins.length) {
          this.logger.debug({
            tnx: "transaction",
            pluginCount: userPlugins.length,
            step
          }, "Using %s plugins for %s", userPlugins.length, step);
        }
        if (userPlugins.length + defaultPlugins.length === 0) {
          return callback();
        }
        let pos = 0;
        let block = "default";
        let processPlugins = () => {
          let curplugins = block === "default" ? defaultPlugins : userPlugins;
          if (pos >= curplugins.length) {
            if (block === "default" && userPlugins.length) {
              block = "user";
              pos = 0;
              curplugins = userPlugins;
            } else {
              return callback();
            }
          }
          let plugin = curplugins[pos++];
          plugin(mail, (err) => {
            if (err) {
              return callback(err);
            }
            processPlugins();
          });
        };
        processPlugins();
      }
      /**
         * Sets up proxy handler for a Nodemailer object
         *
         * @param {String} proxyUrl Proxy configuration url
         */
      setupProxy(proxyUrl) {
        let proxy = urllib.parse(proxyUrl);
        this.getSocket = (options, callback) => {
          let protocol = proxy.protocol.replace(/:$/, "").toLowerCase();
          if (this.meta.has("proxy_handler_" + protocol)) {
            return this.meta.get("proxy_handler_" + protocol)(proxy, options, callback);
          }
          switch (protocol) {
            // Connect using a HTTP CONNECT method
            case "http":
            case "https":
              httpProxyClient(proxy.href, options.port, options.host, (err, socket) => {
                if (err) {
                  return callback(err);
                }
                return callback(null, {
                  connection: socket
                });
              });
              return;
            case "socks":
            case "socks5":
            case "socks4":
            case "socks4a": {
              if (!this.meta.has("proxy_socks_module")) {
                return callback(new Error("Socks module not loaded"));
              }
              let connect = (ipaddress) => {
                let proxyV2 = !!this.meta.get("proxy_socks_module").SocksClient;
                let socksClient = proxyV2 ? this.meta.get("proxy_socks_module").SocksClient : this.meta.get("proxy_socks_module");
                let proxyType = Number(proxy.protocol.replace(/\D/g, "")) || 5;
                let connectionOpts = {
                  proxy: {
                    ipaddress,
                    port: Number(proxy.port),
                    type: proxyType
                  },
                  [proxyV2 ? "destination" : "target"]: {
                    host: options.host,
                    port: options.port
                  },
                  command: "connect"
                };
                if (proxy.auth) {
                  let username = decodeURIComponent(proxy.auth.split(":").shift());
                  let password = decodeURIComponent(proxy.auth.split(":").pop());
                  if (proxyV2) {
                    connectionOpts.proxy.userId = username;
                    connectionOpts.proxy.password = password;
                  } else if (proxyType === 4) {
                    connectionOpts.userid = username;
                  } else {
                    connectionOpts.authentication = {
                      username,
                      password
                    };
                  }
                }
                socksClient.createConnection(connectionOpts, (err, info) => {
                  if (err) {
                    return callback(err);
                  }
                  return callback(null, {
                    connection: info.socket || info
                  });
                });
              };
              if (net.isIP(proxy.hostname)) {
                return connect(proxy.hostname);
              }
              return dns.resolve(proxy.hostname, (err, address) => {
                if (err) {
                  return callback(err);
                }
                connect(Array.isArray(address) ? address[0] : address);
              });
            }
          }
          callback(new Error("Unknown proxy configuration"));
        };
      }
      _convertDataImages(mail, callback) {
        if (!this.options.attachDataUrls && !mail.data.attachDataUrls || !mail.data.html) {
          return callback();
        }
        mail.resolveContent(mail.data, "html", (err, html) => {
          if (err) {
            return callback(err);
          }
          let cidCounter = 0;
          html = (html || "").toString().replace(/(<img\b[^<>]{0,1024} src\s{0,20}=[\s"']{0,20})(data:([^;]+);[^"'>\s]+)/gi, (match, prefix, dataUri, mimeType) => {
            let cid = crypto2.randomBytes(10).toString("hex") + "@localhost";
            if (!mail.data.attachments) {
              mail.data.attachments = [];
            }
            if (!Array.isArray(mail.data.attachments)) {
              mail.data.attachments = [].concat(mail.data.attachments || []);
            }
            mail.data.attachments.push({
              path: dataUri,
              cid,
              filename: "image-" + ++cidCounter + "." + mimeTypes.detectExtension(mimeType)
            });
            return prefix + "cid:" + cid;
          });
          mail.data.html = html;
          callback();
        });
      }
      set(key, value) {
        return this.meta.set(key, value);
      }
      get(key) {
        return this.meta.get(key);
      }
    };
    module.exports = Mail;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-connection/data-stream.js
var require_data_stream = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-connection/data-stream.js"(exports, module) {
    "use strict";
    var stream = __require("node:stream");
    var Transform = stream.Transform;
    var DataStream = class extends Transform {
      constructor(options) {
        super(options);
        this.options = options || {};
        this._curLine = "";
        this.inByteCount = 0;
        this.outByteCount = 0;
        this.lastByte = false;
      }
      /**
         * Escapes dots
         */
      _transform(chunk, encoding, done) {
        let chunks = [];
        let chunklen = 0;
        let i, len, lastPos = 0;
        let buf;
        if (!chunk || !chunk.length) {
          return done();
        }
        if (typeof chunk === "string") {
          chunk = Buffer.from(chunk);
        }
        this.inByteCount += chunk.length;
        for (i = 0, len = chunk.length; i < len; i++) {
          if (chunk[i] === 46) {
            if (i && chunk[i - 1] === 10 || !i && (!this.lastByte || this.lastByte === 10)) {
              buf = chunk.slice(lastPos, i + 1);
              chunks.push(buf);
              chunks.push(Buffer.from("."));
              chunklen += buf.length + 1;
              lastPos = i + 1;
            }
          } else if (chunk[i] === 10) {
            if (i && chunk[i - 1] !== 13 || !i && this.lastByte !== 13) {
              if (i > lastPos) {
                buf = chunk.slice(lastPos, i);
                chunks.push(buf);
                chunklen += buf.length + 2;
              } else {
                chunklen += 2;
              }
              chunks.push(Buffer.from("\r\n"));
              lastPos = i + 1;
            }
          }
        }
        if (chunklen) {
          if (lastPos < chunk.length) {
            buf = chunk.slice(lastPos);
            chunks.push(buf);
            chunklen += buf.length;
          }
          this.outByteCount += chunklen;
          this.push(Buffer.concat(chunks, chunklen));
        } else {
          this.outByteCount += chunk.length;
          this.push(chunk);
        }
        this.lastByte = chunk[chunk.length - 1];
        done();
      }
      /**
         * Finalizes the stream with a dot on a single line
         */
      _flush(done) {
        let buf;
        if (this.lastByte === 10) {
          buf = Buffer.from(".\r\n");
        } else if (this.lastByte === 13) {
          buf = Buffer.from("\n.\r\n");
        } else {
          buf = Buffer.from("\r\n.\r\n");
        }
        this.outByteCount += buf.length;
        this.push(buf);
        done();
      }
    };
    module.exports = DataStream;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-connection/index.js
var require_smtp_connection = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-connection/index.js"(exports, module) {
    "use strict";
    var packageInfo = require_package();
    var EventEmitter = __require("node:events").EventEmitter;
    var net = __require("node:net");
    var tls = __require("node:tls");
    var os = __require("node:os");
    var crypto2 = __require("node:crypto");
    var DataStream = require_data_stream();
    var PassThrough = __require("node:stream").PassThrough;
    var shared = require_shared();
    var CONNECTION_TIMEOUT = 2 * 60 * 1e3;
    var SOCKET_TIMEOUT = 10 * 60 * 1e3;
    var GREETING_TIMEOUT = 30 * 1e3;
    var DNS_TIMEOUT = 30 * 1e3;
    var SMTPConnection = class extends EventEmitter {
      constructor(options) {
        super(options);
        this.id = crypto2.randomBytes(8).toString("base64").replace(/\W/g, "");
        this.stage = "init";
        this.options = options || {};
        this.secureConnection = !!this.options.secure;
        this.alreadySecured = !!this.options.secured;
        this.port = Number(this.options.port) || (this.secureConnection ? 465 : 587);
        this.host = this.options.host || "localhost";
        this.servername = this.options.servername ? this.options.servername : !net.isIP(this.host) ? this.host : false;
        this.allowInternalNetworkInterfaces = this.options.allowInternalNetworkInterfaces || false;
        if (typeof this.options.secure === "undefined" && this.port === 465) {
          this.secureConnection = true;
        }
        this.name = this.options.name || this._getHostname();
        this.logger = shared.getLogger(this.options, {
          component: this.options.component || "smtp-connection",
          sid: this.id
        });
        this.customAuth = /* @__PURE__ */ new Map();
        Object.keys(this.options.customAuth || {}).forEach((key) => {
          let mapKey = (key || "").toString().trim().toUpperCase();
          if (!mapKey) {
            return;
          }
          this.customAuth.set(mapKey, this.options.customAuth[key]);
        });
        this.version = packageInfo.version;
        this.authenticated = false;
        this.destroyed = false;
        this.secure = !!this.secureConnection;
        this._remainder = "";
        this._responseQueue = [];
        this.lastServerResponse = false;
        this._socket = false;
        this._supportedAuth = [];
        this.allowsAuth = false;
        this._envelope = false;
        this._supportedExtensions = [];
        this._maxAllowedSize = 0;
        this._responseActions = [];
        this._recipientQueue = [];
        this._greetingTimeout = false;
        this._connectionTimeout = false;
        this._destroyed = false;
        this._closing = false;
        this._onSocketData = (chunk) => this._onData(chunk);
        this._onSocketError = (error) => this._onError(error, "ESOCKET", false, "CONN");
        this._onSocketClose = () => this._onClose();
        this._onSocketEnd = () => this._onEnd();
        this._onSocketTimeout = () => this._onTimeout();
      }
      /**
         * Creates a connection to a SMTP server and sets up connection
         * listener
         */
      connect(connectCallback) {
        if (typeof connectCallback === "function") {
          this.once("connect", () => {
            this.logger.debug({
              tnx: "smtp"
            }, "SMTP handshake finished");
            connectCallback();
          });
          const isDestroyedMessage = this._isDestroyedMessage("connect");
          if (isDestroyedMessage) {
            return connectCallback(this._formatError(isDestroyedMessage, "ECONNECTION", false, "CONN"));
          }
        }
        let opts = {
          port: this.port,
          host: this.host,
          allowInternalNetworkInterfaces: this.allowInternalNetworkInterfaces,
          timeout: this.options.dnsTimeout || DNS_TIMEOUT
        };
        if (this.options.localAddress) {
          opts.localAddress = this.options.localAddress;
        }
        let setupConnectionHandlers = () => {
          this._connectionTimeout = setTimeout(() => {
            this._onError("Connection timeout", "ETIMEDOUT", false, "CONN");
          }, this.options.connectionTimeout || CONNECTION_TIMEOUT);
          this._socket.on("error", this._onSocketError);
        };
        if (this.options.connection) {
          this._socket = this.options.connection;
          if (this.secureConnection && !this.alreadySecured) {
            setImmediate(() => this._upgradeConnection((err) => {
              if (err) {
                this._onError(new Error("Error initiating TLS - " + (err.message || err)), "ETLS", false, "CONN");
                return;
              }
              this._onConnect();
            }));
          } else {
            setImmediate(() => this._onConnect());
          }
          return;
        } else if (this.options.socket) {
          this._socket = this.options.socket;
          return shared.resolveHostname(opts, (err, resolved) => {
            if (err) {
              return setImmediate(() => this._onError(err, "EDNS", false, "CONN"));
            }
            this.logger.debug({
              tnx: "dns",
              source: opts.host,
              resolved: resolved.host,
              cached: !!resolved.cached
            }, "Resolved %s as %s [cache %s]", opts.host, resolved.host, resolved.cached ? "hit" : "miss");
            Object.keys(resolved).forEach((key) => {
              if (key.charAt(0) !== "_" && resolved[key]) {
                opts[key] = resolved[key];
              }
            });
            try {
              this._socket.connect(this.port, this.host, () => {
                this._socket.setKeepAlive(true);
                this._onConnect();
              });
              setupConnectionHandlers();
            } catch (E) {
              return setImmediate(() => this._onError(E, "ECONNECTION", false, "CONN"));
            }
          });
        } else if (this.secureConnection) {
          if (this.options.tls) {
            Object.keys(this.options.tls).forEach((key) => {
              opts[key] = this.options.tls[key];
            });
          }
          if (this.servername && !opts.servername) {
            opts.servername = this.servername;
          }
          return shared.resolveHostname(opts, (err, resolved) => {
            if (err) {
              return setImmediate(() => this._onError(err, "EDNS", false, "CONN"));
            }
            this.logger.debug({
              tnx: "dns",
              source: opts.host,
              resolved: resolved.host,
              cached: !!resolved.cached
            }, "Resolved %s as %s [cache %s]", opts.host, resolved.host, resolved.cached ? "hit" : "miss");
            Object.keys(resolved).forEach((key) => {
              if (key.charAt(0) !== "_" && resolved[key]) {
                opts[key] = resolved[key];
              }
            });
            try {
              this._socket = tls.connect(opts, () => {
                this._socket.setKeepAlive(true);
                this._onConnect();
              });
              setupConnectionHandlers();
            } catch (E) {
              return setImmediate(() => this._onError(E, "ECONNECTION", false, "CONN"));
            }
          });
        } else {
          return shared.resolveHostname(opts, (err, resolved) => {
            if (err) {
              return setImmediate(() => this._onError(err, "EDNS", false, "CONN"));
            }
            this.logger.debug({
              tnx: "dns",
              source: opts.host,
              resolved: resolved.host,
              cached: !!resolved.cached
            }, "Resolved %s as %s [cache %s]", opts.host, resolved.host, resolved.cached ? "hit" : "miss");
            Object.keys(resolved).forEach((key) => {
              if (key.charAt(0) !== "_" && resolved[key]) {
                opts[key] = resolved[key];
              }
            });
            try {
              this._socket = net.connect(opts, () => {
                this._socket.setKeepAlive(true);
                this._onConnect();
              });
              setupConnectionHandlers();
            } catch (E) {
              return setImmediate(() => this._onError(E, "ECONNECTION", false, "CONN"));
            }
          });
        }
      }
      /**
         * Sends QUIT
         */
      quit() {
        this._sendCommand("QUIT");
        this._responseActions.push(this.close);
      }
      /**
         * Closes the connection to the server
         */
      close() {
        clearTimeout(this._connectionTimeout);
        clearTimeout(this._greetingTimeout);
        this._responseActions = [];
        if (this._closing) {
          return;
        }
        this._closing = true;
        let closeMethod = "end";
        if (this.stage === "init") {
          closeMethod = "destroy";
        }
        this.logger.debug({
          tnx: "smtp"
        }, 'Closing connection to the server using "%s"', closeMethod);
        let socket = this._socket && this._socket.socket || this._socket;
        if (socket && !socket.destroyed) {
          try {
            this._socket[closeMethod]();
          } catch (E) {
          }
        }
        this._destroy();
      }
      /**
         * Authenticate user
         */
      login(authData, callback) {
        const isDestroyedMessage = this._isDestroyedMessage("login");
        if (isDestroyedMessage) {
          return callback(this._formatError(isDestroyedMessage, "ECONNECTION", false, "API"));
        }
        this._auth = authData || {};
        this._authMethod = (this._auth.method || "").toString().trim().toUpperCase() || false;
        if (!this._authMethod && this._auth.oauth2 && !this._auth.credentials) {
          this._authMethod = "XOAUTH2";
        } else if (!this._authMethod || this._authMethod === "XOAUTH2" && !this._auth.oauth2) {
          this._authMethod = (this._supportedAuth[0] || "PLAIN").toUpperCase().trim();
        }
        if (this._authMethod !== "XOAUTH2" && (!this._auth.credentials || !this._auth.credentials.user || !this._auth.credentials.pass)) {
          if (this._auth.user && this._auth.pass || this.customAuth.has(this._authMethod)) {
            this._auth.credentials = {
              user: this._auth.user,
              pass: this._auth.pass,
              options: this._auth.options
            };
          } else {
            return callback(this._formatError('Missing credentials for "' + this._authMethod + '"', "EAUTH", false, "API"));
          }
        }
        if (this.customAuth.has(this._authMethod)) {
          let handler2 = this.customAuth.get(this._authMethod);
          let lastResponse;
          let returned = false;
          let resolve = () => {
            if (returned) {
              return;
            }
            returned = true;
            this.logger.info({
              tnx: "smtp",
              username: this._auth.user,
              action: "authenticated",
              method: this._authMethod
            }, "User %s authenticated", JSON.stringify(this._auth.user));
            this.authenticated = true;
            callback(null, true);
          };
          let reject = (err) => {
            if (returned) {
              return;
            }
            returned = true;
            callback(this._formatError(err, "EAUTH", lastResponse, "AUTH " + this._authMethod));
          };
          let handlerResponse = handler2({
            auth: this._auth,
            method: this._authMethod,
            extensions: [].concat(this._supportedExtensions),
            authMethods: [].concat(this._supportedAuth),
            maxAllowedSize: this._maxAllowedSize || false,
            sendCommand: (cmd, done) => {
              let promise;
              if (!done) {
                promise = new Promise((resolve2, reject2) => {
                  done = shared.callbackPromise(resolve2, reject2);
                });
              }
              this._responseActions.push((str) => {
                lastResponse = str;
                let codes = str.match(/^(\d+)(?:\s(\d+\.\d+\.\d+))?\s/);
                let data = {
                  command: cmd,
                  response: str
                };
                if (codes) {
                  data.status = Number(codes[1]) || 0;
                  if (codes[2]) {
                    data.code = codes[2];
                  }
                  data.text = str.substr(codes[0].length);
                } else {
                  data.text = str;
                  data.status = 0;
                }
                done(null, data);
              });
              setImmediate(() => this._sendCommand(cmd));
              return promise;
            },
            resolve,
            reject
          });
          if (handlerResponse && typeof handlerResponse.catch === "function") {
            handlerResponse.then(resolve).catch(reject);
          }
          return;
        }
        switch (this._authMethod) {
          case "XOAUTH2":
            this._handleXOauth2Token(false, callback);
            return;
          case "LOGIN":
            this._responseActions.push((str) => {
              this._actionAUTH_LOGIN_USER(str, callback);
            });
            this._sendCommand("AUTH LOGIN");
            return;
          case "PLAIN":
            this._responseActions.push((str) => {
              this._actionAUTHComplete(str, callback);
            });
            this._sendCommand(
              "AUTH PLAIN " + Buffer.from(
                //this._auth.user+'\u0000'+
                "\0" + // skip authorization identity as it causes problems with some servers
                this._auth.credentials.user + "\0" + this._auth.credentials.pass,
                "utf-8"
              ).toString("base64"),
              // log entry without passwords
              "AUTH PLAIN " + Buffer.from(
                //this._auth.user+'\u0000'+
                "\0" + // skip authorization identity as it causes problems with some servers
                this._auth.credentials.user + "\0/* secret */",
                "utf-8"
              ).toString("base64")
            );
            return;
          case "CRAM-MD5":
            this._responseActions.push((str) => {
              this._actionAUTH_CRAM_MD5(str, callback);
            });
            this._sendCommand("AUTH CRAM-MD5");
            return;
        }
        return callback(this._formatError('Unknown authentication method "' + this._authMethod + '"', "EAUTH", false, "API"));
      }
      /**
         * Sends a message
         *
         * @param {Object} envelope Envelope object, {from: addr, to: [addr]}
         * @param {Object} message String, Buffer or a Stream
         * @param {Function} callback Callback to return once sending is completed
         */
      send(envelope, message, done) {
        if (!message) {
          return done(this._formatError("Empty message", "EMESSAGE", false, "API"));
        }
        const isDestroyedMessage = this._isDestroyedMessage("send message");
        if (isDestroyedMessage) {
          return done(this._formatError(isDestroyedMessage, "ECONNECTION", false, "API"));
        }
        if (this._maxAllowedSize && envelope.size > this._maxAllowedSize) {
          return setImmediate(() => {
            done(this._formatError("Message size larger than allowed " + this._maxAllowedSize, "EMESSAGE", false, "MAIL FROM"));
          });
        }
        let returned = false;
        let callback = function() {
          if (returned) {
            return;
          }
          returned = true;
          done(...arguments);
        };
        if (typeof message.on === "function") {
          message.on("error", (err) => callback(this._formatError(err, "ESTREAM", false, "API")));
        }
        let startTime = Date.now();
        this._setEnvelope(envelope, (err, info) => {
          if (err) {
            return callback(err);
          }
          let envelopeTime = Date.now();
          let stream = this._createSendStream((err2, str) => {
            if (err2) {
              return callback(err2);
            }
            info.envelopeTime = envelopeTime - startTime;
            info.messageTime = Date.now() - envelopeTime;
            info.messageSize = stream.outByteCount;
            info.response = str;
            return callback(null, info);
          });
          if (typeof message.pipe === "function") {
            message.pipe(stream);
          } else {
            stream.write(message);
            stream.end();
          }
        });
      }
      /**
         * Resets connection state
         *
         * @param {Function} callback Callback to return once connection is reset
         */
      reset(callback) {
        this._sendCommand("RSET");
        this._responseActions.push((str) => {
          if (str.charAt(0) !== "2") {
            return callback(this._formatError("Could not reset session state. response=" + str, "EPROTOCOL", str, "RSET"));
          }
          this._envelope = false;
          return callback(null, true);
        });
      }
      /**
         * Connection listener that is run when the connection to
         * the server is opened
         *
         * @event
         */
      _onConnect() {
        clearTimeout(this._connectionTimeout);
        this.logger.info({
          tnx: "network",
          localAddress: this._socket.localAddress,
          localPort: this._socket.localPort,
          remoteAddress: this._socket.remoteAddress,
          remotePort: this._socket.remotePort
        }, "%s established to %s:%s", this.secure ? "Secure connection" : "Connection", this._socket.remoteAddress, this._socket.remotePort);
        if (this._destroyed) {
          this.close();
          return;
        }
        this.stage = "connected";
        this._socket.removeListener("data", this._onSocketData);
        this._socket.removeListener("timeout", this._onSocketTimeout);
        this._socket.removeListener("close", this._onSocketClose);
        this._socket.removeListener("end", this._onSocketEnd);
        this._socket.on("data", this._onSocketData);
        this._socket.once("close", this._onSocketClose);
        this._socket.once("end", this._onSocketEnd);
        this._socket.setTimeout(this.options.socketTimeout || SOCKET_TIMEOUT);
        this._socket.on("timeout", this._onSocketTimeout);
        this._greetingTimeout = setTimeout(() => {
          if (this._socket && !this._destroyed && this._responseActions[0] === this._actionGreeting) {
            this._onError("Greeting never received", "ETIMEDOUT", false, "CONN");
          }
        }, this.options.greetingTimeout || GREETING_TIMEOUT);
        this._responseActions.push(this._actionGreeting);
        this._socket.resume();
      }
      /**
         * 'data' listener for data coming from the server
         *
         * @event
         * @param {Buffer} chunk Data chunk coming from the server
         */
      _onData(chunk) {
        if (this._destroyed || !chunk || !chunk.length) {
          return;
        }
        let data = (chunk || "").toString("binary");
        let lines = (this._remainder + data).split(/\r?\n/);
        let lastline;
        this._remainder = lines.pop();
        for (let i = 0, len = lines.length; i < len; i++) {
          if (this._responseQueue.length) {
            lastline = this._responseQueue[this._responseQueue.length - 1];
            if (/^\d+-/.test(lastline.split("\n").pop())) {
              this._responseQueue[this._responseQueue.length - 1] += "\n" + lines[i];
              continue;
            }
          }
          this._responseQueue.push(lines[i]);
        }
        if (this._responseQueue.length) {
          lastline = this._responseQueue[this._responseQueue.length - 1];
          if (/^\d+-/.test(lastline.split("\n").pop())) {
            return;
          }
        }
        this._processResponse();
      }
      /**
         * 'error' listener for the socket
         *
         * @event
         * @param {Error} err Error object
         * @param {String} type Error name
         */
      _onError(err, type, data, command) {
        clearTimeout(this._connectionTimeout);
        clearTimeout(this._greetingTimeout);
        if (this._destroyed) {
          return;
        }
        err = this._formatError(err, type, data, command);
        this.logger.error(data, err.message);
        this.emit("error", err);
        this.close();
      }
      _formatError(message, type, response, command) {
        let err;
        if (/Error\]$/i.test(Object.prototype.toString.call(message))) {
          err = message;
        } else {
          err = new Error(message);
        }
        if (type && type !== "Error") {
          err.code = type;
        }
        if (response) {
          err.response = response;
          err.message += ": " + response;
        }
        let responseCode = typeof response === "string" && Number((response.match(/^\d+/) || [])[0]) || false;
        if (responseCode) {
          err.responseCode = responseCode;
        }
        if (command) {
          err.command = command;
        }
        return err;
      }
      /**
         * 'close' listener for the socket
         *
         * @event
         */
      _onClose() {
        let serverResponse = false;
        if (this._remainder && this._remainder.trim()) {
          if (this.options.debug || this.options.transactionLog) {
            this.logger.debug({
              tnx: "server"
            }, this._remainder.replace(/\r?\n$/, ""));
          }
          this.lastServerResponse = serverResponse = this._remainder.trim();
        }
        this.logger.info({
          tnx: "network"
        }, "Connection closed");
        if (this.upgrading && !this._destroyed) {
          return this._onError(new Error("Connection closed unexpectedly"), "ETLS", serverResponse, "CONN");
        } else if (![
          this._actionGreeting,
          this.close
        ].includes(this._responseActions[0]) && !this._destroyed) {
          return this._onError(new Error("Connection closed unexpectedly"), "ECONNECTION", serverResponse, "CONN");
        } else if (/^[45]\d{2}\b/.test(serverResponse)) {
          return this._onError(new Error("Connection closed unexpectedly"), "ECONNECTION", serverResponse, "CONN");
        }
        this._destroy();
      }
      /**
         * 'end' listener for the socket
         *
         * @event
         */
      _onEnd() {
        if (this._socket && !this._socket.destroyed) {
          this._socket.destroy();
        }
      }
      /**
         * 'timeout' listener for the socket
         *
         * @event
         */
      _onTimeout() {
        return this._onError(new Error("Timeout"), "ETIMEDOUT", false, "CONN");
      }
      /**
         * Destroys the client, emits 'end'
         */
      _destroy() {
        if (this._destroyed) {
          return;
        }
        this._destroyed = true;
        this.emit("end");
      }
      /**
         * Upgrades the connection to TLS
         *
         * @param {Function} callback Callback function to run when the connection
         *        has been secured
         */
      _upgradeConnection(callback) {
        this._socket.removeListener("data", this._onSocketData);
        this._socket.removeListener("timeout", this._onSocketTimeout);
        let socketPlain = this._socket;
        let opts = {
          socket: this._socket,
          host: this.host
        };
        Object.keys(this.options.tls || {}).forEach((key) => {
          opts[key] = this.options.tls[key];
        });
        if (this.servername && !opts.servername) {
          opts.servername = this.servername;
        }
        this.upgrading = true;
        try {
          this._socket = tls.connect(opts, () => {
            this.secure = true;
            this.upgrading = false;
            this._socket.on("data", this._onSocketData);
            socketPlain.removeListener("close", this._onSocketClose);
            socketPlain.removeListener("end", this._onSocketEnd);
            return callback(null, true);
          });
        } catch (err) {
          return callback(err);
        }
        this._socket.on("error", this._onSocketError);
        this._socket.once("close", this._onSocketClose);
        this._socket.once("end", this._onSocketEnd);
        this._socket.setTimeout(this.options.socketTimeout || SOCKET_TIMEOUT);
        this._socket.on("timeout", this._onSocketTimeout);
        socketPlain.resume();
      }
      /**
         * Processes queued responses from the server
         *
         * @param {Boolean} force If true, ignores _processing flag
         */
      _processResponse() {
        if (!this._responseQueue.length) {
          return false;
        }
        let str = this.lastServerResponse = (this._responseQueue.shift() || "").toString();
        if (/^\d+-/.test(str.split("\n").pop())) {
          return;
        }
        if (this.options.debug || this.options.transactionLog) {
          this.logger.debug({
            tnx: "server"
          }, str.replace(/\r?\n$/, ""));
        }
        if (!str.trim()) {
          setImmediate(() => this._processResponse());
        }
        let action = this._responseActions.shift();
        if (typeof action === "function") {
          action.call(this, str);
          setImmediate(() => this._processResponse());
        } else {
          return this._onError(new Error("Unexpected Response"), "EPROTOCOL", str, "CONN");
        }
      }
      /**
         * Send a command to the server, append \r\n
         *
         * @param {String} str String to be sent to the server
         * @param {String} logStr Optional string to be used for logging instead of the actual string
         */
      _sendCommand(str, logStr) {
        if (this._destroyed) {
          return;
        }
        if (this._socket.destroyed) {
          return this.close();
        }
        if (this.options.debug || this.options.transactionLog) {
          this.logger.debug({
            tnx: "client"
          }, (logStr || str || "").toString().replace(/\r?\n$/, ""));
        }
        this._socket.write(Buffer.from(str + "\r\n", "utf-8"));
      }
      /**
         * Initiates a new message by submitting envelope data, starting with
         * MAIL FROM: command
         *
         * @param {Object} envelope Envelope object in the form of
         *        {from:'...', to:['...']}
         *        or
         *        {from:{address:'...',name:'...'}, to:[address:'...',name:'...']}
         */
      _setEnvelope(envelope, callback) {
        let args = [];
        let useSmtpUtf8 = false;
        this._envelope = envelope || {};
        this._envelope.from = (this._envelope.from && this._envelope.from.address || this._envelope.from || "").toString().trim();
        this._envelope.to = [].concat(this._envelope.to || []).map((to) => (to && to.address || to || "").toString().trim());
        if (!this._envelope.to.length) {
          return callback(this._formatError("No recipients defined", "EENVELOPE", false, "API"));
        }
        if (this._envelope.from && /[\r\n<>]/.test(this._envelope.from)) {
          return callback(this._formatError("Invalid sender " + JSON.stringify(this._envelope.from), "EENVELOPE", false, "API"));
        }
        if (/[\x80-\uFFFF]/.test(this._envelope.from)) {
          useSmtpUtf8 = true;
        }
        for (let i = 0, len = this._envelope.to.length; i < len; i++) {
          if (!this._envelope.to[i] || /[\r\n<>]/.test(this._envelope.to[i])) {
            return callback(this._formatError("Invalid recipient " + JSON.stringify(this._envelope.to[i]), "EENVELOPE", false, "API"));
          }
          if (/[\x80-\uFFFF]/.test(this._envelope.to[i])) {
            useSmtpUtf8 = true;
          }
        }
        this._envelope.rcptQueue = JSON.parse(JSON.stringify(this._envelope.to || []));
        this._envelope.rejected = [];
        this._envelope.rejectedErrors = [];
        this._envelope.accepted = [];
        if (this._envelope.dsn) {
          try {
            this._envelope.dsn = this._setDsnEnvelope(this._envelope.dsn);
          } catch (err) {
            return callback(this._formatError("Invalid DSN " + err.message, "EENVELOPE", false, "API"));
          }
        }
        this._responseActions.push((str) => {
          this._actionMAIL(str, callback);
        });
        if (useSmtpUtf8 && this._supportedExtensions.includes("SMTPUTF8")) {
          args.push("SMTPUTF8");
          this._usingSmtpUtf8 = true;
        }
        if (this._envelope.use8BitMime && this._supportedExtensions.includes("8BITMIME")) {
          args.push("BODY=8BITMIME");
          this._using8BitMime = true;
        }
        if (this._envelope.size && this._supportedExtensions.includes("SIZE")) {
          args.push("SIZE=" + this._envelope.size);
        }
        if (this._envelope.dsn && this._supportedExtensions.includes("DSN")) {
          if (this._envelope.dsn.ret) {
            args.push("RET=" + shared.encodeXText(this._envelope.dsn.ret));
          }
          if (this._envelope.dsn.envid) {
            args.push("ENVID=" + shared.encodeXText(this._envelope.dsn.envid));
          }
        }
        this._sendCommand("MAIL FROM:<" + this._envelope.from + ">" + (args.length ? " " + args.join(" ") : ""));
      }
      _setDsnEnvelope(params) {
        let ret = (params.ret || params.return || "").toString().toUpperCase() || null;
        if (ret) {
          switch (ret) {
            case "HDRS":
            case "HEADERS":
              ret = "HDRS";
              break;
            case "FULL":
            case "BODY":
              ret = "FULL";
              break;
          }
        }
        if (ret && ![
          "FULL",
          "HDRS"
        ].includes(ret)) {
          throw new Error("ret: " + JSON.stringify(ret));
        }
        let envid = (params.envid || params.id || "").toString() || null;
        let notify = params.notify || null;
        if (notify) {
          if (typeof notify === "string") {
            notify = notify.split(",");
          }
          notify = notify.map((n) => n.trim().toUpperCase());
          let validNotify = [
            "NEVER",
            "SUCCESS",
            "FAILURE",
            "DELAY"
          ];
          let invaliNotify = notify.filter((n) => !validNotify.includes(n));
          if (invaliNotify.length || notify.length > 1 && notify.includes("NEVER")) {
            throw new Error("notify: " + JSON.stringify(notify.join(",")));
          }
          notify = notify.join(",");
        }
        let orcpt = (params.recipient || params.orcpt || "").toString() || null;
        if (orcpt && orcpt.indexOf(";") < 0) {
          orcpt = "rfc822;" + orcpt;
        }
        return {
          ret,
          envid,
          notify,
          orcpt
        };
      }
      _getDsnRcptToArgs() {
        let args = [];
        if (this._envelope.dsn && this._supportedExtensions.includes("DSN")) {
          if (this._envelope.dsn.notify) {
            args.push("NOTIFY=" + shared.encodeXText(this._envelope.dsn.notify));
          }
          if (this._envelope.dsn.orcpt) {
            args.push("ORCPT=" + shared.encodeXText(this._envelope.dsn.orcpt));
          }
        }
        return args.length ? " " + args.join(" ") : "";
      }
      _createSendStream(callback) {
        let dataStream = new DataStream();
        let logStream;
        if (this.options.lmtp) {
          this._envelope.accepted.forEach((recipient, i) => {
            let final = i === this._envelope.accepted.length - 1;
            this._responseActions.push((str) => {
              this._actionLMTPStream(recipient, final, str, callback);
            });
          });
        } else {
          this._responseActions.push((str) => {
            this._actionSMTPStream(str, callback);
          });
        }
        dataStream.pipe(this._socket, {
          end: false
        });
        if (this.options.debug) {
          logStream = new PassThrough();
          logStream.on("readable", () => {
            let chunk;
            while (chunk = logStream.read()) {
              this.logger.debug({
                tnx: "message"
              }, chunk.toString("binary").replace(/\r?\n$/, ""));
            }
          });
          dataStream.pipe(logStream);
        }
        dataStream.once("end", () => {
          this.logger.info({
            tnx: "message",
            inByteCount: dataStream.inByteCount,
            outByteCount: dataStream.outByteCount
          }, "<%s bytes encoded mime message (source size %s bytes)>", dataStream.outByteCount, dataStream.inByteCount);
        });
        return dataStream;
      }
      /** ACTIONS **/
      /**
      * Will be run after the connection is created and the server sends
      * a greeting. If the incoming message starts with 220 initiate
      * SMTP session by sending EHLO command
      *
      * @param {String} str Message from the server
      */
      _actionGreeting(str) {
        clearTimeout(this._greetingTimeout);
        if (str.substr(0, 3) !== "220") {
          this._onError(new Error("Invalid greeting. response=" + str), "EPROTOCOL", str, "CONN");
          return;
        }
        if (this.options.lmtp) {
          this._responseActions.push(this._actionLHLO);
          this._sendCommand("LHLO " + this.name);
        } else {
          this._responseActions.push(this._actionEHLO);
          this._sendCommand("EHLO " + this.name);
        }
      }
      /**
         * Handles server response for LHLO command. If it yielded in
         * error, emit 'error', otherwise treat this as an EHLO response
         *
         * @param {String} str Message from the server
         */
      _actionLHLO(str) {
        if (str.charAt(0) !== "2") {
          this._onError(new Error("Invalid LHLO. response=" + str), "EPROTOCOL", str, "LHLO");
          return;
        }
        this._actionEHLO(str);
      }
      /**
         * Handles server response for EHLO command. If it yielded in
         * error, try HELO instead, otherwise initiate TLS negotiation
         * if STARTTLS is supported by the server or move into the
         * authentication phase.
         *
         * @param {String} str Message from the server
         */
      _actionEHLO(str) {
        let match;
        if (str.substr(0, 3) === "421") {
          this._onError(new Error("Server terminates connection. response=" + str), "ECONNECTION", str, "EHLO");
          return;
        }
        if (str.charAt(0) !== "2") {
          if (this.options.requireTLS) {
            this._onError(new Error("EHLO failed but HELO does not support required STARTTLS. response=" + str), "ECONNECTION", str, "EHLO");
            return;
          }
          this._responseActions.push(this._actionHELO);
          this._sendCommand("HELO " + this.name);
          return;
        }
        this._ehloLines = str.split(/\r?\n/).map((line) => line.replace(/^\d+[ -]/, "").trim()).filter((line) => line).slice(1);
        if (!this.secure && !this.options.ignoreTLS && (/[ -]STARTTLS\b/im.test(str) || this.options.requireTLS)) {
          this._sendCommand("STARTTLS");
          this._responseActions.push(this._actionSTARTTLS);
          return;
        }
        if (/[ -]SMTPUTF8\b/im.test(str)) {
          this._supportedExtensions.push("SMTPUTF8");
        }
        if (/[ -]DSN\b/im.test(str)) {
          this._supportedExtensions.push("DSN");
        }
        if (/[ -]8BITMIME\b/im.test(str)) {
          this._supportedExtensions.push("8BITMIME");
        }
        if (/[ -]PIPELINING\b/im.test(str)) {
          this._supportedExtensions.push("PIPELINING");
        }
        if (/[ -]AUTH\b/i.test(str)) {
          this.allowsAuth = true;
        }
        if (/[ -]AUTH(?:(\s+|=)[^\n]*\s+|\s+|=)PLAIN/i.test(str)) {
          this._supportedAuth.push("PLAIN");
        }
        if (/[ -]AUTH(?:(\s+|=)[^\n]*\s+|\s+|=)LOGIN/i.test(str)) {
          this._supportedAuth.push("LOGIN");
        }
        if (/[ -]AUTH(?:(\s+|=)[^\n]*\s+|\s+|=)CRAM-MD5/i.test(str)) {
          this._supportedAuth.push("CRAM-MD5");
        }
        if (/[ -]AUTH(?:(\s+|=)[^\n]*\s+|\s+|=)XOAUTH2/i.test(str)) {
          this._supportedAuth.push("XOAUTH2");
        }
        if (match = str.match(/[ -]SIZE(?:[ \t]+(\d+))?/im)) {
          this._supportedExtensions.push("SIZE");
          this._maxAllowedSize = Number(match[1]) || 0;
        }
        this.emit("connect");
      }
      /**
         * Handles server response for HELO command. If it yielded in
         * error, emit 'error', otherwise move into the authentication phase.
         *
         * @param {String} str Message from the server
         */
      _actionHELO(str) {
        if (str.charAt(0) !== "2") {
          this._onError(new Error("Invalid HELO. response=" + str), "EPROTOCOL", str, "HELO");
          return;
        }
        this.allowsAuth = true;
        this.emit("connect");
      }
      /**
         * Handles server response for STARTTLS command. If there's an error
         * try HELO instead, otherwise initiate TLS upgrade. If the upgrade
         * succeedes restart the EHLO
         *
         * @param {String} str Message from the server
         */
      _actionSTARTTLS(str) {
        if (str.charAt(0) !== "2") {
          if (this.options.opportunisticTLS) {
            this.logger.info({
              tnx: "smtp"
            }, "Failed STARTTLS upgrade, continuing unencrypted");
            return this.emit("connect");
          }
          this._onError(new Error("Error upgrading connection with STARTTLS"), "ETLS", str, "STARTTLS");
          return;
        }
        this._upgradeConnection((err, secured) => {
          if (err) {
            this._onError(new Error("Error initiating TLS - " + (err.message || err)), "ETLS", false, "STARTTLS");
            return;
          }
          this.logger.info({
            tnx: "smtp"
          }, "Connection upgraded with STARTTLS");
          if (secured) {
            if (this.options.lmtp) {
              this._responseActions.push(this._actionLHLO);
              this._sendCommand("LHLO " + this.name);
            } else {
              this._responseActions.push(this._actionEHLO);
              this._sendCommand("EHLO " + this.name);
            }
          } else {
            this.emit("connect");
          }
        });
      }
      /**
         * Handle the response for AUTH LOGIN command. We are expecting
         * '334 VXNlcm5hbWU6' (base64 for 'Username:'). Data to be sent as
         * response needs to be base64 encoded username. We do not need
         * exact match but settle with 334 response in general as some
         * hosts invalidly use a longer message than VXNlcm5hbWU6
         *
         * @param {String} str Message from the server
         */
      _actionAUTH_LOGIN_USER(str, callback) {
        if (!/^334[ -]/.test(str)) {
          callback(this._formatError('Invalid login sequence while waiting for "334 VXNlcm5hbWU6"', "EAUTH", str, "AUTH LOGIN"));
          return;
        }
        this._responseActions.push((str2) => {
          this._actionAUTH_LOGIN_PASS(str2, callback);
        });
        this._sendCommand(Buffer.from(this._auth.credentials.user + "", "utf-8").toString("base64"));
      }
      /**
         * Handle the response for AUTH CRAM-MD5 command. We are expecting
         * '334 <challenge string>'. Data to be sent as response needs to be
         * base64 decoded challenge string, MD5 hashed using the password as
         * a HMAC key, prefixed by the username and a space, and finally all
         * base64 encoded again.
         *
         * @param {String} str Message from the server
         */
      _actionAUTH_CRAM_MD5(str, callback) {
        let challengeMatch = str.match(/^334\s+(.+)$/);
        let challengeString = "";
        if (!challengeMatch) {
          return callback(this._formatError("Invalid login sequence while waiting for server challenge string", "EAUTH", str, "AUTH CRAM-MD5"));
        } else {
          challengeString = challengeMatch[1];
        }
        let base64decoded = Buffer.from(challengeString, "base64").toString("ascii"), hmacMD5 = crypto2.createHmac("md5", this._auth.credentials.pass);
        hmacMD5.update(base64decoded);
        let prepended = this._auth.credentials.user + " " + hmacMD5.digest("hex");
        this._responseActions.push((str2) => {
          this._actionAUTH_CRAM_MD5_PASS(str2, callback);
        });
        this._sendCommand(
          Buffer.from(prepended).toString("base64"),
          // hidden hash for logs
          Buffer.from(this._auth.credentials.user + " /* secret */").toString("base64")
        );
      }
      /**
         * Handles the response to CRAM-MD5 authentication, if there's no error,
         * the user can be considered logged in. Start waiting for a message to send
         *
         * @param {String} str Message from the server
         */
      _actionAUTH_CRAM_MD5_PASS(str, callback) {
        if (!str.match(/^235\s+/)) {
          return callback(this._formatError('Invalid login sequence while waiting for "235"', "EAUTH", str, "AUTH CRAM-MD5"));
        }
        this.logger.info({
          tnx: "smtp",
          username: this._auth.user,
          action: "authenticated",
          method: this._authMethod
        }, "User %s authenticated", JSON.stringify(this._auth.user));
        this.authenticated = true;
        callback(null, true);
      }
      /**
         * Handle the response for AUTH LOGIN command. We are expecting
         * '334 UGFzc3dvcmQ6' (base64 for 'Password:'). Data to be sent as
         * response needs to be base64 encoded password.
         *
         * @param {String} str Message from the server
         */
      _actionAUTH_LOGIN_PASS(str, callback) {
        if (!/^334[ -]/.test(str)) {
          return callback(this._formatError('Invalid login sequence while waiting for "334 UGFzc3dvcmQ6"', "EAUTH", str, "AUTH LOGIN"));
        }
        this._responseActions.push((str2) => {
          this._actionAUTHComplete(str2, callback);
        });
        this._sendCommand(
          Buffer.from((this._auth.credentials.pass || "").toString(), "utf-8").toString("base64"),
          // Hidden pass for logs
          Buffer.from("/* secret */", "utf-8").toString("base64")
        );
      }
      /**
         * Handles the response for authentication, if there's no error,
         * the user can be considered logged in. Start waiting for a message to send
         *
         * @param {String} str Message from the server
         */
      _actionAUTHComplete(str, isRetry, callback) {
        if (!callback && typeof isRetry === "function") {
          callback = isRetry;
          isRetry = false;
        }
        if (str.substr(0, 3) === "334") {
          this._responseActions.push((str2) => {
            if (isRetry || this._authMethod !== "XOAUTH2") {
              this._actionAUTHComplete(str2, true, callback);
            } else {
              setImmediate(() => this._handleXOauth2Token(true, callback));
            }
          });
          this._sendCommand("");
          return;
        }
        if (str.charAt(0) !== "2") {
          this.logger.info({
            tnx: "smtp",
            username: this._auth.user,
            action: "authfail",
            method: this._authMethod
          }, "User %s failed to authenticate", JSON.stringify(this._auth.user));
          return callback(this._formatError("Invalid login", "EAUTH", str, "AUTH " + this._authMethod));
        }
        this.logger.info({
          tnx: "smtp",
          username: this._auth.user,
          action: "authenticated",
          method: this._authMethod
        }, "User %s authenticated", JSON.stringify(this._auth.user));
        this.authenticated = true;
        callback(null, true);
      }
      /**
         * Handle response for a MAIL FROM: command
         *
         * @param {String} str Message from the server
         */
      _actionMAIL(str, callback) {
        let message, curRecipient;
        if (Number(str.charAt(0)) !== 2) {
          if (this._usingSmtpUtf8 && /^550 /.test(str) && /[\x80-\uFFFF]/.test(this._envelope.from)) {
            message = "Internationalized mailbox name not allowed";
          } else {
            message = "Mail command failed";
          }
          return callback(this._formatError(message, "EENVELOPE", str, "MAIL FROM"));
        }
        if (!this._envelope.rcptQueue.length) {
          return callback(this._formatError("Can't send mail - no recipients defined", "EENVELOPE", false, "API"));
        } else {
          this._recipientQueue = [];
          if (this._supportedExtensions.includes("PIPELINING")) {
            while (this._envelope.rcptQueue.length) {
              curRecipient = this._envelope.rcptQueue.shift();
              this._recipientQueue.push(curRecipient);
              this._responseActions.push((str2) => {
                this._actionRCPT(str2, callback);
              });
              this._sendCommand("RCPT TO:<" + curRecipient + ">" + this._getDsnRcptToArgs());
            }
          } else {
            curRecipient = this._envelope.rcptQueue.shift();
            this._recipientQueue.push(curRecipient);
            this._responseActions.push((str2) => {
              this._actionRCPT(str2, callback);
            });
            this._sendCommand("RCPT TO:<" + curRecipient + ">" + this._getDsnRcptToArgs());
          }
        }
      }
      /**
         * Handle response for a RCPT TO: command
         *
         * @param {String} str Message from the server
         */
      _actionRCPT(str, callback) {
        let message, err, curRecipient = this._recipientQueue.shift();
        if (Number(str.charAt(0)) !== 2) {
          if (this._usingSmtpUtf8 && /^553 /.test(str) && /[\x80-\uFFFF]/.test(curRecipient)) {
            message = "Internationalized mailbox name not allowed";
          } else {
            message = "Recipient command failed";
          }
          this._envelope.rejected.push(curRecipient);
          err = this._formatError(message, "EENVELOPE", str, "RCPT TO");
          err.recipient = curRecipient;
          this._envelope.rejectedErrors.push(err);
        } else {
          this._envelope.accepted.push(curRecipient);
        }
        if (!this._envelope.rcptQueue.length && !this._recipientQueue.length) {
          if (this._envelope.rejected.length < this._envelope.to.length) {
            this._responseActions.push((str2) => {
              this._actionDATA(str2, callback);
            });
            this._sendCommand("DATA");
          } else {
            err = this._formatError("Can't send mail - all recipients were rejected", "EENVELOPE", str, "RCPT TO");
            err.rejected = this._envelope.rejected;
            err.rejectedErrors = this._envelope.rejectedErrors;
            return callback(err);
          }
        } else if (this._envelope.rcptQueue.length) {
          curRecipient = this._envelope.rcptQueue.shift();
          this._recipientQueue.push(curRecipient);
          this._responseActions.push((str2) => {
            this._actionRCPT(str2, callback);
          });
          this._sendCommand("RCPT TO:<" + curRecipient + ">" + this._getDsnRcptToArgs());
        }
      }
      /**
         * Handle response for a DATA command
         *
         * @param {String} str Message from the server
         */
      _actionDATA(str, callback) {
        if (!/^[23]/.test(str)) {
          return callback(this._formatError("Data command failed", "EENVELOPE", str, "DATA"));
        }
        let response = {
          accepted: this._envelope.accepted,
          rejected: this._envelope.rejected
        };
        if (this._ehloLines && this._ehloLines.length) {
          response.ehlo = this._ehloLines;
        }
        if (this._envelope.rejectedErrors.length) {
          response.rejectedErrors = this._envelope.rejectedErrors;
        }
        callback(null, response);
      }
      /**
         * Handle response for a DATA stream when using SMTP
         * We expect a single response that defines if the sending succeeded or failed
         *
         * @param {String} str Message from the server
         */
      _actionSMTPStream(str, callback) {
        if (Number(str.charAt(0)) !== 2) {
          return callback(this._formatError("Message failed", "EMESSAGE", str, "DATA"));
        } else {
          return callback(null, str);
        }
      }
      /**
         * Handle response for a DATA stream
         * We expect a separate response for every recipient. All recipients can either
         * succeed or fail separately
         *
         * @param {String} recipient The recipient this response applies to
         * @param {Boolean} final Is this the final recipient?
         * @param {String} str Message from the server
         */
      _actionLMTPStream(recipient, final, str, callback) {
        let err;
        if (Number(str.charAt(0)) !== 2) {
          err = this._formatError("Message failed for recipient " + recipient, "EMESSAGE", str, "DATA");
          err.recipient = recipient;
          this._envelope.rejected.push(recipient);
          this._envelope.rejectedErrors.push(err);
          for (let i = 0, len = this._envelope.accepted.length; i < len; i++) {
            if (this._envelope.accepted[i] === recipient) {
              this._envelope.accepted.splice(i, 1);
            }
          }
        }
        if (final) {
          return callback(null, str);
        }
      }
      _handleXOauth2Token(isRetry, callback) {
        this._auth.oauth2.getToken(isRetry, (err, accessToken) => {
          if (err) {
            this.logger.info({
              tnx: "smtp",
              username: this._auth.user,
              action: "authfail",
              method: this._authMethod
            }, "User %s failed to authenticate", JSON.stringify(this._auth.user));
            return callback(this._formatError(err, "EAUTH", false, "AUTH XOAUTH2"));
          }
          this._responseActions.push((str) => {
            this._actionAUTHComplete(str, isRetry, callback);
          });
          this._sendCommand(
            "AUTH XOAUTH2 " + this._auth.oauth2.buildXOAuth2Token(accessToken),
            //  Hidden for logs
            "AUTH XOAUTH2 " + this._auth.oauth2.buildXOAuth2Token("/* secret */")
          );
        });
      }
      /**
         *
         * @param {string} command
         * @private
         */
      _isDestroyedMessage(command) {
        if (this._destroyed) {
          return "Cannot " + command + " - smtp connection is already destroyed.";
        }
        if (this._socket) {
          if (this._socket.destroyed) {
            return "Cannot " + command + " - smtp connection socket is already destroyed.";
          }
          if (!this._socket.writable) {
            return "Cannot " + command + " - smtp connection socket is already half-closed.";
          }
        }
      }
      _getHostname() {
        let defaultHostname;
        try {
          defaultHostname = os.hostname() || "";
        } catch (err) {
          defaultHostname = "localhost";
        }
        if (!defaultHostname || defaultHostname.indexOf(".") < 0) {
          defaultHostname = "[127.0.0.1]";
        }
        if (defaultHostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
          defaultHostname = "[" + defaultHostname + "]";
        }
        return defaultHostname;
      }
    };
    module.exports = SMTPConnection;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/xoauth2/index.js
var require_xoauth2 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/xoauth2/index.js"(exports, module) {
    "use strict";
    var Stream = __require("node:stream").Stream;
    var nmfetch = require_fetch();
    var crypto2 = __require("node:crypto");
    var shared = require_shared();
    var XOAuth2 = class extends Stream {
      constructor(options, logger) {
        super();
        this.options = options || {};
        if (options && options.serviceClient) {
          if (!options.privateKey || !options.user) {
            setImmediate(() => this.emit("error", new Error('Options "privateKey" and "user" are required for service account!')));
            return;
          }
          let serviceRequestTimeout = Math.min(Math.max(Number(this.options.serviceRequestTimeout) || 0, 0), 3600);
          this.options.serviceRequestTimeout = serviceRequestTimeout || 5 * 60;
        }
        this.logger = shared.getLogger({
          logger
        }, {
          component: this.options.component || "OAuth2"
        });
        this.provisionCallback = typeof this.options.provisionCallback === "function" ? this.options.provisionCallback : false;
        this.options.accessUrl = this.options.accessUrl || "https://accounts.google.com/o/oauth2/token";
        this.options.customHeaders = this.options.customHeaders || {};
        this.options.customParams = this.options.customParams || {};
        this.accessToken = this.options.accessToken || false;
        if (this.options.expires && Number(this.options.expires)) {
          this.expires = this.options.expires;
        } else {
          let timeout = Math.max(Number(this.options.timeout) || 0, 0);
          this.expires = timeout && Date.now() + timeout * 1e3 || 0;
        }
      }
      /**
         * Returns or generates (if previous has expired) a XOAuth2 token
         *
         * @param {Boolean} renew If false then use cached access token (if available)
         * @param {Function} callback Callback function with error object and token string
         */
      getToken(renew, callback) {
        if (!renew && this.accessToken && (!this.expires || this.expires > Date.now())) {
          return callback(null, this.accessToken);
        }
        let generateCallback = (...args) => {
          if (args[0]) {
            this.logger.error({
              err: args[0],
              tnx: "OAUTH2",
              user: this.options.user,
              action: "renew"
            }, "Failed generating new Access Token for %s", this.options.user);
          } else {
            this.logger.info({
              tnx: "OAUTH2",
              user: this.options.user,
              action: "renew"
            }, "Generated new Access Token for %s", this.options.user);
          }
          callback(...args);
        };
        if (this.provisionCallback) {
          this.provisionCallback(this.options.user, !!renew, (err, accessToken, expires) => {
            if (!err && accessToken) {
              this.accessToken = accessToken;
              this.expires = expires || 0;
            }
            generateCallback(err, accessToken);
          });
        } else {
          this.generateToken(generateCallback);
        }
      }
      /**
         * Updates token values
         *
         * @param {String} accessToken New access token
         * @param {Number} timeout Access token lifetime in seconds
         *
         * Emits 'token': { user: User email-address, accessToken: the new accessToken, timeout: TTL in seconds}
         */
      updateToken(accessToken, timeout) {
        this.accessToken = accessToken;
        timeout = Math.max(Number(timeout) || 0, 0);
        this.expires = timeout && Date.now() + timeout * 1e3 || 0;
        this.emit("token", {
          user: this.options.user,
          accessToken: accessToken || "",
          expires: this.expires
        });
      }
      /**
         * Generates a new XOAuth2 token with the credentials provided at initialization
         *
         * @param {Function} callback Callback function with error object and token string
         */
      generateToken(callback) {
        let urlOptions;
        let loggedUrlOptions;
        if (this.options.serviceClient) {
          let iat = Math.floor(Date.now() / 1e3);
          let tokenData = {
            iss: this.options.serviceClient,
            scope: this.options.scope || "https://mail.google.com/",
            sub: this.options.user,
            aud: this.options.accessUrl,
            iat,
            exp: iat + this.options.serviceRequestTimeout
          };
          let token;
          try {
            token = this.jwtSignRS256(tokenData);
          } catch (err) {
            return callback(new Error("Can't generate token. Check your auth options"));
          }
          urlOptions = {
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: token
          };
          loggedUrlOptions = {
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: tokenData
          };
        } else {
          if (!this.options.refreshToken) {
            return callback(new Error("Can't create new access token for user"));
          }
          urlOptions = {
            client_id: this.options.clientId || "",
            client_secret: this.options.clientSecret || "",
            refresh_token: this.options.refreshToken,
            grant_type: "refresh_token"
          };
          loggedUrlOptions = {
            client_id: this.options.clientId || "",
            client_secret: (this.options.clientSecret || "").substr(0, 6) + "...",
            refresh_token: (this.options.refreshToken || "").substr(0, 6) + "...",
            grant_type: "refresh_token"
          };
        }
        Object.keys(this.options.customParams).forEach((key) => {
          urlOptions[key] = this.options.customParams[key];
          loggedUrlOptions[key] = this.options.customParams[key];
        });
        this.logger.debug({
          tnx: "OAUTH2",
          user: this.options.user,
          action: "generate"
        }, "Requesting token using: %s", JSON.stringify(loggedUrlOptions));
        this.postRequest(this.options.accessUrl, urlOptions, this.options, (error, body) => {
          let data;
          if (error) {
            return callback(error);
          }
          try {
            data = JSON.parse(body.toString());
          } catch (E) {
            return callback(E);
          }
          if (!data || typeof data !== "object") {
            this.logger.debug({
              tnx: "OAUTH2",
              user: this.options.user,
              action: "post"
            }, "Response: %s", (body || "").toString());
            return callback(new Error("Invalid authentication response"));
          }
          let logData = {};
          Object.keys(data).forEach((key) => {
            if (key !== "access_token") {
              logData[key] = data[key];
            } else {
              logData[key] = (data[key] || "").toString().substr(0, 6) + "...";
            }
          });
          this.logger.debug({
            tnx: "OAUTH2",
            user: this.options.user,
            action: "post"
          }, "Response: %s", JSON.stringify(logData));
          if (data.error) {
            let errorMessage = data.error;
            if (data.error_description) {
              errorMessage += ": " + data.error_description;
            }
            if (data.error_uri) {
              errorMessage += " (" + data.error_uri + ")";
            }
            return callback(new Error(errorMessage));
          }
          if (data.access_token) {
            this.updateToken(data.access_token, data.expires_in);
            return callback(null, this.accessToken);
          }
          return callback(new Error("No access token"));
        });
      }
      /**
         * Converts an access_token and user id into a base64 encoded XOAuth2 token
         *
         * @param {String} [accessToken] Access token string
         * @return {String} Base64 encoded token for IMAP or SMTP login
         */
      buildXOAuth2Token(accessToken) {
        let authData = [
          "user=" + (this.options.user || ""),
          "auth=Bearer " + (accessToken || this.accessToken),
          "",
          ""
        ];
        return Buffer.from(authData.join(""), "utf-8").toString("base64");
      }
      /**
         * Custom POST request handler.
         * This is only needed to keep paths short in Windows – usually this module
         * is a dependency of a dependency and if it tries to require something
         * like the request module the paths get way too long to handle for Windows.
         * As we do only a simple POST request we do not actually require complicated
         * logic support (no redirects, no nothing) anyway.
         *
         * @param {String} url Url to POST to
         * @param {String|Buffer} payload Payload to POST
         * @param {Function} callback Callback function with (err, buff)
         */
      postRequest(url, payload, params, callback) {
        let returned = false;
        let chunks = [];
        let chunklen = 0;
        let req = nmfetch(url, {
          method: "post",
          headers: params.customHeaders,
          body: payload,
          allowErrorResponse: true
        });
        req.on("readable", () => {
          let chunk;
          while ((chunk = req.read()) !== null) {
            chunks.push(chunk);
            chunklen += chunk.length;
          }
        });
        req.once("error", (err) => {
          if (returned) {
            return;
          }
          returned = true;
          return callback(err);
        });
        req.once("end", () => {
          if (returned) {
            return;
          }
          returned = true;
          return callback(null, Buffer.concat(chunks, chunklen));
        });
      }
      /**
         * Encodes a buffer or a string into Base64url format
         *
         * @param {Buffer|String} data The data to convert
         * @return {String} The encoded string
         */
      toBase64URL(data) {
        if (typeof data === "string") {
          data = Buffer.from(data);
        }
        return data.toString("base64").replace(/[=]+/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      }
      /**
         * Creates a JSON Web Token signed with RS256 (SHA256 + RSA)
         *
         * @param {Object} payload The payload to include in the generated token
         * @return {String} The generated and signed token
         */
      jwtSignRS256(payload) {
        payload = [
          '{"alg":"RS256","typ":"JWT"}',
          JSON.stringify(payload)
        ].map((val2) => this.toBase64URL(val2)).join(".");
        let signature = crypto2.createSign("RSA-SHA256").update(payload).sign(this.options.privateKey);
        return payload + "." + this.toBase64URL(signature);
      }
    };
    module.exports = XOAuth2;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-pool/pool-resource.js
var require_pool_resource = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-pool/pool-resource.js"(exports, module) {
    "use strict";
    var SMTPConnection = require_smtp_connection();
    var assign = require_shared().assign;
    var XOAuth2 = require_xoauth2();
    var EventEmitter = __require("node:events");
    var PoolResource = class extends EventEmitter {
      constructor(pool2) {
        super();
        this.pool = pool2;
        this.options = pool2.options;
        this.logger = this.pool.logger;
        if (this.options.auth) {
          switch ((this.options.auth.type || "").toString().toUpperCase()) {
            case "OAUTH2": {
              let oauth2 = new XOAuth2(this.options.auth, this.logger);
              oauth2.provisionCallback = this.pool.mailer && this.pool.mailer.get("oauth2_provision_cb") || oauth2.provisionCallback;
              this.auth = {
                type: "OAUTH2",
                user: this.options.auth.user,
                oauth2,
                method: "XOAUTH2"
              };
              oauth2.on("token", (token) => this.pool.mailer.emit("token", token));
              oauth2.on("error", (err) => this.emit("error", err));
              break;
            }
            default:
              if (!this.options.auth.user && !this.options.auth.pass) {
                break;
              }
              this.auth = {
                type: (this.options.auth.type || "").toString().toUpperCase() || "LOGIN",
                user: this.options.auth.user,
                credentials: {
                  user: this.options.auth.user || "",
                  pass: this.options.auth.pass,
                  options: this.options.auth.options
                },
                method: (this.options.auth.method || "").trim().toUpperCase() || this.options.authMethod || false
              };
          }
        }
        this._connection = false;
        this._connected = false;
        this.messages = 0;
        this.available = true;
      }
      /**
         * Initiates a connection to the SMTP server
         *
         * @param {Function} callback Callback function to run once the connection is established or failed
         */
      connect(callback) {
        this.pool.getSocket(this.options, (err, socketOptions) => {
          if (err) {
            return callback(err);
          }
          let returned = false;
          let options = this.options;
          if (socketOptions && socketOptions.connection) {
            this.logger.info({
              tnx: "proxy",
              remoteAddress: socketOptions.connection.remoteAddress,
              remotePort: socketOptions.connection.remotePort,
              destHost: options.host || "",
              destPort: options.port || "",
              action: "connected"
            }, "Using proxied socket from %s:%s to %s:%s", socketOptions.connection.remoteAddress, socketOptions.connection.remotePort, options.host || "", options.port || "");
            options = assign(false, options);
            Object.keys(socketOptions).forEach((key) => {
              options[key] = socketOptions[key];
            });
          }
          this.connection = new SMTPConnection(options);
          this.connection.once("error", (err2) => {
            this.emit("error", err2);
            if (returned) {
              return;
            }
            returned = true;
            return callback(err2);
          });
          this.connection.once("end", () => {
            this.close();
            if (returned) {
              return;
            }
            returned = true;
            let timer = setTimeout(() => {
              if (returned) {
                return;
              }
              let err2 = new Error("Unexpected socket close");
              if (this.connection && this.connection._socket && this.connection._socket.upgrading) {
                err2.code = "ETLS";
              }
              callback(err2);
            }, 1e3);
            try {
              timer.unref();
            } catch (E) {
            }
          });
          this.connection.connect(() => {
            if (returned) {
              return;
            }
            if (this.auth && (this.connection.allowsAuth || options.forceAuth)) {
              this.connection.login(this.auth, (err2) => {
                if (returned) {
                  return;
                }
                returned = true;
                if (err2) {
                  this.connection.close();
                  this.emit("error", err2);
                  return callback(err2);
                }
                this._connected = true;
                callback(null, true);
              });
            } else {
              returned = true;
              this._connected = true;
              return callback(null, true);
            }
          });
        });
      }
      /**
         * Sends an e-mail to be sent using the selected settings
         *
         * @param {Object} mail Mail object
         * @param {Function} callback Callback function
         */
      send(mail, callback) {
        if (!this._connected) {
          return this.connect((err) => {
            if (err) {
              return callback(err);
            }
            return this.send(mail, callback);
          });
        }
        let envelope = mail.message.getEnvelope();
        let messageId = mail.message.messageId();
        let recipients = [].concat(envelope.to || []);
        if (recipients.length > 3) {
          recipients.push("...and " + recipients.splice(2).length + " more");
        }
        this.logger.info({
          tnx: "send",
          messageId,
          cid: this.id
        }, "Sending message %s using #%s to <%s>", messageId, this.id, recipients.join(", "));
        if (mail.data.dsn) {
          envelope.dsn = mail.data.dsn;
        }
        this.connection.send(envelope, mail.message.createReadStream(), (err, info) => {
          this.messages++;
          if (err) {
            this.connection.close();
            this.emit("error", err);
            return callback(err);
          }
          info.envelope = {
            from: envelope.from,
            to: envelope.to
          };
          info.messageId = messageId;
          setImmediate(() => {
            let err2;
            if (this.messages >= this.options.maxMessages) {
              err2 = new Error("Resource exhausted");
              err2.code = "EMAXLIMIT";
              this.connection.close();
              this.emit("error", err2);
            } else {
              this.pool._checkRateLimit(() => {
                this.available = true;
                this.emit("available");
              });
            }
          });
          callback(null, info);
        });
      }
      /**
         * Closes the connection
         */
      close() {
        this._connected = false;
        if (this.auth && this.auth.oauth2) {
          this.auth.oauth2.removeAllListeners();
        }
        if (this.connection) {
          this.connection.close();
        }
        this.emit("close");
      }
    };
    module.exports = PoolResource;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/well-known/services.json
var require_services = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/well-known/services.json"(exports, module) {
    module.exports = {
      "1und1": {
        host: "smtp.1und1.de",
        port: 465,
        secure: true,
        authMethod: "LOGIN"
      },
      Aliyun: {
        domains: ["aliyun.com"],
        host: "smtp.aliyun.com",
        port: 465,
        secure: true
      },
      AOL: {
        domains: ["aol.com"],
        host: "smtp.aol.com",
        port: 587
      },
      Bluewin: {
        host: "smtpauths.bluewin.ch",
        domains: ["bluewin.ch"],
        port: 465
      },
      DebugMail: {
        host: "debugmail.io",
        port: 25
      },
      DynectEmail: {
        aliases: ["Dynect"],
        host: "smtp.dynect.net",
        port: 25
      },
      Ethereal: {
        aliases: ["ethereal.email"],
        host: "smtp.ethereal.email",
        port: 587
      },
      FastMail: {
        domains: ["fastmail.fm"],
        host: "smtp.fastmail.com",
        port: 465,
        secure: true
      },
      "Forward Email": {
        aliases: ["FE", "ForwardEmail"],
        domains: ["forwardemail.net"],
        host: "smtp.forwardemail.net",
        port: 465,
        secure: true
      },
      GandiMail: {
        aliases: ["Gandi", "Gandi Mail"],
        host: "mail.gandi.net",
        port: 587
      },
      Gmail: {
        aliases: ["Google Mail"],
        domains: ["gmail.com", "googlemail.com"],
        host: "smtp.gmail.com",
        port: 465,
        secure: true
      },
      Godaddy: {
        host: "smtpout.secureserver.net",
        port: 25
      },
      GodaddyAsia: {
        host: "smtp.asia.secureserver.net",
        port: 25
      },
      GodaddyEurope: {
        host: "smtp.europe.secureserver.net",
        port: 25
      },
      "hot.ee": {
        host: "mail.hot.ee"
      },
      Hotmail: {
        aliases: ["Outlook", "Outlook.com", "Hotmail.com"],
        domains: ["hotmail.com", "outlook.com"],
        host: "smtp-mail.outlook.com",
        port: 587
      },
      iCloud: {
        aliases: ["Me", "Mac"],
        domains: ["me.com", "mac.com"],
        host: "smtp.mail.me.com",
        port: 587
      },
      Infomaniak: {
        host: "mail.infomaniak.com",
        domains: ["ik.me", "ikmail.com", "etik.com"],
        port: 587
      },
      "mail.ee": {
        host: "smtp.mail.ee"
      },
      "Mail.ru": {
        host: "smtp.mail.ru",
        port: 465,
        secure: true
      },
      "Mailcatch.app": {
        host: "sandbox-smtp.mailcatch.app",
        port: 2525
      },
      Maildev: {
        port: 1025,
        ignoreTLS: true
      },
      Mailgun: {
        host: "smtp.mailgun.org",
        port: 465,
        secure: true
      },
      Mailjet: {
        host: "in.mailjet.com",
        port: 587
      },
      Mailosaur: {
        host: "mailosaur.io",
        port: 25
      },
      Mailtrap: {
        host: "smtp.mailtrap.io",
        port: 2525
      },
      Mandrill: {
        host: "smtp.mandrillapp.com",
        port: 587
      },
      Naver: {
        host: "smtp.naver.com",
        port: 587
      },
      One: {
        host: "send.one.com",
        port: 465,
        secure: true
      },
      OpenMailBox: {
        aliases: ["OMB", "openmailbox.org"],
        host: "smtp.openmailbox.org",
        port: 465,
        secure: true
      },
      Outlook365: {
        host: "smtp.office365.com",
        port: 587,
        secure: false
      },
      OhMySMTP: {
        host: "smtp.ohmysmtp.com",
        port: 587,
        secure: false
      },
      Postmark: {
        aliases: ["PostmarkApp"],
        host: "smtp.postmarkapp.com",
        port: 2525
      },
      "qiye.aliyun": {
        host: "smtp.mxhichina.com",
        port: "465",
        secure: true
      },
      QQ: {
        domains: ["qq.com"],
        host: "smtp.qq.com",
        port: 465,
        secure: true
      },
      QQex: {
        aliases: ["QQ Enterprise"],
        domains: ["exmail.qq.com"],
        host: "smtp.exmail.qq.com",
        port: 465,
        secure: true
      },
      SendCloud: {
        host: "smtp.sendcloud.net",
        port: 2525
      },
      SendGrid: {
        host: "smtp.sendgrid.net",
        port: 587
      },
      SendinBlue: {
        aliases: ["Brevo"],
        host: "smtp-relay.brevo.com",
        port: 587
      },
      SendPulse: {
        host: "smtp-pulse.com",
        port: 465,
        secure: true
      },
      SES: {
        host: "email-smtp.us-east-1.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-US-EAST-1": {
        host: "email-smtp.us-east-1.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-US-WEST-2": {
        host: "email-smtp.us-west-2.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-EU-WEST-1": {
        host: "email-smtp.eu-west-1.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-AP-SOUTH-1": {
        host: "email-smtp.ap-south-1.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-AP-NORTHEAST-1": {
        host: "email-smtp.ap-northeast-1.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-AP-NORTHEAST-2": {
        host: "email-smtp.ap-northeast-2.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-AP-NORTHEAST-3": {
        host: "email-smtp.ap-northeast-3.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-AP-SOUTHEAST-1": {
        host: "email-smtp.ap-southeast-1.amazonaws.com",
        port: 465,
        secure: true
      },
      "SES-AP-SOUTHEAST-2": {
        host: "email-smtp.ap-southeast-2.amazonaws.com",
        port: 465,
        secure: true
      },
      Sparkpost: {
        aliases: ["SparkPost", "SparkPost Mail"],
        domains: ["sparkpost.com"],
        host: "smtp.sparkpostmail.com",
        port: 587,
        secure: false
      },
      Tipimail: {
        host: "smtp.tipimail.com",
        port: 587
      },
      Yahoo: {
        domains: ["yahoo.com"],
        host: "smtp.mail.yahoo.com",
        port: 465,
        secure: true
      },
      Yandex: {
        domains: ["yandex.ru"],
        host: "smtp.yandex.ru",
        port: 465,
        secure: true
      },
      Zoho: {
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        authMethod: "LOGIN"
      },
      "126": {
        host: "smtp.126.com",
        port: 465,
        secure: true
      },
      "163": {
        host: "smtp.163.com",
        port: 465,
        secure: true
      }
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/well-known/index.js
var require_well_known = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/well-known/index.js"(exports, module) {
    "use strict";
    var services = require_services();
    var normalized = {};
    Object.keys(services).forEach((key) => {
      let service = services[key];
      normalized[normalizeKey(key)] = normalizeService(service);
      [].concat(service.aliases || []).forEach((alias) => {
        normalized[normalizeKey(alias)] = normalizeService(service);
      });
      [].concat(service.domains || []).forEach((domain) => {
        normalized[normalizeKey(domain)] = normalizeService(service);
      });
    });
    function normalizeKey(key) {
      return key.replace(/[^a-zA-Z0-9.-]/g, "").toLowerCase();
    }
    function normalizeService(service) {
      let filter = [
        "domains",
        "aliases"
      ];
      let response = {};
      Object.keys(service).forEach((key) => {
        if (filter.indexOf(key) < 0) {
          response[key] = service[key];
        }
      });
      return response;
    }
    module.exports = function(key) {
      key = normalizeKey(key.split("@").pop());
      return normalized[key] || false;
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-pool/index.js
var require_smtp_pool = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-pool/index.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events");
    var PoolResource = require_pool_resource();
    var SMTPConnection = require_smtp_connection();
    var wellKnown = require_well_known();
    var shared = require_shared();
    var packageData = require_package();
    var SMTPPool = class extends EventEmitter {
      constructor(options) {
        super();
        options = options || {};
        if (typeof options === "string") {
          options = {
            url: options
          };
        }
        let urlData;
        let service = options.service;
        if (typeof options.getSocket === "function") {
          this.getSocket = options.getSocket;
        }
        if (options.url) {
          urlData = shared.parseConnectionUrl(options.url);
          service = service || urlData.service;
        }
        this.options = shared.assign(
          false,
          options,
          urlData,
          service && wellKnown(service)
          // wellknown options
        );
        this.options.maxConnections = this.options.maxConnections || 5;
        this.options.maxMessages = this.options.maxMessages || 100;
        this.logger = shared.getLogger(this.options, {
          component: this.options.component || "smtp-pool"
        });
        let connection = new SMTPConnection(this.options);
        this.name = "SMTP (pool)";
        this.version = packageData.version + "[client:" + connection.version + "]";
        this._rateLimit = {
          counter: 0,
          timeout: null,
          waiting: [],
          checkpoint: false,
          delta: Number(this.options.rateDelta) || 1e3,
          limit: Number(this.options.rateLimit) || 0
        };
        this._closed = false;
        this._queue = [];
        this._connections = [];
        this._connectionCounter = 0;
        this.idling = true;
        setImmediate(() => {
          if (this.idling) {
            this.emit("idle");
          }
        });
      }
      /**
         * Placeholder function for creating proxy sockets. This method immediatelly returns
         * without a socket
         *
         * @param {Object} options Connection options
         * @param {Function} callback Callback function to run with the socket keys
         */
      getSocket(options, callback) {
        return setImmediate(() => callback(null, false));
      }
      /**
         * Queues an e-mail to be sent using the selected settings
         *
         * @param {Object} mail Mail object
         * @param {Function} callback Callback function
         */
      send(mail, callback) {
        if (this._closed) {
          return false;
        }
        this._queue.push({
          mail,
          requeueAttempts: 0,
          callback
        });
        if (this.idling && this._queue.length >= this.options.maxConnections) {
          this.idling = false;
        }
        setImmediate(() => this._processMessages());
        return true;
      }
      /**
         * Closes all connections in the pool. If there is a message being sent, the connection
         * is closed later
         */
      close() {
        let connection;
        let len = this._connections.length;
        this._closed = true;
        clearTimeout(this._rateLimit.timeout);
        if (!len && !this._queue.length) {
          return;
        }
        for (let i = len - 1; i >= 0; i--) {
          if (this._connections[i] && this._connections[i].available) {
            connection = this._connections[i];
            connection.close();
            this.logger.info({
              tnx: "connection",
              cid: connection.id,
              action: "removed"
            }, "Connection #%s removed", connection.id);
          }
        }
        if (len && !this._connections.length) {
          this.logger.debug({
            tnx: "connection"
          }, "All connections removed");
        }
        if (!this._queue.length) {
          return;
        }
        let invokeCallbacks = () => {
          if (!this._queue.length) {
            this.logger.debug({
              tnx: "connection"
            }, "Pending queue entries cleared");
            return;
          }
          let entry = this._queue.shift();
          if (entry && typeof entry.callback === "function") {
            try {
              entry.callback(new Error("Connection pool was closed"));
            } catch (E) {
              this.logger.error({
                err: E,
                tnx: "callback",
                cid: connection.id
              }, "Callback error for #%s: %s", connection.id, E.message);
            }
          }
          setImmediate(invokeCallbacks);
        };
        setImmediate(invokeCallbacks);
      }
      /**
         * Check the queue and available connections. If there is a message to be sent and there is
         * an available connection, then use this connection to send the mail
         */
      _processMessages() {
        let connection;
        let i, len;
        if (this._closed) {
          return;
        }
        if (!this._queue.length) {
          if (!this.idling) {
            this.idling = true;
            this.emit("idle");
          }
          return;
        }
        for (i = 0, len = this._connections.length; i < len; i++) {
          if (this._connections[i].available) {
            connection = this._connections[i];
            break;
          }
        }
        if (!connection && this._connections.length < this.options.maxConnections) {
          connection = this._createConnection();
        }
        if (!connection) {
          this.idling = false;
          return;
        }
        if (!this.idling && this._queue.length < this.options.maxConnections) {
          this.idling = true;
          this.emit("idle");
        }
        let entry = connection.queueEntry = this._queue.shift();
        entry.messageId = (connection.queueEntry.mail.message.getHeader("message-id") || "").replace(/[<>\s]/g, "");
        connection.available = false;
        this.logger.debug({
          tnx: "pool",
          cid: connection.id,
          messageId: entry.messageId,
          action: "assign"
        }, "Assigned message <%s> to #%s (%s)", entry.messageId, connection.id, connection.messages + 1);
        if (this._rateLimit.limit) {
          this._rateLimit.counter++;
          if (!this._rateLimit.checkpoint) {
            this._rateLimit.checkpoint = Date.now();
          }
        }
        connection.send(entry.mail, (err, info) => {
          if (entry === connection.queueEntry) {
            try {
              entry.callback(err, info);
            } catch (E) {
              this.logger.error({
                err: E,
                tnx: "callback",
                cid: connection.id
              }, "Callback error for #%s: %s", connection.id, E.message);
            }
            connection.queueEntry = false;
          }
        });
      }
      /**
         * Creates a new pool resource
         */
      _createConnection() {
        let connection = new PoolResource(this);
        connection.id = ++this._connectionCounter;
        this.logger.info({
          tnx: "pool",
          cid: connection.id,
          action: "conection"
        }, "Created new pool resource #%s", connection.id);
        connection.on("available", () => {
          this.logger.debug({
            tnx: "connection",
            cid: connection.id,
            action: "available"
          }, "Connection #%s became available", connection.id);
          if (this._closed) {
            this.close();
          } else {
            this._processMessages();
          }
        });
        connection.once("error", (err) => {
          if (err.code !== "EMAXLIMIT") {
            this.logger.error({
              err,
              tnx: "pool",
              cid: connection.id
            }, "Pool Error for #%s: %s", connection.id, err.message);
          } else {
            this.logger.debug({
              tnx: "pool",
              cid: connection.id,
              action: "maxlimit"
            }, "Max messages limit exchausted for #%s", connection.id);
          }
          if (connection.queueEntry) {
            try {
              connection.queueEntry.callback(err);
            } catch (E) {
              this.logger.error({
                err: E,
                tnx: "callback",
                cid: connection.id
              }, "Callback error for #%s: %s", connection.id, E.message);
            }
            connection.queueEntry = false;
          }
          this._removeConnection(connection);
          this._continueProcessing();
        });
        connection.once("close", () => {
          this.logger.info({
            tnx: "connection",
            cid: connection.id,
            action: "closed"
          }, "Connection #%s was closed", connection.id);
          this._removeConnection(connection);
          if (connection.queueEntry) {
            setTimeout(() => {
              if (connection.queueEntry) {
                if (this._shouldRequeuOnConnectionClose(connection.queueEntry)) {
                  this._requeueEntryOnConnectionClose(connection);
                } else {
                  this._failDeliveryOnConnectionClose(connection);
                }
              }
              this._continueProcessing();
            }, 50);
          } else {
            this._continueProcessing();
          }
        });
        this._connections.push(connection);
        return connection;
      }
      _shouldRequeuOnConnectionClose(queueEntry) {
        if (this.options.maxRequeues === void 0 || this.options.maxRequeues < 0) {
          return true;
        }
        return queueEntry.requeueAttempts < this.options.maxRequeues;
      }
      _failDeliveryOnConnectionClose(connection) {
        if (connection.queueEntry && connection.queueEntry.callback) {
          try {
            connection.queueEntry.callback(new Error("Reached maximum number of retries after connection was closed"));
          } catch (E) {
            this.logger.error({
              err: E,
              tnx: "callback",
              messageId: connection.queueEntry.messageId,
              cid: connection.id
            }, "Callback error for #%s: %s", connection.id, E.message);
          }
          connection.queueEntry = false;
        }
      }
      _requeueEntryOnConnectionClose(connection) {
        connection.queueEntry.requeueAttempts = connection.queueEntry.requeueAttempts + 1;
        this.logger.debug({
          tnx: "pool",
          cid: connection.id,
          messageId: connection.queueEntry.messageId,
          action: "requeue"
        }, "Re-queued message <%s> for #%s. Attempt: #%s", connection.queueEntry.messageId, connection.id, connection.queueEntry.requeueAttempts);
        this._queue.unshift(connection.queueEntry);
        connection.queueEntry = false;
      }
      /**
         * Continue to process message if the pool hasn't closed
         */
      _continueProcessing() {
        if (this._closed) {
          this.close();
        } else {
          setTimeout(() => this._processMessages(), 100);
        }
      }
      /**
         * Remove resource from pool
         *
         * @param {Object} connection The PoolResource to remove
         */
      _removeConnection(connection) {
        let index = this._connections.indexOf(connection);
        if (index !== -1) {
          this._connections.splice(index, 1);
        }
      }
      /**
         * Checks if connections have hit current rate limit and if so, queues the availability callback
         *
         * @param {Function} callback Callback function to run once rate limiter has been cleared
         */
      _checkRateLimit(callback) {
        if (!this._rateLimit.limit) {
          return callback();
        }
        let now = Date.now();
        if (this._rateLimit.counter < this._rateLimit.limit) {
          return callback();
        }
        this._rateLimit.waiting.push(callback);
        if (this._rateLimit.checkpoint <= now - this._rateLimit.delta) {
          return this._clearRateLimit();
        } else if (!this._rateLimit.timeout) {
          this._rateLimit.timeout = setTimeout(() => this._clearRateLimit(), this._rateLimit.delta - (now - this._rateLimit.checkpoint));
          this._rateLimit.checkpoint = now;
        }
      }
      /**
         * Clears current rate limit limitation and runs paused callback
         */
      _clearRateLimit() {
        clearTimeout(this._rateLimit.timeout);
        this._rateLimit.timeout = null;
        this._rateLimit.counter = 0;
        this._rateLimit.checkpoint = false;
        while (this._rateLimit.waiting.length) {
          let cb = this._rateLimit.waiting.shift();
          setImmediate(cb);
        }
      }
      /**
         * Returns true if there are free slots in the queue
         */
      isIdle() {
        return this.idling;
      }
      /**
         * Verifies SMTP configuration
         *
         * @param {Function} callback Callback function
         */
      verify(callback) {
        let promise;
        if (!callback) {
          promise = new Promise((resolve, reject) => {
            callback = shared.callbackPromise(resolve, reject);
          });
        }
        let auth = new PoolResource(this).auth;
        this.getSocket(this.options, (err, socketOptions) => {
          if (err) {
            return callback(err);
          }
          let options = this.options;
          if (socketOptions && socketOptions.connection) {
            this.logger.info({
              tnx: "proxy",
              remoteAddress: socketOptions.connection.remoteAddress,
              remotePort: socketOptions.connection.remotePort,
              destHost: options.host || "",
              destPort: options.port || "",
              action: "connected"
            }, "Using proxied socket from %s:%s to %s:%s", socketOptions.connection.remoteAddress, socketOptions.connection.remotePort, options.host || "", options.port || "");
            options = shared.assign(false, options);
            Object.keys(socketOptions).forEach((key) => {
              options[key] = socketOptions[key];
            });
          }
          let connection = new SMTPConnection(options);
          let returned = false;
          connection.once("error", (err2) => {
            if (returned) {
              return;
            }
            returned = true;
            connection.close();
            return callback(err2);
          });
          connection.once("end", () => {
            if (returned) {
              return;
            }
            returned = true;
            return callback(new Error("Connection closed"));
          });
          let finalize = () => {
            if (returned) {
              return;
            }
            returned = true;
            connection.quit();
            return callback(null, true);
          };
          connection.connect(() => {
            if (returned) {
              return;
            }
            if (auth && (connection.allowsAuth || options.forceAuth)) {
              connection.login(auth, (err2) => {
                if (returned) {
                  return;
                }
                if (err2) {
                  returned = true;
                  connection.close();
                  return callback(err2);
                }
                finalize();
              });
            } else if (!auth && connection.allowsAuth && options.forceAuth) {
              let err2 = new Error("Authentication info was not provided");
              err2.code = "NoAuth";
              returned = true;
              connection.close();
              return callback(err2);
            } else {
              finalize();
            }
          });
        });
        return promise;
      }
    };
    module.exports = SMTPPool;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-transport/index.js
var require_smtp_transport = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/smtp-transport/index.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events");
    var SMTPConnection = require_smtp_connection();
    var wellKnown = require_well_known();
    var shared = require_shared();
    var XOAuth2 = require_xoauth2();
    var packageData = require_package();
    var SMTPTransport = class extends EventEmitter {
      constructor(options) {
        super();
        options = options || {};
        if (typeof options === "string") {
          options = {
            url: options
          };
        }
        let urlData;
        let service = options.service;
        if (typeof options.getSocket === "function") {
          this.getSocket = options.getSocket;
        }
        if (options.url) {
          urlData = shared.parseConnectionUrl(options.url);
          service = service || urlData.service;
        }
        this.options = shared.assign(
          false,
          options,
          urlData,
          service && wellKnown(service)
          // wellknown options
        );
        this.logger = shared.getLogger(this.options, {
          component: this.options.component || "smtp-transport"
        });
        let connection = new SMTPConnection(this.options);
        this.name = "SMTP";
        this.version = packageData.version + "[client:" + connection.version + "]";
        if (this.options.auth) {
          this.auth = this.getAuth({});
        }
      }
      /**
         * Placeholder function for creating proxy sockets. This method immediatelly returns
         * without a socket
         *
         * @param {Object} options Connection options
         * @param {Function} callback Callback function to run with the socket keys
         */
      getSocket(options, callback) {
        return setImmediate(() => callback(null, false));
      }
      getAuth(authOpts) {
        if (!authOpts) {
          return this.auth;
        }
        let hasAuth = false;
        let authData = {};
        if (this.options.auth && typeof this.options.auth === "object") {
          Object.keys(this.options.auth).forEach((key) => {
            hasAuth = true;
            authData[key] = this.options.auth[key];
          });
        }
        if (authOpts && typeof authOpts === "object") {
          Object.keys(authOpts).forEach((key) => {
            hasAuth = true;
            authData[key] = authOpts[key];
          });
        }
        if (!hasAuth) {
          return false;
        }
        switch ((authData.type || "").toString().toUpperCase()) {
          case "OAUTH2": {
            if (!authData.service && !authData.user) {
              return false;
            }
            let oauth2 = new XOAuth2(authData, this.logger);
            oauth2.provisionCallback = this.mailer && this.mailer.get("oauth2_provision_cb") || oauth2.provisionCallback;
            oauth2.on("token", (token) => this.mailer.emit("token", token));
            oauth2.on("error", (err) => this.emit("error", err));
            return {
              type: "OAUTH2",
              user: authData.user,
              oauth2,
              method: "XOAUTH2"
            };
          }
          default:
            return {
              type: (authData.type || "").toString().toUpperCase() || "LOGIN",
              user: authData.user,
              credentials: {
                user: authData.user || "",
                pass: authData.pass,
                options: authData.options
              },
              method: (authData.method || "").trim().toUpperCase() || this.options.authMethod || false
            };
        }
      }
      /**
         * Sends an e-mail using the selected settings
         *
         * @param {Object} mail Mail object
         * @param {Function} callback Callback function
         */
      send(mail, callback) {
        this.getSocket(this.options, (err, socketOptions) => {
          if (err) {
            return callback(err);
          }
          let returned = false;
          let options = this.options;
          if (socketOptions && socketOptions.connection) {
            this.logger.info({
              tnx: "proxy",
              remoteAddress: socketOptions.connection.remoteAddress,
              remotePort: socketOptions.connection.remotePort,
              destHost: options.host || "",
              destPort: options.port || "",
              action: "connected"
            }, "Using proxied socket from %s:%s to %s:%s", socketOptions.connection.remoteAddress, socketOptions.connection.remotePort, options.host || "", options.port || "");
            options = shared.assign(false, options);
            Object.keys(socketOptions).forEach((key) => {
              options[key] = socketOptions[key];
            });
          }
          let connection = new SMTPConnection(options);
          connection.once("error", (err2) => {
            if (returned) {
              return;
            }
            returned = true;
            connection.close();
            return callback(err2);
          });
          connection.once("end", () => {
            if (returned) {
              return;
            }
            let timer = setTimeout(() => {
              if (returned) {
                return;
              }
              returned = true;
              let err2 = new Error("Unexpected socket close");
              if (connection && connection._socket && connection._socket.upgrading) {
                err2.code = "ETLS";
              }
              callback(err2);
            }, 1e3);
            try {
              timer.unref();
            } catch (E) {
            }
          });
          let sendMessage = () => {
            let envelope = mail.message.getEnvelope();
            let messageId = mail.message.messageId();
            let recipients = [].concat(envelope.to || []);
            if (recipients.length > 3) {
              recipients.push("...and " + recipients.splice(2).length + " more");
            }
            if (mail.data.dsn) {
              envelope.dsn = mail.data.dsn;
            }
            this.logger.info({
              tnx: "send",
              messageId
            }, "Sending message %s to <%s>", messageId, recipients.join(", "));
            connection.send(envelope, mail.message.createReadStream(), (err2, info) => {
              returned = true;
              connection.close();
              if (err2) {
                this.logger.error({
                  err: err2,
                  tnx: "send"
                }, "Send error for %s: %s", messageId, err2.message);
                return callback(err2);
              }
              info.envelope = {
                from: envelope.from,
                to: envelope.to
              };
              info.messageId = messageId;
              try {
                return callback(null, info);
              } catch (E) {
                this.logger.error({
                  err: E,
                  tnx: "callback"
                }, "Callback error for %s: %s", messageId, E.message);
              }
            });
          };
          connection.connect(() => {
            if (returned) {
              return;
            }
            let auth = this.getAuth(mail.data.auth);
            if (auth && (connection.allowsAuth || options.forceAuth)) {
              connection.login(auth, (err2) => {
                if (auth && auth !== this.auth && auth.oauth2) {
                  auth.oauth2.removeAllListeners();
                }
                if (returned) {
                  return;
                }
                if (err2) {
                  returned = true;
                  connection.close();
                  return callback(err2);
                }
                sendMessage();
              });
            } else {
              sendMessage();
            }
          });
        });
      }
      /**
         * Verifies SMTP configuration
         *
         * @param {Function} callback Callback function
         */
      verify(callback) {
        let promise;
        if (!callback) {
          promise = new Promise((resolve, reject) => {
            callback = shared.callbackPromise(resolve, reject);
          });
        }
        this.getSocket(this.options, (err, socketOptions) => {
          if (err) {
            return callback(err);
          }
          let options = this.options;
          if (socketOptions && socketOptions.connection) {
            this.logger.info({
              tnx: "proxy",
              remoteAddress: socketOptions.connection.remoteAddress,
              remotePort: socketOptions.connection.remotePort,
              destHost: options.host || "",
              destPort: options.port || "",
              action: "connected"
            }, "Using proxied socket from %s:%s to %s:%s", socketOptions.connection.remoteAddress, socketOptions.connection.remotePort, options.host || "", options.port || "");
            options = shared.assign(false, options);
            Object.keys(socketOptions).forEach((key) => {
              options[key] = socketOptions[key];
            });
          }
          let connection = new SMTPConnection(options);
          let returned = false;
          connection.once("error", (err2) => {
            if (returned) {
              return;
            }
            returned = true;
            connection.close();
            return callback(err2);
          });
          connection.once("end", () => {
            if (returned) {
              return;
            }
            returned = true;
            return callback(new Error("Connection closed"));
          });
          let finalize = () => {
            if (returned) {
              return;
            }
            returned = true;
            connection.quit();
            return callback(null, true);
          };
          connection.connect(() => {
            if (returned) {
              return;
            }
            let authData = this.getAuth({});
            if (authData && (connection.allowsAuth || options.forceAuth)) {
              connection.login(authData, (err2) => {
                if (returned) {
                  return;
                }
                if (err2) {
                  returned = true;
                  connection.close();
                  return callback(err2);
                }
                finalize();
              });
            } else if (!authData && connection.allowsAuth && options.forceAuth) {
              let err2 = new Error("Authentication info was not provided");
              err2.code = "NoAuth";
              returned = true;
              connection.close();
              return callback(err2);
            } else {
              finalize();
            }
          });
        });
        return promise;
      }
      /**
         * Releases resources
         */
      close() {
        if (this.auth && this.auth.oauth2) {
          this.auth.oauth2.removeAllListeners();
        }
        this.emit("close");
      }
    };
    module.exports = SMTPTransport;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/sendmail-transport/index.js
var require_sendmail_transport = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/sendmail-transport/index.js"(exports, module) {
    "use strict";
    var spawn = __require("node:child_process").spawn;
    var packageData = require_package();
    var shared = require_shared();
    var SendmailTransport = class {
      constructor(options) {
        options = options || {};
        this._spawn = spawn;
        this.options = options || {};
        this.name = "Sendmail";
        this.version = packageData.version;
        this.path = "sendmail";
        this.args = false;
        this.winbreak = false;
        this.logger = shared.getLogger(this.options, {
          component: this.options.component || "sendmail"
        });
        if (options) {
          if (typeof options === "string") {
            this.path = options;
          } else if (typeof options === "object") {
            if (options.path) {
              this.path = options.path;
            }
            if (Array.isArray(options.args)) {
              this.args = options.args;
            }
            this.winbreak = [
              "win",
              "windows",
              "dos",
              "\r\n"
            ].includes((options.newline || "").toString().toLowerCase());
          }
        }
      }
      /**
         * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
         *
         * @param {Object} emailMessage MailComposer object
         * @param {Function} callback Callback function to run when the sending is completed
         */
      send(mail, done) {
        mail.message.keepBcc = true;
        let envelope = mail.data.envelope || mail.message.getEnvelope();
        let messageId = mail.message.messageId();
        let args;
        let sendmail;
        let returned;
        const hasInvalidAddresses = [].concat(envelope.from || []).concat(envelope.to || []).some((addr) => /^-/.test(addr));
        if (hasInvalidAddresses) {
          return done(new Error("Can not send mail. Invalid envelope addresses."));
        }
        if (this.args) {
          args = [
            "-i"
          ].concat(this.args).concat(envelope.to);
        } else {
          args = [
            "-i"
          ].concat(envelope.from ? [
            "-f",
            envelope.from
          ] : []).concat(envelope.to);
        }
        let callback = (err) => {
          if (returned) {
            return;
          }
          returned = true;
          if (typeof done === "function") {
            if (err) {
              return done(err);
            } else {
              return done(null, {
                envelope: mail.data.envelope || mail.message.getEnvelope(),
                messageId,
                response: "Messages queued for delivery"
              });
            }
          }
        };
        try {
          sendmail = this._spawn(this.path, args);
        } catch (E) {
          this.logger.error({
            err: E,
            tnx: "spawn",
            messageId
          }, "Error occurred while spawning sendmail. %s", E.message);
          return callback(E);
        }
        if (sendmail) {
          sendmail.on("error", (err) => {
            this.logger.error({
              err,
              tnx: "spawn",
              messageId
            }, "Error occurred when sending message %s. %s", messageId, err.message);
            callback(err);
          });
          sendmail.once("exit", (code) => {
            if (!code) {
              return callback();
            }
            let err;
            if (code === 127) {
              err = new Error("Sendmail command not found, process exited with code " + code);
            } else {
              err = new Error("Sendmail exited with code " + code);
            }
            this.logger.error({
              err,
              tnx: "stdin",
              messageId
            }, "Error sending message %s to sendmail. %s", messageId, err.message);
            callback(err);
          });
          sendmail.once("close", callback);
          sendmail.stdin.on("error", (err) => {
            this.logger.error({
              err,
              tnx: "stdin",
              messageId
            }, "Error occurred when piping message %s to sendmail. %s", messageId, err.message);
            callback(err);
          });
          let recipients = [].concat(envelope.to || []);
          if (recipients.length > 3) {
            recipients.push("...and " + recipients.splice(2).length + " more");
          }
          this.logger.info({
            tnx: "send",
            messageId
          }, "Sending message %s to <%s>", messageId, recipients.join(", "));
          let sourceStream = mail.message.createReadStream();
          sourceStream.once("error", (err) => {
            this.logger.error({
              err,
              tnx: "stdin",
              messageId
            }, "Error occurred when generating message %s. %s", messageId, err.message);
            sendmail.kill("SIGINT");
            callback(err);
          });
          sourceStream.pipe(sendmail.stdin);
        } else {
          return callback(new Error("sendmail was not found"));
        }
      }
    };
    module.exports = SendmailTransport;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/stream-transport/index.js
var require_stream_transport = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/stream-transport/index.js"(exports, module) {
    "use strict";
    var packageData = require_package();
    var shared = require_shared();
    var StreamTransport = class {
      constructor(options) {
        options = options || {};
        this.options = options || {};
        this.name = "StreamTransport";
        this.version = packageData.version;
        this.logger = shared.getLogger(this.options, {
          component: this.options.component || "stream-transport"
        });
        this.winbreak = [
          "win",
          "windows",
          "dos",
          "\r\n"
        ].includes((options.newline || "").toString().toLowerCase());
      }
      /**
         * Compiles a mailcomposer message and forwards it to handler that sends it
         *
         * @param {Object} emailMessage MailComposer object
         * @param {Function} callback Callback function to run when the sending is completed
         */
      send(mail, done) {
        mail.message.keepBcc = true;
        let envelope = mail.data.envelope || mail.message.getEnvelope();
        let messageId = mail.message.messageId();
        let recipients = [].concat(envelope.to || []);
        if (recipients.length > 3) {
          recipients.push("...and " + recipients.splice(2).length + " more");
        }
        this.logger.info({
          tnx: "send",
          messageId
        }, "Sending message %s to <%s> using %s line breaks", messageId, recipients.join(", "), this.winbreak ? "<CR><LF>" : "<LF>");
        setImmediate(() => {
          let stream;
          try {
            stream = mail.message.createReadStream();
          } catch (E) {
            this.logger.error({
              err: E,
              tnx: "send",
              messageId
            }, "Creating send stream failed for %s. %s", messageId, E.message);
            return done(E);
          }
          if (!this.options.buffer) {
            stream.once("error", (err) => {
              this.logger.error({
                err,
                tnx: "send",
                messageId
              }, "Failed creating message for %s. %s", messageId, err.message);
            });
            return done(null, {
              envelope: mail.data.envelope || mail.message.getEnvelope(),
              messageId,
              message: stream
            });
          }
          let chunks = [];
          let chunklen = 0;
          stream.on("readable", () => {
            let chunk;
            while ((chunk = stream.read()) !== null) {
              chunks.push(chunk);
              chunklen += chunk.length;
            }
          });
          stream.once("error", (err) => {
            this.logger.error({
              err,
              tnx: "send",
              messageId
            }, "Failed creating message for %s. %s", messageId, err.message);
            return done(err);
          });
          stream.on("end", () => done(null, {
            envelope: mail.data.envelope || mail.message.getEnvelope(),
            messageId,
            message: Buffer.concat(chunks, chunklen)
          }));
        });
      }
    };
    module.exports = StreamTransport;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/json-transport/index.js
var require_json_transport = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/json-transport/index.js"(exports, module) {
    "use strict";
    var packageData = require_package();
    var shared = require_shared();
    var JSONTransport = class {
      constructor(options) {
        options = options || {};
        this.options = options || {};
        this.name = "JSONTransport";
        this.version = packageData.version;
        this.logger = shared.getLogger(this.options, {
          component: this.options.component || "json-transport"
        });
      }
      /**
         * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
         *
         * @param {Object} emailMessage MailComposer object
         * @param {Function} callback Callback function to run when the sending is completed
         */
      send(mail, done) {
        mail.message.keepBcc = true;
        let envelope = mail.data.envelope || mail.message.getEnvelope();
        let messageId = mail.message.messageId();
        let recipients = [].concat(envelope.to || []);
        if (recipients.length > 3) {
          recipients.push("...and " + recipients.splice(2).length + " more");
        }
        this.logger.info({
          tnx: "send",
          messageId
        }, "Composing JSON structure of %s to <%s>", messageId, recipients.join(", "));
        setImmediate(() => {
          mail.normalize((err, data) => {
            if (err) {
              this.logger.error({
                err,
                tnx: "send",
                messageId
              }, "Failed building JSON structure for %s. %s", messageId, err.message);
              return done(err);
            }
            delete data.envelope;
            delete data.normalizedHeaders;
            return done(null, {
              envelope,
              messageId,
              message: this.options.skipEncoding ? data : JSON.stringify(data)
            });
          });
        });
      }
    };
    module.exports = JSONTransport;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/ses-transport/index.js
var require_ses_transport = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/ses-transport/index.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events");
    var packageData = require_package();
    var shared = require_shared();
    var LeWindows = require_le_windows();
    var SESTransport = class extends EventEmitter {
      constructor(options) {
        super();
        options = options || {};
        this.options = options || {};
        this.ses = this.options.SES;
        this.name = "SESTransport";
        this.version = packageData.version;
        this.logger = shared.getLogger(this.options, {
          component: this.options.component || "ses-transport"
        });
        this.maxConnections = Number(this.options.maxConnections) || Infinity;
        this.connections = 0;
        this.sendingRate = Number(this.options.sendingRate) || Infinity;
        this.sendingRateTTL = null;
        this.rateInterval = 1e3;
        this.rateMessages = [];
        this.pending = [];
        this.idling = true;
        setImmediate(() => {
          if (this.idling) {
            this.emit("idle");
          }
        });
      }
      /**
         * Schedules a sending of a message
         *
         * @param {Object} emailMessage MailComposer object
         * @param {Function} callback Callback function to run when the sending is completed
         */
      send(mail, callback) {
        if (this.connections >= this.maxConnections) {
          this.idling = false;
          return this.pending.push({
            mail,
            callback
          });
        }
        if (!this._checkSendingRate()) {
          this.idling = false;
          return this.pending.push({
            mail,
            callback
          });
        }
        this._send(mail, (...args) => {
          setImmediate(() => callback(...args));
          this._sent();
        });
      }
      _checkRatedQueue() {
        if (this.connections >= this.maxConnections || !this._checkSendingRate()) {
          return;
        }
        if (!this.pending.length) {
          if (!this.idling) {
            this.idling = true;
            this.emit("idle");
          }
          return;
        }
        let next = this.pending.shift();
        this._send(next.mail, (...args) => {
          setImmediate(() => next.callback(...args));
          this._sent();
        });
      }
      _checkSendingRate() {
        clearTimeout(this.sendingRateTTL);
        let now = Date.now();
        let oldest = false;
        for (let i = this.rateMessages.length - 1; i >= 0; i--) {
          if (this.rateMessages[i].ts >= now - this.rateInterval && (!oldest || this.rateMessages[i].ts < oldest)) {
            oldest = this.rateMessages[i].ts;
          }
          if (this.rateMessages[i].ts < now - this.rateInterval && !this.rateMessages[i].pending) {
            this.rateMessages.splice(i, 1);
          }
        }
        if (this.rateMessages.length < this.sendingRate) {
          return true;
        }
        let delay = Math.max(oldest + 1001, now + 20);
        this.sendingRateTTL = setTimeout(() => this._checkRatedQueue(), now - delay);
        try {
          this.sendingRateTTL.unref();
        } catch (E) {
        }
        return false;
      }
      _sent() {
        this.connections--;
        this._checkRatedQueue();
      }
      /**
         * Returns true if there are free slots in the queue
         */
      isIdle() {
        return this.idling;
      }
      /**
         * Compiles a mailcomposer message and forwards it to SES
         *
         * @param {Object} emailMessage MailComposer object
         * @param {Function} callback Callback function to run when the sending is completed
         */
      _send(mail, callback) {
        let statObject = {
          ts: Date.now(),
          pending: true
        };
        this.connections++;
        this.rateMessages.push(statObject);
        let envelope = mail.data.envelope || mail.message.getEnvelope();
        let messageId = mail.message.messageId();
        let recipients = [].concat(envelope.to || []);
        if (recipients.length > 3) {
          recipients.push("...and " + recipients.splice(2).length + " more");
        }
        this.logger.info({
          tnx: "send",
          messageId
        }, "Sending message %s to <%s>", messageId, recipients.join(", "));
        let getRawMessage = (next) => {
          if (!mail.data._dkim) {
            mail.data._dkim = {};
          }
          if (mail.data._dkim.skipFields && typeof mail.data._dkim.skipFields === "string") {
            mail.data._dkim.skipFields += ":date:message-id";
          } else {
            mail.data._dkim.skipFields = "date:message-id";
          }
          let sourceStream = mail.message.createReadStream();
          let stream = sourceStream.pipe(new LeWindows());
          let chunks = [];
          let chunklen = 0;
          stream.on("readable", () => {
            let chunk;
            while ((chunk = stream.read()) !== null) {
              chunks.push(chunk);
              chunklen += chunk.length;
            }
          });
          sourceStream.once("error", (err) => stream.emit("error", err));
          stream.once("error", (err) => {
            next(err);
          });
          stream.once("end", () => next(null, Buffer.concat(chunks, chunklen)));
        };
        setImmediate(() => getRawMessage((err, raw) => {
          if (err) {
            this.logger.error({
              err,
              tnx: "send",
              messageId
            }, "Failed creating message for %s. %s", messageId, err.message);
            statObject.pending = false;
            return callback(err);
          }
          let sesMessage = {
            RawMessage: {
              // required
              Data: raw
              // required
            },
            Source: envelope.from,
            Destinations: envelope.to
          };
          Object.keys(mail.data.ses || {}).forEach((key) => {
            sesMessage[key] = mail.data.ses[key];
          });
          let ses = (this.ses.aws ? this.ses.ses : this.ses) || {};
          let aws = this.ses.aws || {};
          let getRegion = (cb) => {
            if (ses.config && typeof ses.config.region === "function") {
              return ses.config.region().then((region) => cb(null, region)).catch((err2) => cb(err2));
            }
            return cb(null, ses.config && ses.config.region || "us-east-1");
          };
          getRegion((err2, region) => {
            if (err2 || !region) {
              region = "us-east-1";
            }
            let sendPromise;
            if (typeof ses.send === "function" && aws.SendRawEmailCommand) {
              sendPromise = ses.send(new aws.SendRawEmailCommand(sesMessage));
            } else {
              sendPromise = ses.sendRawEmail(sesMessage).promise();
            }
            sendPromise.then((data) => {
              if (region === "us-east-1") {
                region = "email";
              }
              statObject.pending = false;
              callback(null, {
                envelope: {
                  from: envelope.from,
                  to: envelope.to
                },
                messageId: "<" + data.MessageId + (!/@/.test(data.MessageId) ? "@" + region + ".amazonses.com" : "") + ">",
                response: data.MessageId,
                raw
              });
            }).catch((err3) => {
              this.logger.error({
                err: err3,
                tnx: "send"
              }, "Send error for %s: %s", messageId, err3.message);
              statObject.pending = false;
              callback(err3);
            });
          });
        }));
      }
      /**
         * Verifies SES configuration
         *
         * @param {Function} callback Callback function
         */
      verify(callback) {
        let promise;
        let ses = (this.ses.aws ? this.ses.ses : this.ses) || {};
        let aws = this.ses.aws || {};
        const sesMessage = {
          RawMessage: {
            // required
            Data: "From: invalid@invalid\r\nTo: invalid@invalid\r\n Subject: Invalid\r\n\r\nInvalid"
          },
          Source: "invalid@invalid",
          Destinations: [
            "invalid@invalid"
          ]
        };
        if (!callback) {
          promise = new Promise((resolve, reject) => {
            callback = shared.callbackPromise(resolve, reject);
          });
        }
        const cb = (err) => {
          if (err && (err.code || err.Code) !== "InvalidParameterValue") {
            return callback(err);
          }
          return callback(null, true);
        };
        if (typeof ses.send === "function" && aws.SendRawEmailCommand) {
          sesMessage.RawMessage.Data = Buffer.from(sesMessage.RawMessage.Data);
          ses.send(new aws.SendRawEmailCommand(sesMessage), cb);
        } else {
          ses.sendRawEmail(sesMessage, cb);
        }
        return promise;
      }
    };
    module.exports = SESTransport;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/nodemailer.js
var require_nodemailer = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/nodemailer/6.9.13/lib/nodemailer.js"(exports, module) {
    "use strict";
    var Mailer = require_mailer();
    var shared = require_shared();
    var SMTPPool = require_smtp_pool();
    var SMTPTransport = require_smtp_transport();
    var SendmailTransport = require_sendmail_transport();
    var StreamTransport = require_stream_transport();
    var JSONTransport = require_json_transport();
    var SESTransport = require_ses_transport();
    var nmfetch = require_fetch();
    var packageData = require_package();
    var ETHEREAL_API = (process.env.ETHEREAL_API || "https://api.nodemailer.com").replace(/\/+$/, "");
    var ETHEREAL_WEB = (process.env.ETHEREAL_WEB || "https://ethereal.email").replace(/\/+$/, "");
    var ETHEREAL_CACHE = [
      "true",
      "yes",
      "y",
      "1"
    ].includes((process.env.ETHEREAL_CACHE || "yes").toString().trim().toLowerCase());
    var testAccount = false;
    module.exports.createTransport = function(transporter, defaults) {
      let urlConfig;
      let options;
      let mailer;
      if (
        // provided transporter is a configuration object, not transporter plugin
        typeof transporter === "object" && typeof transporter.send !== "function" || // provided transporter looks like a connection url
        typeof transporter === "string" && /^(smtps?|direct):/i.test(transporter)
      ) {
        if (urlConfig = typeof transporter === "string" ? transporter : transporter.url) {
          options = shared.parseConnectionUrl(urlConfig);
        } else {
          options = transporter;
        }
        if (options.pool) {
          transporter = new SMTPPool(options);
        } else if (options.sendmail) {
          transporter = new SendmailTransport(options);
        } else if (options.streamTransport) {
          transporter = new StreamTransport(options);
        } else if (options.jsonTransport) {
          transporter = new JSONTransport(options);
        } else if (options.SES) {
          transporter = new SESTransport(options);
        } else {
          transporter = new SMTPTransport(options);
        }
      }
      mailer = new Mailer(transporter, options, defaults);
      return mailer;
    };
    module.exports.createTestAccount = function(apiUrl, callback) {
      let promise;
      if (!callback && typeof apiUrl === "function") {
        callback = apiUrl;
        apiUrl = false;
      }
      if (!callback) {
        promise = new Promise((resolve, reject) => {
          callback = shared.callbackPromise(resolve, reject);
        });
      }
      if (ETHEREAL_CACHE && testAccount) {
        setImmediate(() => callback(null, testAccount));
        return promise;
      }
      apiUrl = apiUrl || ETHEREAL_API;
      let chunks = [];
      let chunklen = 0;
      let req = nmfetch(apiUrl + "/user", {
        contentType: "application/json",
        method: "POST",
        body: Buffer.from(JSON.stringify({
          requestor: packageData.name,
          version: packageData.version
        }))
      });
      req.on("readable", () => {
        let chunk;
        while ((chunk = req.read()) !== null) {
          chunks.push(chunk);
          chunklen += chunk.length;
        }
      });
      req.once("error", (err) => callback(err));
      req.once("end", () => {
        let res = Buffer.concat(chunks, chunklen);
        let data;
        let err;
        try {
          data = JSON.parse(res.toString());
        } catch (E) {
          err = E;
        }
        if (err) {
          return callback(err);
        }
        if (data.status !== "success" || data.error) {
          return callback(new Error(data.error || "Request failed"));
        }
        delete data.status;
        testAccount = data;
        callback(null, testAccount);
      });
      return promise;
    };
    module.exports.getTestMessageUrl = function(info) {
      if (!info || !info.response) {
        return false;
      }
      let infoProps = /* @__PURE__ */ new Map();
      info.response.replace(/\[([^\]]+)\]$/, (m, props) => {
        props.replace(/\b([A-Z0-9]+)=([^\s]+)/g, (m2, key, value) => {
          infoProps.set(key, value);
        });
      });
      if (infoProps.has("STATUS") && infoProps.has("MSGID")) {
        return (testAccount.web || ETHEREAL_WEB) + "/message/" + infoProps.get("MSGID");
      }
      return false;
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/postgres-array/2.0.0/index.js
var require__ = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/postgres-array/2.0.0/index.js"(exports) {
    "use strict";
    exports.parse = function(source, transform) {
      return new ArrayParser(source, transform).parse();
    };
    var ArrayParser = class _ArrayParser {
      constructor(source, transform) {
        this.source = source;
        this.transform = transform || identity;
        this.position = 0;
        this.entries = [];
        this.recorded = [];
        this.dimension = 0;
      }
      isEof() {
        return this.position >= this.source.length;
      }
      nextCharacter() {
        var character = this.source[this.position++];
        if (character === "\\") {
          return {
            value: this.source[this.position++],
            escaped: true
          };
        }
        return {
          value: character,
          escaped: false
        };
      }
      record(character) {
        this.recorded.push(character);
      }
      newEntry(includeEmpty) {
        var entry;
        if (this.recorded.length > 0 || includeEmpty) {
          entry = this.recorded.join("");
          if (entry === "NULL" && !includeEmpty) {
            entry = null;
          }
          if (entry !== null) entry = this.transform(entry);
          this.entries.push(entry);
          this.recorded = [];
        }
      }
      consumeDimensions() {
        if (this.source[0] === "[") {
          while (!this.isEof()) {
            var char = this.nextCharacter();
            if (char.value === "=") break;
          }
        }
      }
      parse(nested) {
        var character, parser, quote;
        this.consumeDimensions();
        while (!this.isEof()) {
          character = this.nextCharacter();
          if (character.value === "{" && !quote) {
            this.dimension++;
            if (this.dimension > 1) {
              parser = new _ArrayParser(this.source.substr(this.position - 1), this.transform);
              this.entries.push(parser.parse(true));
              this.position += parser.position - 2;
            }
          } else if (character.value === "}" && !quote) {
            this.dimension--;
            if (!this.dimension) {
              this.newEntry();
              if (nested) return this.entries;
            }
          } else if (character.value === '"' && !character.escaped) {
            if (quote) this.newEntry(true);
            quote = !quote;
          } else if (character.value === "," && !quote) {
            this.newEntry();
          } else {
            this.record(character.value);
          }
        }
        if (this.dimension !== 0) {
          throw new Error("array dimension not balanced");
        }
        return this.entries;
      }
    };
    function identity(value) {
      return value;
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/lib/arrayParser.js
var require_arrayParser = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/lib/arrayParser.js"(exports, module) {
    var array = require__();
    module.exports = {
      create: function(source, transform) {
        return {
          parse: function() {
            return array.parse(source, transform);
          }
        };
      }
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/postgres-date/1.0.7/index.js
var require__2 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/postgres-date/1.0.7/index.js"(exports, module) {
    "use strict";
    var DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/;
    var DATE = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/;
    var TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/;
    var INFINITY = /^-?infinity$/;
    module.exports = function parseDate(isoDate) {
      if (INFINITY.test(isoDate)) {
        return Number(isoDate.replace("i", "I"));
      }
      var matches = DATE_TIME.exec(isoDate);
      if (!matches) {
        return getDate(isoDate) || null;
      }
      var isBC = !!matches[8];
      var year = parseInt(matches[1], 10);
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var hour = parseInt(matches[4], 10);
      var minute = parseInt(matches[5], 10);
      var second = parseInt(matches[6], 10);
      var ms = matches[7];
      ms = ms ? 1e3 * parseFloat(ms) : 0;
      var date;
      var offset = timeZoneOffset(isoDate);
      if (offset != null) {
        date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
        if (is0To99(year)) {
          date.setUTCFullYear(year);
        }
        if (offset !== 0) {
          date.setTime(date.getTime() - offset);
        }
      } else {
        date = new Date(year, month, day, hour, minute, second, ms);
        if (is0To99(year)) {
          date.setFullYear(year);
        }
      }
      return date;
    };
    function getDate(isoDate) {
      var matches = DATE.exec(isoDate);
      if (!matches) {
        return;
      }
      var year = parseInt(matches[1], 10);
      var isBC = !!matches[4];
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var date = new Date(year, month, day);
      if (is0To99(year)) {
        date.setFullYear(year);
      }
      return date;
    }
    function timeZoneOffset(isoDate) {
      if (isoDate.endsWith("+00")) {
        return 0;
      }
      var zone = TIME_ZONE.exec(isoDate.split(" ")[1]);
      if (!zone) return;
      var type = zone[1];
      if (type === "Z") {
        return 0;
      }
      var sign = type === "-" ? -1 : 1;
      var offset = parseInt(zone[2], 10) * 3600 + parseInt(zone[3] || 0, 10) * 60 + parseInt(zone[4] || 0, 10);
      return offset * sign * 1e3;
    }
    function bcYearToNegativeYear(year) {
      return -(year - 1);
    }
    function is0To99(num) {
      return num >= 0 && num < 100;
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/xtend/4.0.2/mutable.js
var require_mutable = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/xtend/4.0.2/mutable.js"(exports, module) {
    module.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/postgres-interval/1.2.0/index.js
var require__3 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/postgres-interval/1.2.0/index.js"(exports, module) {
    "use strict";
    var extend = require_mutable();
    module.exports = PostgresInterval;
    function PostgresInterval(raw) {
      if (!(this instanceof PostgresInterval)) {
        return new PostgresInterval(raw);
      }
      extend(this, parse(raw));
    }
    var properties = [
      "seconds",
      "minutes",
      "hours",
      "days",
      "months",
      "years"
    ];
    PostgresInterval.prototype.toPostgres = function() {
      var filtered = properties.filter(this.hasOwnProperty, this);
      if (this.milliseconds && filtered.indexOf("seconds") < 0) {
        filtered.push("seconds");
      }
      if (filtered.length === 0) return "0";
      return filtered.map(function(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/\.?0+$/, "");
        }
        return value + " " + property;
      }, this).join(" ");
    };
    var propertiesISOEquivalent = {
      years: "Y",
      months: "M",
      days: "D",
      hours: "H",
      minutes: "M",
      seconds: "S"
    };
    var dateProperties = [
      "years",
      "months",
      "days"
    ];
    var timeProperties = [
      "hours",
      "minutes",
      "seconds"
    ];
    PostgresInterval.prototype.toISOString = PostgresInterval.prototype.toISO = function() {
      var datePart = dateProperties.map(buildProperty, this).join("");
      var timePart = timeProperties.map(buildProperty, this).join("");
      return "P" + datePart + "T" + timePart;
      function buildProperty(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/0+$/, "");
        }
        return value + propertiesISOEquivalent[property];
      }
    };
    var NUMBER = "([+-]?\\d+)";
    var YEAR = NUMBER + "\\s+years?";
    var MONTH = NUMBER + "\\s+mons?";
    var DAY = NUMBER + "\\s+days?";
    var TIME = "([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?";
    var INTERVAL = new RegExp([
      YEAR,
      MONTH,
      DAY,
      TIME
    ].map(function(regexString) {
      return "(" + regexString + ")?";
    }).join("\\s*"));
    var positions = {
      years: 2,
      months: 4,
      days: 6,
      hours: 9,
      minutes: 10,
      seconds: 11,
      milliseconds: 12
    };
    var negatives = [
      "hours",
      "minutes",
      "seconds",
      "milliseconds"
    ];
    function parseMilliseconds(fraction) {
      var microseconds = fraction + "000000".slice(fraction.length);
      return parseInt(microseconds, 10) / 1e3;
    }
    function parse(interval) {
      if (!interval) return {};
      var matches = INTERVAL.exec(interval);
      var isNegative = matches[8] === "-";
      return Object.keys(positions).reduce(function(parsed, property) {
        var position = positions[property];
        var value = matches[position];
        if (!value) return parsed;
        value = property === "milliseconds" ? parseMilliseconds(value) : parseInt(value, 10);
        if (!value) return parsed;
        if (isNegative && ~negatives.indexOf(property)) {
          value *= -1;
        }
        parsed[property] = value;
        return parsed;
      }, {});
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/postgres-bytea/1.0.1/index.js
var require__4 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/postgres-bytea/1.0.1/index.js"(exports, module) {
    "use strict";
    var bufferFrom = Buffer.from || Buffer;
    module.exports = function parseBytea(input) {
      if (/^\\x/.test(input)) {
        return bufferFrom(input.substr(2), "hex");
      }
      var output = "";
      var i = 0;
      while (i < input.length) {
        if (input[i] !== "\\") {
          output += input[i];
          ++i;
        } else {
          if (/[0-7]{3}/.test(input.substr(i + 1, 3))) {
            output += String.fromCharCode(parseInt(input.substr(i + 1, 3), 8));
            i += 4;
          } else {
            var backslashes = 1;
            while (i + backslashes < input.length && input[i + backslashes] === "\\") {
              backslashes++;
            }
            for (var k = 0; k < Math.floor(backslashes / 2); ++k) {
              output += "\\";
            }
            i += Math.floor(backslashes / 2) * 2;
          }
        }
      }
      return bufferFrom(output, "binary");
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/lib/textParsers.js
var require_textParsers = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/lib/textParsers.js"(exports, module) {
    var array = require__();
    var arrayParser = require_arrayParser();
    var parseDate = require__2();
    var parseInterval = require__3();
    var parseByteA = require__4();
    function allowNull(fn) {
      return function nullAllowed(value) {
        if (value === null) return value;
        return fn(value);
      };
    }
    function parseBool(value) {
      if (value === null) return value;
      return value === "TRUE" || value === "t" || value === "true" || value === "y" || value === "yes" || value === "on" || value === "1";
    }
    function parseBoolArray(value) {
      if (!value) return null;
      return array.parse(value, parseBool);
    }
    function parseBaseTenInt(string) {
      return parseInt(string, 10);
    }
    function parseIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(parseBaseTenInt));
    }
    function parseBigIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(function(entry) {
        return parseBigInteger(entry).trim();
      }));
    }
    var parsePointArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parsePoint(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseFloatArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseFloat(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseStringArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value);
      return p.parse();
    };
    var parseDateArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseDate(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseIntervalArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseInterval(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseByteAArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(parseByteA));
    };
    var parseInteger = function(value) {
      return parseInt(value, 10);
    };
    var parseBigInteger = function(value) {
      var valStr = String(value);
      if (/^\d+$/.test(valStr)) {
        return valStr;
      }
      return value;
    };
    var parseJsonArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(JSON.parse));
    };
    var parsePoint = function(value) {
      if (value[0] !== "(") {
        return null;
      }
      value = value.substring(1, value.length - 1).split(",");
      return {
        x: parseFloat(value[0]),
        y: parseFloat(value[1])
      };
    };
    var parseCircle = function(value) {
      if (value[0] !== "<" && value[1] !== "(") {
        return null;
      }
      var point = "(";
      var radius = "";
      var pointParsed = false;
      for (var i = 2; i < value.length - 1; i++) {
        if (!pointParsed) {
          point += value[i];
        }
        if (value[i] === ")") {
          pointParsed = true;
          continue;
        } else if (!pointParsed) {
          continue;
        }
        if (value[i] === ",") {
          continue;
        }
        radius += value[i];
      }
      var result = parsePoint(point);
      result.radius = parseFloat(radius);
      return result;
    };
    var init = function(register) {
      register(20, parseBigInteger);
      register(21, parseInteger);
      register(23, parseInteger);
      register(26, parseInteger);
      register(700, parseFloat);
      register(701, parseFloat);
      register(16, parseBool);
      register(1082, parseDate);
      register(1114, parseDate);
      register(1184, parseDate);
      register(600, parsePoint);
      register(651, parseStringArray);
      register(718, parseCircle);
      register(1e3, parseBoolArray);
      register(1001, parseByteAArray);
      register(1005, parseIntegerArray);
      register(1007, parseIntegerArray);
      register(1028, parseIntegerArray);
      register(1016, parseBigIntegerArray);
      register(1017, parsePointArray);
      register(1021, parseFloatArray);
      register(1022, parseFloatArray);
      register(1231, parseFloatArray);
      register(1014, parseStringArray);
      register(1015, parseStringArray);
      register(1008, parseStringArray);
      register(1009, parseStringArray);
      register(1040, parseStringArray);
      register(1041, parseStringArray);
      register(1115, parseDateArray);
      register(1182, parseDateArray);
      register(1185, parseDateArray);
      register(1186, parseInterval);
      register(1187, parseIntervalArray);
      register(17, parseByteA);
      register(114, JSON.parse.bind(JSON));
      register(3802, JSON.parse.bind(JSON));
      register(199, parseJsonArray);
      register(3807, parseJsonArray);
      register(3907, parseStringArray);
      register(2951, parseStringArray);
      register(791, parseStringArray);
      register(1183, parseStringArray);
      register(1270, parseStringArray);
    };
    module.exports = {
      init
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-int8/1.0.1/index.js
var require__5 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-int8/1.0.1/index.js"(exports, module) {
    "use strict";
    var BASE = 1e6;
    function readInt8(buffer) {
      var high = buffer.readInt32BE(0);
      var low = buffer.readUInt32BE(4);
      var sign = "";
      if (high < 0) {
        high = ~high + (low === 0);
        low = ~low + 1 >>> 0;
        sign = "-";
      }
      var result = "";
      var carry;
      var t;
      var digits;
      var pad;
      var l;
      var i;
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        t = 4294967296 * carry + low;
        digits = "" + t % BASE;
        return sign + digits + result;
      }
    }
    module.exports = readInt8;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/lib/binaryParsers.js
var require_binaryParsers = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/lib/binaryParsers.js"(exports, module) {
    var parseInt64 = require__5();
    var parseBits = function(data, bits, offset, invert, callback) {
      offset = offset || 0;
      invert = invert || false;
      callback = callback || function(lastValue, newValue, bits2) {
        return lastValue * Math.pow(2, bits2) + newValue;
      };
      var offsetBytes = offset >> 3;
      var inv = function(value) {
        if (invert) {
          return ~value & 255;
        }
        return value;
      };
      var mask = 255;
      var firstBits = 8 - offset % 8;
      if (bits < firstBits) {
        mask = 255 << 8 - bits & 255;
        firstBits = bits;
      }
      if (offset) {
        mask = mask >> offset % 8;
      }
      var result = 0;
      if (offset % 8 + bits >= 8) {
        result = callback(0, inv(data[offsetBytes]) & mask, firstBits);
      }
      var bytes = bits + offset >> 3;
      for (var i = offsetBytes + 1; i < bytes; i++) {
        result = callback(result, inv(data[i]), 8);
      }
      var lastBits = (bits + offset) % 8;
      if (lastBits > 0) {
        result = callback(result, inv(data[bytes]) >> 8 - lastBits, lastBits);
      }
      return result;
    };
    var parseFloatFromBits = function(data, precisionBits, exponentBits) {
      var bias = Math.pow(2, exponentBits - 1) - 1;
      var sign = parseBits(data, 1);
      var exponent = parseBits(data, exponentBits, 1);
      if (exponent === 0) {
        return 0;
      }
      var precisionBitsCounter = 1;
      var parsePrecisionBits = function(lastValue, newValue, bits) {
        if (lastValue === 0) {
          lastValue = 1;
        }
        for (var i = 1; i <= bits; i++) {
          precisionBitsCounter /= 2;
          if ((newValue & 1 << bits - i) > 0) {
            lastValue += precisionBitsCounter;
          }
        }
        return lastValue;
      };
      var mantissa = parseBits(data, precisionBits, exponentBits + 1, false, parsePrecisionBits);
      if (exponent == Math.pow(2, exponentBits + 1) - 1) {
        if (mantissa === 0) {
          return sign === 0 ? Infinity : -Infinity;
        }
        return NaN;
      }
      return (sign === 0 ? 1 : -1) * Math.pow(2, exponent - bias) * mantissa;
    };
    var parseInt16 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 15, 1, true) + 1);
      }
      return parseBits(value, 15, 1);
    };
    var parseInt32 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 31, 1, true) + 1);
      }
      return parseBits(value, 31, 1);
    };
    var parseFloat32 = function(value) {
      return parseFloatFromBits(value, 23, 8);
    };
    var parseFloat64 = function(value) {
      return parseFloatFromBits(value, 52, 11);
    };
    var parseNumeric = function(value) {
      var sign = parseBits(value, 16, 32);
      if (sign == 49152) {
        return NaN;
      }
      var weight = Math.pow(1e4, parseBits(value, 16, 16));
      var result = 0;
      var digits = [];
      var ndigits = parseBits(value, 16);
      for (var i = 0; i < ndigits; i++) {
        result += parseBits(value, 16, 64 + 16 * i) * weight;
        weight /= 1e4;
      }
      var scale = Math.pow(10, parseBits(value, 16, 48));
      return (sign === 0 ? 1 : -1) * Math.round(result * scale) / scale;
    };
    var parseDate = function(isUTC, value) {
      var sign = parseBits(value, 1);
      var rawValue = parseBits(value, 63, 1);
      var result = new Date((sign === 0 ? 1 : -1) * rawValue / 1e3 + 9466848e5);
      if (!isUTC) {
        result.setTime(result.getTime() + result.getTimezoneOffset() * 6e4);
      }
      result.usec = rawValue % 1e3;
      result.getMicroSeconds = function() {
        return this.usec;
      };
      result.setMicroSeconds = function(value2) {
        this.usec = value2;
      };
      result.getUTCMicroSeconds = function() {
        return this.usec;
      };
      return result;
    };
    var parseArray = function(value) {
      var dim = parseBits(value, 32);
      var flags = parseBits(value, 32, 32);
      var elementType = parseBits(value, 32, 64);
      var offset = 96;
      var dims = [];
      for (var i = 0; i < dim; i++) {
        dims[i] = parseBits(value, 32, offset);
        offset += 32;
        offset += 32;
      }
      var parseElement = function(elementType2) {
        var length = parseBits(value, 32, offset);
        offset += 32;
        if (length == 4294967295) {
          return null;
        }
        var result;
        if (elementType2 == 23 || elementType2 == 20) {
          result = parseBits(value, length * 8, offset);
          offset += length * 8;
          return result;
        } else if (elementType2 == 25) {
          result = value.toString(this.encoding, offset >> 3, (offset += length << 3) >> 3);
          return result;
        } else {
          console.log("ERROR: ElementType not implemented: " + elementType2);
        }
      };
      var parse = function(dimension, elementType2) {
        var array = [];
        var i2;
        if (dimension.length > 1) {
          var count = dimension.shift();
          for (i2 = 0; i2 < count; i2++) {
            array[i2] = parse(dimension, elementType2);
          }
          dimension.unshift(count);
        } else {
          for (i2 = 0; i2 < dimension[0]; i2++) {
            array[i2] = parseElement(elementType2);
          }
        }
        return array;
      };
      return parse(dims, elementType);
    };
    var parseText = function(value) {
      return value.toString("utf8");
    };
    var parseBool = function(value) {
      if (value === null) return null;
      return parseBits(value, 8) > 0;
    };
    var init = function(register) {
      register(20, parseInt64);
      register(21, parseInt16);
      register(23, parseInt32);
      register(26, parseInt32);
      register(1700, parseNumeric);
      register(700, parseFloat32);
      register(701, parseFloat64);
      register(16, parseBool);
      register(1114, parseDate.bind(null, false));
      register(1184, parseDate.bind(null, true));
      register(1e3, parseArray);
      register(1007, parseArray);
      register(1016, parseArray);
      register(1008, parseArray);
      register(1009, parseArray);
      register(25, parseText);
    };
    module.exports = {
      init
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/lib/builtins.js
var require_builtins = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/lib/builtins.js"(exports, module) {
    module.exports = {
      BOOL: 16,
      BYTEA: 17,
      CHAR: 18,
      INT8: 20,
      INT2: 21,
      INT4: 23,
      REGPROC: 24,
      TEXT: 25,
      OID: 26,
      TID: 27,
      XID: 28,
      CID: 29,
      JSON: 114,
      XML: 142,
      PG_NODE_TREE: 194,
      SMGR: 210,
      PATH: 602,
      POLYGON: 604,
      CIDR: 650,
      FLOAT4: 700,
      FLOAT8: 701,
      ABSTIME: 702,
      RELTIME: 703,
      TINTERVAL: 704,
      CIRCLE: 718,
      MACADDR8: 774,
      MONEY: 790,
      MACADDR: 829,
      INET: 869,
      ACLITEM: 1033,
      BPCHAR: 1042,
      VARCHAR: 1043,
      DATE: 1082,
      TIME: 1083,
      TIMESTAMP: 1114,
      TIMESTAMPTZ: 1184,
      INTERVAL: 1186,
      TIMETZ: 1266,
      BIT: 1560,
      VARBIT: 1562,
      NUMERIC: 1700,
      REFCURSOR: 1790,
      REGPROCEDURE: 2202,
      REGOPER: 2203,
      REGOPERATOR: 2204,
      REGCLASS: 2205,
      REGTYPE: 2206,
      UUID: 2950,
      TXID_SNAPSHOT: 2970,
      PG_LSN: 3220,
      PG_NDISTINCT: 3361,
      PG_DEPENDENCIES: 3402,
      TSVECTOR: 3614,
      TSQUERY: 3615,
      GTSVECTOR: 3642,
      REGCONFIG: 3734,
      REGDICTIONARY: 3769,
      JSONB: 3802,
      REGNAMESPACE: 4089,
      REGROLE: 4096
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/index.js
var require__6 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-types/2.2.0/index.js"(exports) {
    var textParsers = require_textParsers();
    var binaryParsers = require_binaryParsers();
    var arrayParser = require_arrayParser();
    var builtinTypes = require_builtins();
    exports.getTypeParser = getTypeParser;
    exports.setTypeParser = setTypeParser;
    exports.arrayParser = arrayParser;
    exports.builtins = builtinTypes;
    var typeParsers = {
      text: {},
      binary: {}
    };
    function noParse(val2) {
      return String(val2);
    }
    function getTypeParser(oid, format) {
      format = format || "text";
      if (!typeParsers[format]) {
        return noParse;
      }
      return typeParsers[format][oid] || noParse;
    }
    function setTypeParser(oid, format, parseFn) {
      if (typeof format == "function") {
        parseFn = format;
        format = "text";
      }
      typeParsers[format][oid] = parseFn;
    }
    textParsers.init(function(oid, converter) {
      typeParsers.text[oid] = converter;
    });
    binaryParsers.init(function(oid, converter) {
      typeParsers.binary[oid] = converter;
    });
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/defaults.js
var require_defaults = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/defaults.js"(exports, module) {
    "use strict";
    module.exports = {
      // database host. defaults to localhost
      host: "localhost",
      // database user's name
      user: process.platform === "win32" ? process.env.USERNAME : process.env.USER,
      // name of database to connect
      database: void 0,
      // database user's password
      password: null,
      // a Postgres connection string to be used instead of setting individual connection items
      // NOTE:  Setting this value will cause it to override any other value (such as database or user) defined
      // in the defaults object.
      connectionString: void 0,
      // database port
      port: 5432,
      // number of rows to return at a time from a prepared statement's
      // portal. 0 will return all rows at once
      rows: 0,
      // binary result mode
      binary: false,
      // Connection pool options - see https://github.com/brianc/node-pg-pool
      // number of connections to use in connection pool
      // 0 will disable connection pooling
      max: 10,
      // max milliseconds a client can go unused before it is removed
      // from the pool and destroyed
      idleTimeoutMillis: 3e4,
      client_encoding: "",
      ssl: false,
      application_name: void 0,
      fallback_application_name: void 0,
      options: void 0,
      parseInputDatesAsUTC: false,
      // max milliseconds any query using this connection will execute for before timing out in error.
      // false=unlimited
      statement_timeout: false,
      // Abort any statement that waits longer than the specified duration in milliseconds while attempting to acquire a lock.
      // false=unlimited
      lock_timeout: false,
      // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds
      // false=unlimited
      idle_in_transaction_session_timeout: false,
      // max milliseconds to wait for query to complete (client side)
      query_timeout: false,
      connect_timeout: 0,
      keepalives: 1,
      keepalives_idle: 0
    };
    var pgTypes = require__6();
    var parseBigInteger = pgTypes.getTypeParser(20, "text");
    var parseBigIntegerArray = pgTypes.getTypeParser(1016, "text");
    module.exports.__defineSetter__("parseInt8", function(val2) {
      pgTypes.setTypeParser(20, "text", val2 ? pgTypes.getTypeParser(23, "text") : parseBigInteger);
      pgTypes.setTypeParser(1016, "text", val2 ? pgTypes.getTypeParser(1007, "text") : parseBigIntegerArray);
    });
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/utils.js
var require_utils = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/utils.js"(exports, module) {
    "use strict";
    var defaults = require_defaults();
    function escapeElement(elementRepresentation) {
      var escaped = elementRepresentation.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return '"' + escaped + '"';
    }
    function arrayString(val2) {
      var result = "{";
      for (var i = 0; i < val2.length; i++) {
        if (i > 0) {
          result = result + ",";
        }
        if (val2[i] === null || typeof val2[i] === "undefined") {
          result = result + "NULL";
        } else if (Array.isArray(val2[i])) {
          result = result + arrayString(val2[i]);
        } else if (ArrayBuffer.isView(val2[i])) {
          var item = val2[i];
          if (!(item instanceof Buffer)) {
            var buf = Buffer.from(item.buffer, item.byteOffset, item.byteLength);
            if (buf.length === item.byteLength) {
              item = buf;
            } else {
              item = buf.slice(item.byteOffset, item.byteOffset + item.byteLength);
            }
          }
          result += "\\\\x" + item.toString("hex");
        } else {
          result += escapeElement(prepareValue(val2[i]));
        }
      }
      result = result + "}";
      return result;
    }
    var prepareValue = function(val2, seen) {
      if (val2 == null) {
        return null;
      }
      if (val2 instanceof Buffer) {
        return val2;
      }
      if (ArrayBuffer.isView(val2)) {
        var buf = Buffer.from(val2.buffer, val2.byteOffset, val2.byteLength);
        if (buf.length === val2.byteLength) {
          return buf;
        }
        return buf.slice(val2.byteOffset, val2.byteOffset + val2.byteLength);
      }
      if (val2 instanceof Date) {
        if (defaults.parseInputDatesAsUTC) {
          return dateToStringUTC(val2);
        } else {
          return dateToString(val2);
        }
      }
      if (Array.isArray(val2)) {
        return arrayString(val2);
      }
      if (typeof val2 === "object") {
        return prepareObject(val2, seen);
      }
      return val2.toString();
    };
    function prepareObject(val2, seen) {
      if (val2 && typeof val2.toPostgres === "function") {
        seen = seen || [];
        if (seen.indexOf(val2) !== -1) {
          throw new Error('circular reference detected while preparing "' + val2 + '" for query');
        }
        seen.push(val2);
        return prepareValue(val2.toPostgres(prepareValue), seen);
      }
      return JSON.stringify(val2);
    }
    function pad(number, digits) {
      number = "" + number;
      while (number.length < digits) {
        number = "0" + number;
      }
      return number;
    }
    function dateToString(date) {
      var offset = -date.getTimezoneOffset();
      var year = date.getFullYear();
      var isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      var ret = pad(year, 4) + "-" + pad(date.getMonth() + 1, 2) + "-" + pad(date.getDate(), 2) + "T" + pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2) + ":" + pad(date.getSeconds(), 2) + "." + pad(date.getMilliseconds(), 3);
      if (offset < 0) {
        ret += "-";
        offset *= -1;
      } else {
        ret += "+";
      }
      ret += pad(Math.floor(offset / 60), 2) + ":" + pad(offset % 60, 2);
      if (isBCYear) ret += " BC";
      return ret;
    }
    function dateToStringUTC(date) {
      var year = date.getUTCFullYear();
      var isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      var ret = pad(year, 4) + "-" + pad(date.getUTCMonth() + 1, 2) + "-" + pad(date.getUTCDate(), 2) + "T" + pad(date.getUTCHours(), 2) + ":" + pad(date.getUTCMinutes(), 2) + ":" + pad(date.getUTCSeconds(), 2) + "." + pad(date.getUTCMilliseconds(), 3);
      ret += "+00:00";
      if (isBCYear) ret += " BC";
      return ret;
    }
    function normalizeQueryConfig(config, values, callback) {
      config = typeof config === "string" ? {
        text: config
      } : config;
      if (values) {
        if (typeof values === "function") {
          config.callback = values;
        } else {
          config.values = values;
        }
      }
      if (callback) {
        config.callback = callback;
      }
      return config;
    }
    var escapeIdentifier = function(str) {
      return '"' + str.replace(/"/g, '""') + '"';
    };
    var escapeLiteral = function(str) {
      var hasBackslash = false;
      var escaped = "'";
      for (var i = 0; i < str.length; i++) {
        var c = str[i];
        if (c === "'") {
          escaped += c + c;
        } else if (c === "\\") {
          escaped += c + c;
          hasBackslash = true;
        } else {
          escaped += c;
        }
      }
      escaped += "'";
      if (hasBackslash === true) {
        escaped = " E" + escaped;
      }
      return escaped;
    };
    module.exports = {
      prepareValue: function prepareValueWrapper(value) {
        return prepareValue(value);
      },
      normalizeQueryConfig,
      escapeIdentifier,
      escapeLiteral
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/crypto/utils-legacy.js
var require_utils_legacy = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/crypto/utils-legacy.js"(exports, module) {
    "use strict";
    var nodeCrypto = __require("node:crypto");
    function md5(string) {
      return nodeCrypto.createHash("md5").update(string, "utf-8").digest("hex");
    }
    function postgresMd5PasswordHash(user, password, salt) {
      var inner = md5(password + user);
      var outer = md5(Buffer.concat([
        Buffer.from(inner),
        salt
      ]));
      return "md5" + outer;
    }
    function sha256(text) {
      return nodeCrypto.createHash("sha256").update(text).digest();
    }
    function hmacSha256(key, msg) {
      return nodeCrypto.createHmac("sha256", key).update(msg).digest();
    }
    async function deriveKey(password, salt, iterations) {
      return nodeCrypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
    }
    module.exports = {
      postgresMd5PasswordHash,
      randomBytes: nodeCrypto.randomBytes,
      deriveKey,
      sha256,
      hmacSha256,
      md5
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/crypto/utils-webcrypto.js
var require_utils_webcrypto = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/crypto/utils-webcrypto.js"(exports, module) {
    var nodeCrypto = __require("node:crypto");
    module.exports = {
      postgresMd5PasswordHash,
      randomBytes,
      deriveKey,
      sha256,
      hmacSha256,
      md5
    };
    var webCrypto = nodeCrypto.webcrypto || globalThis.crypto;
    var subtleCrypto = webCrypto.subtle;
    var textEncoder = new TextEncoder();
    function randomBytes(length) {
      return webCrypto.getRandomValues(Buffer.alloc(length));
    }
    async function md5(string) {
      try {
        return nodeCrypto.createHash("md5").update(string, "utf-8").digest("hex");
      } catch (e) {
        const data = typeof string === "string" ? textEncoder.encode(string) : string;
        const hash = await subtleCrypto.digest("MD5", data);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
    async function postgresMd5PasswordHash(user, password, salt) {
      var inner = await md5(password + user);
      var outer = await md5(Buffer.concat([
        Buffer.from(inner),
        salt
      ]));
      return "md5" + outer;
    }
    async function sha256(text) {
      return await subtleCrypto.digest("SHA-256", text);
    }
    async function hmacSha256(keyBuffer, msg) {
      const key = await subtleCrypto.importKey("raw", keyBuffer, {
        name: "HMAC",
        hash: "SHA-256"
      }, false, [
        "sign"
      ]);
      return await subtleCrypto.sign("HMAC", key, textEncoder.encode(msg));
    }
    async function deriveKey(password, salt, iterations) {
      const key = await subtleCrypto.importKey("raw", textEncoder.encode(password), "PBKDF2", false, [
        "deriveBits"
      ]);
      const params = {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations
      };
      return await subtleCrypto.deriveBits(params, key, 32 * 8, [
        "deriveBits"
      ]);
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/crypto/utils.js
var require_utils2 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/crypto/utils.js"(exports, module) {
    "use strict";
    var useLegacyCrypto = parseInt(process.versions && process.versions.node && process.versions.node.split(".")[0]) < 15;
    if (useLegacyCrypto) {
      module.exports = require_utils_legacy();
    } else {
      module.exports = require_utils_webcrypto();
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/crypto/sasl.js
var require_sasl = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/crypto/sasl.js"(exports, module) {
    "use strict";
    var crypto2 = require_utils2();
    function startSession(mechanisms) {
      if (mechanisms.indexOf("SCRAM-SHA-256") === -1) {
        throw new Error("SASL: Only mechanism SCRAM-SHA-256 is currently supported");
      }
      const clientNonce = crypto2.randomBytes(18).toString("base64");
      return {
        mechanism: "SCRAM-SHA-256",
        clientNonce,
        response: "n,,n=*,r=" + clientNonce,
        message: "SASLInitialResponse"
      };
    }
    async function continueSession(session, password, serverData) {
      if (session.message !== "SASLInitialResponse") {
        throw new Error("SASL: Last message was not SASLInitialResponse");
      }
      if (typeof password !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
      }
      if (password === "") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
      }
      const sv = parseServerFirstMessage(serverData);
      if (!sv.nonce.startsWith(session.clientNonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
      } else if (sv.nonce.length === session.clientNonce.length) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
      }
      var clientFirstMessageBare = "n=*,r=" + session.clientNonce;
      var serverFirstMessage = "r=" + sv.nonce + ",s=" + sv.salt + ",i=" + sv.iteration;
      var clientFinalMessageWithoutProof = "c=biws,r=" + sv.nonce;
      var authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;
      var saltBytes = Buffer.from(sv.salt, "base64");
      var saltedPassword = await crypto2.deriveKey(password, saltBytes, sv.iteration);
      var clientKey = await crypto2.hmacSha256(saltedPassword, "Client Key");
      var storedKey = await crypto2.sha256(clientKey);
      var clientSignature = await crypto2.hmacSha256(storedKey, authMessage);
      var clientProof = xorBuffers(Buffer.from(clientKey), Buffer.from(clientSignature)).toString("base64");
      var serverKey = await crypto2.hmacSha256(saltedPassword, "Server Key");
      var serverSignatureBytes = await crypto2.hmacSha256(serverKey, authMessage);
      session.message = "SASLResponse";
      session.serverSignature = Buffer.from(serverSignatureBytes).toString("base64");
      session.response = clientFinalMessageWithoutProof + ",p=" + clientProof;
    }
    function finalizeSession(session, serverData) {
      if (session.message !== "SASLResponse") {
        throw new Error("SASL: Last message was not SASLResponse");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
      }
      const { serverSignature } = parseServerFinalMessage(serverData);
      if (serverSignature !== session.serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
      }
    }
    function isPrintableChars(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: text must be a string");
      }
      return text.split("").map((_, i) => text.charCodeAt(i)).every((c) => c >= 33 && c <= 43 || c >= 45 && c <= 126);
    }
    function isBase64(text) {
      return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(text);
    }
    function parseAttributePairs(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: attribute pairs text must be a string");
      }
      return new Map(text.split(",").map((attrValue) => {
        if (!/^.=/.test(attrValue)) {
          throw new Error("SASL: Invalid attribute pair entry");
        }
        const name = attrValue[0];
        const value = attrValue.substring(2);
        return [
          name,
          value
        ];
      }));
    }
    function parseServerFirstMessage(data) {
      const attrPairs = parseAttributePairs(data);
      const nonce = attrPairs.get("r");
      if (!nonce) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
      } else if (!isPrintableChars(nonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
      }
      const salt = attrPairs.get("s");
      if (!salt) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
      } else if (!isBase64(salt)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
      }
      const iterationText = attrPairs.get("i");
      if (!iterationText) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
      } else if (!/^[1-9][0-9]*$/.test(iterationText)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
      }
      const iteration = parseInt(iterationText, 10);
      return {
        nonce,
        salt,
        iteration
      };
    }
    function parseServerFinalMessage(serverData) {
      const attrPairs = parseAttributePairs(serverData);
      const serverSignature = attrPairs.get("v");
      if (!serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
      } else if (!isBase64(serverSignature)) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
      }
      return {
        serverSignature
      };
    }
    function xorBuffers(a, b) {
      if (!Buffer.isBuffer(a)) {
        throw new TypeError("first argument must be a Buffer");
      }
      if (!Buffer.isBuffer(b)) {
        throw new TypeError("second argument must be a Buffer");
      }
      if (a.length !== b.length) {
        throw new Error("Buffer lengths must match");
      }
      if (a.length === 0) {
        throw new Error("Buffers cannot be empty");
      }
      return Buffer.from(a.map((_, i) => a[i] ^ b[i]));
    }
    module.exports = {
      startSession,
      continueSession,
      finalizeSession
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/type-overrides.js
var require_type_overrides = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/type-overrides.js"(exports, module) {
    "use strict";
    var types = require__6();
    function TypeOverrides(userTypes) {
      this._types = userTypes || types;
      this.text = {};
      this.binary = {};
    }
    TypeOverrides.prototype.getOverrides = function(format) {
      switch (format) {
        case "text":
          return this.text;
        case "binary":
          return this.binary;
        default:
          return {};
      }
    };
    TypeOverrides.prototype.setTypeParser = function(oid, format, parseFn) {
      if (typeof format === "function") {
        parseFn = format;
        format = "text";
      }
      this.getOverrides(format)[oid] = parseFn;
    };
    TypeOverrides.prototype.getTypeParser = function(oid, format) {
      format = format || "text";
      return this.getOverrides(format)[oid] || this._types.getTypeParser(oid, format);
    };
    module.exports = TypeOverrides;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-connection-string/2.14.1/index.js
var require__7 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-connection-string/2.14.1/index.js"(exports, module) {
    "use strict";
    function parse(str, options = {}) {
      if (str.charAt(0) === "/") {
        const config2 = str.split(" ");
        return {
          host: config2[0],
          database: config2[1]
        };
      }
      const config = /* @__PURE__ */ Object.create(null);
      let result;
      let dummyHost = false;
      if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(str)) {
        str = encodeURI(str).replace(/%25(\d\d)/g, "%$1");
      }
      try {
        try {
          result = new URL(str, "postgres://base");
        } catch (e) {
          result = new URL(str.replace("@/", "@___DUMMY___/"), "postgres://base");
          dummyHost = true;
        }
      } catch (err) {
        err.input && (err.input = "*****REDACTED*****");
        throw err;
      }
      for (const entry of result.searchParams.entries()) {
        config[entry[0]] = entry[1];
      }
      config.user = config.user || decodeURIComponent(result.username);
      config.password = config.password || decodeURIComponent(result.password);
      if (result.protocol == "socket:") {
        config.host = decodeURI(result.pathname);
        config.database = result.searchParams.get("db");
        config.client_encoding = result.searchParams.get("encoding");
        return config;
      }
      const hostname = (dummyHost ? "" : result.hostname).replace(/^\[(.+)\]$/, "$1");
      if (!config.host) {
        config.host = decodeURIComponent(hostname);
      } else if (hostname && /^%2f/i.test(hostname)) {
        result.pathname = hostname + result.pathname;
      }
      if (!config.port) {
        config.port = result.port;
      }
      const pathname = result.pathname.slice(1) || null;
      config.database = pathname ? decodeURI(pathname) : null;
      if (config.ssl === "true" || config.ssl === "1") {
        config.ssl = true;
      }
      if (config.ssl === "0") {
        config.ssl = false;
      }
      if (config.sslcert || config.sslkey || config.sslrootcert || config.sslmode) {
        config.ssl = {};
      }
      if (config.sslnegotiation === "direct" && config.ssl === void 0) {
        config.ssl = true;
      }
      const fs = config.sslcert || config.sslkey || config.sslrootcert ? __require("node:fs") : null;
      if (config.sslcert) {
        config.ssl.cert = fs.readFileSync(config.sslcert).toString();
      }
      if (config.sslkey) {
        config.ssl.key = fs.readFileSync(config.sslkey).toString();
      }
      if (config.sslrootcert) {
        config.ssl.ca = fs.readFileSync(config.sslrootcert).toString();
      }
      if (options.useLibpqCompat && config.uselibpqcompat) {
        throw new Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");
      }
      if (config.uselibpqcompat === "true" || options.useLibpqCompat) {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
          case "require": {
            if (config.sslrootcert) {
              config.ssl.checkServerIdentity = function() {
              };
            } else {
              config.ssl.rejectUnauthorized = false;
            }
            break;
          }
          case "verify-ca": {
            if (!config.ssl.ca) {
              throw new Error("SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security.");
            }
            config.ssl.checkServerIdentity = function() {
            };
            break;
          }
          case "verify-full": {
            break;
          }
        }
      } else {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer":
          case "require":
          case "verify-ca":
          case "verify-full": {
            if (config.sslmode !== "verify-full") {
              deprecatedSslModeWarning(config.sslmode);
            }
            break;
          }
          case "no-verify": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
        }
      }
      return config;
    }
    function toConnectionOptions(sslConfig) {
      const connectionOptions = Object.entries(sslConfig).reduce((c, [key, value]) => {
        if (value !== void 0 && value !== null) {
          c[key] = value;
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return connectionOptions;
    }
    function toClientConfig(config) {
      const poolConfig = Object.entries(config).reduce((c, [key, value]) => {
        if (key === "ssl") {
          const sslConfig = value;
          if (typeof sslConfig === "boolean") {
            c[key] = sslConfig;
          }
          if (typeof sslConfig === "object") {
            c[key] = toConnectionOptions(sslConfig);
          }
        } else if (value !== void 0 && value !== null) {
          if (key === "port") {
            if (value !== "") {
              const v = parseInt(value, 10);
              if (isNaN(v)) {
                throw new Error(`Invalid ${key}: ${value}`);
              }
              c[key] = v;
            }
          } else {
            c[key] = value;
          }
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return poolConfig;
    }
    function parseIntoClientConfig(str) {
      return toClientConfig(parse(str));
    }
    function deprecatedSslModeWarning(sslmode) {
      if (!deprecatedSslModeWarning.warned && typeof process !== "undefined" && process.emitWarning) {
        deprecatedSslModeWarning.warned = true;
        process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${sslmode}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`);
      }
    }
    module.exports = parse;
    parse.parse = parse;
    parse.toClientConfig = toClientConfig;
    parse.parseIntoClientConfig = parseIntoClientConfig;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/connection-parameters.js
var require_connection_parameters = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/connection-parameters.js"(exports, module) {
    "use strict";
    var dns = __require("node:dns");
    var defaults = require_defaults();
    var parse = require__7().parse;
    var val2 = function(key, config, envVar) {
      if (envVar === void 0) {
        envVar = process.env["PG" + key.toUpperCase()];
      } else if (envVar === false) {
      } else {
        envVar = process.env[envVar];
      }
      return config[key] || envVar || defaults[key];
    };
    var readSSLConfigFromEnvironment = function() {
      switch (process.env.PGSSLMODE) {
        case "disable":
          return false;
        case "prefer":
        case "require":
        case "verify-ca":
        case "verify-full":
          return true;
        case "no-verify":
          return {
            rejectUnauthorized: false
          };
      }
      return defaults.ssl;
    };
    var quoteParamValue = function(value) {
      return "'" + ("" + value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
    };
    var add = function(params, config, paramName) {
      var value = config[paramName];
      if (value !== void 0 && value !== null) {
        params.push(paramName + "=" + quoteParamValue(value));
      }
    };
    var ConnectionParameters = class {
      constructor(config) {
        config = typeof config === "string" ? parse(config) : config || {};
        if (config.connectionString) {
          config = Object.assign({}, config, parse(config.connectionString));
        }
        this.user = val2("user", config);
        this.database = val2("database", config);
        if (this.database === void 0) {
          this.database = this.user;
        }
        this.port = parseInt(val2("port", config), 10);
        this.host = val2("host", config);
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: val2("password", config)
        });
        this.binary = val2("binary", config);
        this.options = val2("options", config);
        this.ssl = typeof config.ssl === "undefined" ? readSSLConfigFromEnvironment() : config.ssl;
        if (typeof this.ssl === "string") {
          if (this.ssl === "true") {
            this.ssl = true;
          }
        }
        if (this.ssl === "no-verify") {
          this.ssl = {
            rejectUnauthorized: false
          };
        }
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this.client_encoding = val2("client_encoding", config);
        this.replication = val2("replication", config);
        this.isDomainSocket = !(this.host || "").indexOf("/");
        this.application_name = val2("application_name", config, "PGAPPNAME");
        this.fallback_application_name = val2("fallback_application_name", config, false);
        this.statement_timeout = val2("statement_timeout", config, false);
        this.lock_timeout = val2("lock_timeout", config, false);
        this.idle_in_transaction_session_timeout = val2("idle_in_transaction_session_timeout", config, false);
        this.query_timeout = val2("query_timeout", config, false);
        if (config.connectionTimeoutMillis === void 0) {
          this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0;
        } else {
          this.connect_timeout = Math.floor(config.connectionTimeoutMillis / 1e3);
        }
        if (config.keepAlive === false) {
          this.keepalives = 0;
        } else if (config.keepAlive === true) {
          this.keepalives = 1;
        }
        if (typeof config.keepAliveInitialDelayMillis === "number") {
          this.keepalives_idle = Math.floor(config.keepAliveInitialDelayMillis / 1e3);
        }
      }
      getLibpqConnectionString(cb) {
        var params = [];
        add(params, this, "user");
        add(params, this, "password");
        add(params, this, "port");
        add(params, this, "application_name");
        add(params, this, "fallback_application_name");
        add(params, this, "connect_timeout");
        add(params, this, "options");
        var ssl = typeof this.ssl === "object" ? this.ssl : this.ssl ? {
          sslmode: this.ssl
        } : {};
        add(params, ssl, "sslmode");
        add(params, ssl, "sslca");
        add(params, ssl, "sslkey");
        add(params, ssl, "sslcert");
        add(params, ssl, "sslrootcert");
        if (this.database) {
          params.push("dbname=" + quoteParamValue(this.database));
        }
        if (this.replication) {
          params.push("replication=" + quoteParamValue(this.replication));
        }
        if (this.host) {
          params.push("host=" + quoteParamValue(this.host));
        }
        if (this.isDomainSocket) {
          return cb(null, params.join(" "));
        }
        if (this.client_encoding) {
          params.push("client_encoding=" + quoteParamValue(this.client_encoding));
        }
        dns.lookup(this.host, function(err, address) {
          if (err) return cb(err, null);
          params.push("hostaddr=" + quoteParamValue(address));
          return cb(null, params.join(" "));
        });
      }
    };
    module.exports = ConnectionParameters;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/result.js
var require_result = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/result.js"(exports, module) {
    "use strict";
    var types = require__6();
    var matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
    var Result = class {
      constructor(rowMode, types2) {
        this.command = null;
        this.rowCount = null;
        this.oid = null;
        this.rows = [];
        this.fields = [];
        this._parsers = void 0;
        this._types = types2;
        this.RowCtor = null;
        this.rowAsArray = rowMode === "array";
        if (this.rowAsArray) {
          this.parseRow = this._parseRowAsArray;
        }
        this._prebuiltEmptyResultObject = null;
      }
      // adds a command complete message
      addCommandComplete(msg) {
        var match;
        if (msg.text) {
          match = matchRegexp.exec(msg.text);
        } else {
          match = matchRegexp.exec(msg.command);
        }
        if (match) {
          this.command = match[1];
          if (match[3]) {
            this.oid = parseInt(match[2], 10);
            this.rowCount = parseInt(match[3], 10);
          } else if (match[2]) {
            this.rowCount = parseInt(match[2], 10);
          }
        }
      }
      _parseRowAsArray(rowData) {
        var row = new Array(rowData.length);
        for (var i = 0, len = rowData.length; i < len; i++) {
          var rawValue = rowData[i];
          if (rawValue !== null) {
            row[i] = this._parsers[i](rawValue);
          } else {
            row[i] = null;
          }
        }
        return row;
      }
      parseRow(rowData) {
        var row = {
          ...this._prebuiltEmptyResultObject
        };
        for (var i = 0, len = rowData.length; i < len; i++) {
          var rawValue = rowData[i];
          var field = this.fields[i].name;
          if (rawValue !== null) {
            row[field] = this._parsers[i](rawValue);
          } else {
            row[field] = null;
          }
        }
        return row;
      }
      addRow(row) {
        this.rows.push(row);
      }
      addFields(fieldDescriptions) {
        this.fields = fieldDescriptions;
        if (this.fields.length) {
          this._parsers = new Array(fieldDescriptions.length);
        }
        var row = {};
        for (var i = 0; i < fieldDescriptions.length; i++) {
          var desc = fieldDescriptions[i];
          row[desc.name] = null;
          if (this._types) {
            this._parsers[i] = this._types.getTypeParser(desc.dataTypeID, desc.format || "text");
          } else {
            this._parsers[i] = types.getTypeParser(desc.dataTypeID, desc.format || "text");
          }
        }
        this._prebuiltEmptyResultObject = {
          ...row
        };
      }
    };
    module.exports = Result;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/query.js
var require_query = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/query.js"(exports, module) {
    "use strict";
    var { EventEmitter } = __require("node:events");
    var Result = require_result();
    var utils = require_utils();
    var Query = class extends EventEmitter {
      constructor(config, values, callback) {
        super();
        config = utils.normalizeQueryConfig(config, values, callback);
        this.text = config.text;
        this.values = config.values;
        this.rows = config.rows;
        this.types = config.types;
        this.name = config.name;
        this.queryMode = config.queryMode;
        this.binary = config.binary;
        this.portal = config.portal || "";
        this.callback = config.callback;
        this._rowMode = config.rowMode;
        if (process.domain && config.callback) {
          this.callback = process.domain.bind(config.callback);
        }
        this._result = new Result(this._rowMode, this.types);
        this._results = this._result;
        this._canceledDueToError = false;
      }
      requiresPreparation() {
        if (this.queryMode === "extended") {
          return true;
        }
        if (this.name) {
          return true;
        }
        if (this.rows) {
          return true;
        }
        if (!this.text) {
          return false;
        }
        if (!this.values) {
          return false;
        }
        return this.values.length > 0;
      }
      _checkForMultirow() {
        if (this._result.command) {
          if (!Array.isArray(this._results)) {
            this._results = [
              this._result
            ];
          }
          this._result = new Result(this._rowMode, this._result._types);
          this._results.push(this._result);
        }
      }
      // associates row metadata from the supplied
      // message with this query object
      // metadata used when parsing row results
      handleRowDescription(msg) {
        this._checkForMultirow();
        this._result.addFields(msg.fields);
        this._accumulateRows = this.callback || !this.listeners("row").length;
      }
      handleDataRow(msg) {
        let row;
        if (this._canceledDueToError) {
          return;
        }
        try {
          row = this._result.parseRow(msg.fields);
        } catch (err) {
          this._canceledDueToError = err;
          return;
        }
        this.emit("row", row, this._result);
        if (this._accumulateRows) {
          this._result.addRow(row);
        }
      }
      handleCommandComplete(msg, connection) {
        this._checkForMultirow();
        this._result.addCommandComplete(msg);
        if (this.rows) {
          connection.sync();
        }
      }
      // if a named prepared statement is created with empty query text
      // the backend will send an emptyQuery message but *not* a command complete message
      // since we pipeline sync immediately after execute we don't need to do anything here
      // unless we have rows specified, in which case we did not pipeline the intial sync call
      handleEmptyQuery(connection) {
        if (this.rows) {
          connection.sync();
        }
      }
      handleError(err, connection) {
        if (this._canceledDueToError) {
          err = this._canceledDueToError;
          this._canceledDueToError = false;
        }
        if (this.callback) {
          return this.callback(err);
        }
        this.emit("error", err);
      }
      handleReadyForQuery(con) {
        if (this._canceledDueToError) {
          return this.handleError(this._canceledDueToError, con);
        }
        if (this.callback) {
          try {
            this.callback(null, this._results);
          } catch (err) {
            process.nextTick(() => {
              throw err;
            });
          }
        }
        this.emit("end", this._results);
      }
      submit(connection) {
        if (typeof this.text !== "string" && typeof this.name !== "string") {
          return new Error("A query must have either text or a name. Supplying neither is unsupported.");
        }
        const previous = connection.parsedStatements[this.name];
        if (this.text && previous && this.text !== previous) {
          return new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
        }
        if (this.values && !Array.isArray(this.values)) {
          return new Error("Query values must be an array");
        }
        if (this.requiresPreparation()) {
          this.prepare(connection);
        } else {
          connection.query(this.text);
        }
        return null;
      }
      hasBeenParsed(connection) {
        return this.name && connection.parsedStatements[this.name];
      }
      handlePortalSuspended(connection) {
        this._getRows(connection, this.rows);
      }
      _getRows(connection, rows) {
        connection.execute({
          portal: this.portal,
          rows
        });
        if (!rows) {
          connection.sync();
        } else {
          connection.flush();
        }
      }
      // http://developer.postgresql.org/pgdocs/postgres/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY
      prepare(connection) {
        if (!this.hasBeenParsed(connection)) {
          connection.parse({
            text: this.text,
            name: this.name,
            types: this.types
          });
        }
        try {
          connection.bind({
            portal: this.portal,
            statement: this.name,
            values: this.values,
            binary: this.binary,
            valueMapper: utils.prepareValue
          });
        } catch (err) {
          this.handleError(err, connection);
          return;
        }
        connection.describe({
          type: "P",
          name: this.portal || ""
        });
        this._getRows(connection, this.rows);
      }
      handleCopyInResponse(connection) {
        connection.sendCopyFail("No source stream defined");
      }
      // eslint-disable-next-line no-unused-vars
      handleCopyData(msg, connection) {
      }
    };
    module.exports = Query;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/messages.js
var require_messages = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/messages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.NoticeMessage = exports.DataRowMessage = exports.CommandCompleteMessage = exports.ReadyForQueryMessage = exports.NotificationResponseMessage = exports.BackendKeyDataMessage = exports.AuthenticationMD5Password = exports.ParameterStatusMessage = exports.ParameterDescriptionMessage = exports.RowDescriptionMessage = exports.Field = exports.CopyResponse = exports.CopyDataMessage = exports.DatabaseError = exports.copyDone = exports.emptyQuery = exports.replicationStart = exports.portalSuspended = exports.noData = exports.closeComplete = exports.bindComplete = exports.parseComplete = void 0;
    exports.parseComplete = {
      name: "parseComplete",
      length: 5
    };
    exports.bindComplete = {
      name: "bindComplete",
      length: 5
    };
    exports.closeComplete = {
      name: "closeComplete",
      length: 5
    };
    exports.noData = {
      name: "noData",
      length: 5
    };
    exports.portalSuspended = {
      name: "portalSuspended",
      length: 5
    };
    exports.replicationStart = {
      name: "replicationStart",
      length: 4
    };
    exports.emptyQuery = {
      name: "emptyQuery",
      length: 4
    };
    exports.copyDone = {
      name: "copyDone",
      length: 4
    };
    var DatabaseError = class extends Error {
      constructor(message, length, name) {
        super(message);
        this.length = length;
        this.name = name;
      }
    };
    exports.DatabaseError = DatabaseError;
    var CopyDataMessage = class {
      constructor(length, chunk) {
        this.length = length;
        this.chunk = chunk;
        this.name = "copyData";
      }
    };
    exports.CopyDataMessage = CopyDataMessage;
    var CopyResponse = class {
      constructor(length, name, binary, columnCount) {
        this.length = length;
        this.name = name;
        this.binary = binary;
        this.columnTypes = new Array(columnCount);
      }
    };
    exports.CopyResponse = CopyResponse;
    var Field = class {
      constructor(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, format) {
        this.name = name;
        this.tableID = tableID;
        this.columnID = columnID;
        this.dataTypeID = dataTypeID;
        this.dataTypeSize = dataTypeSize;
        this.dataTypeModifier = dataTypeModifier;
        this.format = format;
      }
    };
    exports.Field = Field;
    var RowDescriptionMessage = class {
      constructor(length, fieldCount) {
        this.length = length;
        this.fieldCount = fieldCount;
        this.name = "rowDescription";
        this.fields = new Array(this.fieldCount);
      }
    };
    exports.RowDescriptionMessage = RowDescriptionMessage;
    var ParameterDescriptionMessage = class {
      constructor(length, parameterCount) {
        this.length = length;
        this.parameterCount = parameterCount;
        this.name = "parameterDescription";
        this.dataTypeIDs = new Array(this.parameterCount);
      }
    };
    exports.ParameterDescriptionMessage = ParameterDescriptionMessage;
    var ParameterStatusMessage = class {
      constructor(length, parameterName, parameterValue) {
        this.length = length;
        this.parameterName = parameterName;
        this.parameterValue = parameterValue;
        this.name = "parameterStatus";
      }
    };
    exports.ParameterStatusMessage = ParameterStatusMessage;
    var AuthenticationMD5Password = class {
      constructor(length, salt) {
        this.length = length;
        this.salt = salt;
        this.name = "authenticationMD5Password";
      }
    };
    exports.AuthenticationMD5Password = AuthenticationMD5Password;
    var BackendKeyDataMessage = class {
      constructor(length, processID, secretKey) {
        this.length = length;
        this.processID = processID;
        this.secretKey = secretKey;
        this.name = "backendKeyData";
      }
    };
    exports.BackendKeyDataMessage = BackendKeyDataMessage;
    var NotificationResponseMessage = class {
      constructor(length, processId, channel, payload) {
        this.length = length;
        this.processId = processId;
        this.channel = channel;
        this.payload = payload;
        this.name = "notification";
      }
    };
    exports.NotificationResponseMessage = NotificationResponseMessage;
    var ReadyForQueryMessage = class {
      constructor(length, status) {
        this.length = length;
        this.status = status;
        this.name = "readyForQuery";
      }
    };
    exports.ReadyForQueryMessage = ReadyForQueryMessage;
    var CommandCompleteMessage = class {
      constructor(length, text) {
        this.length = length;
        this.text = text;
        this.name = "commandComplete";
      }
    };
    exports.CommandCompleteMessage = CommandCompleteMessage;
    var DataRowMessage = class {
      constructor(length, fields) {
        this.length = length;
        this.fields = fields;
        this.name = "dataRow";
        this.fieldCount = fields.length;
      }
    };
    exports.DataRowMessage = DataRowMessage;
    var NoticeMessage = class {
      constructor(length, message) {
        this.length = length;
        this.message = message;
        this.name = "notice";
      }
    };
    exports.NoticeMessage = NoticeMessage;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/buffer-writer.js
var require_buffer_writer = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/buffer-writer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.Writer = void 0;
    var Writer = class {
      constructor(size = 256) {
        this.size = size;
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(size);
      }
      ensure(size) {
        const remaining = this.buffer.length - this.offset;
        if (remaining < size) {
          const oldBuffer = this.buffer;
          const newSize = oldBuffer.length + (oldBuffer.length >> 1) + size;
          this.buffer = Buffer.allocUnsafe(newSize);
          oldBuffer.copy(this.buffer, 0, 0, this.offset);
        }
      }
      addInt32(num) {
        this.ensure(4);
        this.buffer[this.offset++] = num >>> 24 & 255;
        this.buffer[this.offset++] = num >>> 16 & 255;
        this.buffer[this.offset++] = num >>> 8 & 255;
        this.buffer[this.offset++] = num >>> 0 & 255;
        return this;
      }
      addInt16(num) {
        this.ensure(2);
        this.buffer[this.offset++] = num >>> 8 & 255;
        this.buffer[this.offset++] = num >>> 0 & 255;
        return this;
      }
      addCString(string) {
        if (!string) {
          this.ensure(1);
        } else {
          const len = Buffer.byteLength(string);
          this.ensure(len + 1);
          this.buffer.write(string, this.offset, "utf-8");
          this.offset += len;
        }
        this.buffer[this.offset++] = 0;
        return this;
      }
      addString(string = "") {
        const len = Buffer.byteLength(string);
        this.ensure(len);
        this.buffer.write(string, this.offset);
        this.offset += len;
        return this;
      }
      // Write an Int32 byte-length prefix immediately followed by the string's UTF-8
      // bytes. Postgres' Bind wire format prefixes every parameter with its length,
      // and doing it in one method computes Buffer.byteLength ONCE — the previous
      // `addInt32(Buffer.byteLength(s)).addString(s)` pairing scanned the string
      // three times (byteLength for the prefix, byteLength again inside addString,
      // then the encode), which is costly for large text parameters.
      addInt32PrefixedString(string) {
        const len = Buffer.byteLength(string);
        this.ensure(4 + len);
        const buffer = this.buffer;
        let offset = this.offset;
        buffer[offset++] = len >>> 24 & 255;
        buffer[offset++] = len >>> 16 & 255;
        buffer[offset++] = len >>> 8 & 255;
        buffer[offset++] = len >>> 0 & 255;
        buffer.write(string, offset, "utf-8");
        this.offset = offset + len;
        return this;
      }
      add(otherBuffer) {
        this.ensure(otherBuffer.length);
        otherBuffer.copy(this.buffer, this.offset);
        this.offset += otherBuffer.length;
        return this;
      }
      /**
         * Appends an uninitialized block of {@link size} bytes to the buffer and returns its offset.
         */
      reserveUnsafe(size) {
        const offset = this.offset;
        this.ensure(size);
        this.offset += size;
        return offset;
      }
      join(code) {
        if (code) {
          this.buffer[this.headerPosition] = code;
          const length = this.offset - (this.headerPosition + 1);
          this.buffer.writeInt32BE(length, this.headerPosition + 1);
        }
        return this.buffer.slice(code ? 0 : 5, this.offset);
      }
      flush(code) {
        const result = this.join(code);
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(this.size);
        return result;
      }
      clear() {
        this.offset = 5;
        this.headerPosition = 0;
      }
    };
    exports.Writer = Writer;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/serializer.js
var require_serializer = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/serializer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.serialize = void 0;
    var buffer_writer_1 = require_buffer_writer();
    var writer = new buffer_writer_1.Writer();
    var startup = (opts) => {
      writer.addInt16(3).addInt16(0);
      for (const key of Object.keys(opts)) {
        writer.addCString(key).addCString(opts[key]);
      }
      writer.addCString("client_encoding").addCString("UTF8");
      const bodyBuffer = writer.addCString("").flush();
      const length = bodyBuffer.length + 4;
      return new buffer_writer_1.Writer().addInt32(length).add(bodyBuffer).flush();
    };
    var requestSsl = () => {
      const response = Buffer.allocUnsafe(8);
      response.writeInt32BE(8, 0);
      response.writeInt32BE(80877103, 4);
      return response;
    };
    var password = (password2) => {
      return writer.addCString(password2).flush(
        112
        /* code.startup */
      );
    };
    var sendSASLInitialResponseMessage = function(mechanism, initialResponse) {
      writer.addCString(mechanism).addInt32PrefixedString(initialResponse);
      return writer.flush(
        112
        /* code.startup */
      );
    };
    var sendSCRAMClientFinalMessage = function(additionalData) {
      return writer.addString(additionalData).flush(
        112
        /* code.startup */
      );
    };
    var query = (text) => {
      return writer.addCString(text).flush(
        81
        /* code.query */
      );
    };
    var emptyArray = [];
    var parse = (query2) => {
      const name = query2.name || "";
      if (name.length > 63) {
        console.error("Warning! Postgres only supports 63 characters for query names.");
        console.error("You supplied %s (%s)", name, name.length);
        console.error("This can cause conflicts and silent errors executing queries");
      }
      const types = query2.types || emptyArray;
      const len = types.length;
      const buffer = writer.addCString(name).addCString(query2.text).addInt16(len);
      for (let i = 0; i < len; i++) {
        buffer.addInt32(types[i]);
      }
      return writer.flush(
        80
        /* code.parse */
      );
    };
    var writeValues = function(values, valueMapper, formatsOffset) {
      const len = values.length;
      for (let i = 0; i < len; i++) {
        const mappedVal = valueMapper ? valueMapper(values[i], i) : values[i];
        let formatByte = 0;
        if (mappedVal == null) {
          writer.addInt32(-1);
        } else if (mappedVal instanceof Buffer) {
          formatByte = 1;
          writer.addInt32(mappedVal.length);
          writer.add(mappedVal);
        } else {
          writer.addInt32PrefixedString(mappedVal);
        }
        const buf = writer.buffer;
        buf[formatsOffset++] = 0;
        buf[formatsOffset++] = formatByte;
      }
    };
    var bind = (config = {}) => {
      const portal = config.portal || "";
      const statement = config.statement || "";
      const binary = config.binary || false;
      const values = config.values || emptyArray;
      const len = values.length;
      writer.addCString(portal).addCString(statement);
      writer.addInt16(len);
      const formatsOffset = writer.reserveUnsafe(len * 2);
      writer.addInt16(len);
      try {
        writeValues(values, config.valueMapper, formatsOffset);
      } catch (err) {
        writer.clear();
        throw err;
      }
      writer.addInt16(1);
      writer.addInt16(
        binary ? 1 : 0
        /* ParamType.STRING */
      );
      return writer.flush(
        66
        /* code.bind */
      );
    };
    var emptyExecute = Buffer.from([
      69,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      0,
      0
    ]);
    var execute = (config) => {
      if (!config || !config.portal && !config.rows) {
        return emptyExecute;
      }
      const portal = config.portal || "";
      const rows = config.rows || 0;
      const portalLength = Buffer.byteLength(portal);
      const len = 4 + portalLength + 1 + 4;
      const buff = Buffer.allocUnsafe(1 + len);
      buff[0] = 69;
      buff.writeInt32BE(len, 1);
      buff.write(portal, 5, "utf-8");
      buff[portalLength + 5] = 0;
      buff.writeUInt32BE(rows, buff.length - 4);
      return buff;
    };
    var cancel = (processID, secretKey) => {
      const buffer = Buffer.allocUnsafe(16);
      buffer.writeInt32BE(16, 0);
      buffer.writeInt16BE(1234, 4);
      buffer.writeInt16BE(5678, 6);
      buffer.writeInt32BE(processID, 8);
      buffer.writeInt32BE(secretKey, 12);
      return buffer;
    };
    var cstringMessage = (code, string) => {
      const stringLen = Buffer.byteLength(string);
      const len = 4 + stringLen + 1;
      const buffer = Buffer.allocUnsafe(1 + len);
      buffer[0] = code;
      buffer.writeInt32BE(len, 1);
      buffer.write(string, 5, "utf-8");
      buffer[len] = 0;
      return buffer;
    };
    var emptyDescribePortal = writer.addCString("P").flush(
      68
      /* code.describe */
    );
    var emptyDescribeStatement = writer.addCString("S").flush(
      68
      /* code.describe */
    );
    var describe = (msg) => {
      return msg.name ? cstringMessage(68, `${msg.type}${msg.name || ""}`) : msg.type === "P" ? emptyDescribePortal : emptyDescribeStatement;
    };
    var close = (msg) => {
      const text = `${msg.type}${msg.name || ""}`;
      return cstringMessage(67, text);
    };
    var copyData = (chunk) => {
      return writer.add(chunk).flush(
        100
        /* code.copyFromChunk */
      );
    };
    var copyFail = (message) => {
      return cstringMessage(102, message);
    };
    var codeOnlyBuffer = (code) => Buffer.from([
      code,
      0,
      0,
      0,
      4
    ]);
    var flushBuffer = codeOnlyBuffer(
      72
      /* code.flush */
    );
    var syncBuffer = codeOnlyBuffer(
      83
      /* code.sync */
    );
    var endBuffer = codeOnlyBuffer(
      88
      /* code.end */
    );
    var copyDoneBuffer = codeOnlyBuffer(
      99
      /* code.copyDone */
    );
    var serialize = {
      startup,
      password,
      requestSsl,
      sendSASLInitialResponseMessage,
      sendSCRAMClientFinalMessage,
      query,
      parse,
      bind,
      execute,
      describe,
      close,
      flush: () => flushBuffer,
      sync: () => syncBuffer,
      end: () => endBuffer,
      copyData,
      copyDone: () => copyDoneBuffer,
      copyFail,
      cancel
    };
    exports.serialize = serialize;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/buffer-reader.js
var require_buffer_reader = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/buffer-reader.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.BufferReader = void 0;
    var BufferReader = class {
      constructor(offset = 0) {
        this.offset = offset;
        this.buffer = Buffer.allocUnsafe(0);
        this.encoding = "utf-8";
      }
      setBuffer(offset, buffer) {
        this.offset = offset;
        this.buffer = buffer;
      }
      int16() {
        const result = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return result;
      }
      byte() {
        const result = this.buffer[this.offset];
        this.offset++;
        return result;
      }
      int32() {
        const result = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      uint32() {
        const result = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      string(length) {
        const result = this.buffer.toString(this.encoding, this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
      cstring() {
        const start = this.offset;
        let end = start;
        while (this.buffer[end++]) {
        }
        this.offset = end;
        return this.buffer.toString(this.encoding, start, end - 1);
      }
      bytes(length) {
        const result = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
    };
    exports.BufferReader = BufferReader;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/parser.js
var require_parser = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/parser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.Parser = void 0;
    var messages_1 = require_messages();
    var buffer_reader_1 = require_buffer_reader();
    var CODE_LENGTH = 1;
    var LEN_LENGTH = 4;
    var HEADER_LENGTH = CODE_LENGTH + LEN_LENGTH;
    var LATEINIT_LENGTH = -1;
    var emptyBuffer = Buffer.allocUnsafe(0);
    var Parser = class {
      constructor(opts) {
        this.buffer = emptyBuffer;
        this.bufferLength = 0;
        this.bufferOffset = 0;
        this.reader = new buffer_reader_1.BufferReader();
        if ((opts === null || opts === void 0 ? void 0 : opts.mode) === "binary") {
          throw new Error("Binary mode not supported yet");
        }
        this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || "text";
      }
      parse(buffer, callback) {
        this.mergeBuffer(buffer);
        const bufferFullLength = this.bufferOffset + this.bufferLength;
        let offset = this.bufferOffset;
        while (offset + HEADER_LENGTH <= bufferFullLength) {
          const code = this.buffer[offset];
          const length = this.buffer.readUInt32BE(offset + CODE_LENGTH);
          const fullMessageLength = CODE_LENGTH + length;
          if (fullMessageLength + offset <= bufferFullLength) {
            const message = this.handlePacket(offset + HEADER_LENGTH, code, length, this.buffer);
            callback(message);
            offset += fullMessageLength;
          } else {
            break;
          }
        }
        if (offset === bufferFullLength) {
          this.buffer = emptyBuffer;
          this.bufferLength = 0;
          this.bufferOffset = 0;
        } else {
          this.bufferLength = bufferFullLength - offset;
          this.bufferOffset = offset;
        }
      }
      mergeBuffer(buffer) {
        if (this.bufferLength > 0) {
          const newLength = this.bufferLength + buffer.byteLength;
          const newFullLength = newLength + this.bufferOffset;
          if (newFullLength > this.buffer.byteLength) {
            let newBuffer;
            if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) {
              newBuffer = this.buffer;
            } else {
              let newBufferLength = this.buffer.byteLength * 2;
              while (newLength >= newBufferLength) {
                newBufferLength *= 2;
              }
              newBuffer = Buffer.allocUnsafe(newBufferLength);
            }
            this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
            this.buffer = newBuffer;
            this.bufferOffset = 0;
          }
          buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
          this.bufferLength = newLength;
        } else {
          this.buffer = buffer;
          this.bufferOffset = 0;
          this.bufferLength = buffer.byteLength;
        }
      }
      handlePacket(offset, code, length, bytes) {
        const { reader } = this;
        reader.setBuffer(offset, bytes);
        let message;
        switch (code) {
          case 50:
            message = messages_1.bindComplete;
            break;
          case 49:
            message = messages_1.parseComplete;
            break;
          case 51:
            message = messages_1.closeComplete;
            break;
          case 110:
            message = messages_1.noData;
            break;
          case 115:
            message = messages_1.portalSuspended;
            break;
          case 99:
            message = messages_1.copyDone;
            break;
          case 87:
            message = messages_1.replicationStart;
            break;
          case 73:
            message = messages_1.emptyQuery;
            break;
          case 68:
            message = parseDataRowMessage(reader);
            break;
          case 67:
            message = parseCommandCompleteMessage(reader);
            break;
          case 90:
            message = parseReadyForQueryMessage(reader);
            break;
          case 65:
            message = parseNotificationMessage(reader);
            break;
          case 82:
            message = parseAuthenticationResponse(reader, length);
            break;
          case 83:
            message = parseParameterStatusMessage(reader);
            break;
          case 75:
            message = parseBackendKeyData(reader);
            break;
          case 69:
            message = parseErrorMessage(reader, "error");
            break;
          case 78:
            message = parseErrorMessage(reader, "notice");
            break;
          case 84:
            message = parseRowDescriptionMessage(reader);
            break;
          case 116:
            message = parseParameterDescriptionMessage(reader);
            break;
          case 71:
            message = parseCopyInMessage(reader);
            break;
          case 72:
            message = parseCopyOutMessage(reader);
            break;
          case 100:
            message = parseCopyData(reader, length);
            break;
          default:
            return new messages_1.DatabaseError("received invalid response: " + code.toString(16), length, "error");
        }
        reader.setBuffer(0, emptyBuffer);
        message.length = length;
        return message;
      }
    };
    exports.Parser = Parser;
    var parseReadyForQueryMessage = (reader) => {
      const status = reader.string(1);
      return new messages_1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
    };
    var parseCommandCompleteMessage = (reader) => {
      const text = reader.cstring();
      return new messages_1.CommandCompleteMessage(LATEINIT_LENGTH, text);
    };
    var parseCopyData = (reader, length) => {
      const chunk = reader.bytes(length - 4);
      return new messages_1.CopyDataMessage(LATEINIT_LENGTH, chunk);
    };
    var parseCopyInMessage = (reader) => parseCopyMessage(reader, "copyInResponse");
    var parseCopyOutMessage = (reader) => parseCopyMessage(reader, "copyOutResponse");
    var parseCopyMessage = (reader, messageName) => {
      const isBinary = reader.byte() !== 0;
      const columnCount = reader.int16();
      const message = new messages_1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
      for (let i = 0; i < columnCount; i++) {
        message.columnTypes[i] = reader.int16();
      }
      return message;
    };
    var parseNotificationMessage = (reader) => {
      const processId = reader.int32();
      const channel = reader.cstring();
      const payload = reader.cstring();
      return new messages_1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
    };
    var parseRowDescriptionMessage = (reader) => {
      const fieldCount = reader.int16();
      const message = new messages_1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        message.fields[i] = parseField(reader);
      }
      return message;
    };
    var parseField = (reader) => {
      const name = reader.cstring();
      const tableID = reader.uint32();
      const columnID = reader.int16();
      const dataTypeID = reader.uint32();
      const dataTypeSize = reader.int16();
      const dataTypeModifier = reader.int32();
      const mode = reader.int16() === 0 ? "text" : "binary";
      return new messages_1.Field(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
    };
    var parseParameterDescriptionMessage = (reader) => {
      const parameterCount = reader.int16();
      const message = new messages_1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
      for (let i = 0; i < parameterCount; i++) {
        message.dataTypeIDs[i] = reader.uint32();
      }
      return message;
    };
    var parseDataRowMessage = (reader) => {
      const fieldCount = reader.int16();
      const fields = new Array(fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        const len = reader.int32();
        fields[i] = len === -1 ? null : reader.string(len);
      }
      return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
    };
    var parseParameterStatusMessage = (reader) => {
      const name = reader.cstring();
      const value = reader.cstring();
      return new messages_1.ParameterStatusMessage(LATEINIT_LENGTH, name, value);
    };
    var parseBackendKeyData = (reader) => {
      const processID = reader.int32();
      const secretKey = reader.int32();
      return new messages_1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
    };
    var parseAuthenticationResponse = (reader, length) => {
      const code = reader.int32();
      const message = {
        name: "authenticationOk",
        length
      };
      switch (code) {
        case 0:
          break;
        case 3:
          if (message.length === 8) {
            message.name = "authenticationCleartextPassword";
          }
          break;
        case 5:
          if (message.length === 12) {
            message.name = "authenticationMD5Password";
            const salt = reader.bytes(4);
            return new messages_1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
          }
          break;
        case 10:
          {
            message.name = "authenticationSASL";
            message.mechanisms = [];
            let mechanism;
            do {
              mechanism = reader.cstring();
              if (mechanism) {
                message.mechanisms.push(mechanism);
              }
            } while (mechanism);
          }
          break;
        case 11:
          message.name = "authenticationSASLContinue";
          message.data = reader.string(length - 8);
          break;
        case 12:
          message.name = "authenticationSASLFinal";
          message.data = reader.string(length - 8);
          break;
        default:
          throw new Error("Unknown authenticationOk message type " + code);
      }
      return message;
    };
    var parseErrorMessage = (reader, name) => {
      const fields = {};
      let fieldType = reader.string(1);
      while (fieldType !== "\0") {
        fields[fieldType] = reader.cstring();
        fieldType = reader.string(1);
      }
      const messageValue = fields.M;
      const message = name === "notice" ? new messages_1.NoticeMessage(LATEINIT_LENGTH, messageValue) : new messages_1.DatabaseError(messageValue, LATEINIT_LENGTH, name);
      message.severity = fields.S;
      message.code = fields.C;
      message.detail = fields.D;
      message.hint = fields.H;
      message.position = fields.P;
      message.internalPosition = fields.p;
      message.internalQuery = fields.q;
      message.where = fields.W;
      message.schema = fields.s;
      message.table = fields.t;
      message.column = fields.c;
      message.dataType = fields.d;
      message.constraint = fields.n;
      message.file = fields.F;
      message.line = fields.L;
      message.routine = fields.R;
      return message;
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/index.js
var require_dist = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-protocol/1.16.1/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.DatabaseError = exports.serialize = void 0;
    exports.parse = parse;
    var messages_1 = require_messages();
    Object.defineProperty(exports, "DatabaseError", {
      enumerable: true,
      get: function() {
        return messages_1.DatabaseError;
      }
    });
    var serializer_1 = require_serializer();
    Object.defineProperty(exports, "serialize", {
      enumerable: true,
      get: function() {
        return serializer_1.serialize;
      }
    });
    var parser_1 = require_parser();
    function parse(stream, callback) {
      const parser = new parser_1.Parser();
      stream.on("data", (buffer) => parser.parse(buffer, callback));
      return new Promise((resolve) => stream.on("end", () => resolve()));
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-cloudflare/1.4.1/dist/empty.js
var require_empty = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-cloudflare/1.4.1/dist/empty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = {};
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/stream.js
var require_stream = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/stream.js"(exports, module) {
    var { getStream, getSecureStream } = getStreamFuncs();
    module.exports = {
      /**
       * Get a socket stream compatible with the current runtime environment.
       * @returns {Duplex}
       */
      getStream,
      /**
       * Get a TLS secured socket, compatible with the current environment,
       * using the socket and other settings given in `options`.
       * @returns {Duplex}
       */
      getSecureStream
    };
    function getNodejsStreamFuncs() {
      function getStream2(ssl) {
        const net = __require("node:net");
        return new net.Socket();
      }
      function getSecureStream2(options) {
        var tls = __require("node:tls");
        return tls.connect(options);
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function getCloudflareStreamFuncs() {
      function getStream2(ssl) {
        const { CloudflareSocket } = require_empty();
        return new CloudflareSocket(ssl);
      }
      function getSecureStream2(options) {
        options.socket.startTls(options);
        return options.socket;
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function isCloudflareRuntime() {
      if (typeof navigator === "object" && navigator !== null && typeof navigator.userAgent === "string") {
        return navigator.userAgent === "Cloudflare-Workers";
      }
      if (typeof Response === "function") {
        const resp = new Response(null, {
          cf: {
            thing: true
          }
        });
        if (typeof resp.cf === "object" && resp.cf !== null && resp.cf.thing) {
          return true;
        }
      }
      return false;
    }
    function getStreamFuncs() {
      if (isCloudflareRuntime()) {
        return getCloudflareStreamFuncs();
      }
      return getNodejsStreamFuncs();
    }
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/connection.js
var require_connection = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/connection.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events").EventEmitter;
    var { parse, serialize } = require_dist();
    var { getStream, getSecureStream } = require_stream();
    var flushBuffer = serialize.flush();
    var syncBuffer = serialize.sync();
    var endBuffer = serialize.end();
    var Connection = class extends EventEmitter {
      constructor(config) {
        super();
        config = config || {};
        this.stream = config.stream || getStream(config.ssl);
        if (typeof this.stream === "function") {
          this.stream = this.stream(config);
        }
        this._keepAlive = config.keepAlive;
        this._keepAliveInitialDelayMillis = config.keepAliveInitialDelayMillis;
        this.lastBuffer = false;
        this.parsedStatements = {};
        this.ssl = config.ssl || false;
        this._ending = false;
        this._emitMessage = false;
        var self = this;
        this.on("newListener", function(eventName) {
          if (eventName === "message") {
            self._emitMessage = true;
          }
        });
      }
      connect(port, host) {
        var self = this;
        this._connecting = true;
        this.stream.setNoDelay(true);
        this.stream.connect(port, host);
        this.stream.once("connect", function() {
          if (self._keepAlive) {
            self.stream.setKeepAlive(true, self._keepAliveInitialDelayMillis);
          }
          self.emit("connect");
        });
        const reportStreamError = function(error) {
          if (self._ending && (error.code === "ECONNRESET" || error.code === "EPIPE")) {
            return;
          }
          self.emit("error", error);
        };
        this.stream.on("error", reportStreamError);
        this.stream.on("close", function() {
          self.emit("end");
        });
        if (!this.ssl) {
          return this.attachListeners(this.stream);
        }
        this.stream.once("data", function(buffer) {
          var responseCode = buffer.toString("utf8");
          switch (responseCode) {
            case "S":
              break;
            case "N":
              self.stream.end();
              return self.emit("error", new Error("The server does not support SSL connections"));
            default:
              self.stream.end();
              return self.emit("error", new Error("There was an error establishing an SSL connection"));
          }
          const options = {
            socket: self.stream
          };
          if (self.ssl !== true) {
            Object.assign(options, self.ssl);
            if ("key" in self.ssl) {
              options.key = self.ssl.key;
            }
          }
          var net = __require("node:net");
          if (net.isIP && net.isIP(host) === 0) {
            options.servername = host;
          }
          try {
            self.stream = getSecureStream(options);
          } catch (err) {
            return self.emit("error", err);
          }
          self.attachListeners(self.stream);
          self.stream.on("error", reportStreamError);
          self.emit("sslconnect");
        });
      }
      attachListeners(stream) {
        parse(stream, (msg) => {
          var eventName = msg.name === "error" ? "errorMessage" : msg.name;
          if (this._emitMessage) {
            this.emit("message", msg);
          }
          this.emit(eventName, msg);
        });
      }
      requestSsl() {
        this.stream.write(serialize.requestSsl());
      }
      startup(config) {
        this.stream.write(serialize.startup(config));
      }
      cancel(processID, secretKey) {
        this._send(serialize.cancel(processID, secretKey));
      }
      password(password) {
        this._send(serialize.password(password));
      }
      sendSASLInitialResponseMessage(mechanism, initialResponse) {
        this._send(serialize.sendSASLInitialResponseMessage(mechanism, initialResponse));
      }
      sendSCRAMClientFinalMessage(additionalData) {
        this._send(serialize.sendSCRAMClientFinalMessage(additionalData));
      }
      _send(buffer) {
        if (!this.stream.writable) {
          return false;
        }
        return this.stream.write(buffer);
      }
      query(text) {
        this._send(serialize.query(text));
      }
      // send parse message
      parse(query) {
        this._send(serialize.parse(query));
      }
      // send bind message
      bind(config) {
        this._send(serialize.bind(config));
      }
      // send execute message
      execute(config) {
        this._send(serialize.execute(config));
      }
      flush() {
        if (this.stream.writable) {
          this.stream.write(flushBuffer);
        }
      }
      sync() {
        this._ending = true;
        this._send(syncBuffer);
      }
      ref() {
        this.stream.ref();
      }
      unref() {
        this.stream.unref();
      }
      end() {
        this._ending = true;
        if (!this._connecting || !this.stream.writable) {
          this.stream.end();
          return;
        }
        return this.stream.write(endBuffer, () => {
          this.stream.end();
        });
      }
      close(msg) {
        this._send(serialize.close(msg));
      }
      describe(msg) {
        this._send(serialize.describe(msg));
      }
      sendCopyFromChunk(chunk) {
        this._send(serialize.copyData(chunk));
      }
      endCopyFrom() {
        this._send(serialize.copyDone());
      }
      sendCopyFail(msg) {
        this._send(serialize.copyFail(msg));
      }
    };
    module.exports = Connection;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pgpass/1.0.6/lib/helper.js
var require_helper = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pgpass/1.0.6/lib/helper.js"(exports, module) {
    "use strict";
    var path = __require("node:path");
    var Stream = __require("node:stream").Stream;
    var createInterface = __require("node:readline").createInterface;
    var util = __require("node:util");
    var defaultPort = 5432;
    var isWin = process.platform === "win32";
    var warnStream = process.stderr;
    var S_IRWXG = 56;
    var S_IRWXO = 7;
    var S_IFMT = 61440;
    var S_IFREG = 32768;
    function isRegFile(mode) {
      return (mode & S_IFMT) == S_IFREG;
    }
    var fieldNames = [
      "host",
      "port",
      "database",
      "user",
      "password"
    ];
    var nrOfFields = fieldNames.length;
    var passKey = fieldNames[nrOfFields - 1];
    function warn() {
      var isWritable = warnStream instanceof Stream && true === warnStream.writable;
      if (isWritable) {
        var args = Array.prototype.slice.call(arguments).concat("\n");
        warnStream.write(util.format.apply(util, args));
      }
    }
    Object.defineProperty(module.exports, "isWin", {
      get: function() {
        return isWin;
      },
      set: function(val2) {
        isWin = val2;
      }
    });
    module.exports.warnTo = function(stream) {
      var old = warnStream;
      warnStream = stream;
      return old;
    };
    module.exports.getFileName = function(rawEnv) {
      var env = rawEnv || process.env;
      var file = env.PGPASSFILE || (isWin ? path.join(env.APPDATA || "./", "postgresql", "pgpass.conf") : path.join(env.HOME || "./", ".pgpass"));
      return file;
    };
    module.exports.usePgPass = function(stats, fname) {
      if (Object.prototype.hasOwnProperty.call(process.env, "PGPASSWORD")) {
        return false;
      }
      if (isWin) {
        return true;
      }
      fname = fname || "<unkn>";
      if (!isRegFile(stats.mode)) {
        warn('WARNING: password file "%s" is not a plain file', fname);
        return false;
      }
      if (stats.mode & (S_IRWXG | S_IRWXO)) {
        warn('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', fname);
        return false;
      }
      return true;
    };
    var matcher = module.exports.match = function(connInfo, entry) {
      return fieldNames.slice(0, -1).reduce(function(prev, field, idx) {
        if (idx == 1) {
          if (Number(connInfo[field] || defaultPort) === Number(entry[field])) {
            return prev && true;
          }
        }
        return prev && (entry[field] === "*" || entry[field] === connInfo[field]);
      }, true);
    };
    module.exports.getPassword = function(connInfo, stream, cb) {
      var pass;
      var isDone = false;
      var lineStream = createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      function finish(result) {
        isDone = true;
        stream.destroy();
        cb(result);
      }
      function onLine(line) {
        var entry = parseLine(line);
        if (entry && isValidEntry(entry) && matcher(connInfo, entry)) {
          pass = entry[passKey];
          lineStream.close();
        }
      }
      var onEnd = function() {
        if (!isDone) {
          finish(pass);
        }
      };
      var onErr = function(err) {
        if (isDone) {
          return;
        }
        warn("WARNING: error on reading file: %s", err);
        finish(void 0);
      };
      stream.on("error", onErr);
      lineStream.on("line", onLine).on("close", onEnd).on("error", onErr);
    };
    var parseLine = module.exports.parseLine = function(line) {
      if (line.length < 11 || line.match(/^\s+#/)) {
        return null;
      }
      var curChar = "";
      var prevChar = "";
      var fieldIdx = 0;
      var startIdx = 0;
      var endIdx = 0;
      var obj = {};
      var isLastField = false;
      var addToObj = function(idx, i0, i1) {
        var field = line.substring(i0, i1);
        if (!Object.hasOwnProperty.call(process.env, "PGPASS_NO_DEESCAPE")) {
          field = field.replace(/\\([:\\])/g, "$1");
        }
        obj[fieldNames[idx]] = field;
      };
      for (var i = 0; i < line.length - 1; i += 1) {
        curChar = line.charAt(i + 1);
        prevChar = line.charAt(i);
        isLastField = fieldIdx == nrOfFields - 1;
        if (isLastField) {
          addToObj(fieldIdx, startIdx);
          break;
        }
        if (i >= 0 && curChar == ":" && prevChar !== "\\") {
          addToObj(fieldIdx, startIdx, i + 1);
          startIdx = i + 2;
          fieldIdx += 1;
        }
      }
      obj = Object.keys(obj).length === nrOfFields ? obj : null;
      return obj;
    };
    var isValidEntry = module.exports.isValidEntry = function(entry) {
      var rules = {
        // host
        0: function(x) {
          return x.length > 0;
        },
        // port
        1: function(x) {
          if (x === "*") {
            return true;
          }
          x = Number(x);
          return isFinite(x) && x > 0 && x < 9007199254740992 && Math.floor(x) === x;
        },
        // database
        2: function(x) {
          return x.length > 0;
        },
        // username
        3: function(x) {
          return x.length > 0;
        },
        // password
        4: function(x) {
          return x.length > 0;
        }
      };
      for (var idx = 0; idx < fieldNames.length; idx += 1) {
        var rule = rules[idx];
        var value = entry[fieldNames[idx]] || "";
        var res = rule(value);
        if (!res) {
          return false;
        }
      }
      return true;
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pgpass/1.0.6/lib/index.js
var require_lib = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pgpass/1.0.6/lib/index.js"(exports, module) {
    "use strict";
    var path = __require("node:path");
    var fs = __require("node:fs");
    var helper = require_helper();
    module.exports = function(connInfo, cb) {
      var file = helper.getFileName();
      fs.stat(file, function(err, stat) {
        if (err || !helper.usePgPass(stat, file)) {
          return cb(void 0);
        }
        var st = fs.createReadStream(file);
        helper.getPassword(connInfo, st, cb);
      });
    };
    module.exports.warnTo = helper.warnTo;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/client.js
var require_client = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/client.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events").EventEmitter;
    var utils = require_utils();
    var sasl = require_sasl();
    var TypeOverrides = require_type_overrides();
    var ConnectionParameters = require_connection_parameters();
    var Query = require_query();
    var defaults = require_defaults();
    var Connection = require_connection();
    var crypto2 = require_utils2();
    var Client = class extends EventEmitter {
      constructor(config) {
        super();
        this.connectionParameters = new ConnectionParameters(config);
        this.user = this.connectionParameters.user;
        this.database = this.connectionParameters.database;
        this.port = this.connectionParameters.port;
        this.host = this.connectionParameters.host;
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: this.connectionParameters.password
        });
        this.replication = this.connectionParameters.replication;
        var c = config || {};
        this._Promise = c.Promise || global.Promise;
        this._types = new TypeOverrides(c.types);
        this._ending = false;
        this._ended = false;
        this._connecting = false;
        this._connected = false;
        this._connectionError = false;
        this._queryable = true;
        this.connection = c.connection || new Connection({
          stream: c.stream,
          ssl: this.connectionParameters.ssl,
          keepAlive: c.keepAlive || false,
          keepAliveInitialDelayMillis: c.keepAliveInitialDelayMillis || 0,
          encoding: this.connectionParameters.client_encoding || "utf8"
        });
        this.queryQueue = [];
        this.binary = c.binary || defaults.binary;
        this.processID = null;
        this.secretKey = null;
        this.ssl = this.connectionParameters.ssl || false;
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this._connectionTimeoutMillis = c.connectionTimeoutMillis || 0;
      }
      _errorAllQueries(err) {
        const enqueueError = (query) => {
          process.nextTick(() => {
            query.handleError(err, this.connection);
          });
        };
        if (this.activeQuery) {
          enqueueError(this.activeQuery);
          this.activeQuery = null;
        }
        this.queryQueue.forEach(enqueueError);
        this.queryQueue.length = 0;
      }
      _connect(callback) {
        var self = this;
        var con = this.connection;
        this._connectionCallback = callback;
        if (this._connecting || this._connected) {
          const err = new Error("Client has already been connected. You cannot reuse a client.");
          process.nextTick(() => {
            callback(err);
          });
          return;
        }
        this._connecting = true;
        if (this._connectionTimeoutMillis > 0) {
          this.connectionTimeoutHandle = setTimeout(() => {
            con._ending = true;
            con.stream.destroy(new Error("timeout expired"));
          }, this._connectionTimeoutMillis);
        }
        if (this.host && this.host.indexOf("/") === 0) {
          con.connect(this.host + "/.s.PGSQL." + this.port);
        } else {
          con.connect(this.port, this.host);
        }
        con.on("connect", function() {
          if (self.ssl) {
            con.requestSsl();
          } else {
            con.startup(self.getStartupConf());
          }
        });
        con.on("sslconnect", function() {
          con.startup(self.getStartupConf());
        });
        this._attachListeners(con);
        con.once("end", () => {
          const error = this._ending ? new Error("Connection terminated") : new Error("Connection terminated unexpectedly");
          clearTimeout(this.connectionTimeoutHandle);
          this._errorAllQueries(error);
          this._ended = true;
          if (!this._ending) {
            if (this._connecting && !this._connectionError) {
              if (this._connectionCallback) {
                this._connectionCallback(error);
              } else {
                this._handleErrorEvent(error);
              }
            } else if (!this._connectionError) {
              this._handleErrorEvent(error);
            }
          }
          process.nextTick(() => {
            this.emit("end");
          });
        });
      }
      connect(callback) {
        if (callback) {
          this._connect(callback);
          return;
        }
        return new this._Promise((resolve, reject) => {
          this._connect((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }
      _attachListeners(con) {
        con.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this));
        con.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this));
        con.on("authenticationSASL", this._handleAuthSASL.bind(this));
        con.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this));
        con.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this));
        con.on("backendKeyData", this._handleBackendKeyData.bind(this));
        con.on("error", this._handleErrorEvent.bind(this));
        con.on("errorMessage", this._handleErrorMessage.bind(this));
        con.on("readyForQuery", this._handleReadyForQuery.bind(this));
        con.on("notice", this._handleNotice.bind(this));
        con.on("rowDescription", this._handleRowDescription.bind(this));
        con.on("dataRow", this._handleDataRow.bind(this));
        con.on("portalSuspended", this._handlePortalSuspended.bind(this));
        con.on("emptyQuery", this._handleEmptyQuery.bind(this));
        con.on("commandComplete", this._handleCommandComplete.bind(this));
        con.on("parseComplete", this._handleParseComplete.bind(this));
        con.on("copyInResponse", this._handleCopyInResponse.bind(this));
        con.on("copyData", this._handleCopyData.bind(this));
        con.on("notification", this._handleNotification.bind(this));
      }
      // TODO(bmc): deprecate pgpass "built in" integration since this.password can be a function
      // it can be supplied by the user if required - this is a breaking change!
      _checkPgPass(cb) {
        const con = this.connection;
        if (typeof this.password === "function") {
          this._Promise.resolve().then(() => this.password()).then((pass) => {
            if (pass !== void 0) {
              if (typeof pass !== "string") {
                con.emit("error", new TypeError("Password must be a string"));
                return;
              }
              this.connectionParameters.password = this.password = pass;
            } else {
              this.connectionParameters.password = this.password = null;
            }
            cb();
          }).catch((err) => {
            con.emit("error", err);
          });
        } else if (this.password !== null) {
          cb();
        } else {
          try {
            const pgPass = require_lib();
            pgPass(this.connectionParameters, (pass) => {
              if (void 0 !== pass) {
                this.connectionParameters.password = this.password = pass;
              }
              cb();
            });
          } catch (e) {
            this.emit("error", e);
          }
        }
      }
      _handleAuthCleartextPassword(msg) {
        this._checkPgPass(() => {
          this.connection.password(this.password);
        });
      }
      _handleAuthMD5Password(msg) {
        this._checkPgPass(async () => {
          try {
            const hashedPassword = await crypto2.postgresMd5PasswordHash(this.user, this.password, msg.salt);
            this.connection.password(hashedPassword);
          } catch (e) {
            this.emit("error", e);
          }
        });
      }
      _handleAuthSASL(msg) {
        this._checkPgPass(() => {
          try {
            this.saslSession = sasl.startSession(msg.mechanisms);
            this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response);
          } catch (err) {
            this.connection.emit("error", err);
          }
        });
      }
      async _handleAuthSASLContinue(msg) {
        try {
          await sasl.continueSession(this.saslSession, this.password, msg.data);
          this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleAuthSASLFinal(msg) {
        try {
          sasl.finalizeSession(this.saslSession, msg.data);
          this.saslSession = null;
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleBackendKeyData(msg) {
        this.processID = msg.processID;
        this.secretKey = msg.secretKey;
      }
      _handleReadyForQuery(msg) {
        if (this._connecting) {
          this._connecting = false;
          this._connected = true;
          clearTimeout(this.connectionTimeoutHandle);
          if (this._connectionCallback) {
            this._connectionCallback(null, this);
            this._connectionCallback = null;
          }
          this.emit("connect");
        }
        const { activeQuery } = this;
        this.activeQuery = null;
        this.readyForQuery = true;
        if (activeQuery) {
          activeQuery.handleReadyForQuery(this.connection);
        }
        this._pulseQueryQueue();
      }
      // if we receieve an error event or error message
      // during the connection process we handle it here
      _handleErrorWhileConnecting(err) {
        if (this._connectionError) {
          return;
        }
        this._connectionError = true;
        clearTimeout(this.connectionTimeoutHandle);
        if (this._connectionCallback) {
          return this._connectionCallback(err);
        }
        this.emit("error", err);
      }
      // if we're connected and we receive an error event from the connection
      // this means the socket is dead - do a hard abort of all queries and emit
      // the socket error on the client as well
      _handleErrorEvent(err) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(err);
        }
        this._queryable = false;
        this._errorAllQueries(err);
        this.emit("error", err);
      }
      // handle error messages from the postgres backend
      _handleErrorMessage(msg) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(msg);
        }
        const activeQuery = this.activeQuery;
        if (!activeQuery) {
          this._handleErrorEvent(msg);
          return;
        }
        this.activeQuery = null;
        activeQuery.handleError(msg, this.connection);
      }
      _handleRowDescription(msg) {
        this.activeQuery.handleRowDescription(msg);
      }
      _handleDataRow(msg) {
        this.activeQuery.handleDataRow(msg);
      }
      _handlePortalSuspended(msg) {
        this.activeQuery.handlePortalSuspended(this.connection);
      }
      _handleEmptyQuery(msg) {
        this.activeQuery.handleEmptyQuery(this.connection);
      }
      _handleCommandComplete(msg) {
        if (this.activeQuery == null) {
          const error = new Error("Received unexpected commandComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        this.activeQuery.handleCommandComplete(msg, this.connection);
      }
      _handleParseComplete() {
        if (this.activeQuery == null) {
          const error = new Error("Received unexpected parseComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        if (this.activeQuery.name) {
          this.connection.parsedStatements[this.activeQuery.name] = this.activeQuery.text;
        }
      }
      _handleCopyInResponse(msg) {
        this.activeQuery.handleCopyInResponse(this.connection);
      }
      _handleCopyData(msg) {
        this.activeQuery.handleCopyData(msg, this.connection);
      }
      _handleNotification(msg) {
        this.emit("notification", msg);
      }
      _handleNotice(msg) {
        this.emit("notice", msg);
      }
      getStartupConf() {
        var params = this.connectionParameters;
        var data = {
          user: params.user,
          database: params.database
        };
        var appName = params.application_name || params.fallback_application_name;
        if (appName) {
          data.application_name = appName;
        }
        if (params.replication) {
          data.replication = "" + params.replication;
        }
        if (params.statement_timeout) {
          data.statement_timeout = String(parseInt(params.statement_timeout, 10));
        }
        if (params.lock_timeout) {
          data.lock_timeout = String(parseInt(params.lock_timeout, 10));
        }
        if (params.idle_in_transaction_session_timeout) {
          data.idle_in_transaction_session_timeout = String(parseInt(params.idle_in_transaction_session_timeout, 10));
        }
        if (params.options) {
          data.options = params.options;
        }
        return data;
      }
      cancel(client, query) {
        if (client.activeQuery === query) {
          var con = this.connection;
          if (this.host && this.host.indexOf("/") === 0) {
            con.connect(this.host + "/.s.PGSQL." + this.port);
          } else {
            con.connect(this.port, this.host);
          }
          con.on("connect", function() {
            con.cancel(client.processID, client.secretKey);
          });
        } else if (client.queryQueue.indexOf(query) !== -1) {
          client.queryQueue.splice(client.queryQueue.indexOf(query), 1);
        }
      }
      setTypeParser(oid, format, parseFn) {
        return this._types.setTypeParser(oid, format, parseFn);
      }
      getTypeParser(oid, format) {
        return this._types.getTypeParser(oid, format);
      }
      // escapeIdentifier and escapeLiteral moved to utility functions & exported
      // on PG
      // re-exported here for backwards compatibility
      escapeIdentifier(str) {
        return utils.escapeIdentifier(str);
      }
      escapeLiteral(str) {
        return utils.escapeLiteral(str);
      }
      _pulseQueryQueue() {
        if (this.readyForQuery === true) {
          this.activeQuery = this.queryQueue.shift();
          if (this.activeQuery) {
            this.readyForQuery = false;
            this.hasExecuted = true;
            const queryError = this.activeQuery.submit(this.connection);
            if (queryError) {
              process.nextTick(() => {
                this.activeQuery.handleError(queryError, this.connection);
                this.readyForQuery = true;
                this._pulseQueryQueue();
              });
            }
          } else if (this.hasExecuted) {
            this.activeQuery = null;
            this.emit("drain");
          }
        }
      }
      query(config, values, callback) {
        var query;
        var result;
        var readTimeout;
        var readTimeoutTimer;
        var queryCallback;
        if (config === null || config === void 0) {
          throw new TypeError("Client was passed a null or undefined query");
        } else if (typeof config.submit === "function") {
          readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
          result = query = config;
          if (typeof values === "function") {
            query.callback = query.callback || values;
          }
        } else {
          readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
          query = new Query(config, values, callback);
          if (!query.callback) {
            result = new this._Promise((resolve, reject) => {
              query.callback = (err, res) => err ? reject(err) : resolve(res);
            }).catch((err) => {
              Error.captureStackTrace(err);
              throw err;
            });
          }
        }
        if (readTimeout) {
          queryCallback = query.callback;
          readTimeoutTimer = setTimeout(() => {
            var error = new Error("Query read timeout");
            process.nextTick(() => {
              query.handleError(error, this.connection);
            });
            queryCallback(error);
            query.callback = () => {
            };
            var index = this.queryQueue.indexOf(query);
            if (index > -1) {
              this.queryQueue.splice(index, 1);
            }
            this._pulseQueryQueue();
          }, readTimeout);
          query.callback = (err, res) => {
            clearTimeout(readTimeoutTimer);
            queryCallback(err, res);
          };
        }
        if (this.binary && !query.binary) {
          query.binary = true;
        }
        if (query._result && !query._result._types) {
          query._result._types = this._types;
        }
        if (!this._queryable) {
          process.nextTick(() => {
            query.handleError(new Error("Client has encountered a connection error and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._ending) {
          process.nextTick(() => {
            query.handleError(new Error("Client was closed and is not queryable"), this.connection);
          });
          return result;
        }
        this.queryQueue.push(query);
        this._pulseQueryQueue();
        return result;
      }
      ref() {
        this.connection.ref();
      }
      unref() {
        this.connection.unref();
      }
      end(cb) {
        this._ending = true;
        if (!this.connection._connecting || this._ended) {
          if (cb) {
            cb();
          } else {
            return this._Promise.resolve();
          }
        }
        if (this.activeQuery || !this._queryable) {
          this.connection.stream.destroy();
        } else {
          this.connection.end();
        }
        if (cb) {
          this.connection.once("end", cb);
        } else {
          return new this._Promise((resolve) => {
            this.connection.once("end", resolve);
          });
        }
      }
    };
    Client.Query = Query;
    module.exports = Client;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg-pool/3.14.0/index.js
var require__8 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg-pool/3.14.0/index.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events").EventEmitter;
    var NOOP = function() {
    };
    var removeWhere = (list, predicate) => {
      const i = list.findIndex(predicate);
      return i === -1 ? void 0 : list.splice(i, 1)[0];
    };
    var IdleItem = class {
      constructor(client, idleListener, timeoutId) {
        this.client = client;
        this.idleListener = idleListener;
        this.timeoutId = timeoutId;
      }
    };
    var PendingItem = class {
      constructor(callback) {
        this.callback = callback;
      }
    };
    function throwOnDoubleRelease() {
      throw new Error("Release called on client which has already been released to the pool.");
    }
    function promisify(Promise2, callback) {
      if (callback) {
        return {
          callback,
          result: void 0
        };
      }
      let rej;
      let res;
      const cb = function(err, client) {
        err ? rej(err) : res(client);
      };
      const result = new Promise2(function(resolve, reject) {
        res = resolve;
        rej = reject;
      }).catch((err) => {
        Error.captureStackTrace(err);
        throw err;
      });
      return {
        callback: cb,
        result
      };
    }
    function makeIdleListener(pool2, client) {
      return function idleListener(err) {
        err.client = client;
        client.removeListener("error", idleListener);
        client.on("error", () => {
          pool2.log("additional client error after disconnection due to error", err);
        });
        pool2._remove(client);
        pool2.emit("error", err, client);
      };
    }
    var Pool = class extends EventEmitter {
      constructor(options, Client) {
        super();
        this.options = Object.assign({}, options);
        if (options != null && "password" in options) {
          Object.defineProperty(this.options, "password", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: options.password
          });
        }
        if (options != null && options.ssl && options.ssl.key) {
          Object.defineProperty(this.options.ssl, "key", {
            enumerable: false
          });
        }
        this.options.max = this.options.max || this.options.poolSize || 10;
        this.options.min = this.options.min || 0;
        this.options.maxUses = this.options.maxUses || Infinity;
        this.options.allowExitOnIdle = this.options.allowExitOnIdle || false;
        this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0;
        this.log = this.options.log || function() {
        };
        this.Client = this.options.Client || Client || require_lib2().Client;
        this.Promise = this.options.Promise || global.Promise;
        if (typeof this.options.idleTimeoutMillis === "undefined") {
          this.options.idleTimeoutMillis = 1e4;
        }
        this._clients = [];
        this._idle = [];
        this._expired = /* @__PURE__ */ new WeakSet();
        this._pendingQueue = [];
        this._endCallback = void 0;
        this.ending = false;
        this.ended = false;
      }
      _promiseTry(f) {
        const Promise2 = this.Promise;
        if (typeof Promise2.try === "function") {
          return Promise2.try(f);
        }
        return new Promise2((resolve) => resolve(f()));
      }
      _isFull() {
        return this._clients.length >= this.options.max;
      }
      _isAboveMin() {
        return this._clients.length > this.options.min;
      }
      _pulseQueue() {
        this.log("pulse queue");
        if (this.ended) {
          this.log("pulse queue ended");
          return;
        }
        if (this.ending) {
          this.log("pulse queue on ending");
          if (this._idle.length) {
            this._idle.slice().map((item) => {
              this._remove(item.client);
            });
          }
          if (!this._clients.length) {
            this.ended = true;
            this._endCallback();
          }
          return;
        }
        if (!this._pendingQueue.length) {
          this.log("no queued requests");
          return;
        }
        if (!this._idle.length && this._isFull()) {
          return;
        }
        const pendingItem = this._pendingQueue.shift();
        if (this._idle.length) {
          const idleItem = this._idle.pop();
          clearTimeout(idleItem.timeoutId);
          const client = idleItem.client;
          client.ref && client.ref();
          const idleListener = idleItem.idleListener;
          return this._acquireClient(client, pendingItem, idleListener, false);
        }
        if (!this._isFull()) {
          return this.newClient(pendingItem);
        }
        throw new Error("unexpected condition");
      }
      _remove(client, callback) {
        const removed = removeWhere(this._idle, (item) => item.client === client);
        if (removed !== void 0) {
          clearTimeout(removed.timeoutId);
        }
        this._clients = this._clients.filter((c) => c !== client);
        const context = this;
        client.end(() => {
          context.emit("remove", client);
          if (typeof callback === "function") {
            callback();
          }
        });
      }
      connect(cb) {
        if (this.ending) {
          const err = new Error("Cannot use a pool after calling end on the pool");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        const response = promisify(this.Promise, cb);
        const result = response.result;
        if (this._isFull() || this._idle.length) {
          if (this._idle.length) {
            process.nextTick(() => this._pulseQueue());
          }
          if (!this.options.connectionTimeoutMillis) {
            this._pendingQueue.push(new PendingItem(response.callback));
            return result;
          }
          const queueCallback = (err, res, done) => {
            clearTimeout(tid);
            response.callback(err, res, done);
          };
          const pendingItem = new PendingItem(queueCallback);
          const tid = setTimeout(() => {
            removeWhere(this._pendingQueue, (i) => i.callback === queueCallback);
            pendingItem.timedOut = true;
            response.callback(new Error("timeout exceeded when trying to connect"));
          }, this.options.connectionTimeoutMillis);
          if (tid.unref) {
            tid.unref();
          }
          this._pendingQueue.push(pendingItem);
          return result;
        }
        this.newClient(new PendingItem(response.callback));
        return result;
      }
      newClient(pendingItem) {
        const client = new this.Client(this.options);
        this._clients.push(client);
        const idleListener = makeIdleListener(this, client);
        this.log("checking client timeout");
        let tid;
        let timeoutHit = false;
        if (this.options.connectionTimeoutMillis) {
          tid = setTimeout(() => {
            if (client.connection) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.connection.stream.destroy();
            } else if (!client.isConnected()) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.end();
            }
          }, this.options.connectionTimeoutMillis);
        }
        this.log("connecting new client");
        client.connect((err) => {
          if (tid) {
            clearTimeout(tid);
          }
          client.on("error", idleListener);
          if (err) {
            this.log("client failed to connect", err);
            this._clients = this._clients.filter((c) => c !== client);
            if (timeoutHit) {
              err = new Error("Connection terminated due to connection timeout", {
                cause: err
              });
            }
            this._pulseQueue();
            if (!pendingItem.timedOut) {
              pendingItem.callback(err, void 0, NOOP);
            }
          } else {
            this.log("new client connected");
            if (this.options.onConnect) {
              this._promiseTry(() => this.options.onConnect(client)).then(() => {
                this._afterConnect(client, pendingItem, idleListener);
              }, (hookErr) => {
                this._clients = this._clients.filter((c) => c !== client);
                client.end(() => {
                  this._pulseQueue();
                  if (!pendingItem.timedOut) {
                    pendingItem.callback(hookErr, void 0, NOOP);
                  }
                });
              });
              return;
            }
            return this._afterConnect(client, pendingItem, idleListener);
          }
        });
      }
      _afterConnect(client, pendingItem, idleListener) {
        if (this.options.maxLifetimeSeconds !== 0) {
          const maxLifetimeTimeout = setTimeout(() => {
            this.log("ending client due to expired lifetime");
            this._expired.add(client);
            const idleIndex = this._idle.findIndex((idleItem) => idleItem.client === client);
            if (idleIndex !== -1) {
              this._acquireClient(client, new PendingItem((err, client2, clientRelease) => clientRelease()), idleListener, false);
            }
          }, this.options.maxLifetimeSeconds * 1e3);
          maxLifetimeTimeout.unref();
          client.once("end", () => clearTimeout(maxLifetimeTimeout));
        }
        return this._acquireClient(client, pendingItem, idleListener, true);
      }
      // acquire a client for a pending work item
      _acquireClient(client, pendingItem, idleListener, isNew) {
        if (isNew) {
          this.emit("connect", client);
        }
        this.emit("acquire", client);
        client.release = this._releaseOnce(client, idleListener);
        client.removeListener("error", idleListener);
        if (!pendingItem.timedOut) {
          if (isNew && this.options.verify) {
            this.options.verify(client, (err) => {
              if (err) {
                client.release(err);
                return pendingItem.callback(err, void 0, NOOP);
              }
              pendingItem.callback(void 0, client, client.release);
            });
          } else {
            pendingItem.callback(void 0, client, client.release);
          }
        } else {
          if (isNew && this.options.verify) {
            this.options.verify(client, client.release);
          } else {
            client.release();
          }
        }
      }
      // returns a function that wraps _release and throws if called more than once
      _releaseOnce(client, idleListener) {
        let released = false;
        return (err) => {
          if (released) {
            throwOnDoubleRelease();
          }
          released = true;
          this._release(client, idleListener, err);
        };
      }
      // release a client back to the poll, include an error
      // to remove it from the pool
      _release(client, idleListener, err) {
        client.on("error", idleListener);
        client._poolUseCount = (client._poolUseCount || 0) + 1;
        this.emit("release", err, client);
        if (err || this.ending || !client._queryable || client._ending || client._poolUseCount >= this.options.maxUses) {
          if (client._poolUseCount >= this.options.maxUses) {
            this.log("remove expended client");
          }
          return this._remove(client, this._pulseQueue.bind(this));
        }
        const isExpired = this._expired.has(client);
        if (isExpired) {
          this.log("remove expired client");
          this._expired.delete(client);
          return this._remove(client, this._pulseQueue.bind(this));
        }
        let tid;
        if (this.options.idleTimeoutMillis && this._isAboveMin()) {
          tid = setTimeout(() => {
            if (this._isAboveMin()) {
              this.log("remove idle client");
              this._remove(client, this._pulseQueue.bind(this));
            }
          }, this.options.idleTimeoutMillis);
          if (this.options.allowExitOnIdle) {
            tid.unref();
          }
        }
        if (this.options.allowExitOnIdle) {
          client.unref();
        }
        this._idle.push(new IdleItem(client, idleListener, tid));
        this._pulseQueue();
      }
      query(text, values, cb) {
        if (typeof text === "function") {
          const response2 = promisify(this.Promise, text);
          setImmediate(function() {
            return response2.callback(new Error("Passing a function as the first parameter to pool.query is not supported"));
          });
          return response2.result;
        }
        if (typeof values === "function") {
          cb = values;
          values = void 0;
        }
        const response = promisify(this.Promise, cb);
        cb = response.callback;
        this.connect((err, client) => {
          if (err) {
            return cb(err);
          }
          let clientReleased = false;
          const onError = (err2) => {
            if (clientReleased) {
              return;
            }
            clientReleased = true;
            client.release(err2);
            cb(err2);
          };
          client.once("error", onError);
          this.log("dispatching query");
          try {
            client.query(text, values, (err2, res) => {
              this.log("query dispatched");
              client.removeListener("error", onError);
              if (clientReleased) {
                return;
              }
              clientReleased = true;
              client.release(err2);
              if (err2) {
                return cb(err2);
              }
              return cb(void 0, res);
            });
          } catch (err2) {
            client.release(err2);
            return cb(err2);
          }
        });
        return response.result;
      }
      end(cb) {
        this.log("ending");
        if (this.ending) {
          const err = new Error("Called end on pool more than once");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        this.ending = true;
        const promised = promisify(this.Promise, cb);
        this._endCallback = promised.callback;
        this._pulseQueue();
        return promised.result;
      }
      get waitingCount() {
        return this._pendingQueue.length;
      }
      get idleCount() {
        return this._idle.length;
      }
      get expiredCount() {
        return this._clients.reduce((acc, client) => acc + (this._expired.has(client) ? 1 : 0), 0);
      }
      get totalCount() {
        return this._clients.length;
      }
    };
    module.exports = Pool;
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/native/query.js
var require_query2 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/native/query.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events").EventEmitter;
    var util = __require("node:util");
    var utils = require_utils();
    var NativeQuery = module.exports = function(config, values, callback) {
      EventEmitter.call(this);
      config = utils.normalizeQueryConfig(config, values, callback);
      this.text = config.text;
      this.values = config.values;
      this.name = config.name;
      this.queryMode = config.queryMode;
      this.callback = config.callback;
      this.state = "new";
      this._arrayMode = config.rowMode === "array";
      this._emitRowEvents = false;
      this.on("newListener", function(event) {
        if (event === "row") this._emitRowEvents = true;
      }.bind(this));
    };
    util.inherits(NativeQuery, EventEmitter);
    var errorFieldMap = {
      /* eslint-disable quote-props */
      sqlState: "code",
      statementPosition: "position",
      messagePrimary: "message",
      context: "where",
      schemaName: "schema",
      tableName: "table",
      columnName: "column",
      dataTypeName: "dataType",
      constraintName: "constraint",
      sourceFile: "file",
      sourceLine: "line",
      sourceFunction: "routine"
    };
    NativeQuery.prototype.handleError = function(err) {
      var fields = this.native.pq.resultErrorFields();
      if (fields) {
        for (var key in fields) {
          var normalizedFieldName = errorFieldMap[key] || key;
          err[normalizedFieldName] = fields[key];
        }
      }
      if (this.callback) {
        this.callback(err);
      } else {
        this.emit("error", err);
      }
      this.state = "error";
    };
    NativeQuery.prototype.then = function(onSuccess, onFailure) {
      return this._getPromise().then(onSuccess, onFailure);
    };
    NativeQuery.prototype.catch = function(callback) {
      return this._getPromise().catch(callback);
    };
    NativeQuery.prototype._getPromise = function() {
      if (this._promise) return this._promise;
      this._promise = new Promise(function(resolve, reject) {
        this._once("end", resolve);
        this._once("error", reject);
      }.bind(this));
      return this._promise;
    };
    NativeQuery.prototype.submit = function(client) {
      this.state = "running";
      var self = this;
      this.native = client.native;
      client.native.arrayMode = this._arrayMode;
      var after = function(err, rows, results) {
        client.native.arrayMode = false;
        setImmediate(function() {
          self.emit("_done");
        });
        if (err) {
          return self.handleError(err);
        }
        if (self._emitRowEvents) {
          if (results.length > 1) {
            rows.forEach((rowOfRows, i) => {
              rowOfRows.forEach((row) => {
                self.emit("row", row, results[i]);
              });
            });
          } else {
            rows.forEach(function(row) {
              self.emit("row", row, results);
            });
          }
        }
        self.state = "end";
        self.emit("end", results);
        if (self.callback) {
          self.callback(null, results);
        }
      };
      if (process.domain) {
        after = process.domain.bind(after);
      }
      if (this.name) {
        if (this.name.length > 63) {
          console.error("Warning! Postgres only supports 63 characters for query names.");
          console.error("You supplied %s (%s)", this.name, this.name.length);
          console.error("This can cause conflicts and silent errors executing queries");
        }
        var values = (this.values || []).map(utils.prepareValue);
        if (client.namedQueries[this.name]) {
          if (this.text && client.namedQueries[this.name] !== this.text) {
            const err = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
            return after(err);
          }
          return client.native.execute(this.name, values, after);
        }
        return client.native.prepare(this.name, this.text, values.length, function(err) {
          if (err) return after(err);
          client.namedQueries[self.name] = self.text;
          return self.native.execute(self.name, values, after);
        });
      } else if (this.values) {
        if (!Array.isArray(this.values)) {
          const err = new Error("Query values must be an array");
          return after(err);
        }
        var vals = this.values.map(utils.prepareValue);
        client.native.query(this.text, vals, after);
      } else if (this.queryMode === "extended") {
        client.native.query(this.text, [], after);
      } else {
        client.native.query(this.text, after);
      }
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/native/client.js
var require_client2 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/native/client.js"(exports, module) {
    "use strict";
    var Native;
    try {
      Native = __require("pg-native");
    } catch (e) {
      throw e;
    }
    var TypeOverrides = require_type_overrides();
    var EventEmitter = __require("node:events").EventEmitter;
    var util = __require("node:util");
    var ConnectionParameters = require_connection_parameters();
    var NativeQuery = require_query2();
    var Client = module.exports = function(config) {
      EventEmitter.call(this);
      config = config || {};
      this._Promise = config.Promise || global.Promise;
      this._types = new TypeOverrides(config.types);
      this.native = new Native({
        types: this._types
      });
      this._queryQueue = [];
      this._ending = false;
      this._connecting = false;
      this._connected = false;
      this._queryable = true;
      var cp = this.connectionParameters = new ConnectionParameters(config);
      if (config.nativeConnectionString) cp.nativeConnectionString = config.nativeConnectionString;
      this.user = cp.user;
      Object.defineProperty(this, "password", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: cp.password
      });
      this.database = cp.database;
      this.host = cp.host;
      this.port = cp.port;
      this.namedQueries = {};
    };
    Client.Query = NativeQuery;
    util.inherits(Client, EventEmitter);
    Client.prototype._errorAllQueries = function(err) {
      const enqueueError = (query) => {
        process.nextTick(() => {
          query.native = this.native;
          query.handleError(err);
        });
      };
      if (this._hasActiveQuery()) {
        enqueueError(this._activeQuery);
        this._activeQuery = null;
      }
      this._queryQueue.forEach(enqueueError);
      this._queryQueue.length = 0;
    };
    Client.prototype._connect = function(cb) {
      var self = this;
      if (this._connecting) {
        process.nextTick(() => cb(new Error("Client has already been connected. You cannot reuse a client.")));
        return;
      }
      this._connecting = true;
      this.connectionParameters.getLibpqConnectionString(function(err, conString) {
        if (self.connectionParameters.nativeConnectionString) conString = self.connectionParameters.nativeConnectionString;
        if (err) return cb(err);
        self.native.connect(conString, function(err2) {
          if (err2) {
            self.native.end();
            return cb(err2);
          }
          self._connected = true;
          self.native.on("error", function(err3) {
            self._queryable = false;
            self._errorAllQueries(err3);
            self.emit("error", err3);
          });
          self.native.on("notification", function(msg) {
            self.emit("notification", {
              channel: msg.relname,
              payload: msg.extra
            });
          });
          self.emit("connect");
          self._pulseQueryQueue(true);
          cb();
        });
      });
    };
    Client.prototype.connect = function(callback) {
      if (callback) {
        this._connect(callback);
        return;
      }
      return new this._Promise((resolve, reject) => {
        this._connect((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    };
    Client.prototype.query = function(config, values, callback) {
      var query;
      var result;
      var readTimeout;
      var readTimeoutTimer;
      var queryCallback;
      if (config === null || config === void 0) {
        throw new TypeError("Client was passed a null or undefined query");
      } else if (typeof config.submit === "function") {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        result = query = config;
        if (typeof values === "function") {
          config.callback = values;
        }
      } else {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        query = new NativeQuery(config, values, callback);
        if (!query.callback) {
          let resolveOut, rejectOut;
          result = new this._Promise((resolve, reject) => {
            resolveOut = resolve;
            rejectOut = reject;
          }).catch((err) => {
            Error.captureStackTrace(err);
            throw err;
          });
          query.callback = (err, res) => err ? rejectOut(err) : resolveOut(res);
        }
      }
      if (readTimeout) {
        queryCallback = query.callback;
        readTimeoutTimer = setTimeout(() => {
          var error = new Error("Query read timeout");
          process.nextTick(() => {
            query.handleError(error, this.connection);
          });
          queryCallback(error);
          query.callback = () => {
          };
          var index = this._queryQueue.indexOf(query);
          if (index > -1) {
            this._queryQueue.splice(index, 1);
          }
          this._pulseQueryQueue();
        }, readTimeout);
        query.callback = (err, res) => {
          clearTimeout(readTimeoutTimer);
          queryCallback(err, res);
        };
      }
      if (!this._queryable) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client has encountered a connection error and is not queryable"));
        });
        return result;
      }
      if (this._ending) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client was closed and is not queryable"));
        });
        return result;
      }
      this._queryQueue.push(query);
      this._pulseQueryQueue();
      return result;
    };
    Client.prototype.end = function(cb) {
      var self = this;
      this._ending = true;
      if (!this._connected) {
        this.once("connect", this.end.bind(this, cb));
      }
      var result;
      if (!cb) {
        result = new this._Promise(function(resolve, reject) {
          cb = (err) => err ? reject(err) : resolve();
        });
      }
      this.native.end(function() {
        self._errorAllQueries(new Error("Connection terminated"));
        process.nextTick(() => {
          self.emit("end");
          if (cb) cb();
        });
      });
      return result;
    };
    Client.prototype._hasActiveQuery = function() {
      return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
    };
    Client.prototype._pulseQueryQueue = function(initialConnection) {
      if (!this._connected) {
        return;
      }
      if (this._hasActiveQuery()) {
        return;
      }
      var query = this._queryQueue.shift();
      if (!query) {
        if (!initialConnection) {
          this.emit("drain");
        }
        return;
      }
      this._activeQuery = query;
      query.submit(this);
      var self = this;
      query.once("_done", function() {
        self._pulseQueryQueue();
      });
    };
    Client.prototype.cancel = function(query) {
      if (this._activeQuery === query) {
        this.native.cancel(function() {
        });
      } else if (this._queryQueue.indexOf(query) !== -1) {
        this._queryQueue.splice(this._queryQueue.indexOf(query), 1);
      }
    };
    Client.prototype.ref = function() {
    };
    Client.prototype.unref = function() {
    };
    Client.prototype.setTypeParser = function(oid, format, parseFn) {
      return this._types.setTypeParser(oid, format, parseFn);
    };
    Client.prototype.getTypeParser = function(oid, format) {
      return this._types.getTypeParser(oid, format);
    };
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/native/index.js
var require_native = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/native/index.js"(exports, module) {
    "use strict";
    module.exports = require_client2();
  }
});

// ../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/index.js
var require_lib2 = __commonJS({
  "../../managed/deno/npm/registry.npmjs.org/pg/8.13.1/lib/index.js"(exports, module) {
    "use strict";
    var Client = require_client();
    var defaults = require_defaults();
    var Connection = require_connection();
    var Pool = require__8();
    var { DatabaseError } = require_dist();
    var { escapeIdentifier, escapeLiteral } = require_utils();
    var poolFactory = (Client2) => {
      return class BoundPool extends Pool {
        constructor(options) {
          super(options, Client2);
        }
      };
    };
    var PG = function(clientConstructor) {
      this.defaults = defaults;
      this.Client = clientConstructor;
      this.Query = this.Client.Query;
      this.Pool = poolFactory(this.Client);
      this._pools = [];
      this.Connection = Connection;
      this.types = require__6();
      this.DatabaseError = DatabaseError;
      this.escapeIdentifier = escapeIdentifier;
      this.escapeLiteral = escapeLiteral;
    };
    if (typeof process.env.NODE_PG_FORCE_NATIVE !== "undefined") {
      module.exports = new PG(require_native());
    } else {
      module.exports = new PG(Client);
      Object.defineProperty(module.exports, "native", {
        configurable: true,
        enumerable: false,
        get() {
          var native = null;
          try {
            native = new PG(require_native());
          } catch (err) {
            if (err.code !== "MODULE_NOT_FOUND") {
              throw err;
            }
          }
          Object.defineProperty(module.exports, "native", {
            value: native
          });
          return native;
        }
      });
    }
  }
});

// functions/_shared/compat.ts
var import_npm_nodemailer_6_9 = __toESM(require_nodemailer());
var SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
var SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
var ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
var PRIV_BUCKET = "private";
var PUB_BUCKET = "public";
var LEGACY_BASE44_URL = () => Deno.env.get("EXM_LEGACY_BASE44_URL") || "https://exmortis-return-path.base44.app";
var H = () => ({
  apikey: SRK,
  Authorization: `Bearer ${SRK}`,
  "Content-Type": "application/json"
});
var val = (v) => encodeURIComponent(String(v));
var inVal = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
var col = (f) => `data->>${encodeURIComponent(f)}`;
var OP_MAP = {
  $ne: "neq",
  $gt: "gt",
  $gte: "gte",
  $lt: "lt",
  $lte: "lte"
};
function atom(field, cond) {
  if (cond === null) return `${col(field)}=is.null`;
  if (cond === true || cond === false) return `${col(field)}=eq.${cond}`;
  if (typeof cond !== "object" || Array.isArray(cond)) {
    return Array.isArray(cond) ? `${col(field)}=in.(${cond.map(inVal).join(",")})` : `${col(field)}=eq.${val(cond)}`;
  }
  const [op, v] = Object.entries(cond)[0];
  if (op === "$in" || op === "$nin") {
    const list = Array.isArray(v) ? v : [
      v
    ];
    return `${col(field)}=${op === "$in" ? "in" : "not.in"}.(${list.map(inVal).join(",")})`;
  }
  if (op === "$exists") return `${col(field)}=is.${v ? "not.null" : "null"}`;
  if (op === "$regex") return `${col(field)}=like.*${encodeURIComponent(String(v))}*`;
  if (op in OP_MAP) return `${col(field)}=${OP_MAP[op]}.${val(v)}`;
  throw new Error(`Nieobs\u0142ugiwany operator filtra: ${op}`);
}
function conditions(query) {
  const parts = [];
  for (const [field, cond] of Object.entries(query || {})) {
    if (field === "$or" || field === "$and") {
      const sep = field === "$or" ? "or" : "and";
      const inner = cond.map((sub) => {
        const [f, c] = Object.entries(sub)[0];
        return atom(f, c).replace("=", ".");
      });
      parts.push(`${sep}=(${inner.join(",")})`);
    } else {
      parts.push(atom(field, cond));
    }
  }
  return parts;
}
function orderExpr(sort) {
  const dir = String(sort).startsWith("-") ? "desc" : "asc";
  const field = String(sort).replace(/^-/, "");
  const built = [
    "created_date",
    "updated_date"
  ].includes(field);
  return `${built ? field : encodeURIComponent("data->>" + field)}.${dir}`;
}
async function pgGet(table, qs) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: H(),
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}
var row2rec = (r) => ({
  ...r.data || {},
  id: r.id,
  created_date: r.created_date,
  updated_date: r.updated_date,
  created_by_id: r.created_by_id
});
var rec2row = (rec) => {
  const data = {};
  for (const [k, v] of Object.entries(rec)) {
    if (![
      "id",
      "created_date",
      "updated_date",
      "created_by_id"
    ].includes(k)) data[k] = v;
  }
  return data;
};
var tableOf = (name) => "exm_" + name.toLowerCase();
function parseArgs(args) {
  const [query, second] = args;
  if (second && typeof second === "object" && !Array.isArray(second)) {
    const o = second;
    return {
      query: query || {},
      sort: o.sort,
      limit: o.limit,
      cursor: o.cursor,
      distinct: o.distinct,
      page: true
    };
  }
  return {
    query: query || {},
    sort: second,
    limit: args[2],
    cursor: args[3],
    distinct: null,
    page: false
  };
}
function makeEntity(name) {
  const table = tableOf(name);
  async function fetchPage(parts, sort, limit, cursor) {
    const order = sort ? `&order=${orderExpr(String(sort))}` : "";
    const lim = Math.max(1, Math.min(Number(limit) || 50, 2e3));
    const off = Math.max(0, Number(cursor ?? 0) || 0);
    const qs = `${parts.join("&")}${order}&limit=${lim + 1}&offset=${off}`;
    const rows = await pgGet(table, qs);
    const has_more = rows.length > lim;
    return {
      items: (has_more ? rows.slice(0, lim) : rows).map(row2rec),
      next_cursor: has_more ? String(off + lim) : null,
      has_more
    };
  }
  return {
    async get(id) {
      const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
      return rows[0] ? row2rec(rows[0]) : null;
    },
    async filter(...args) {
      const { query, sort, limit, cursor, distinct, page } = parseArgs(args);
      const parts = conditions(query);
      if (distinct) {
        const rows = await pgGet(table, `select=v:${encodeURIComponent("data->>" + distinct)}&limit=2000`);
        return {
          items: [
            ...new Set(rows.map((r) => r.v).filter((v) => v !== null && v !== void 0))
          ]
        };
      }
      if (!page) {
        const order = sort ? `&order=${orderExpr(String(sort))}` : "";
        const lim = limit ? `&limit=${Math.min(Number(limit) || 50, 2e3)}` : "";
        return (await pgGet(table, `${parts.join("&")}${order}${lim}`)).map(row2rec);
      }
      return fetchPage(parts, sort, limit, cursor);
    },
    async list(options) {
      if (!options || !Object.keys(options).length) {
        return (await pgGet(table, "limit=2000")).map(row2rec);
      }
      return this.filter(options.query || {}, {
        sort: options.sort,
        limit: options.limit,
        cursor: options.cursor,
        distinct: options.distinct
      });
    },
    async count(query = {}) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${conditions(query).join("&") || "select=id"}&limit=0`, {
        method: "HEAD",
        headers: {
          ...H(),
          Prefer: "count=exact"
        },
        signal: AbortSignal.timeout(2e4)
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      const range = res.headers.get("content-range") || "/0";
      return Number(range.split("/")[1]) || 0;
    },
    async aggregate(body = {}) {
      const parts = conditions(body.query || {});
      const rows = (await pgGet(table, `${parts.join("&") || "select=*"}&limit=20000`)).map(row2rec);
      const groupBy = body.groupBy || (body.dateBucket ? body.dateBucket.field : null);
      const bucketUnit = body.dateBucket ? body.dateBucket.unit || "day" : null;
      const groups = /* @__PURE__ */ new Map();
      for (const r of rows) {
        let g = groupBy ? r[groupBy] ?? null : "";
        if (g && bucketUnit && groupBy) {
          const d = new Date(g);
          g = bucketUnit === "month" ? d.toISOString().slice(0, 7) : bucketUnit === "week" ? String(d.getUTCFullYear()) + "-W" + Math.ceil(((+d - +new Date(d.getUTCFullYear(), 0, 1)) / 864e5 + new Date(d.getUTCFullYear(), 0, 1).getUTCDay() + 1) / 7) : d.toISOString().slice(0, 10);
        }
        const key = String(g);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      const num = (r, f) => Number(r[f]) || 0;
      const out = [
        ...groups.entries()
      ].map(([key, rs]) => {
        const row = {
          [groupBy || "okres"]: key === "null" ? null : key,
          count: rs.length
        };
        for (const f of body.sum || []) row[`sum_${f}`] = rs.reduce((a, r) => a + num(r, f), 0);
        for (const f of body.avg || []) row[`avg_${f}`] = rs.length ? rs.reduce((a, r) => a + num(r, f), 0) / rs.length : 0;
        for (const f of body.min || []) row[`min_${f}`] = rs.length ? Math.min(...rs.map((r) => num(r, f))) : 0;
        for (const f of body.max || []) row[`max_${f}`] = rs.length ? Math.max(...rs.map((r) => num(r, f))) : 0;
        return row;
      });
      out.sort((a, b) => String(Object.values(a)[0]).localeCompare(String(Object.values(b)[0])));
      return {
        rows: out
      };
    },
    async create(rec) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const row = {
        id: crypto.randomUUID(),
        created_date: now,
        updated_date: now,
        created_by_id: rec.created_by_id || null,
        data: rec2row(rec)
      };
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          ...H(),
          Prefer: "return=representation"
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(2e4)
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return row2rec((await res.json())[0]);
    },
    async bulkCreate(recs) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const rows = (recs || []).map((rec) => ({
        id: crypto.randomUUID(),
        created_date: now,
        updated_date: now,
        created_by_id: rec.created_by_id || null,
        data: rec2row(rec)
      }));
      if (!rows.length) return [];
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          ...H(),
          Prefer: "return=representation"
        },
        body: JSON.stringify(rows),
        signal: AbortSignal.timeout(3e4)
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).map(row2rec);
    },
    async update(id, patch) {
      const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
      if (!rows[0]) return null;
      const data = {
        ...rows[0].data,
        ...rec2row(patch)
      };
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, {
        method: "PATCH",
        headers: {
          ...H(),
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          data,
          updated_date: (/* @__PURE__ */ new Date()).toISOString()
        }),
        signal: AbortSignal.timeout(2e4)
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return row2rec((await res.json())[0]);
    },
    async updateMany(query, ops) {
      const $set = ops.$set || {};
      const $inc = ops.$inc || {};
      const $unset = ops.$unset || [];
      let changed = 0;
      for (let round = 0; round < 20; round++) {
        const ids = (await pgGet(table, `${conditions(query).join("&")}&select=id&limit=500`)).map((r) => String(r.id));
        if (!ids.length) break;
        await Promise.all(ids.map(async (id) => {
          const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
          const data = {
            ...rows[0]?.data || {},
            ...$set
          };
          for (const [f, n] of Object.entries($inc)) data[f] = (Number(data[f]) || 0) + Number(n);
          for (const f of $unset) delete data[f];
          const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, {
            method: "PATCH",
            headers: {
              ...H(),
              Prefer: "return=minimal"
            },
            body: JSON.stringify({
              data,
              updated_date: (/* @__PURE__ */ new Date()).toISOString()
            }),
            signal: AbortSignal.timeout(2e4)
          });
          if (res.ok) changed++;
        }));
      }
      return {
        ok: true,
        changed
      };
    },
    async bulkUpdate(list) {
      for (const item of list || []) await this.update(item.id, item);
      return {
        ok: true,
        count: (list || []).length
      };
    },
    async delete(id) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, {
        method: "DELETE",
        headers: H(),
        signal: AbortSignal.timeout(2e4)
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      return {
        ok: true
      };
    },
    async deleteMany(query = {}) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${conditions(query).join("&")}`, {
        method: "DELETE",
        headers: H(),
        signal: AbortSignal.timeout(6e4)
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      return {
        ok: true
      };
    },
    subscribe: () => () => {
    }
  };
}
var ENTITIES = /* @__PURE__ */ new Map();
function entities() {
  return new Proxy({}, {
    get: (_t, name) => {
      if (!ENTITIES.has(name)) ENTITIES.set(name, makeEntity(name));
      return ENTITIES.get(name);
    }
  });
}
var HOSTING_BASE = "";
var HOSTING_BASE_AT = 0;
async function hostingBase() {
  if (HOSTING_BASE && Date.now() - HOSTING_BASE_AT < 3e5) return HOSTING_BASE;
  let url = String(Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  if (!url || /preview--/i.test(url)) {
    const r = await fetch(`${SUPA_URL}/rest/v1/app_settings?key=eq.app&select=value&limit=1`, {
      headers: H(),
      signal: AbortSignal.timeout(1e4)
    }).catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    url = String(j?.[0]?.value?.url || "").replace(/\/+$/, "");
    if (/preview--/i.test(url)) url = "";
  }
  if (url) {
    HOSTING_BASE = url;
    HOSTING_BASE_AT = Date.now();
  }
  return url;
}
var Core = {
  async SendEmail(opts) {
    const host = Deno.env.get("SMTP_HOST");
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    if (!host || !user || !pass) throw new Error("Wysy\u0142ka awaryjna: brak sekret\xF3w SMTP_HOST/SMTP_USER/SMTP_PASS");
    const port = Number(Deno.env.get("SMTP_PORT") || 587);
    const transport = import_npm_nodemailer_6_9.default.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      }
    });
    await transport.sendMail({
      from: `${opts.from_name || "Exmortis"} <${user}>`,
      to: opts.to,
      subject: opts.subject || "(bez tematu)",
      html: opts.html || opts.body || "",
      text: opts.text || ""
    });
    return {
      ok: true
    };
  },
  async CreateFileSignedUrl({ file_uri, expires_in = 300 }) {
    if (/^https?:\/\//.test(file_uri)) return {
      signed_url: file_uri
    };
    if (/^cf\//.test(String(file_uri))) {
      const name = String(file_uri).replace(/^cf\/(private|public)\//, "");
      if (!/^[A-Za-z0-9._-]{1,160}$/.test(name)) throw new Error("Podpis pliku: nieprawid\u0142owa nazwa pliku");
      const key = Deno.env.get("MEDIA_SECRET") || Deno.env.get("BOOKING_HMAC_KEY");
      if (!key) throw new Error("Podpis pliku: brak sekretu MEDIA_SECRET");
      const base = await hostingBase();
      if (!base) throw new Error("Podpis pliku: brak adresu aplikacji (ustawienie app)");
      const exp2 = Math.floor(Date.now() / 1e3) + Math.max(60, Math.min(Number(expires_in) || 300, 604800));
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc.encode(key), {
        name: "HMAC",
        hash: "SHA-256"
      }, false, [
        "sign"
      ]);
      const mac = [
        ...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${name}.${exp2}`)))
      ].map((b) => b.toString(16).padStart(2, "0")).join("");
      return {
        signed_url: `${base}/media/private/${encodeURIComponent(name)}?e=${exp2}&s=${mac}`
      };
    }
    let bucket = "", path = "";
    const m = file_uri.match(/^(?:supabase:\/\/)([^/]+)\/(.+)$/);
    if (m) {
      bucket = m[1];
      path = m[2];
    } else {
      const [head, ...rest] = String(file_uri).split("/");
      bucket = /privat/i.test(head) ? PRIV_BUCKET : PUB_BUCKET;
      path = rest.join("/");
    }
    const exp = Math.max(60, Math.min(Number(expires_in) || 300, 604800));
    const legacy = async () => {
      const key = Deno.env.get("BOOKING_HMAC_KEY");
      if (!key) throw new Error("Podpis pliku: brak sekretu BOOKING_HMAC_KEY");
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc.encode(key), {
        name: "HMAC",
        hash: "SHA-256"
      }, false, [
        "sign"
      ]);
      const mac = [
        ...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`sign:${file_uri}`)))
      ].map((b) => b.toString(16).padStart(2, "0")).join("");
      const res = await fetch(`${LEGACY_BASE44_URL()}/functions/legacySign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uri: file_uri,
          sig: mac,
          expires_in: exp
        }),
        signal: AbortSignal.timeout(15e3)
      });
      if (!res.ok) throw new Error(`Podpis pliku (stare miejsce): ${res.status}`);
      const j = await res.json().catch(() => null);
      if (!j || !j.signed_url) throw new Error("Podpis pliku: brak linku");
      return {
        signed_url: j.signed_url
      };
    };
    try {
      const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
        method: "POST",
        headers: {
          ...H()
        },
        body: JSON.stringify({
          expiresIn: exp
        }),
        signal: AbortSignal.timeout(2e4)
      });
      if (!res.ok) return await legacy();
      const j = await res.json();
      const rel = j.signedURL || j.token ? j.signedURL || `/object/sign/${bucket}/${path}?token=${j.token}` : null;
      if (!rel) return await legacy();
      return {
        signed_url: `${SUPA_URL}/storage/v1${rel}`
      };
    } catch {
      return await legacy();
    }
  },
  async UploadPrivateFile({ file }) {
    const name = `${Date.now()}-${(file.name || "plik").replace(/[^\w.\-]/g, "_")}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/${PRIV_BUCKET}/${name}`, {
      method: "POST",
      headers: {
        apikey: SRK,
        Authorization: `Bearer ${SRK}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true"
      },
      body: file,
      signal: AbortSignal.timeout(6e4)
    });
    if (!res.ok) throw new Error(`Storage upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return {
      file_uri: `${PRIV_BUCKET}/${name}`
    };
  },
  async UploadPublicFile({ file }) {
    const name = `${Date.now()}-${(file.name || "plik").replace(/[^\w.\-]/g, "_")}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/${PUB_BUCKET}/${name}`, {
      method: "POST",
      headers: {
        apikey: SRK,
        Authorization: `Bearer ${SRK}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true"
      },
      body: file,
      signal: AbortSignal.timeout(6e4)
    });
    if (!res.ok) throw new Error(`Storage upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return {
      file_url: `${SUPA_URL}/storage/v1/object/public/${PUB_BUCKET}/${name}`
    };
  },
  async GenerateImage({ prompt }) {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("Generowanie obraz\xF3w: brak sekretu OPENAI_API_KEY");
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1
      }),
      signal: AbortSignal.timeout(12e4)
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const b64 = (await res.json()).data?.[0]?.b64_json;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { url } = await this.UploadPublicFile({
      file: new Blob([
        bytes
      ], {
        type: "image/png"
      })
    });
    return {
      url
    };
  }
};
var connectors = {
  async getConnection(type) {
    if (type === "supabase") return {
      accessToken: SRK,
      connectionConfig: {}
    };
    throw new Error(`\u0141\u0105cznik "${type}" nie dzia\u0142a po migracji \u2014 przenie\u015B token do sekret\xF3w i czytaj go w kodzie (Deno.env.get)`);
  }
};
var CURRENT_REQ = null;
var jwtOf = (req) => {
  const h = (req?.headers.get("authorization") || "").match(/^Bearer (.+)$/i);
  return h ? h[1] : "";
};
async function me() {
  const token = jwtOf(CURRENT_REQ);
  if (!token) return null;
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`
    },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) return null;
  const u = await res.json();
  let profile = null;
  try {
    const rows = await pgGet("exm_user", `${col("email")}=eq.${val(u.email)}&limit=1`);
    profile = rows[0] || null;
  } catch {
  }
  const d = profile?.data || {};
  return {
    id: String(u.id),
    email: u.email,
    full_name: d.full_name || u.user_metadata?.full_name || String(u.email || "").split("@")[0],
    role: d.role || u.user_metadata?.role || "user",
    created_date: profile?.created_date || u.created_at
  };
}
async function updateMe(patch) {
  const user = await me();
  if (!user) throw new Error("Logowanie wymagane");
  const data = {
    full_name: patch.full_name,
    ...rec2row(patch)
  };
  const res = await fetch(`${SUPA_URL}/rest/v1/exm_user?${col("email")}=eq.${val(user.email)}`, {
    method: "PATCH",
    headers: {
      ...H(),
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      data
    }),
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
  const rows = await res.json();
  return {
    ...user,
    ...rows[0]?.data || {},
    ...patch
  };
}
async function inviteUser(email, role = "user") {
  const res = await fetch(`${SUPA_URL}/auth/v1/invite`, {
    method: "POST",
    headers: {
      ...H()
    },
    body: JSON.stringify({
      email
    }),
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) throw new Error(`Supabase invite ${res.status}: ${(await res.text()).slice(0, 200)}`);
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await fetch(`${SUPA_URL}/rest/v1/exm_user`, {
      method: "POST",
      headers: {
        ...H(),
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        email,
        role,
        data: {
          email,
          full_name: email.split("@")[0],
          role
        },
        created_date: now,
        updated_date: now
      }),
      signal: AbortSignal.timeout(2e4)
    });
  } catch {
  }
  return {
    ok: true
  };
}
async function invoke(name, payload) {
  const res = await fetch(`${SUPA_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12e4)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Funkcja ${name}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return {
    data
  };
}
function createClientFromRequest(req) {
  CURRENT_REQ = req;
  const ents = entities();
  return {
    entities: ents,
    auth: {
      me,
      isAuthenticated: async () => await me() !== null,
      updateMe,
      logout: () => new Response(null, {
        status: 204
      })
    },
    users: {
      inviteUser
    },
    functions: {
      invoke
    },
    asServiceRole: {
      entities: ents,
      integrations: {
        Core
      },
      connectors,
      users: {
        inviteUser
      },
      aiGateway: {
        connection: async () => {
          throw new Error("aiGateway: po migracji u\u017Cywaj OpenAI (sekret OPENAI_API_KEY)");
        }
      }
    }
  };
}

// functions/_shared/supabase.ts
var import_npm_pg_8_13 = __toESM(require_lib2());
var SUPA_URL2 = Deno.env.get("SUPABASE_URL") || "";
var SRK2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
var PROJECT_REF = SUPA_URL2.replace(/^https:\/\//, "").split(".")[0] || "fqhvxhnbeyvwubpnuzxe";
var POOL = null;
function pool() {
  if (!POOL) {
    const cs = Deno.env.get("SUPABASE_DB_URL");
    if (!cs) throw new Error("Brak zmiennej SUPABASE_DB_URL (wstrzykiwana przez runtime Supabase)");
    POOL = new import_npm_pg_8_13.default.Pool({
      connectionString: cs,
      max: 5,
      idleTimeoutMillis: 2e4
    });
  }
  return POOL;
}
async function runSql(_base44, query, _readOnly = false) {
  const res = await pool().query(query);
  return res.rows ?? [];
}
async function rpc(_base44, fn, args) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SRK2,
      Authorization: `Bearer ${SRK2}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15e3)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase RPC ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
function escStr(value) {
  const s = String(value);
  let d = "$q$";
  for (let n = 1; (s + d).indexOf(d) !== s.length; n++) d = `$q${n}$`;
  return `${d}${s}${d}`;
}
function esc(value) {
  if (value === null || value === void 0) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return escStr(value);
}
function textField(body, key, { max = 2e3, required = true } = {}) {
  const v = body ? body[key] : void 0;
  if (v === void 0 || v === null || String(v).trim() === "") {
    if (required) {
      const e = new Error(`Brak pola: ${key}`);
      e.isValidation = true;
      throw e;
    }
    return null;
  }
  const s = String(v).trim();
  if (s.length > max) {
    const e = new Error(`Pole ${key} jest zbyt d\u0142ugie`);
    e.isValidation = true;
    throw e;
  }
  return s;
}
async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

// functions/_shared/librarySchema.ts
var SCHEMA_SQL = `
-- ============ 1. USTAWIENIA MODU\u0141U ============
-- Dwa niezale\u017Cne prze\u0142\u0105czniki tr\xF3jstanowe (domy\u015Blnie \u201Eoff"), pr\xF3g przestrzeni i adres WhatsApp.
CREATE TABLE IF NOT EXISTS public.mb_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  library_mode text NOT NULL DEFAULT 'off' CHECK (library_mode IN ('off','admin','on')),
  messages_mode text NOT NULL DEFAULT 'off' CHECK (messages_mode IN ('off','admin','on')),
  email_notify boolean NOT NULL DEFAULT false,
  whatsapp text CHECK (whatsapp IS NULL OR whatsapp ~ '^https://wa\\.me/[0-9]{6,20}$'),
  space_limit_mb int NOT NULL DEFAULT 5120 CHECK (space_limit_mb BETWEEN 64 AND 1048576),
  tick_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.mb_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ 2. MATERIA\u0141Y ============
-- Plik trzymany wy\u0142\u0105cznie w prywatnym magazynie; w bazie sam klucz (bez nazw i e-maili w \u015Bcie\u017Cce).
-- Adresy wideo zapisujemy jako dostawc\u0119 + znormalizowany identyfikator, nigdy jako surowy adres.
CREATE TABLE IF NOT EXISTS public.mb_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  kind text NOT NULL CHECK (kind IN ('AUDIO','WIDEO','PDF','LINK','TEKST')),
  file_key text CHECK (file_key IS NULL OR (length(file_key) <= 500 AND position('@' in file_key) = 0)),
  file_name text CHECK (file_name IS NULL OR length(file_name) <= 300),
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  file_version int NOT NULL DEFAULT 1 CHECK (file_version >= 1),
  prev_file_key text CHECK (prev_file_key IS NULL OR (length(prev_file_key) <= 500 AND position('@' in prev_file_key) = 0)),
  prev_file_name text CHECK (prev_file_name IS NULL OR length(prev_file_name) <= 300),
  prev_file_size bigint CHECK (prev_file_size IS NULL OR prev_file_size >= 0),
  pdf_js_warning boolean NOT NULL DEFAULT false,
  external_url text CHECK (external_url IS NULL OR external_url ~ '^https://'),
  video_provider text CHECK (video_provider IS NULL OR video_provider IN ('youtube','vimeo','bunny')),
  video_id text CHECK (video_id IS NULL OR length(video_id) <= 120),
  body_html text CHECK (body_html IS NULL OR length(body_html) <= 20000),
  stage text CHECK (stage IS NULL OR length(stage) <= 60),
  tags text[] NOT NULL DEFAULT '{}',
  duration_s int CHECK (duration_s IS NULL OR duration_s >= 0),
  pages int CHECK (pages IS NULL OR pages >= 0),
  allow_download boolean NOT NULL DEFAULT false,
  source text CHECK (source IS NULL OR length(source) <= 200),
  deleted_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Rodzaj decyduje, sk\u0105d pochodzi tre\u015B\u0107: plik, adres, odtwarzacz albo tekst \u2014 nigdy dwa naraz.
  CHECK (CASE kind
    WHEN 'AUDIO' THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'PDF'   THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'WIDEO' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NOT NULL AND video_id IS NOT NULL AND body_html IS NULL
    WHEN 'LINK'  THEN file_key IS NULL AND external_url IS NOT NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'TEKST' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NOT NULL
  END)
);
CREATE INDEX IF NOT EXISTS mb_materials_live ON public.mb_materials (kind, created_at DESC) WHERE deleted_at IS NULL;

-- ============ 3. KOLEKCJE ============
CREATE TABLE IF NOT EXISTS public.mb_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  sort int NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.mb_collection_items (
  collection_id uuid NOT NULL REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, material_id)
);
CREATE INDEX IF NOT EXISTS mb_collection_items_order ON public.mb_collection_items (collection_id, position);

-- ============ 4. GRUPY = ZNACZNIKI ============
CREATE TABLE IF NOT EXISTS public.mb_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  color text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  kind text NOT NULL DEFAULT 'RECZNA' CHECK (kind IN ('RECZNA','AUTOMATYCZNA')),
  rule jsonb,
  created_by text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'RECZNA' AND rule IS NULL)
      OR (kind = 'AUTOMATYCZNA' AND rule IS NOT NULL AND rule->>'typ' IN ('produkt','aktywny_pakiet')))
);
-- Dopisane w 1B-1: grupy startowe czekaj\u0105 na akceptacj\u0119 (NULL = \u201Edo akceptacji").
ALTER TABLE public.mb_groups ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
CREATE TABLE IF NOT EXISTS public.mb_group_members (
  group_id uuid NOT NULL REFERENCES public.mb_groups(id) ON DELETE CASCADE,
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  added_by text,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, client_email)
);
CREATE INDEX IF NOT EXISTS mb_group_members_email ON public.mb_group_members (client_email);

-- ============ 5. PRZYDZIA\u0141Y ============
-- Widoczno\u015B\u0107 liczona przy ka\u017Cdym otwarciu, bez kopiowania wierszy na osoby.
-- TYLKO_OBECNI zamra\u017Ca list\u0119 cz\u0142onk\xF3w na dzie\u0144 przydzia\u0142u (snapshot_emails).
CREATE TABLE IF NOT EXISTS public.mb_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('osoba','grupa')),
  target_email text CHECK (target_email IS NULL OR (target_email = lower(btrim(target_email)) AND length(target_email) <= 320)),
  group_id uuid REFERENCES public.mb_groups(id) ON DELETE CASCADE,
  group_mode text CHECK (group_mode IS NULL OR group_mode IN ('OBECNI_I_PRZYSZLI','TYLKO_OBECNI')),
  snapshot_emails text[] NOT NULL DEFAULT '{}',
  exceptions_add text[] NOT NULL DEFAULT '{}',
  exceptions_drop text[] NOT NULL DEFAULT '{}',
  note text CHECK (note IS NULL OR length(note) <= 2000),
  visible_from timestamptz,
  visible_to timestamptz,
  notified_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK ((material_id IS NOT NULL) <> (collection_id IS NOT NULL)),
  CHECK ((target_kind = 'osoba' AND target_email IS NOT NULL AND group_id IS NULL AND group_mode IS NULL)
      OR (target_kind = 'grupa' AND group_id IS NOT NULL AND target_email IS NULL AND group_mode IS NOT NULL)),
  CHECK (visible_to IS NULL OR visible_from IS NULL OR visible_to > visible_from)
);
CREATE INDEX IF NOT EXISTS mb_assign_email ON public.mb_assignments (target_email) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_group ON public.mb_assignments (group_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_material ON public.mb_assignments (material_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_collection ON public.mb_assignments (collection_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_pending ON public.mb_assignments (created_at) WHERE notified_at IS NULL AND revoked_at IS NULL;

-- ============ 6. STAN U KLIENTA ============
CREATE TABLE IF NOT EXISTS public.mb_material_state (
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  material_id uuid NOT NULL REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  opened_at timestamptz,
  completed_at timestamptz,
  PRIMARY KEY (client_email, material_id)
);
CREATE INDEX IF NOT EXISTS mb_state_material ON public.mb_material_state (material_id);

-- ============ 7. WIADOMO\u015ACI (jednostronne) ============
-- target = definicja odbiorc\xF3w; lista odbiorc\xF3w powstaje dopiero w chwili wysy\u0142ki.
-- WYSYLANIE = wiadomo\u015B\u0107 przej\u0119ta atomowo przez zadanie (blokada przed podw\xF3jn\u0105 wysy\u0142k\u0105).
CREATE TABLE IF NOT EXISTS public.mb_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text CHECK (title IS NULL OR length(title) <= 200),
  body_html text NOT NULL CHECK (length(body_html) <= 20000),
  status text NOT NULL DEFAULT 'SZKIC' CHECK (status IN ('SZKIC','ZAPLANOWANA','WYSYLANIE','WYSLANA','WYCOFANA')),
  send_at timestamptz,
  email_mode text NOT NULL DEFAULT 'BRAK' CHECK (email_mode IN ('BRAK','POWIADOMIENIE','PELNA')),
  attached_material_id uuid REFERENCES public.mb_materials(id) ON DELETE SET NULL,
  attached_collection_id uuid REFERENCES public.mb_collections(id) ON DELETE SET NULL,
  target jsonb,
  recipient_count int NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  idem_key text UNIQUE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  withdrawn_at timestamptz,
  CHECK (status <> 'ZAPLANOWANA' OR send_at IS NOT NULL),
  CHECK (attached_material_id IS NULL OR attached_collection_id IS NULL)
);
CREATE INDEX IF NOT EXISTS mb_messages_due ON public.mb_messages (send_at) WHERE status = 'ZAPLANOWANA';
CREATE INDEX IF NOT EXISTS mb_messages_status ON public.mb_messages (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mb_message_recipients (
  message_id uuid NOT NULL REFERENCES public.mb_messages(id) ON DELETE CASCADE,
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  hidden_at timestamptz,
  PRIMARY KEY (message_id, client_email)
);
CREATE INDEX IF NOT EXISTS mb_rcpt_email ON public.mb_message_recipients (client_email, delivered_at DESC);
CREATE INDEX IF NOT EXISTS mb_rcpt_read ON public.mb_message_recipients (message_id, read_at);

CREATE TABLE IF NOT EXISTS public.mb_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  title text CHECK (title IS NULL OR length(title) <= 200),
  body_html text NOT NULL CHECK (length(body_html) <= 20000),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 8. LIMIT WYDAWANIA LINK\xD3W ============
CREATE TABLE IF NOT EXISTS public.mb_rate (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL CHECK (bucket IN ('link')),
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mb_rate_key ON public.mb_rate (key_hash, at);

-- ============ 9. HISTORIA ZMIAN (tylko dopisywanie) ============
CREATE TABLE IF NOT EXISTS public.mb_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  object_type text,
  object_id text,
  summary text CHECK (summary IS NULL OR length(summary) <= 500),
  anonymized boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS mb_log_at ON public.mb_log (at DESC);

DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mb_log_maint') THEN
    CREATE ROLE mb_log_maint NOLOGIN;
  END IF;
END $r$;
-- mb_log ma w\u0142\u0105czone RLS bez polityk, wi\u0119c rola nieb\u0119d\u0105ca w\u0142a\u015Bcicielem tabeli nie widzi
-- ani jednego wiersza. Bez tej linii UPDATE w funkcji czyszcz\u0105cej i anonimizuj\u0105cej cicho nic nie robi.
ALTER ROLE mb_log_maint BYPASSRLS;
GRANT USAGE ON SCHEMA public TO mb_log_maint;
-- CREATE na schemacie jest potrzebne wy\u0142\u0105cznie po to, by przekaza\u0107 funkcj\u0119 czyszcz\u0105c\u0105 na w\u0142asno\u015B\u0107 tej roli.
GRANT CREATE ON SCHEMA public TO mb_log_maint;
GRANT SELECT, UPDATE, DELETE ON public.mb_log TO mb_log_maint;

CREATE OR REPLACE FUNCTION public.mb_log_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $g$
BEGIN
  IF current_user = 'mb_log_maint' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'mb_log: wpisy mozna tylko dopisywac';
END $g$;
DROP TRIGGER IF EXISTS mb_log_no_change ON public.mb_log;
CREATE TRIGGER mb_log_no_change BEFORE UPDATE OR DELETE ON public.mb_log FOR EACH ROW EXECUTE FUNCTION public.mb_log_guard();
DROP TRIGGER IF EXISTS mb_log_no_truncate ON public.mb_log;
CREATE TRIGGER mb_log_no_truncate BEFORE TRUNCATE ON public.mb_log FOR EACH STATEMENT EXECUTE FUNCTION public.mb_log_guard();

-- Historia zmian trzymana 12 miesi\u0119cy.
CREATE OR REPLACE FUNCTION public.mb_log_purge() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $p$
DECLARE n int;
BEGIN
  DELETE FROM public.mb_log WHERE at < now() - interval '12 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $p$;
ALTER FUNCTION public.mb_log_purge() OWNER TO mb_log_maint;

-- RODO: anonimizacja wpis\xF3w historii dotycz\u0105cych danej osoby (bez usuwania historii).
-- W\u0142a\u015Bcicielem jest mb_log_maint \u2014 tylko ta rola mo\u017Ce zmienia\u0107 wpisy (trigger mb_log_guard).
CREATE OR REPLACE FUNCTION public.mb_log_anonymize(p_email text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $an$
DECLARE n int;
BEGIN
  UPDATE public.mb_log SET
    actor = CASE WHEN lower(actor) = lower(btrim(COALESCE(p_email,''))) THEN '[usuniete]' ELSE actor END,
    summary = regexp_replace(COALESCE(summary,''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+.[A-Za-z]{2,}', '[usuniete]', 'g'),
    anonymized = true
  WHERE lower(actor) = lower(btrim(COALESCE(p_email,'')))
     OR COALESCE(summary,'') ILIKE '%' || lower(btrim(COALESCE(p_email,''))) || '%';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $an$;
ALTER FUNCTION public.mb_log_anonymize(text) OWNER TO mb_log_maint;
REVOKE CREATE ON SCHEMA public FROM mb_log_maint;

-- ============ 9b. GRUPY AUTOMATYCZNE (jedno miejsce prawdy) ============
-- Cz\u0142onkostwo grupy automatycznej liczone wy\u0142\u0105cznie ODCZYTEM istniej\u0105cych danych:
-- op\u0142acone zam\xF3wienia (orders) i aktywne pakiety (bk_packages). Zero zmian w zakupach i rezerwacjach.
-- Ta sama regu\u0142a obs\u0142uguje widoczno\u015B\u0107 materia\u0142\xF3w, list\u0119 odbiorc\xF3w wiadomo\u015Bci i podgl\u0105d w panelu.
CREATE OR REPLACE FUNCTION public.mb_auto_group_emails(p_rule jsonb)
RETURNS TABLE (email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $ae$
BEGIN
  IF p_rule->>'typ' = 'produkt' AND COALESCE(p_rule->>'id','') <> '' THEN
    RETURN QUERY
      SELECT DISTINCT lower(btrim(o.buyer_email))
        FROM public.orders o, jsonb_array_elements(o.items) e
       WHERE o.status = 'COMPLETED' AND e->>'product_id' = p_rule->>'id' AND o.buyer_email IS NOT NULL;
  ELSIF p_rule->>'typ' = 'aktywny_pakiet' THEN
    -- Opcjonalny type_id: bez niego regu\u0142a obejmuje KA\u017BDY aktywny pakiet, z nim tylko ten typ spotkania.
    RETURN QUERY
      SELECT DISTINCT lower(btrim(p.email_display))
        FROM public.bk_packages p
       WHERE p.payment_status = 'oplacony' AND p.valid_until > now()
         AND p.sessions_used < p.sessions_total AND p.email_display IS NOT NULL
         AND (COALESCE(p_rule->>'type_id','') = '' OR p.type_id::text = p_rule->>'type_id');
  END IF;
END $ae$;

-- Kto jest w grupie TERAZ: cz\u0142onkowie r\u0119czni plus, dla grupy automatycznej, aktualny wynik regu\u0142y.
CREATE OR REPLACE FUNCTION public.mb_group_members_now(p_group uuid)
RETURNS TABLE (email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $gm$
  SELECT DISTINCT lower(btrim(m.client_email)) AS email
    FROM public.mb_group_members m WHERE m.group_id = p_group
  UNION
  SELECT e.email FROM public.mb_groups g, public.mb_auto_group_emails(g.rule) e
   WHERE g.id = p_group AND g.kind = 'AUTOMATYCZNA'
$gm$;

-- ============ 10. REGU\u0141A WIDOCZNO\u015ACI (jedno miejsce prawdy) ============
-- Zwraca materia\u0142y widoczne dla danej osoby: przydzia\u0142 wprost, przez grup\u0119 wg trybu,
-- z wyj\u0105tkami (dodani / wykluczeni), w oknie dat, przy w\u0142\u0105czonym prze\u0142\u0105czniku modu\u0142u.
-- Materia\u0142 z dw\xF3ch \u017Ar\xF3de\u0142 wyst\u0119puje raz (pierwsze\u0144stwo ma przydzia\u0142 wprost).
CREATE OR REPLACE FUNCTION public.mb_visible_materials(p_email text, p_admin boolean DEFAULT false)
RETURNS TABLE (material_id uuid, collection_id uuid, assignment_id uuid, note text, visible_from timestamptz, visible_to timestamptz, pos int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $vm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
s AS (SELECT library_mode FROM public.mb_settings WHERE id = 1),
-- \u201Emoje grupy": r\u0119czne (z listy cz\u0142onk\xF3w) ORAZ automatyczne (aktualny wynik regu\u0142y zakupowej / pakietowej)
mine AS (
  SELECT m.group_id FROM public.mb_group_members m, me WHERE m.client_email = me.mail
  UNION
  SELECT g.id FROM public.mb_groups g, me
   WHERE g.kind = 'AUTOMATYCZNA' AND me.mail <> ''
     AND me.mail IN (SELECT e.email FROM public.mb_auto_group_emails(g.rule) e)
),
a AS (
  SELECT x.*, CASE WHEN x.target_kind = 'osoba' THEN 0 ELSE 1 END AS prio
  FROM public.mb_assignments x, me, s
  WHERE x.revoked_at IS NULL
    AND me.mail <> ''
    AND (s.library_mode = 'on' OR (s.library_mode = 'admin' AND p_admin))
    AND (x.visible_from IS NULL OR x.visible_from <= now())
    AND (x.visible_to IS NULL OR x.visible_to > now())
    AND (
      (x.target_kind = 'osoba' AND x.target_email = me.mail)
      OR (x.target_kind = 'grupa' AND NOT (me.mail = ANY(x.exceptions_drop)) AND (
           (x.group_mode = 'OBECNI_I_PRZYSZLI' AND (x.group_id IN (SELECT group_id FROM mine) OR me.mail = ANY(x.exceptions_add)))
        OR (x.group_mode = 'TYLKO_OBECNI' AND (
             (me.mail = ANY(x.snapshot_emails) AND me.mail IN (SELECT e.email FROM public.mb_group_members_now(x.group_id) e))
             OR me.mail = ANY(x.exceptions_add)))
      ))
    )
),
rows AS (
  SELECT m.id AS mid, a.collection_id, a.id AS aid, a.note, a.visible_from, a.visible_to,
         COALESCE(ci.position, 0) AS pos, a.prio
  FROM a
  JOIN public.mb_materials m ON m.id = a.material_id AND m.deleted_at IS NULL
  LEFT JOIN public.mb_collection_items ci ON ci.collection_id = a.collection_id AND ci.material_id = m.id
  WHERE a.material_id IS NOT NULL
  UNION ALL
  SELECT m.id, a.collection_id, a.id, a.note, a.visible_from, a.visible_to, ci.position, a.prio
  FROM a
  JOIN public.mb_collection_items ci ON ci.collection_id = a.collection_id
  JOIN public.mb_materials m ON m.id = ci.material_id AND m.deleted_at IS NULL
  WHERE a.collection_id IS NOT NULL
)
SELECT DISTINCT ON (mid) mid, collection_id, aid, note, visible_from, visible_to, pos
FROM rows ORDER BY mid, prio, pos
$vm$;

-- ============ 11. ODBIORCY (jedno miejsce prawdy) ============
-- Grupa wg trybu, minus wykluczeni, plus dodani, bez powt\xF3rze\u0144. U\u017Cywane i do podgl\u0105du, i do wysy\u0142ki.
CREATE OR REPLACE FUNCTION public.mb_resolve_recipients(p_target jsonb)
RETURNS TABLE (email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $rr$
WITH t AS (SELECT p_target AS p),
tg AS (
  SELECT (t.p->>'group_id')::uuid AS gid, COALESCE(t.p->>'group_mode','') AS mode, t.p
  FROM t
  WHERE t.p->>'kind' = 'grupa'
    AND (t.p->>'group_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
),
base AS (
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'emails','[]')) AS x(e)
  UNION
  -- grupa wg trybu: \u201Eobecni i przyszli" = wszyscy w grupie teraz (r\u0119czni i automatyczni)
  SELECT e.email FROM tg, public.mb_group_members_now(tg.gid) e WHERE tg.mode = 'OBECNI_I_PRZYSZLI'
  UNION
  -- \u201Etylko obecni": z listy z chwili przydzia\u0142u zostaj\u0105 wy\u0142\u0105cznie osoby, kt\xF3re nadal s\u0105 w grupie
  SELECT lower(btrim(x.e)) AS email FROM tg, jsonb_array_elements_text(COALESCE(tg.p->'snapshot_emails','[]')) AS x(e)
    WHERE tg.mode = 'TYLKO_OBECNI'
      AND lower(btrim(x.e)) IN (SELECT e.email FROM public.mb_group_members_now(tg.gid) e)
  UNION
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'exceptions_add','[]')) AS x(e)
),
drop_ AS (
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'exceptions_drop','[]')) AS x(e)
)
SELECT DISTINCT b.email FROM base b
WHERE b.email IS NOT NULL AND b.email <> ''
  AND NOT EXISTS (SELECT 1 FROM drop_ d WHERE d.email = b.email)
$rr$;

-- ============ 12. PRZENIESIENIE DANYCH PRZY ZMIANIE ADRESU ============
-- Jedna transakcja: wszystkie tabele mb_* oraz adresy wewn\u0105trz tablic wyj\u0105tk\xF3w i snapshot\xF3w.
-- Przygotowane w 1A; podpi\u0119cie do modu\u0142u zmiany adresu nast\u0105pi w 1C.
CREATE OR REPLACE FUNCTION public.mb_move_email(p_old text, p_new text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mv$
DECLARE
  o text := lower(btrim(COALESCE(p_old,'')));
  n text := lower(btrim(COALESCE(p_new,'')));
  c jsonb := '{}'::jsonb;
  k int;
BEGIN
  IF o = '' OR n = '' OR strpos(n, '@') = 0 OR length(n) > 320 THEN
    RETURN jsonb_build_object('error','bad');
  END IF;
  IF o = n THEN RETURN jsonb_build_object('ok', true, 'same', true); END IF;

  DELETE FROM public.mb_group_members a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_group_members b WHERE b.group_id = a.group_id AND b.client_email = n);
  UPDATE public.mb_group_members SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('grupy', k);

  UPDATE public.mb_assignments SET target_email = n WHERE target_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('przydzialy', k);

  UPDATE public.mb_assignments
    SET exceptions_add = array_replace(exceptions_add, o, n),
        exceptions_drop = array_replace(exceptions_drop, o, n),
        snapshot_emails = array_replace(snapshot_emails, o, n)
    WHERE o = ANY(exceptions_add) OR o = ANY(exceptions_drop) OR o = ANY(snapshot_emails);
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('wyjatki', k);

  DELETE FROM public.mb_material_state a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_material_state b WHERE b.material_id = a.material_id AND b.client_email = n);
  UPDATE public.mb_material_state SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('stany', k);

  DELETE FROM public.mb_message_recipients a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_message_recipients b WHERE b.message_id = a.message_id AND b.client_email = n);
  UPDATE public.mb_message_recipients SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('odbiorcy', k);

  INSERT INTO public.mb_log (actor, action, object_type, object_id, summary)
  VALUES ('system', 'zmiana_adresu', 'klient', NULL, 'dane biblioteki przeniesione');
  RETURN jsonb_build_object('ok', true, 'przeniesione', c);
END $mv$;

-- ============ 13. LIMIT WYDAWANIA LINK\xD3W ============
CREATE OR REPLACE FUNCTION public.mb_link_hit(p_key text, p_limit int DEFAULT 30) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $lh$
BEGIN
  DELETE FROM public.mb_rate WHERE at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.mb_rate WHERE key_hash = p_key AND at > now() - interval '1 hour') >= p_limit THEN
    RETURN 'rate';
  END IF;
  INSERT INTO public.mb_rate (bucket, key_hash) VALUES ('link', p_key);
  RETURN 'ok';
END $lh$;

-- ============ 14. DOST\u0118P: wy\u0142\u0105cznie serwer ============
-- RLS bez polityk = brak dost\u0119pu z zewn\u0105trz; uprawnienia odebrane anon/authenticated.
DO $x$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['mb_settings','mb_materials','mb_collections','mb_collection_items','mb_groups','mb_group_members',
    'mb_assignments','mb_material_state','mb_messages','mb_message_recipients','mb_templates','mb_rate','mb_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', r);
  END LOOP;
END $x$;
REVOKE ALL ON SEQUENCE public.mb_rate_id_seq, public.mb_log_id_seq FROM PUBLIC, anon, authenticated;

-- Wszystkie funkcje mb_*: jawnie odbieramy PUBLIC/anon/authenticated, zostaje tylko service_role.
-- (PostgreSQL nadaje EXECUTE dla PUBLIC domy\u015Blnie \u2014 dlatego ka\u017Cda funkcja jest wymieniona z nazwy.)
REVOKE ALL ON FUNCTION public.mb_log_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_log_purge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_auto_group_emails(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_group_members_now(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_visible_materials(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_resolve_recipients(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_move_email(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_link_hit(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_log_anonymize(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mb_log_purge() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_auto_group_emails(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_group_members_now(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_visible_materials(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_resolve_recipients(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_move_email(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_link_hit(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_log_anonymize(text) TO service_role;

NOTIFY pgrst, 'reload schema';
`;
var SEED_SQL = `
INSERT INTO public.mb_groups (name, color, description, kind) VALUES
 ('POWR\xD3T \u2014 wszyscy uczestnicy', '#C9A24A', 'Wszyscy, kt\xF3rzy przeszli przez POWR\xD3T.', 'RECZNA'),
 ('Kohorta 1', '#BC1E22', 'Pierwsza grupa startowa.', 'RECZNA'),
 ('Rozmowa na progu', '#8A8A8C', 'Osoby po rozmowie wst\u0119pnej.', 'RECZNA'),
 ('Alumni', '#3D3D3F', 'Po zako\u0144czeniu programu.', 'RECZNA')
ON CONFLICT (name) DO NOTHING;
`;
var CHECKPOINT_TABLES_SQL = `
SELECT c.relname AS tabela,
       c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS polityki,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname LIKE 'mb\\_%'
ORDER BY c.relname`;
var CHECKPOINT_FUNCS_SQL = `
SELECT p.proname AS funkcja,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       (p.prosecdef) AS security_definer,
       (p.proconfig IS NOT NULL) AS search_path_ustawiony
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'mb\\_%'
ORDER BY p.proname`;

// functions/_shared/libraryRpcSql.ts
var LIBRARY_RPC_SQL = `
-- ============ USTAWIENIA (jedno miejsce prawdy) ============
CREATE OR REPLACE FUNCTION public.mb_lib_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ls$
  SELECT COALESCE(
    (SELECT jsonb_build_object('library_mode', s.library_mode, 'messages_mode', s.messages_mode,
       'email_notify', s.email_notify, 'whatsapp', s.whatsapp, 'space_limit_mb', s.space_limit_mb)
       FROM public.mb_settings s WHERE s.id = 1),
    jsonb_build_object('library_mode','off','messages_mode','off','email_notify',false,'whatsapp',NULL,'space_limit_mb',5120))
$ls$;

-- ============ ZU\u017BYCIE PRZESTRZENI ============
CREATE OR REPLACE FUNCTION public.mb_admin_space() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $sp$
WITH u AS (
  SELECT COALESCE(sum(COALESCE(file_size,0) + COALESCE(prev_file_size,0)),0)::bigint AS bytes,
         count(*)::int AS files
    FROM public.mb_materials WHERE deleted_at IS NULL AND file_key IS NOT NULL
), lim AS (SELECT COALESCE((SELECT space_limit_mb FROM public.mb_settings WHERE id = 1), 5120)::bigint AS mb)
SELECT jsonb_build_object('bytes', u.bytes, 'files', u.files, 'limit_mb', lim.mb,
  'procent', LEAST(100, GREATEST(0, round(u.bytes * 100.0 / (lim.mb * 1048576)))))
FROM u, lim
$sp$;

-- ============ KLIENT: BIBLIOTEKA ============
-- Dok\u0142adnie te same pola co dot\u0105d w itemOf(): bez kluczy plik\xF3w, bez nazw grup, bez list odbiorc\xF3w.
-- Tre\u015B\u0107 i odtwarzacze (embed) sk\u0142ada warstwa JS \u2014 tu wracaj\u0105 tylko dane.
CREATE OR REPLACE FUNCTION public.mb_client_library(p_email text, p_admin boolean DEFAULT false, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cl$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
v AS (SELECT * FROM public.mb_visible_materials(p_email, p_admin)),
m AS (
  SELECT mm.id, mm.title, mm.kind, mm.description, mm.duration_s, mm.pages, mm.stage, mm.tags,
         mm.external_url, mm.video_provider, mm.video_id, mm.body_html, mm.allow_download,
         (mm.file_key IS NOT NULL) AS has_file
    FROM public.mb_materials mm JOIN v ON v.material_id = mm.id
   WHERE mm.deleted_at IS NULL
),
st AS (
  SELECT s.material_id, s.opened_at, s.completed_at
    FROM public.mb_material_state s, me
   WHERE s.client_email = me.mail AND NOT p_preview
),
it AS (
  SELECT jsonb_build_object(
    'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description,
    'duration_s', m.duration_s, 'pages', m.pages, 'stage', m.stage, 'tags', m.tags,
    'note', v.note, 'visible_from', v.visible_from, 'visible_to', v.visible_to,
    'collection_id', v.collection_id, 'position', v.pos,
    'opened_at', st.opened_at, 'completed_at', st.completed_at,
    'has_file', m.has_file, 'allow_download', m.allow_download,
    'external_url', m.external_url, 'video_provider', m.video_provider, 'video_id', m.video_id,
    'body_html', m.body_html) AS j,
    m.kind, v.collection_id, v.pos, m.title, st.opened_at
  FROM m JOIN v ON v.material_id = m.id LEFT JOIN st ON st.material_id = m.id
),
col AS (
  SELECT c.id, c.title, c.description,
    COALESCE((SELECT jsonb_agg(x.j ORDER BY x.pos, x.title) FROM it x WHERE x.collection_id = c.id), '[]'::jsonb) AS items
  FROM public.mb_collections c
  WHERE c.deleted_at IS NULL AND c.id IN (SELECT DISTINCT collection_id FROM it WHERE collection_id IS NOT NULL)
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(j ORDER BY kind, title) FROM it), '[]'::jsonb),
  'collections', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', col.id, 'title', col.title,
     'description', col.description, 'items', col.items) ORDER BY col.title) FROM col), '[]'::jsonb),
  'counts', jsonb_build_object(
    'AUDIO', (SELECT count(*) FROM it WHERE kind = 'AUDIO'),
    'WIDEO', (SELECT count(*) FROM it WHERE kind = 'WIDEO'),
    'PDF',   (SELECT count(*) FROM it WHERE kind = 'PDF'),
    'LINK',  (SELECT count(*) FROM it WHERE kind = 'LINK'),
    'TEKST', (SELECT count(*) FROM it WHERE kind = 'TEKST')),
  'unopened', (SELECT count(*) FROM it WHERE opened_at IS NULL))
$cl$;

-- ============ KLIENT: WIADOMO\u015ACI ============
CREATE OR REPLACE FUNCTION public.mb_client_messages(p_email text, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
r AS (
  SELECT m.id, m.title, m.body_html, m.sent_at, m.attached_material_id, m.attached_collection_id,
         rr.read_at, mt.title AS material_title, mt.kind AS material_kind, cl.title AS collection_title
    FROM public.mb_message_recipients rr
    JOIN public.mb_messages m ON m.id = rr.message_id
    LEFT JOIN public.mb_materials mt ON mt.id = m.attached_material_id AND mt.deleted_at IS NULL
    LEFT JOIN public.mb_collections cl ON cl.id = m.attached_collection_id AND cl.deleted_at IS NULL
   WHERE rr.client_email = (SELECT mail FROM me) AND m.status = 'WYSLANA' AND rr.hidden_at IS NULL
   ORDER BY m.sent_at DESC NULLS LAST LIMIT 100
),
it AS (
  SELECT jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'sent_at', r.sent_at,
    'read_at', r.read_at, 'material_id', r.attached_material_id, 'collection_id', r.attached_collection_id,
    'material_title', r.material_title, 'material_kind', r.material_kind, 'collection_title', r.collection_title) AS j,
    r.sent_at, r.read_at
  FROM r
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sent_at DESC NULLS LAST) FROM it), '[]'::jsonb),
  'unread', CASE WHEN p_preview THEN 0 ELSE (SELECT count(*) FROM it WHERE it.read_at IS NULL) END)
$cm$;

-- ============ KLIENT: JEDNO WEJ\u015ACIE ============
-- /konto dostaje prze\u0142\u0105czniki, bibliotek\u0119 i wiadomo\u015Bci jednym wywo\u0142aniem (zamiast 3\u20134).
CREATE OR REPLACE FUNCTION public.mb_client_bundle(p_email text, p_admin boolean DEFAULT false, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $cb$
DECLARE
  s jsonb;
  lm text;
  mm text;
BEGIN
  s := public.mb_lib_settings();
  lm := s->>'library_mode';
  mm := s->>'messages_mode';
  RETURN jsonb_build_object(
    'library_mode', lm,
    'messages_mode', mm,
    'whatsapp', s->'whatsapp',
    'library', CASE WHEN lm = 'on' OR (lm = 'admin' AND p_admin)
      THEN public.mb_client_library(p_email, p_admin, p_preview) ELSE NULL END,
    'messages', CASE WHEN mm = 'on' OR (mm = 'admin' AND p_admin)
      THEN public.mb_client_messages(p_email, p_preview) ELSE NULL END);
END $cb$;

-- ============ KLIENT: OTWARCIE MATERIA\u0141U ============
-- Sprawdzenie dost\u0119pu + dane materia\u0142u + limit link\xF3w + zapis \u201Eotwarte" w jednym wywo\u0142aniu.
-- Podpisany adres pliku nadal powstaje w warstwie funkcji \u2014 klucz pliku nigdy nie trafia do przegl\u0105darki.
CREATE OR REPLACE FUNCTION public.mb_client_open(p_email text, p_admin boolean, p_material_id uuid,
  p_mark_opened boolean DEFAULT true, p_rate_key text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $co$
DECLARE
  mail text := lower(btrim(COALESCE(p_email,'')));
  m record;
  r text;
BEGIN
  IF p_material_id IS NULL THEN RETURN jsonb_build_object('status','denied'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mb_visible_materials(p_email, p_admin) v WHERE v.material_id = p_material_id) THEN
    RETURN jsonb_build_object('status','denied');
  END IF;
  SELECT mm.id, mm.title, mm.kind, mm.file_key, mm.external_url, mm.video_provider, mm.video_id, mm.body_html, mm.allow_download
    INTO m FROM public.mb_materials mm WHERE mm.id = p_material_id AND mm.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','denied'); END IF;

  IF p_rate_key IS NOT NULL THEN
    r := public.mb_link_hit(p_rate_key, COALESCE(p_limit, 30));
    IF r <> 'ok' THEN RETURN jsonb_build_object('status','rate'); END IF;
  END IF;

  IF p_mark_opened THEN
    INSERT INTO public.mb_material_state (client_email, material_id, opened_at)
    VALUES (mail, p_material_id, now())
    ON CONFLICT (client_email, material_id)
    DO UPDATE SET opened_at = COALESCE(public.mb_material_state.opened_at, EXCLUDED.opened_at);
  END IF;

  RETURN jsonb_build_object('status','ok','material', jsonb_build_object(
    'id', m.id, 'title', m.title, 'kind', m.kind, 'file_key', m.file_key, 'external_url', m.external_url,
    'video_provider', m.video_provider, 'video_id', m.video_id, 'body_html', m.body_html, 'allow_download', m.allow_download));
END $co$;

-- ============ KLIENT: OZNACZENIE MATERIA\u0141U ============
CREATE OR REPLACE FUNCTION public.mb_material_complete(p_email text, p_admin boolean, p_material_id uuid, p_completed boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mc$
DECLARE mail text := lower(btrim(COALESCE(p_email,'')));
BEGIN
  IF p_material_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mb_visible_materials(p_email, p_admin) v WHERE v.material_id = p_material_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.mb_material_state (client_email, material_id, completed_at)
  VALUES (mail, p_material_id, CASE WHEN p_completed THEN now() ELSE NULL END)
  ON CONFLICT (client_email, material_id)
  DO UPDATE SET completed_at = CASE WHEN p_completed THEN now() ELSE NULL END;
  RETURN true;
END $mc$;

-- ============ KLIENT: PRZECZYTANE / UKRYTE ============
-- Brak wiersza odbiorcy = cudza wiadomo\u015B\u0107 = odmowa bez ujawniania czegokolwiek.
CREATE OR REPLACE FUNCTION public.mb_message_flag(p_email text, p_message_id uuid, p_hidden boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mf$
DECLARE
  mail text := lower(btrim(COALESCE(p_email,'')));
  k int;
BEGIN
  IF p_message_id IS NULL THEN RETURN false; END IF;
  IF p_hidden THEN
    UPDATE public.mb_message_recipients SET hidden_at = COALESCE(hidden_at, now())
     WHERE message_id = p_message_id AND client_email = mail;
  ELSE
    UPDATE public.mb_message_recipients SET read_at = COALESCE(read_at, now())
     WHERE message_id = p_message_id AND client_email = mail;
  END IF;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k > 0;
END $mf$;

-- ============ PANEL: ODCZYTY ============
CREATE OR REPLACE FUNCTION public.mb_admin_materials(p_kind text DEFAULT NULL, p_q text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $am$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description, 'stage', m.stage, 'tags', m.tags,
  'file_version', m.file_version, 'file_size', m.file_size, 'prev_file_size', m.prev_file_size,
  'prev_file_name', m.prev_file_name, 'pdf_js_warning', m.pdf_js_warning, 'external_url', m.external_url,
  'video_provider', m.video_provider, 'video_id', m.video_id, 'duration_s', m.duration_s, 'pages', m.pages,
  'allow_download', m.allow_download, 'body_html', m.body_html, 'created_at', m.created_at, 'source', m.source,
  'przydzialy', (SELECT count(*) FROM public.mb_assignments x WHERE x.revoked_at IS NULL
     AND (x.material_id = m.id OR x.collection_id IN
       (SELECT ci.collection_id FROM public.mb_collection_items ci WHERE ci.material_id = m.id))),
  'otwarte', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.opened_at IS NOT NULL),
  'ukonczone', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.completed_at IS NOT NULL)
) ORDER BY m.created_at DESC), '[]'::jsonb)
FROM (
  SELECT * FROM public.mb_materials mm
   WHERE mm.deleted_at IS NULL
     AND (p_kind IS NULL OR mm.kind = p_kind)
     AND (p_q IS NULL OR p_q = '' OR mm.title ILIKE '%' || p_q || '%' OR COALESCE(mm.description,'') ILIKE '%' || p_q || '%')
   ORDER BY mm.created_at DESC LIMIT 500
) m
$am$;

CREATE OR REPLACE FUNCTION public.mb_admin_collections() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acl$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', c.id, 'title', c.title, 'description', c.description, 'sort', c.sort, 'created_at', c.created_at,
  'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('material_id', ci.material_id, 'position', ci.position,
      'title', mm.title, 'kind', mm.kind) ORDER BY ci.position)
    FROM public.mb_collection_items ci
    LEFT JOIN public.mb_materials mm ON mm.id = ci.material_id AND mm.deleted_at IS NULL
    WHERE ci.collection_id = c.id), '[]'::jsonb)
) ORDER BY c.sort, c.created_at), '[]'::jsonb)
FROM public.mb_collections c WHERE c.deleted_at IS NULL
$acl$;

-- Grupy z cz\u0142onkami liczonymi od razu w bazie \u2014 tak\u017Ce automatycznymi (bez wywo\u0142ania na grup\u0119).
CREATE OR REPLACE FUNCTION public.mb_admin_groups() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ag$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', g.id, 'name', g.name, 'color', g.color, 'description', g.description, 'kind', g.kind, 'rule', g.rule,
  'accepted_at', g.accepted_at, 'created_at', g.created_at,
  'members', COALESCE((SELECT jsonb_agg(e.email ORDER BY e.email) FROM public.mb_group_members_now(g.id) e), '[]'::jsonb),
  'count', (SELECT count(*) FROM public.mb_group_members_now(g.id) e)
) ORDER BY g.kind, g.name), '[]'::jsonb)
FROM public.mb_groups g
$ag$;

CREATE OR REPLACE FUNCTION public.mb_admin_messages() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ams$
WITH src AS (
  SELECT m.*, g.name AS group_name
    FROM public.mb_messages m
    LEFT JOIN public.mb_groups g ON g.id = NULLIF(m.target->>'group_id','')::uuid
   ORDER BY COALESCE(m.sent_at, m.send_at, m.created_at) DESC LIMIT 200
),
it AS (
  SELECT jsonb_build_object(
    'id', s.id, 'title', s.title, 'body_html', s.body_html, 'status', s.status, 'send_at', s.send_at,
    'email_mode', s.email_mode, 'recipient_count', s.recipient_count, 'attached_material_id', s.attached_material_id,
    'attached_collection_id', s.attached_collection_id, 'target', s.target, 'created_at', s.created_at,
    'sent_at', s.sent_at, 'withdrawn_at', s.withdrawn_at, 'group_name', s.group_name,
    'dostarczone', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id),
    'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id AND r.read_at IS NOT NULL)
  ) AS j, COALESCE(s.sent_at, s.send_at, s.created_at) AS sort
  FROM src s
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sort DESC) FROM it), '[]'::jsonb),
  'liczniki', (SELECT jsonb_build_object(
    'wyslane', count(*) FILTER (WHERE status = 'WYSLANA'),
    'zaplanowane', count(*) FILTER (WHERE status = 'ZAPLANOWANA'),
    'szkice', count(*) FILTER (WHERE status = 'SZKIC'),
    'wycofane', count(*) FILTER (WHERE status = 'WYCOFANA')) FROM public.mb_messages))
$ams$;

CREATE OR REPLACE FUNCTION public.mb_admin_dashboard() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ad$
SELECT jsonb_build_object(
  'zaplanowane_dzis', (SELECT count(*) FROM public.mb_messages WHERE status = 'ZAPLANOWANA'
     AND (send_at AT TIME ZONE 'Europe/Warsaw')::date = (now() AT TIME ZONE 'Europe/Warsaw')::date),
  'odblokowuje_sie', (SELECT count(*) FROM public.mb_assignments WHERE revoked_at IS NULL
     AND visible_from IS NOT NULL AND visible_from > now() AND visible_from < now() + interval '7 days'),
  'przestrzen', public.mb_admin_space(),
  'tryby', public.mb_lib_settings(),
  'ostatnia', (SELECT jsonb_build_object('id', m.id, 'title', m.title, 'sent_at', m.sent_at,
     'dostarczone', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = m.id),
     'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = m.id AND r.read_at IS NOT NULL))
     FROM public.mb_messages m WHERE m.status = 'WYSLANA' ORDER BY m.sent_at DESC LIMIT 1))
$ad$;

-- Fakty o klientach z tabel mb_* (grupy r\u0119czne i automatyczne, aktywny pakiet) \u2014 bez listy kont Base44.
CREATE OR REPLACE FUNCTION public.mb_admin_clients_mb() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acm$
WITH g AS (SELECT gg.id, gg.name, gg.color, gg.kind, gg.rule FROM public.mb_groups gg),
members AS (
  SELECT lower(btrim(m.client_email)) AS email, m.group_id FROM public.mb_group_members m
  UNION
  SELECT lower(btrim(e.email)) AS email, g.id AS group_id
    FROM g, public.mb_auto_group_emails(g.rule) e WHERE g.kind = 'AUTOMATYCZNA'
),
pkg AS (
  SELECT DISTINCT lower(btrim(email_display)) AS email FROM public.bk_packages
   WHERE payment_status = 'oplacony' AND valid_until > now() AND sessions_used < sessions_total AND email_display IS NOT NULL
),
emails AS (SELECT email FROM members WHERE email <> '' UNION SELECT email FROM pkg WHERE email <> ''),
rows AS (
  SELECT jsonb_build_object('email', e.email,
    'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', gg.id, 'name', gg.name, 'color', gg.color, 'kind', gg.kind) ORDER BY gg.name)
      FROM g gg WHERE gg.id IN (SELECT mm.group_id FROM members mm WHERE mm.email = e.email)), '[]'::jsonb),
    'package', EXISTS (SELECT 1 FROM pkg p WHERE p.email = e.email)) AS j, e.email
  FROM emails e
)
SELECT COALESCE(jsonb_agg(j ORDER BY email), '[]'::jsonb) FROM rows
$acm$;

CREATE OR REPLACE FUNCTION public.mb_admin_client_mb(p_email text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acd$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
g AS (
  SELECT gg.id, gg.name, gg.color, gg.kind FROM public.mb_groups gg
   WHERE (gg.kind = 'RECZNA' AND EXISTS (SELECT 1 FROM public.mb_group_members m
            WHERE m.group_id = gg.id AND m.client_email = (SELECT mail FROM me)))
      OR (gg.kind = 'AUTOMATYCZNA' AND (SELECT mail FROM me) IN
            (SELECT e.email FROM public.mb_auto_group_emails(gg.rule) e))
)
SELECT jsonb_build_object(
  'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'kind', g.kind) ORDER BY g.name) FROM g), '[]'::jsonb),
  'packages', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', p.id, 'sessions_total', p.sessions_total, 'sessions_used', p.sessions_used,
       'valid_until', p.valid_until, 'payment_status', p.payment_status, 'source', p.source, 'created_at', p.created_at) AS j,
       p.created_at
     FROM public.bk_packages p WHERE lower(btrim(p.email_display)) = (SELECT mail FROM me)
     ORDER BY p.created_at DESC LIMIT 20) x), '[]'::jsonb),
  'sends', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.sent_at DESC NULLS LAST) FROM (
     SELECT jsonb_build_object('id', m.id, 'title', m.title, 'sent_at', m.sent_at, 'read_at', r.read_at, 'hidden_at', r.hidden_at) AS j,
       m.sent_at
     FROM public.mb_message_recipients r JOIN public.mb_messages m ON m.id = r.message_id
     WHERE r.client_email = (SELECT mail FROM me) ORDER BY m.sent_at DESC NULLS LAST LIMIT 50) x), '[]'::jsonb),
  'assignments', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', a.id, 'material_id', a.material_id, 'collection_id', a.collection_id, 'note', a.note,
       'visible_from', a.visible_from, 'visible_to', a.visible_to, 'target_kind', a.target_kind, 'group_id', a.group_id,
       'group_name', gg.name, 'material_title', mm.title, 'collection_title', cc.title) AS j, a.created_at
     FROM public.mb_assignments a
     LEFT JOIN public.mb_groups gg ON gg.id = a.group_id
     LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
     LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
     WHERE a.revoked_at IS NULL AND (
       a.target_email = (SELECT mail FROM me)
       OR a.group_id IN (SELECT m.group_id FROM public.mb_group_members m WHERE m.client_email = (SELECT mail FROM me))
       OR a.group_id IN (SELECT g2.id FROM public.mb_groups g2 WHERE g2.kind = 'AUTOMATYCZNA'
            AND (SELECT mail FROM me) IN (SELECT e.email FROM public.mb_auto_group_emails(g2.rule) e)))
     ORDER BY a.created_at DESC LIMIT 200) x), '[]'::jsonb))
$acd$;

CREATE OR REPLACE FUNCTION public.mb_admin_group_detail(p_group uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $agd$
SELECT jsonb_build_object(
  'group', (SELECT jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'description', g.description,
     'kind', g.kind, 'rule', g.rule, 'accepted_at', g.accepted_at) FROM public.mb_groups g WHERE g.id = p_group),
  'members', COALESCE((SELECT jsonb_agg(e.email ORDER BY e.email) FROM public.mb_group_members_now(p_group) e), '[]'::jsonb),
  'materials', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', a.id, 'material_id', a.material_id, 'collection_id', a.collection_id,
       'material_title', m.title, 'collection_title', c.title, 'visible_from', a.visible_from,
       'visible_to', a.visible_to, 'created_at', a.created_at) AS j, a.created_at
     FROM public.mb_assignments a
     LEFT JOIN public.mb_materials m ON m.id = a.material_id AND m.deleted_at IS NULL
     LEFT JOIN public.mb_collections c ON c.id = a.collection_id AND c.deleted_at IS NULL
     WHERE a.group_id = p_group AND a.revoked_at IS NULL ORDER BY a.created_at DESC LIMIT 200) x), '[]'::jsonb),
  'messages', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.sort DESC) FROM (
     SELECT jsonb_build_object('id', mm.id, 'title', mm.title, 'status', mm.status, 'sent_at', mm.sent_at,
       'send_at', mm.send_at, 'recipient_count', mm.recipient_count, 'created_at', mm.created_at,
       'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = mm.id AND r.read_at IS NOT NULL)) AS j,
       COALESCE(mm.sent_at, mm.send_at, mm.created_at) AS sort
     FROM public.mb_messages mm
     WHERE mm.target->>'kind' = 'grupa' AND mm.target->>'group_id' = p_group::text
     ORDER BY COALESCE(mm.sent_at, mm.send_at, mm.created_at) DESC LIMIT 50) x), '[]'::jsonb))
$agd$;

CREATE OR REPLACE FUNCTION public.mb_admin_history(p_action text DEFAULT NULL, p_days int DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ah$
WITH it AS (
  SELECT jsonb_build_object('at', l.at, 'actor', l.actor, 'action', l.action, 'object_type', l.object_type,
    'object_id', l.object_id, 'summary', l.summary, 'anonymized', l.anonymized) AS j, l.at
  FROM public.mb_log l
  WHERE (p_action IS NULL OR l.action = p_action)
    AND (p_days IS NULL OR l.at > now() - make_interval(days => p_days))
  ORDER BY l.at DESC LIMIT 300
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.at DESC) FROM it), '[]'::jsonb),
  'akcje', COALESCE((SELECT jsonb_agg(DISTINCT a.action ORDER BY a.action) FROM public.mb_log a), '[]'::jsonb))
$ah$;

-- Podgl\u0105d odbiorc\xF3w: same adresy \u2014 imiona dok\u0142ada warstwa funkcji (konta Base44).
CREATE OR REPLACE FUNCTION public.mb_admin_assignment_preview(p_target jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ap$
SELECT COALESCE(jsonb_agg(e.email ORDER BY e.email), '[]'::jsonb) FROM public.mb_resolve_recipients(p_target) e
$ap$;

-- ============ PANEL: ZAPISY ============
CREATE OR REPLACE FUNCTION public.mb_admin_assignment_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $asv$
DECLARE
  mat uuid := NULLIF(p->>'material_id','')::uuid;
  col uuid := NULLIF(p->>'collection_id','')::uuid;
  kind text := CASE WHEN p->>'target_kind' = 'grupa' THEN 'grupa' ELSE 'osoba' END;
  tgt text := NULLIF(lower(btrim(COALESCE(p->>'target_email',''))), '');
  gid uuid := NULLIF(p->>'group_id','')::uuid;
  gmode text := NULLIF(p->>'group_mode','');
  snap text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'snapshot_emails','[]')) x), '{}'::text[]);
  addx text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'exceptions_add','[]')) x), '{}'::text[]);
  dropx text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'exceptions_drop','[]')) x), '{}'::text[]);
  vf timestamptz := NULLIF(p->>'visible_from','')::timestamptz;
  vt timestamptz := NULLIF(p->>'visible_to','')::timestamptz;
  who text := COALESCE(NULLIF(p->>'actor',''), 'system');
  tgtjson jsonb;
  newid uuid;
  rec int;
BEGIN
  IF (mat IS NULL) = (col IS NULL) THEN RAISE EXCEPTION 'material albo kolekcja, nie oba'; END IF;
  IF kind = 'osoba' THEN
    IF tgt IS NULL OR position('@' in tgt) = 0 THEN RAISE EXCEPTION 'brak osoby'; END IF;
    gid := NULL; gmode := NULL; snap := '{}'; addx := '{}'; dropx := '{}';
    tgtjson := jsonb_build_object('kind','osoba','emails', jsonb_build_array(tgt));
  ELSE
    IF gid IS NULL THEN RAISE EXCEPTION 'brak grupy'; END IF;
    gmode := CASE WHEN gmode = 'TYLKO_OBECNI' THEN 'TYLKO_OBECNI' ELSE 'OBECNI_I_PRZYSZLI' END;
    tgt := NULL;
    IF gmode = 'TYLKO_OBECNI' THEN
      SELECT COALESCE(array_agg(DISTINCT lower(btrim(m.client_email))), '{}'::text[])
        INTO snap FROM public.mb_group_members m WHERE m.group_id = gid;
    ELSE
      snap := '{}';
    END IF;
    tgtjson := jsonb_build_object('kind','grupa','group_id', gid, 'group_mode', gmode,
      'snapshot_emails', to_jsonb(snap), 'exceptions_add', to_jsonb(addx), 'exceptions_drop', to_jsonb(dropx));
  END IF;

  INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, group_id, group_mode,
    snapshot_emails, exceptions_add, exceptions_drop, note, visible_from, visible_to, created_by)
  VALUES (mat, col, kind, tgt, gid, gmode, snap, addx, dropx,
    NULLIF(p->>'note',''), vf, vt, who)
  RETURNING id INTO newid;

  SELECT count(*) INTO rec FROM public.mb_resolve_recipients(tgtjson) r;
  RETURN jsonb_build_object('id', newid, 'count', rec);
END $asv$;

CREATE OR REPLACE FUNCTION public.mb_admin_assignment_bulk(p_material uuid, p_emails text[], p_note text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $ab$
WITH ins AS (
  INSERT INTO public.mb_assignments (material_id, target_kind, target_email, note, visible_from, visible_to, created_by)
  SELECT p_material, 'osoba', lower(btrim(e)), p_note, p_from, p_to, COALESCE(p_actor, 'system')
    FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
  RETURNING 1
)
SELECT count(*)::int FROM ins
$ab$;

CREATE OR REPLACE FUNCTION public.mb_admin_assignment_revoke(p_id uuid DEFAULT NULL, p_material uuid DEFAULT NULL,
  p_collection uuid DEFAULT NULL, p_group uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ar$
DECLARE k int;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE public.mb_assignments SET revoked_at = now() WHERE id = p_id AND revoked_at IS NULL;
    GET DIAGNOSTICS k = ROW_COUNT;
    RETURN k;
  END IF;
  IF p_group IS NULL OR (p_material IS NULL AND p_collection IS NULL) THEN RETURN 0; END IF;
  UPDATE public.mb_assignments SET revoked_at = now()
   WHERE revoked_at IS NULL AND group_id = p_group
     AND ((p_material IS NOT NULL AND material_id = p_material)
       OR (p_collection IS NOT NULL AND collection_id = p_collection));
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $ar$;

CREATE OR REPLACE FUNCTION public.mb_admin_group_members(p_group uuid, p_emails text[], p_add boolean, p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $agm$
DECLARE k int;
BEGIN
  IF p_group IS NULL THEN RETURN 0; END IF;
  IF p_add THEN
    INSERT INTO public.mb_group_members (group_id, client_email, added_by)
    SELECT p_group, lower(btrim(e)), COALESCE(p_actor, 'system') FROM unnest(p_emails) AS e
     WHERE lower(btrim(e)) <> ''
    ON CONFLICT (group_id, client_email) DO NOTHING;
  ELSE
    DELETE FROM public.mb_group_members m WHERE m.group_id = p_group
      AND m.client_email IN (SELECT lower(btrim(e)) FROM unnest(p_emails) AS e);
  END IF;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $agm$;

-- ============ PANEL: MATERIA\u0141Y (ZAPIS) ============
-- Dodanie albo zmiana materia\u0142u. Kolumny w\u0142a\u015Bciwe dla rodzaju ustawia baza, wi\u0119c warstwa
-- funkcji nie skleja SQL-a \u2014 wysy\u0142a tylko warto\u015Bci.
CREATE OR REPLACE FUNCTION public.mb_admin_material_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ms$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  k text := p->>'kind';
  vurl text := NULLIF(btrim(COALESCE(p->>'external_url','')), '');
  vprov text := NULLIF(p->>'video_provider','');
  vid text := NULLIF(p->>'video_id','');
  vhtml text := NULLIF(p->>'body_html','');
  vkeep boolean := COALESCE((p->>'keep_video')::boolean, false);
  out_id uuid;
BEGIN
  IF k IS NULL OR k NOT IN ('AUDIO','WIDEO','PDF','LINK','TEKST') THEN RAISE EXCEPTION 'nieznany rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;

  IF k = 'LINK' THEN
    IF vurl IS NULL OR vurl NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu'; END IF;
    vprov := NULL; vid := NULL; vhtml := NULL;
  ELSIF k = 'WIDEO' THEN
    vurl := NULL; vhtml := NULL;
    IF vkeep THEN vprov := NULL; vid := NULL; END IF;
  ELSIF k = 'TEKST' THEN
    IF vhtml IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
    vurl := NULL; vprov := NULL; vid := NULL;
  ELSE
    vurl := NULL; vprov := NULL; vid := NULL; vhtml := NULL;
  END IF;

  IF mid IS NULL THEN
    IF k IN ('PDF','AUDIO') THEN RAISE EXCEPTION 'najpierw plik'; END IF;
    INSERT INTO public.mb_materials (kind, title, description, stage, tags, duration_s, pages, allow_download,
      source, external_url, video_provider, video_id, body_html, created_by)
    VALUES (k, btrim(p->>'title'), NULLIF(p->>'description',''), NULLIF(p->>'stage',''),
      COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      NULLIF(p->>'duration_s','')::int, NULLIF(p->>'pages','')::int,
      COALESCE((p->>'allow_download')::boolean, false), NULLIF(p->>'source',''),
      vurl, vprov, vid, vhtml, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_materials SET
      kind = k, title = btrim(p->>'title'), description = NULLIF(p->>'description',''),
      stage = NULLIF(p->>'stage',''),
      tags = COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      duration_s = NULLIF(p->>'duration_s','')::int, pages = NULLIF(p->>'pages','')::int,
      allow_download = COALESCE((p->>'allow_download')::boolean, false), source = NULLIF(p->>'source',''),
      external_url = vurl,
      video_provider = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_provider ELSE vprov END,
      video_id = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_id ELSE vid END,
      body_html = vhtml, updated_at = now()
    WHERE id = mid AND deleted_at IS NULL
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $ms$;

-- Rejestracja pliku po sprawdzeniu sygnatury i rozmiaru (samo wgranie zostaje w warstwie funkcji).
CREATE OR REPLACE FUNCTION public.mb_admin_material_register(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mrg$
DECLARE out_id uuid;
BEGIN
  IF p->>'kind' IS NULL OR p->>'kind' NOT IN ('AUDIO','PDF') THEN RAISE EXCEPTION 'zly rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;
  INSERT INTO public.mb_materials (kind, title, file_key, file_name, file_size, pdf_js_warning, created_by)
  VALUES (p->>'kind', btrim(p->>'title'), p->>'file_key', p->>'file_name',
    NULLIF(p->>'file_size','')::bigint, COALESCE((p->>'pdf_js')::boolean, false), NULLIF(p->>'actor',''))
  RETURNING id INTO out_id;
  RETURN jsonb_build_object('id', out_id);
END $mrg$;

-- Ile os\xF3b straci dost\u0119p po usuni\u0119ciu materia\u0142u \u2014 liczone w bazie, bez p\u0119tli po przydzia\u0142ach.
CREATE OR REPLACE FUNCTION public.mb_admin_material_impact(p_material uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mi$
WITH a AS (SELECT * FROM public.mb_assignments WHERE material_id = p_material AND revoked_at IS NULL),
pp AS (SELECT DISTINCT e.email FROM a, LATERAL public.mb_resolve_recipients(
   CASE WHEN a.target_kind = 'osoba' THEN jsonb_build_object('kind','osoba','emails', jsonb_build_array(a.target_email))
   ELSE jsonb_build_object('kind','grupa','group_id', a.group_id, 'group_mode', a.group_mode,
     'snapshot_emails', to_jsonb(a.snapshot_emails), 'exceptions_add', to_jsonb(a.exceptions_add),
     'exceptions_drop', to_jsonb(a.exceptions_drop)) END) e)
SELECT jsonb_build_object('osoby', (SELECT count(*) FROM pp), 'przydzialy', (SELECT count(*) FROM a))
$mi$;

-- Przydzia\u0142y materia\u0142u/kolekcji: odbiorcy i grupy liczone od razu w bazie.
CREATE OR REPLACE FUNCTION public.mb_admin_assignments_of(p_material uuid DEFAULT NULL, p_collection uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ao$
WITH a AS (
  SELECT x.* FROM public.mb_assignments x
   WHERE (p_material IS NOT NULL AND x.material_id = p_material)
      OR (p_collection IS NOT NULL AND x.collection_id = p_collection)
   ORDER BY x.created_at DESC LIMIT 500
),
pp AS (
  SELECT a.id, e.email FROM a, LATERAL public.mb_resolve_recipients(
    CASE WHEN a.target_kind = 'osoba' THEN jsonb_build_object('kind','osoba','emails', jsonb_build_array(a.target_email))
    ELSE jsonb_build_object('kind','grupa','group_id', a.group_id, 'group_mode', a.group_mode,
      'snapshot_emails', to_jsonb(a.snapshot_emails), 'exceptions_add', to_jsonb(a.exceptions_add),
      'exceptions_drop', to_jsonb(a.exceptions_drop)) END) e
   WHERE a.revoked_at IS NULL
),
it AS (
  SELECT jsonb_build_object('id', a.id, 'target_kind', a.target_kind, 'target_email', a.target_email,
    'group_id', a.group_id, 'group_mode', a.group_mode, 'note', a.note,
    'visible_from', a.visible_from, 'visible_to', a.visible_to, 'created_at', a.created_at, 'revoked_at', a.revoked_at,
    'people', CASE WHEN a.revoked_at IS NULL THEN (SELECT count(*) FROM pp WHERE pp.id = a.id) ELSE 0 END,
    'sample', CASE WHEN a.revoked_at IS NULL THEN COALESCE((SELECT jsonb_agg(x.email ORDER BY x.email) FROM
       (SELECT DISTINCT email FROM pp WHERE pp.id = a.id ORDER BY email LIMIT 5) x), '[]'::jsonb) ELSE '[]'::jsonb END,
    'group', CASE WHEN a.group_id IS NULL THEN NULL ELSE
       (SELECT jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'kind', g.kind)
          FROM public.mb_groups g WHERE g.id = a.group_id) END) AS j,
    a.created_at
  FROM a
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.created_at DESC) FROM it), '[]'::jsonb),
  'odbiorcy', (SELECT count(DISTINCT email) FROM pp),
  'otwarte', CASE WHEN p_material IS NULL THEN NULL ELSE
    (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = p_material AND s.opened_at IS NOT NULL) END)
$ao$;

-- ============ PANEL: WIADOMO\u015ACI (ZAPIS) ============
CREATE OR REPLACE FUNCTION public.mb_admin_message_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mss$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  tgt jsonb := COALESCE(p->'target','{}'::jsonb);
  snap jsonb;
  cnt int;
  out_id uuid;
  st text := CASE WHEN p->>'status' = 'ZAPLANOWANA' THEN 'ZAPLANOWANA' ELSE 'SZKIC' END;
  snd timestamptz := NULLIF(p->>'send_at','')::timestamptz;
BEGIN
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF st = 'ZAPLANOWANA' AND snd IS NULL THEN RAISE EXCEPTION 'brak terminu'; END IF;

  -- Snapshot \u201Etylko obecni" powstaje tu, w tej samej transakcji co zapis.
  IF tgt->>'kind' = 'grupa' AND tgt->>'group_mode' = 'TYLKO_OBECNI' THEN
    SELECT COALESCE(to_jsonb(array_agg(DISTINCT lower(btrim(m.client_email)))), '[]'::jsonb) INTO snap
      FROM public.mb_group_members m WHERE m.group_id = NULLIF(tgt->>'group_id','')::uuid;
    tgt := jsonb_set(tgt, '{snapshot_emails}', COALESCE(snap, '[]'::jsonb));
  END IF;

  SELECT count(*) INTO cnt FROM public.mb_resolve_recipients(tgt) r;

  IF mid IS NULL THEN
    INSERT INTO public.mb_messages (title, body_html, email_mode, attached_material_id, attached_collection_id,
      target, recipient_count, status, send_at, created_by)
    VALUES (NULLIF(p->>'title',''), p->>'body_html', COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      NULLIF(p->>'attached_material_id','')::uuid, NULLIF(p->>'attached_collection_id','')::uuid,
      tgt, cnt, st, snd, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_messages SET title = NULLIF(p->>'title',''), body_html = p->>'body_html',
      email_mode = COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      attached_material_id = NULLIF(p->>'attached_material_id','')::uuid,
      attached_collection_id = NULLIF(p->>'attached_collection_id','')::uuid,
      target = tgt, recipient_count = cnt, status = st, send_at = snd, updated_at = now()
    WHERE id = mid AND status IN ('SZKIC','ZAPLANOWANA')
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id, 'count', cnt);
END $mss$;

-- Atomowe przej\u0119cie wiadomo\u015Bci (ZAPLANOWANA \u2192 WYSYLANIE). p_promote podnosi szkic na \u201Eteraz".
CREATE OR REPLACE FUNCTION public.mb_admin_message_claim(p_id uuid, p_promote boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mcl$
DECLARE r record;
BEGIN
  IF p_id IS NULL THEN RETURN NULL; END IF;
  IF p_promote THEN
    UPDATE public.mb_messages SET status = 'ZAPLANOWANA', send_at = now(), updated_at = now()
     WHERE id = p_id AND status = 'SZKIC';
  END IF;
  UPDATE public.mb_messages
     SET status = 'WYSYLANIE', idem_key = COALESCE(idem_key, 'send:' || id::text), updated_at = now()
   WHERE id = p_id AND status = 'ZAPLANOWANA'
  RETURNING id, title, body_html, email_mode, attached_material_id, attached_collection_id, target INTO r;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'email_mode', r.email_mode,
    'attached_material_id', r.attached_material_id, 'attached_collection_id', r.attached_collection_id, 'target', r.target);
END $mcl$;

-- Domkni\u0119cie wysy\u0142ki: odbiorcy, status i przydzia\u0142 do\u0142\u0105czonego materia\u0142u w jednym wywo\u0142aniu.
CREATE OR REPLACE FUNCTION public.mb_admin_message_finish(p_id uuid, p_emails text[], p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mfn$
DECLARE
  m record;
  n int := 0;
  who text := COALESCE(NULLIF(p_actor,''), 'system');
BEGIN
  IF p_id IS NULL THEN RETURN 0; END IF;
  SELECT target, attached_material_id, attached_collection_id INTO m FROM public.mb_messages WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  n := COALESCE(array_length(p_emails, 1), 0);

  IF n > 0 THEN
    INSERT INTO public.mb_message_recipients (message_id, client_email)
    SELECT p_id, lower(btrim(e)) FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
    ON CONFLICT (message_id, client_email) DO NOTHING;
  END IF;

  UPDATE public.mb_messages SET status = 'WYSLANA', sent_at = now(), recipient_count = n, updated_at = now()
   WHERE id = p_id AND status = 'WYSYLANIE';

  IF m.attached_material_id IS NOT NULL OR m.attached_collection_id IS NOT NULL THEN
    IF m.target->>'kind' = 'grupa' AND NULLIF(m.target->>'group_id','') IS NOT NULL THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, group_id, group_mode,
        snapshot_emails, exceptions_add, exceptions_drop, note, created_by)
      VALUES (m.attached_material_id, m.attached_collection_id, 'grupa', (m.target->>'group_id')::uuid,
        COALESCE(m.target->>'group_mode', 'OBECNI_I_PRZYSZLI'),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'snapshot_emails','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_add','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_drop','[]')) x), '{}'::text[]),
        'do\u0142\u0105czone do wiadomo\u015Bci', who);
    ELSIF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT m.attached_material_id, m.attached_collection_id, 'osoba', lower(btrim(e)), 'do\u0142\u0105czone do wiadomo\u015Bci', who
        FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> '';
    END IF;
  END IF;
  RETURN n;
END $mfn$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_edit(p_id uuid, p_title text, p_body_html text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $med$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET title = NULLIF(p_title,''), body_html = p_body_html, updated_at = now()
   WHERE id = p_id AND status = 'WYSLANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $med$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_cancel(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mca$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET status = 'SZKIC', send_at = NULL, updated_at = now()
   WHERE id = p_id AND status = 'ZAPLANOWANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mca$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_delete(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mdl$
DECLARE k int;
BEGIN
  DELETE FROM public.mb_messages WHERE id = p_id AND status IN ('SZKIC','WYCOFANA');
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mdl$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_withdraw(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mwd$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET status = 'WYCOFANA', withdrawn_at = now(), updated_at = now()
   WHERE id = p_id AND status = 'WYSLANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mwd$;

-- Limit 20 wysy\u0142ek na godzin\u0119 \u2014 jedno zapytanie zamiast osobnego odczytu.
CREATE OR REPLACE FUNCTION public.mb_admin_message_send_rate() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mrt$
SELECT count(*)::int FROM public.mb_messages WHERE sent_at > now() - interval '1 hour'
$mrt$;

-- Wiadomo\u015B\u0107 + adresy nieprzeczytanych (do ponownego powiadomienia) jednym wywo\u0142aniem.
CREATE OR REPLACE FUNCTION public.mb_admin_message_notify(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mnt$
SELECT jsonb_build_object(
  'message', (SELECT jsonb_build_object('id', m.id, 'title', m.title, 'body_html', m.body_html, 'email_mode', m.email_mode)
     FROM public.mb_messages m WHERE m.id = p_id AND m.status = 'WYSLANA'),
  'emails', COALESCE((SELECT jsonb_agg(x.email) FROM
     (SELECT r.client_email AS email FROM public.mb_message_recipients r
       WHERE r.message_id = p_id AND r.read_at IS NULL AND r.hidden_at IS NULL LIMIT 500) x), '[]'::jsonb),
  'niedawno', EXISTS (SELECT 1 FROM public.mb_log l WHERE l.action = 'powiadomienie_ponowne'
     AND l.object_id = p_id::text AND l.at > now() - interval '24 hours'))
$mnt$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_stats(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mst$
SELECT COALESCE(jsonb_agg(jsonb_build_object('client_email', x.client_email, 'delivered_at', x.delivered_at,
  'read_at', x.read_at, 'hidden_at', x.hidden_at) ORDER BY x.read_at DESC NULLS LAST), '[]'::jsonb)
FROM (SELECT * FROM public.mb_message_recipients WHERE message_id = p_id ORDER BY read_at DESC NULLS LAST LIMIT 500) x
$mst$;

-- ============ PANEL: SZABLONY ============
CREATE OR REPLACE FUNCTION public.mb_admin_templates() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mtl$
SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'title', t.title,
  'body_html', t.body_html, 'created_at', t.created_at) ORDER BY t.name), '[]'::jsonb)
FROM public.mb_templates t
$mtl$;

CREATE OR REPLACE FUNCTION public.mb_admin_template_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mts$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  out_id uuid;
BEGIN
  IF NULLIF(btrim(COALESCE(p->>'name','')), '') IS NULL THEN RAISE EXCEPTION 'brak nazwy'; END IF;
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF mid IS NULL THEN
    INSERT INTO public.mb_templates (name, title, body_html, created_by)
    VALUES (btrim(p->>'name'), NULLIF(p->>'title',''), p->>'body_html', NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_templates SET name = btrim(p->>'name'), title = NULLIF(p->>'title',''), body_html = p->>'body_html'
     WHERE id = mid RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $mts$;

CREATE OR REPLACE FUNCTION public.mb_admin_template_delete(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mtd$
DECLARE k int;
BEGIN
  DELETE FROM public.mb_templates WHERE id = p_id;
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mtd$;

-- ============ HISTORIA ZMIAN (ZAPIS) ============
CREATE OR REPLACE FUNCTION public.mb_log_add(p_actor text, p_action text, p_object_type text,
  p_object_id text, p_summary text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $lga$
INSERT INTO public.mb_log (actor, action, object_type, object_id, summary)
VALUES (left(COALESCE(p_actor, 'system'), 200), left(p_action, 60), p_object_type, p_object_id, left(p_summary, 500))
$lga$;

-- ============ USTAWIENIA APLIKACJI (wsp\xF3lne, nie mb_*) ============
-- Ten sam odczyt co getSettingsFast, ale przez PostgREST (Management API to ~1,5 s na zapytanie).
-- Korzystaj\u0105 z niego wszystkie funkcje czytaj\u0105ce Dane firmy i ustawienia SMTP.
CREATE OR REPLACE FUNCTION public.app_settings_get(p_keys text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $asg$
SELECT COALESCE(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
FROM public.app_settings s WHERE s.key = ANY(p_keys)
$asg$;

-- ============ DOST\u0118P: wy\u0142\u0105cznie serwer ============
REVOKE ALL ON FUNCTION public.app_settings_get(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_settings_get(text[]) TO service_role;
REVOKE ALL ON FUNCTION public.mb_lib_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_space() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_library(text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_messages(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_bundle(text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_material_complete(text, boolean, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_message_flag(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_materials(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_collections() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_groups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_dashboard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_clients_mb() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_client_mb(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_group_detail(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_history(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_preview(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_bulk(uuid, text[], text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_revoke(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_group_members(uuid, text[], boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_register(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_impact(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignments_of(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_claim(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_edit(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_cancel(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_withdraw(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_send_rate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_templates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_template_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_template_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_log_add(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mb_lib_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_space() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_library(text, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_messages(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_bundle(text, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_material_complete(text, boolean, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_message_flag(text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_materials(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_collections() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_groups() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_dashboard() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_clients_mb() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_client_mb(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_group_detail(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_history(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_preview(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_bulk(uuid, text[], text, timestamptz, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_revoke(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_group_members(uuid, text[], boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_register(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_impact(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignments_of(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_claim(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_edit(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_cancel(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_delete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_withdraw(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_send_rate() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_notify(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_stats(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_templates() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_template_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_template_delete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_log_add(text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
`;
var CHECKPOINT_RPC_SQL = `
SELECT p.proname AS funkcja,
       p.prosecdef AS security_definer,
       (p.proconfig IS NOT NULL) AS search_path_ustawiony,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'mb\\_%'
ORDER BY p.proname`;

// functions/_shared/library2bSql.ts
var SCHEMA_2B_SQL = `
-- ============ 1. USTAWIENIA: domeny w\u0142asnych plik\xF3w wideo ============
ALTER TABLE public.mb_settings ADD COLUMN IF NOT EXISTS video_domains text[] NOT NULL DEFAULT '{}';

-- ============ 2. MATERIA\u0141Y: trzecie \u017Ar\xF3d\u0142o wideo ============
-- server_url = adres pliku na serwerze w\u0142a\u015Bciciela (tylko z domen wpisanych w ustawieniach).
ALTER TABLE public.mb_materials ADD COLUMN IF NOT EXISTS server_url text
  CHECK (server_url IS NULL OR (server_url ~ '^https://' AND length(server_url) <= 500));

ALTER TABLE public.mb_materials DROP CONSTRAINT IF EXISTS mb_materials_video_provider_check;
ALTER TABLE public.mb_materials ADD CONSTRAINT mb_materials_video_provider_check
  CHECK (video_provider IS NULL OR video_provider IN ('youtube','vimeo','bunny','plik','serwer'));

-- Rodzaj decyduje o \u017Ar\xF3dle tre\u015Bci. WIDEO ma teraz TRZY wykluczaj\u0105ce si\u0119 \u017Ar\xF3d\u0142a.
ALTER TABLE public.mb_materials DROP CONSTRAINT IF EXISTS mb_materials_check;
ALTER TABLE public.mb_materials ADD CONSTRAINT mb_materials_zrodlo_check CHECK (CASE kind
  WHEN 'AUDIO' THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'PDF'   THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'WIDEO' THEN external_url IS NULL AND body_html IS NULL AND (
       (video_provider IN ('youtube','vimeo','bunny') AND video_id IS NOT NULL AND file_key IS NULL AND server_url IS NULL)
    OR (video_provider = 'plik'   AND file_key IS NOT NULL AND video_id IS NULL AND server_url IS NULL)
    OR (video_provider = 'serwer' AND server_url IS NOT NULL AND file_key IS NULL AND video_id IS NULL))
  WHEN 'LINK'  THEN file_key IS NULL AND external_url IS NOT NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'TEKST' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NOT NULL AND server_url IS NULL
END);

-- ============ 3. ZA\u0141\u0104CZNIKI WIADOMO\u015ACI ============
-- Dok\u0142adnie jedno z dw\xF3ch: materia\u0142 albo kolekcja. Do 10 pozycji na wiadomo\u015B\u0107 (pilnuje funkcja zapisu).
CREATE TABLE IF NOT EXISTS public.mb_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mb_messages(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0 CHECK (position >= 0),
  CHECK ((material_id IS NOT NULL) <> (collection_id IS NOT NULL)),
  UNIQUE (message_id, material_id),
  UNIQUE (message_id, collection_id),
  UNIQUE (message_id, position)
);
CREATE INDEX IF NOT EXISTS mb_msg_att_msg ON public.mb_message_attachments (message_id, position);

-- Stare kolumny attached_* zostaj\u0105. Istniej\u0105ce warto\u015Bci przepisujemy raz do nowej tabeli.
INSERT INTO public.mb_message_attachments (message_id, material_id, collection_id, position)
SELECT m.id, m.attached_material_id, m.attached_collection_id, 0
  FROM public.mb_messages m
 WHERE m.attached_material_id IS NOT NULL OR m.attached_collection_id IS NOT NULL
ON CONFLICT DO NOTHING;

DO $x$ BEGIN
  ALTER TABLE public.mb_message_attachments ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.mb_message_attachments FROM PUBLIC, anon, authenticated;
END $x$;
`;
var RPC_2B_SQL = `
-- ============ USTAWIENIA (z domenami wideo) ============
CREATE OR REPLACE FUNCTION public.mb_lib_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ls$
  SELECT COALESCE(
    (SELECT jsonb_build_object('library_mode', s.library_mode, 'messages_mode', s.messages_mode,
       'email_notify', s.email_notify, 'whatsapp', s.whatsapp, 'space_limit_mb', s.space_limit_mb,
       'video_domains', s.video_domains)
       FROM public.mb_settings s WHERE s.id = 1),
    jsonb_build_object('library_mode','off','messages_mode','off','email_notify',false,'whatsapp',NULL,
       'space_limit_mb',5120,'video_domains','[]'::jsonb))
$ls$;

-- Zapis ustawie\u0144 modu\u0142u (jedno miejsce, bez SQL-a w warstwie funkcji).
CREATE OR REPLACE FUNCTION public.mb_admin_settings_save(p jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ssv$
DECLARE
  lib text := CASE WHEN p->>'library_mode' IN ('off','admin','on') THEN p->>'library_mode' ELSE 'off' END;
  msg text := CASE WHEN p->>'messages_mode' IN ('off','admin','on') THEN p->>'messages_mode' ELSE 'off' END;
  wa text := NULLIF(btrim(COALESCE(p->>'whatsapp','')), '');
  lim int := LEAST(1048576, GREATEST(64, COALESCE(NULLIF(p->>'space_limit_mb','')::int, 5120)));
  dom text[] := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM jsonb_array_elements_text(COALESCE(p->'video_domains','[]')) x
     WHERE lower(btrim(x)) <> ''), '{}'::text[]);
BEGIN
  IF wa IS NOT NULL AND wa !~ '^https://wa\\.me/[0-9]{6,20}$' THEN RAISE EXCEPTION 'zly whatsapp'; END IF;
  UPDATE public.mb_settings SET library_mode = lib, messages_mode = msg,
    email_notify = COALESCE((p->>'email_notify')::boolean, false), whatsapp = wa,
    space_limit_mb = lim, video_domains = dom, updated_at = now() WHERE id = 1;
  RETURN true;
END $ssv$;

-- ============ KLIENT: OTWARCIE MATERIA\u0141U (dochodzi adres z serwera) ============
CREATE OR REPLACE FUNCTION public.mb_client_open(p_email text, p_admin boolean, p_material_id uuid,
  p_mark_opened boolean DEFAULT true, p_rate_key text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $co$
DECLARE
  mail text := lower(btrim(COALESCE(p_email,'')));
  m record;
  r text;
BEGIN
  IF p_material_id IS NULL THEN RETURN jsonb_build_object('status','denied'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mb_visible_materials(p_email, p_admin) v WHERE v.material_id = p_material_id) THEN
    RETURN jsonb_build_object('status','denied');
  END IF;
  SELECT mm.id, mm.title, mm.kind, mm.file_key, mm.external_url, mm.video_provider, mm.video_id,
         mm.server_url, mm.body_html, mm.allow_download
    INTO m FROM public.mb_materials mm WHERE mm.id = p_material_id AND mm.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','denied'); END IF;

  IF p_rate_key IS NOT NULL THEN
    r := public.mb_link_hit(p_rate_key, COALESCE(p_limit, 30));
    IF r <> 'ok' THEN RETURN jsonb_build_object('status','rate'); END IF;
  END IF;

  IF p_mark_opened THEN
    INSERT INTO public.mb_material_state (client_email, material_id, opened_at)
    VALUES (mail, p_material_id, now())
    ON CONFLICT (client_email, material_id)
    DO UPDATE SET opened_at = COALESCE(public.mb_material_state.opened_at, EXCLUDED.opened_at);
  END IF;

  RETURN jsonb_build_object('status','ok','material', jsonb_build_object(
    'id', m.id, 'title', m.title, 'kind', m.kind, 'file_key', m.file_key, 'external_url', m.external_url,
    'video_provider', m.video_provider, 'video_id', m.video_id, 'server_url', m.server_url,
    'body_html', m.body_html, 'allow_download', m.allow_download));
END $co$;

-- ============ KLIENT: WIADOMO\u015ACI (wszystkie za\u0142\u0105czniki) ============
CREATE OR REPLACE FUNCTION public.mb_client_messages(p_email text, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
r AS (
  SELECT m.id, m.title, m.body_html, m.sent_at, rr.read_at
    FROM public.mb_message_recipients rr
    JOIN public.mb_messages m ON m.id = rr.message_id
   WHERE rr.client_email = (SELECT mail FROM me) AND m.status = 'WYSLANA' AND rr.hidden_at IS NULL
   ORDER BY m.sent_at DESC NULLS LAST LIMIT 100
),
att AS (
  SELECT a.message_id,
         jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
           'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title,
           'position', a.position) ORDER BY a.position) AS j
    FROM public.mb_message_attachments a
    LEFT JOIN public.mb_materials mm ON mm.id = a.material_id AND mm.deleted_at IS NULL
    LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id AND cc.deleted_at IS NULL
   GROUP BY a.message_id
),
it AS (
  SELECT jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'sent_at', r.sent_at,
    'read_at', r.read_at, 'attachments', COALESCE(att.j, '[]'::jsonb)) AS j, r.sent_at, r.read_at
  FROM r LEFT JOIN att ON att.message_id = r.id
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sent_at DESC NULLS LAST) FROM it), '[]'::jsonb),
  'unread', CASE WHEN p_preview THEN 0 ELSE (SELECT count(*) FROM it WHERE it.read_at IS NULL) END)
$cm$;

-- ============ PANEL: MATERIA\u0141Y (trzy \u017Ar\xF3d\u0142a wideo) ============
CREATE OR REPLACE FUNCTION public.mb_admin_material_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ms$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  k text := p->>'kind';
  vsrc text := NULLIF(p->>'video_source','');
  vurl text := NULLIF(btrim(COALESCE(p->>'external_url','')), '');
  vsrv text := NULLIF(btrim(COALESCE(p->>'server_url','')), '');
  vprov text := NULLIF(p->>'video_provider','');
  vid text := NULLIF(p->>'video_id','');
  vhtml text := NULLIF(p->>'body_html','');
  vkeep boolean := COALESCE((p->>'keep_video')::boolean, false);
  -- Zmiana \u017Ar\xF3d\u0142a wideo z pliku na adres/link: kolumny pliku musz\u0105 zosta\u0107 puste (regu\u0142a sp\xF3jno\u015Bci).
  clearfile boolean := false;
  out_id uuid;
BEGIN
  IF k IS NULL OR k NOT IN ('AUDIO','WIDEO','PDF','LINK','TEKST') THEN RAISE EXCEPTION 'nieznany rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;

  IF k = 'LINK' THEN
    IF vurl IS NULL OR vurl NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu'; END IF;
    vprov := NULL; vid := NULL; vhtml := NULL; vsrv := NULL;
  ELSIF k = 'WIDEO' THEN
    vurl := NULL; vhtml := NULL;
    IF vkeep THEN
      vprov := NULL; vid := NULL; vsrv := NULL;
    ELSIF vsrc = 'serwer' THEN
      clearfile := true;
      IF vsrv IS NULL OR vsrv NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu pliku'; END IF;
      vprov := 'serwer'; vid := NULL;
    ELSIF vsrc = 'plik' THEN
      vprov := 'plik'; vid := NULL; vsrv := NULL;
    ELSE
      vsrv := NULL; clearfile := true;
      IF vprov IS NULL OR vid IS NULL THEN RAISE EXCEPTION 'brak zrodla wideo'; END IF;
    END IF;
  ELSIF k = 'TEKST' THEN
    IF vhtml IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
    vurl := NULL; vprov := NULL; vid := NULL; vsrv := NULL;
  ELSE
    vurl := NULL; vprov := NULL; vid := NULL; vhtml := NULL; vsrv := NULL;
  END IF;

  IF mid IS NULL THEN
    IF k IN ('PDF','AUDIO') THEN RAISE EXCEPTION 'najpierw plik'; END IF;
    INSERT INTO public.mb_materials (kind, title, description, stage, tags, duration_s, pages, allow_download,
      source, external_url, video_provider, video_id, server_url, body_html, created_by)
    VALUES (k, btrim(p->>'title'), NULLIF(p->>'description',''), NULLIF(p->>'stage',''),
      COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      NULLIF(p->>'duration_s','')::int, NULLIF(p->>'pages','')::int,
      COALESCE((p->>'allow_download')::boolean, false), NULLIF(p->>'source',''),
      vurl, vprov, vid, vsrv, vhtml, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_materials SET
      kind = k, title = btrim(p->>'title'), description = NULLIF(p->>'description',''),
      stage = NULLIF(p->>'stage',''),
      tags = COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      duration_s = NULLIF(p->>'duration_s','')::int, pages = NULLIF(p->>'pages','')::int,
      allow_download = COALESCE((p->>'allow_download')::boolean, false), source = NULLIF(p->>'source',''),
      external_url = vurl,
      video_provider = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_provider ELSE vprov END,
      video_id = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_id ELSE vid END,
      server_url = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.server_url ELSE vsrv END,
      file_key = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_key END,
      file_name = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_name END,
      file_size = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_size END,
      prev_file_key = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_key END,
      prev_file_name = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_name END,
      prev_file_size = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_size END,
      body_html = vhtml, updated_at = now()
    WHERE id = mid AND deleted_at IS NULL
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $ms$;

-- Rejestracja pliku: PDF, AUDIO albo WIDEO (plik wideo).
CREATE OR REPLACE FUNCTION public.mb_admin_material_register(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mrg$
DECLARE out_id uuid;
BEGIN
  IF p->>'kind' IS NULL OR p->>'kind' NOT IN ('AUDIO','PDF','WIDEO') THEN RAISE EXCEPTION 'zly rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;
  INSERT INTO public.mb_materials (kind, title, file_key, file_name, file_size, pdf_js_warning, video_provider, created_by)
  VALUES (p->>'kind', btrim(p->>'title'), p->>'file_key', p->>'file_name',
    NULLIF(p->>'file_size','')::bigint, COALESCE((p->>'pdf_js')::boolean, false),
    CASE WHEN p->>'kind' = 'WIDEO' THEN 'plik' ELSE NULL END, NULLIF(p->>'actor',''))
  RETURNING id INTO out_id;
  RETURN jsonb_build_object('id', out_id);
END $mrg$;

-- Lista materia\u0142\xF3w: dok\u0142adamy \u017Ar\xF3d\u0142o wideo i obecno\u015B\u0107 pliku.
CREATE OR REPLACE FUNCTION public.mb_admin_materials(p_kind text DEFAULT NULL, p_q text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $am$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description, 'stage', m.stage, 'tags', m.tags,
  'file_version', m.file_version, 'file_size', m.file_size, 'prev_file_size', m.prev_file_size,
  'prev_file_name', m.prev_file_name, 'pdf_js_warning', m.pdf_js_warning, 'external_url', m.external_url,
  'video_provider', m.video_provider, 'video_id', m.video_id, 'server_url', m.server_url,
  'file_name', m.file_name, 'has_file', (m.file_key IS NOT NULL),
  'duration_s', m.duration_s, 'pages', m.pages,
  'allow_download', m.allow_download, 'body_html', m.body_html, 'created_at', m.created_at, 'source', m.source,
  'przydzialy', (SELECT count(*) FROM public.mb_assignments x WHERE x.revoked_at IS NULL
     AND (x.material_id = m.id OR x.collection_id IN
       (SELECT ci.collection_id FROM public.mb_collection_items ci WHERE ci.material_id = m.id))),
  'otwarte', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.opened_at IS NOT NULL),
  'ukonczone', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.completed_at IS NOT NULL)
) ORDER BY m.created_at DESC), '[]'::jsonb)
FROM (
  SELECT * FROM public.mb_materials mm
   WHERE mm.deleted_at IS NULL
     AND (p_kind IS NULL OR mm.kind = p_kind)
     AND (p_q IS NULL OR p_q = '' OR mm.title ILIKE '%' || p_q || '%' OR COALESCE(mm.description,'') ILIKE '%' || p_q || '%')
   ORDER BY mm.created_at DESC LIMIT 500
) m
$am$;

-- ============ PANEL: WIADOMO\u015A\u0106 Z WIELOMA ZA\u0141\u0104CZNIKAMI ============
CREATE OR REPLACE FUNCTION public.mb_admin_message_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mss$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  tgt jsonb := COALESCE(p->'target','{}'::jsonb);
  snap jsonb;
  cnt int;
  out_id uuid;
  st text := CASE WHEN p->>'status' = 'ZAPLANOWANA' THEN 'ZAPLANOWANA' ELSE 'SZKIC' END;
  snd timestamptz := NULLIF(p->>'send_at','')::timestamptz;
  att jsonb := COALESCE(p->'attachments','[]'::jsonb);
  natt int;
BEGIN
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF st = 'ZAPLANOWANA' AND snd IS NULL THEN RAISE EXCEPTION 'brak terminu'; END IF;
  natt := jsonb_array_length(att);
  IF natt > 10 THEN RAISE EXCEPTION 'za duzo zalacznikow'; END IF;

  IF tgt->>'kind' = 'grupa' AND tgt->>'group_mode' = 'TYLKO_OBECNI' THEN
    SELECT COALESCE(to_jsonb(array_agg(DISTINCT lower(btrim(m.client_email)))), '[]'::jsonb) INTO snap
      FROM public.mb_group_members m WHERE m.group_id = NULLIF(tgt->>'group_id','')::uuid;
    tgt := jsonb_set(tgt, '{snapshot_emails}', COALESCE(snap, '[]'::jsonb));
  END IF;

  SELECT count(*) INTO cnt FROM public.mb_resolve_recipients(tgt) r;

  IF mid IS NULL THEN
    INSERT INTO public.mb_messages (title, body_html, email_mode, attached_material_id, attached_collection_id,
      target, recipient_count, status, send_at, created_by)
    VALUES (NULLIF(p->>'title',''), p->>'body_html', COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      NULLIF(p->>'attached_material_id','')::uuid, NULLIF(p->>'attached_collection_id','')::uuid,
      tgt, cnt, st, snd, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_messages SET title = NULLIF(p->>'title',''), body_html = p->>'body_html',
      email_mode = COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      attached_material_id = NULLIF(p->>'attached_material_id','')::uuid,
      attached_collection_id = NULLIF(p->>'attached_collection_id','')::uuid,
      target = tgt, recipient_count = cnt, status = st, send_at = snd, updated_at = now()
    WHERE id = mid AND status IN ('SZKIC','ZAPLANOWANA')
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
    DELETE FROM public.mb_message_attachments WHERE message_id = out_id;
  END IF;

  IF natt > 0 THEN
    INSERT INTO public.mb_message_attachments (message_id, material_id, collection_id, position)
    SELECT out_id,
      NULLIF(x->>'material_id','')::uuid, NULLIF(x->>'collection_id','')::uuid, (ord - 1)
      FROM jsonb_array_elements(att) WITH ORDINALITY AS t(x, ord)
     WHERE (NULLIF(x->>'material_id','') IS NULL) <> (NULLIF(x->>'collection_id','') IS NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', out_id, 'count', cnt, 'zalaczniki', natt);
END $mss$;

-- Domkni\u0119cie wysy\u0142ki: przej\u015Bcie statusu jest bramk\u0105 \u2014 ponowne wywo\u0142anie nic nie dubluje.
-- Ka\u017Cdy za\u0142\u0105cznik (materia\u0142 albo kolekcja) trafia do tych samych odbiorc\xF3w.
CREATE OR REPLACE FUNCTION public.mb_admin_message_finish(p_id uuid, p_emails text[], p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mfn$
DECLARE
  m record;
  n int := 0;
  k int := 0;
  who text := COALESCE(NULLIF(p_actor,''), 'system');
BEGIN
  IF p_id IS NULL THEN RETURN 0; END IF;
  SELECT target INTO m FROM public.mb_messages WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  UPDATE public.mb_messages SET status = 'WYSLANA', sent_at = now(),
    recipient_count = COALESCE(array_length(p_emails, 1), 0), updated_at = now()
   WHERE id = p_id AND status = 'WYSYLANIE';
  GET DIAGNOSTICS k = ROW_COUNT;
  IF k = 0 THEN RETURN 0; END IF;

  n := COALESCE(array_length(p_emails, 1), 0);

  IF n > 0 THEN
    INSERT INTO public.mb_message_recipients (message_id, client_email)
    SELECT p_id, lower(btrim(e)) FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
    ON CONFLICT (message_id, client_email) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM public.mb_message_attachments a WHERE a.message_id = p_id) THEN
    IF m.target->>'kind' = 'grupa' AND NULLIF(m.target->>'group_id','') IS NOT NULL THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, group_id, group_mode,
        snapshot_emails, exceptions_add, exceptions_drop, note, created_by)
      SELECT a.material_id, a.collection_id, 'grupa', (m.target->>'group_id')::uuid,
        COALESCE(m.target->>'group_mode', 'OBECNI_I_PRZYSZLI'),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'snapshot_emails','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_add','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_drop','[]')) x), '{}'::text[]),
        'do\u0142\u0105czone do wiadomo\u015Bci', who
        FROM public.mb_message_attachments a WHERE a.message_id = p_id;
    ELSIF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT a.material_id, a.collection_id, 'osoba', lower(btrim(e)), 'do\u0142\u0105czone do wiadomo\u015Bci', who
        FROM public.mb_message_attachments a, unnest(p_emails) AS e
       WHERE a.message_id = p_id AND lower(btrim(e)) <> '';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.mb_messages x WHERE x.id = p_id AND (x.attached_material_id IS NOT NULL OR x.attached_collection_id IS NOT NULL)) THEN
    -- Zgodno\u015B\u0107 ze star\u0105 kolumn\u0105: wiadomo\u015B\u0107 sprzed migracji.
    SELECT attached_material_id, attached_collection_id INTO m FROM public.mb_messages WHERE id = p_id;
    IF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT m.attached_material_id, m.attached_collection_id, 'osoba', lower(btrim(e)), 'do\u0142\u0105czone do wiadomo\u015Bci', who
        FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> '';
    END IF;
  END IF;
  RETURN n;
END $mfn$;

-- ============ PANEL: PRZYDZIA\u0141 KILKU MATERIA\u0141\xD3W NARAZ ============
-- Jedno wywo\u0142anie: ka\u017Cdy materia\u0142 z listy trafia do tych samych odbiorc\xF3w (albo do grupy wg trybu).
CREATE OR REPLACE FUNCTION public.mb_admin_assign_many(p_materials uuid[], p_target jsonb,
  p_note text DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_actor text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $amany$
DECLARE
  kind text := CASE WHEN p_target->>'kind' = 'grupa' THEN 'grupa' ELSE 'osoba' END;
  gid uuid := NULLIF(p_target->>'group_id','')::uuid;
  gmode text;
  snap text[];
  addx text[];
  dropx text[];
  tgtjson jsonb;
  em text[];
  who text := COALESCE(NULLIF(p_actor,''), 'system');
  mats uuid[];
  nmat int;
  nppl int;
  nass int;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::uuid[]) INTO mats FROM unnest(COALESCE(p_materials,'{}'::uuid[])) x WHERE x IS NOT NULL;
  nmat := COALESCE(array_length(mats, 1), 0);
  IF nmat = 0 THEN RAISE EXCEPTION 'brak materialow'; END IF;
  IF nmat > 100 THEN RAISE EXCEPTION 'za duzo materialow'; END IF;

  IF kind = 'grupa' THEN
    IF gid IS NULL THEN RAISE EXCEPTION 'brak grupy'; END IF;
    gmode := CASE WHEN p_target->>'group_mode' = 'TYLKO_OBECNI' THEN 'TYLKO_OBECNI' ELSE 'OBECNI_I_PRZYSZLI' END;
    addx := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_target->'exceptions_add','[]')) x), '{}'::text[]);
    dropx := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_target->'exceptions_drop','[]')) x), '{}'::text[]);
    IF gmode = 'TYLKO_OBECNI' THEN
      SELECT COALESCE(array_agg(DISTINCT lower(btrim(m.client_email))), '{}'::text[])
        INTO snap FROM public.mb_group_members m WHERE m.group_id = gid;
    ELSE
      snap := '{}';
    END IF;
    tgtjson := jsonb_build_object('kind','grupa','group_id', gid, 'group_mode', gmode,
      'snapshot_emails', to_jsonb(snap), 'exceptions_add', to_jsonb(addx), 'exceptions_drop', to_jsonb(dropx));

    INSERT INTO public.mb_assignments (material_id, target_kind, group_id, group_mode,
      snapshot_emails, exceptions_add, exceptions_drop, note, visible_from, visible_to, created_by)
    SELECT m, 'grupa', gid, gmode, snap, addx, dropx, NULLIF(p_note,''), p_from, p_to, who
      FROM unnest(mats) AS m;
  ELSE
    em := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM jsonb_array_elements_text(COALESCE(p_target->'emails','[]')) x
       WHERE lower(btrim(x)) <> ''), '{}'::text[]);
    IF COALESCE(array_length(em, 1), 0) = 0 THEN RAISE EXCEPTION 'brak osob'; END IF;
    tgtjson := jsonb_build_object('kind','osoba','emails', to_jsonb(em));

    INSERT INTO public.mb_assignments (material_id, target_kind, target_email, note, visible_from, visible_to, created_by)
    SELECT m, 'osoba', e, NULLIF(p_note,''), p_from, p_to, who
      FROM unnest(mats) AS m, unnest(em) AS e;
  END IF;

  SELECT count(*) INTO nass FROM public.mb_assignments a
   WHERE a.created_by = who AND a.created_at > now() - interval '5 seconds' AND a.material_id = ANY(mats) AND a.revoked_at IS NULL;
  SELECT count(DISTINCT e.email) INTO nppl FROM public.mb_resolve_recipients(tgtjson) e;

  RETURN jsonb_build_object('materialy', nmat, 'osoby', COALESCE(nppl,0), 'przydzialy', COALESCE(nass,0));
END $amany$;

-- Lista wiadomo\u015Bci w panelu: liczba i tytu\u0142y za\u0142\u0105cznik\xF3w z nowej tabeli.
CREATE OR REPLACE FUNCTION public.mb_admin_messages() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ams$
WITH src AS (
  SELECT m.*, g.name AS group_name
    FROM public.mb_messages m
    LEFT JOIN public.mb_groups g ON g.id = NULLIF(m.target->>'group_id','')::uuid
   ORDER BY COALESCE(m.sent_at, m.send_at, m.created_at) DESC LIMIT 200
),
it AS (
  SELECT jsonb_build_object(
    'id', s.id, 'title', s.title, 'body_html', s.body_html, 'status', s.status, 'send_at', s.send_at,
    'email_mode', s.email_mode, 'recipient_count', s.recipient_count, 'target', s.target, 'created_at', s.created_at,
    'sent_at', s.sent_at, 'withdrawn_at', s.withdrawn_at, 'group_name', s.group_name,
    'zalaczniki', (SELECT count(*) FROM public.mb_message_attachments a WHERE a.message_id = s.id),
    'attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
        'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title, 'position', a.position)
        ORDER BY a.position)
       FROM public.mb_message_attachments a
       LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
       LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
      WHERE a.message_id = s.id), '[]'::jsonb),
    'dostarczone', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id),
    'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id AND r.read_at IS NOT NULL)
  ) AS j, COALESCE(s.sent_at, s.send_at, s.created_at) AS sort
  FROM src s
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sort DESC) FROM it), '[]'::jsonb),
  'liczniki', (SELECT jsonb_build_object(
    'wyslane', count(*) FILTER (WHERE status = 'WYSLANA'),
    'zaplanowane', count(*) FILTER (WHERE status = 'ZAPLANOWANA'),
    'szkice', count(*) FILTER (WHERE status = 'SZKIC'),
    'wycofane', count(*) FILTER (WHERE status = 'WYCOFANA')) FROM public.mb_messages))
$ams$;

-- Za\u0142\u0105czniki do podgl\u0105du formularza i ponownego otwarcia wiadomo\u015Bci.
CREATE OR REPLACE FUNCTION public.mb_admin_message_attachments(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $matt$
SELECT COALESCE(jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
  'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title, 'position', a.position)
  ORDER BY a.position), '[]'::jsonb)
FROM public.mb_message_attachments a
LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
WHERE a.message_id = p_id
$matt$;

-- ============ DOST\u0118P: wy\u0142\u0105cznie serwer ============
REVOKE ALL ON FUNCTION public.mb_admin_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_attachments(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mb_admin_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_attachments(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mb_lib_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_settings_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_messages(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_register(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_materials(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assign_many(uuid[], jsonb, text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mb_lib_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_settings_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_messages(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_register(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_materials(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assign_many(uuid[], jsonb, text, timestamptz, timestamptz, text) TO service_role;

NOTIFY pgrst, 'reload schema';
`;

// functions/_shared/libraryAccess.ts
var MODES = [
  "off",
  "admin",
  "on"
];
var DEFAULT_SETTINGS = {
  library_mode: "off",
  messages_mode: "off",
  email_notify: false,
  whatsapp: null,
  space_limit_mb: 5120,
  video_domains: []
};
var CFG = null;
var CFG_AT = 0;
async function libSettings(base44, fresh = false) {
  if (!fresh && CFG && Date.now() - CFG_AT < 3e4) return CFG;
  const s = await rpc(base44, "mb_lib_settings", {});
  CFG = s && s.library_mode ? s : {
    ...DEFAULT_SETTINGS
  };
  CFG_AT = Date.now();
  return CFG;
}
var resetLibSettings = () => {
  CFG_AT = 0;
};
function firstName(me2) {
  const a = String(me2 && me2.imie || "").trim();
  if (a) return a;
  const b = String(me2 && me2.full_name || "").trim();
  return b ? b.split(/\s+/)[0] : "";
}
var resolveRecipients = (base44, target) => rpc(base44, "mb_resolve_recipients", {
  p_target: target || {}
});
async function inBatches(list, size, fn) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(...await Promise.all(list.slice(i, i + size).map(fn)));
  }
  return out;
}
function randomToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
var CONTACT_FALLBACK = "kontakt@exmortis.pl";
var footerData = (s, firma) => ({
  mailto: `mailto:${String(firma && firma.email || "").trim() || CONTACT_FALLBACK}`,
  whatsapp: s && s.whatsapp ? s.whatsapp : null,
  crisis: "Je\u015Bli jeste\u015B w kryzysie: 116 123 \xB7 800 70 2222 (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 112.",
  reply: "Na t\u0119 wiadomo\u015B\u0107 odpowiesz e-mailem lub na WhatsAppie."
});

// functions/_shared/librarySanitize.ts
var ALLOWED = /* @__PURE__ */ new Set([
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "blockquote",
  "a"
]);
var VOID = /* @__PURE__ */ new Set([
  "br"
]);
var DROP = [
  "script",
  "style",
  "iframe",
  "svg",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "link",
  "meta",
  "noscript",
  "template",
  "math",
  "video",
  "audio",
  "source",
  "img",
  "base",
  "applet",
  "frame",
  "frameset"
];
var NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  colon: ":",
  tab: "	",
  newline: "\n",
  sol: "/"
};
function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    const key = String(e);
    if (key[0] === "#") {
      const hex = key[1] === "x" || key[1] === "X";
      const n = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(n) && n > 0 && n < 1114112 ? String.fromCodePoint(n) : m;
    }
    const v = NAMED[key.toLowerCase()];
    return v === void 0 ? m : v;
  });
}
function safeHref(raw) {
  const s = decodeEntities(String(raw || "")).replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u2000-\u200f\u2028\u2029]/g, "").trim();
  if (/^https:\/\/[^\s]+$/i.test(s)) return s;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s]+$/i.test(s)) return s;
  return null;
}
function fixQuillLists(s) {
  const TOKEN = /<\/?ol\b[^>]*>|<li\b[^>]*>/gi;
  const parts = [];
  const open = [];
  let last = 0;
  let m;
  while ((m = TOKEN.exec(s)) !== null) {
    parts.push(s.slice(last, m.index));
    last = TOKEN.lastIndex;
    const t = m[0];
    if (/^<li\b/i.test(t)) {
      if (/data-list\s*=\s*["']?bullet/i.test(t)) {
        const top = open[open.length - 1];
        if (top) parts[top.idx] = "<ul>";
      }
      parts.push(t);
    } else if (/^<\/ol/i.test(t)) {
      const top = open.pop();
      parts.push(top && parts[top.idx] === "<ul>" ? "</ul>" : "</ol>");
    } else {
      open.push({
        idx: parts.length
      });
      parts.push("<ol>");
    }
  }
  parts.push(s.slice(last));
  return parts.join("");
}
function sanitizeHtml(input) {
  let s = String(input == null ? "" : input);
  s = fixQuillLists(s);
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  for (const t of DROP) {
    s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, "gi"), "");
    s = s.replace(new RegExp(`<\\/?${t}\\b[^>]*>`, "gi"), "");
  }
  const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const escText = (t) => t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rebuild = (m, name, attrs) => {
    const tag = String(name).toLowerCase();
    if (!ALLOWED.has(tag)) return "";
    const closing = m.slice(0, 2) === "</";
    if (tag === "a") {
      if (closing) return "</a>";
      const h = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || "");
      const raw = h ? h[2] !== void 0 ? h[2] : h[3] !== void 0 ? h[3] : h[4] || "" : "";
      const href = safeHref(raw);
      if (!href) return "<a>";
      return `<a href="${href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" target="_blank" rel="noopener noreferrer">`;
    }
    if (VOID.has(tag)) return closing ? "" : `<${tag}>`;
    return closing ? `</${tag}>` : `<${tag}>`;
  };
  let out = "";
  let last = 0;
  let mt;
  while ((mt = TAG.exec(s)) !== null) {
    out += escText(s.slice(last, mt.index)) + rebuild(mt[0], mt[1], mt[2]);
    last = TAG.lastIndex;
  }
  out += escText(s.slice(last));
  s = out;
  return s.trim();
}
function plainText(html, max = 160) {
  const t = String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}\u2026` : t;
}

// functions/_shared/libraryMedia.ts
var YT_ID = /^[A-Za-z0-9_-]{11}$/;
var VIMEO_ID = /^\d{6,12}$/;
var VIMEO_HASH = /^[0-9a-f]{6,20}$/;
var BUNNY_ID = /^\d{3,12}\/[A-Za-z0-9_-]{1,40}$/;
var MAX_BYTES = {
  PDF: 100 * 1024 * 1024,
  AUDIO: 500 * 1024 * 1024,
  WIDEO: 500 * 1024 * 1024
};
var ALLOWED_EXT = {
  PDF: [
    "pdf"
  ],
  AUDIO: [
    "mp3",
    "m4a"
  ],
  WIDEO: [
    "mp4",
    "m4v",
    "webm"
  ]
};
var SNIFF_BYTES = 262144;
var MAX_MB = {
  PDF: 100,
  AUDIO: 500,
  WIDEO: 500
};
function sniffVideo(b) {
  if (!b || b.length < 16) return false;
  if (b[0] === 26 && b[1] === 69 && b[2] === 223 && b[3] === 163) return true;
  let s = "";
  for (let i = 4; i < 8; i++) s += String.fromCharCode(b[i]);
  return s === "ftyp";
}
var VIDEO_FILE_EXT = ALLOWED_EXT.WIDEO;
function validHost(value) {
  const h = String(value || "").trim().toLowerCase();
  if (!h || h.length > 253) return null;
  if (/[\/\\:@?#\s]/.test(h)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;
  if (h === "localhost" || h.endsWith(".localhost")) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h)) return null;
  return h;
}
var videoDomains = (list) => [
  ...new Set((Array.isArray(list) ? list : []).map(validHost).filter(Boolean))
];
function normalizeServerVideo(raw, domains) {
  const s = String(raw || "").trim();
  if (!/^https:\/\//i.test(s) || s.length > 500) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.username || u.password || u.port) return null;
  const host = validHost(u.hostname);
  if (!host) return null;
  const allowed = videoDomains(domains);
  if (!allowed.includes(host)) return null;
  const ext = extOf(u.pathname);
  if (!VIDEO_FILE_EXT.includes(ext)) return null;
  return u.toString();
}
function normalizeVideo(raw) {
  const s = String(raw || "").trim();
  if (!/^https:\/\//i.test(s)) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  if ([
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be"
  ].includes(host)) {
    let id = "";
    if (host.endsWith("youtu.be")) id = path.slice(1).split("/")[0];
    else if (path === "/watch") id = u.searchParams.get("v") || "";
    else {
      const m = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(path);
      id = m ? m[1] : "";
    }
    if (!YT_ID.test(id)) return null;
    return {
      provider: "youtube",
      id,
      embed: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`
    };
  }
  if ([
    "vimeo.com",
    "www.vimeo.com",
    "player.vimeo.com"
  ].includes(host)) {
    const m = /^\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?$/.exec(path);
    if (!m || !VIMEO_ID.test(m[1])) return null;
    const h = m[2] || u.searchParams.get("h") || "";
    if (h && !VIMEO_HASH.test(h)) return null;
    const id = h ? `${m[1]}:${h}` : m[1];
    return {
      provider: "vimeo",
      id,
      embed: embedUrl("vimeo", id)
    };
  }
  if ([
    "iframe.mediadelivery.net",
    "player.mediadelivery.net"
  ].includes(host)) {
    const m = /^\/embed\/(\d{3,12}\/[A-Za-z0-9_-]{1,40})$/.exec(path);
    if (!m || !BUNNY_ID.test(m[1])) return null;
    return {
      provider: "bunny",
      id: m[1],
      embed: `https://iframe.mediadelivery.net/embed/${m[1]}`
    };
  }
  return null;
}
function embedUrl(provider, id) {
  if (provider === "youtube") return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`;
  if (provider === "vimeo") {
    const [vid, h] = String(id || "").split(":");
    if (!VIMEO_ID.test(vid) || h && !VIMEO_HASH.test(h)) return null;
    return `https://player.vimeo.com/video/${vid}${h ? `?h=${h}` : ""}`;
  }
  if (provider === "bunny") return `https://iframe.mediadelivery.net/embed/${id}`;
  return null;
}
function extOf(name) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || "").trim());
  return m ? m[1].toLowerCase() : "";
}
function sniff(kind, b) {
  if (!b || b.length < 12) return false;
  const ascii = (o, n) => {
    let s = "";
    for (let i = o; i < o + n && i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  };
  if (kind === "PDF") return ascii(0, 5) === "%PDF-";
  if (kind === "AUDIO") {
    if (ascii(0, 3) === "ID3") return true;
    if (b[0] === 255 && (b[1] & 224) === 224) return true;
    if (ascii(4, 4) === "ftyp") return true;
    return false;
  }
  if (kind === "WIDEO") return sniffVideo(b);
  return false;
}
function pdfHasJs(b) {
  try {
    const s = new TextDecoder("latin1").decode(b);
    return /\/JavaScript|\/JS[\s/<>[\]]/.test(s);
  } catch {
    return false;
  }
}
var mb = (bytes) => Math.round((Number(bytes) || 0) / 1048576 * 10) / 10;

// functions/_shared/smtp.ts
var import_npm_nodemailer_6_92 = __toESM(require_nodemailer());

// functions/_shared/settings.ts
var TABLE_OK = true;
async function ensureSettingsTable(base44) {
  if (TABLE_OK) return;
  TABLE_OK = true;
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_date timestamptz DEFAULT now()
    )`);
}
var FIRMA = null;
async function getSetting(base44, key) {
  await ensureSettingsTable(base44);
  const rows = await runSql(base44, `SELECT value FROM public.app_settings WHERE key = ${escStr(key)}`, true);
  const value = rows && rows.length > 0 ? rows[0].value : null;
  if (key === "smtp") FIRMA = await getSetting(base44, "firma").catch(() => null);
  return value;
}
var DEFAULT_APP_URL = globalThis.Deno?.env?.get?.("APP_URL") || "";
var APP_URL = DEFAULT_APP_URL;
var safeAppUrl = (u) => !u || /preview--/i.test(String(u)) ? DEFAULT_APP_URL : String(u).replace(/\/+$/, "");
var APP_URL_AT = 0;
async function loadAppUrl(base44) {
  if (Date.now() - APP_URL_AT < 3e5) return APP_URL;
  const s = await getSetting(base44, "app").catch(() => null);
  APP_URL = safeAppUrl(s?.url);
  APP_URL_AT = Date.now();
  return APP_URL;
}
var CACHE = /* @__PURE__ */ new Map();
async function getSettingsFast(base44, keys) {
  const ck = keys.join(",");
  const hit = CACHE.get(ck);
  if (hit && Date.now() - hit.at < 6e4) return hit.v;
  let out = await rpc(base44, "app_settings_get", {
    p_keys: keys
  }).catch(() => null);
  if (!out || typeof out !== "object" || Array.isArray(out)) {
    const rows = await runSql(base44, `SELECT key, value FROM public.app_settings WHERE key IN (${keys.map(escStr).join(",")})`, true).catch(() => []);
    out = {};
    for (const r of rows || []) out[r.key] = r.value;
  }
  CACHE.set(ck, {
    v: out,
    at: Date.now()
  });
  return out;
}

// functions/_shared/emailLayout.ts
var BRAND = {
  bg: "#0A0A0B",
  card: "#111113",
  line: "#2A2A2C",
  text: "#E8E6E1",
  muted: "#A3A3A6",
  faint: "#7A7A7D",
  gold: "#C9A24A",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
};
var SOCIAL = [
  [
    "Instagram",
    "https://www.instagram.com/e.x.m.o.r.t.i.s/"
  ],
  [
    "Facebook",
    "https://www.facebook.com/dawidkowalczyk.exmortis"
  ],
  [
    "YouTube",
    "https://www.youtube.com/@e.x.m.o.r.t.i.s"
  ],
  [
    "WhatsApp",
    "https://whatsapp.com/channel/0029VbDYXi1Lo4hfFPvT3O3G"
  ]
];
var MARKETING = /* @__PURE__ */ new Set([
  "listy",
  "newsletter",
  "kampania"
]);
var esc2 = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
})[c]);
function emailButton(label, url, { secondary = false } = {}) {
  const bg = secondary ? "transparent" : BRAND.gold;
  const fg = secondary ? BRAND.gold : BRAND.bg;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr>
<td style="border-radius:2px;background:${bg};border:1px solid ${BRAND.gold};">
<a href="${esc2(url)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${BRAND.sans};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${fg};text-decoration:none;">${esc2(label)}</a>
</td></tr></table>`;
}
function normalizeBody(html) {
  let s = String(html || "");
  s = s.replace(/<p style="[^"]*">\s*EXMORTIS\s*<\/p>/g, "");
  s = s.replace(/<p style="[^"]*">\s*WRACAM Z SIEBIE · UCZĘ WRACAĆ\s*<\/p>/g, "");
  s = s.replace(/background:#0A0A0B;\s*padding:[^;"]*;?/g, "");
  s = s.replace(/font-family:Cinzel,\s*Georgia,\s*serif/g, "font-family:Georgia,serif");
  s = s.replace(/color:#8A8A8C/g, `color:${BRAND.muted}`).replace(/color:#5C5C5E/g, `color:${BRAND.faint}`).replace(/color:#3D3D3F/g, `color:${BRAND.faint}`);
  s = s.replace(/<p[^>]*>\s*<a\s+href="(https?:[^"]+)"[^>]*>\s*([^<]{2,60}?)\s*<\/a>\s*<\/p>/g, (_, href, label) => emailButton(label.replace(/&amp;/g, "&").replace(/&quot;/g, '"'), href.replace(/&amp;/g, "&")));
  s = s.replace(/<h1 style="[^"]*">/g, `<h1 style="margin:0 0 18px;font-family:${BRAND.serif};font-size:28px;line-height:1.25;font-weight:normal;color:#F5EFE1;">`);
  s = s.replace(/<h1>/g, `<h1 style="margin:0 0 18px;font-family:${BRAND.serif};font-size:28px;line-height:1.25;font-weight:normal;color:#F5EFE1;">`);
  s = s.replace(/<h2>/g, `<h2 style="margin:28px 0 12px;font-family:${BRAND.serif};font-size:21px;line-height:1.3;font-weight:normal;color:#F5EFE1;">`);
  return s;
}
function textOf(html) {
  return String(html || "").replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}
function emailLayout(html, { firma = null, appUrl = APP_URL, kind = "", preheader = "", unsubUrl = "" } = {}) {
  const body = normalizeBody(html);
  const site = String(appUrl || APP_URL).replace(/\/+$/, "");
  const pre = (preheader || textOf(body).replace(/^(EXMORTIS\s*)+/, "")).slice(0, 140);
  const marketing = MARKETING.has(kind) || !!unsubUrl;
  const hasCrisis = /116\s?123/.test(body);
  const contact = firma?.email || "kontakt@exmortis.pl";
  const firmLine = [
    firma?.nazwa || firma?.osoba,
    firma?.adres,
    firma?.nip && `NIP ${firma.nip}`,
    firma?.regon && `REGON ${firma.regon}`
  ].filter(Boolean).map(esc2).join(" \xB7 ");
  const link = (href, label) => `<a href="${esc2(href)}" target="_blank" style="color:${BRAND.muted};text-decoration:underline;">${esc2(label)}</a>`;
  const small = `font-family:${BRAND.sans};font-size:12px;line-height:1.7;color:${BRAND.faint};margin:0 0 10px;`;
  const footer = [
    `<p style="font-family:${BRAND.sans};font-size:11px;letter-spacing:3px;color:${BRAND.gold};margin:0 0 14px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>`,
    `<p style="${small}">${SOCIAL.map(([l, u]) => link(u, l)).join(" &nbsp;\xB7&nbsp; ")}</p>`,
    `<p style="${small}">${link(`mailto:${contact}`, contact)} &nbsp;\xB7&nbsp; ${link(site, site.replace(/^https?:\/\//, ""))}</p>`,
    hasCrisis ? "" : `<p style="${small}">exmortis to mentoring, nie terapia. Je\u015Bli jest Ci bardzo ci\u0119\u017Cko: <span style="color:${BRAND.muted};">116 123</span> \xB7 <span style="color:${BRAND.muted};">800 70 2222</span> (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 w zagro\u017Ceniu \u017Cycia <span style="color:${BRAND.muted};">112</span>.</p>`,
    firmLine ? `<p style="${small}">${firmLine}</p>` : "",
    `<p style="${small}">${link(`${site}/regulamin`, "Regulamin")} &nbsp;\xB7&nbsp; ${link(`${site}/polityka-prywatnosci`, "Polityka prywatno\u015Bci")}</p>`,
    marketing ? `<p style="${small}">Dostajesz Listy powrotu, bo zapisano ten adres na ${esc2(site.replace(/^https?:\/\//, ""))} i potwierdzono zapis.${unsubUrl ? ` ${link(unsubUrl, "Wypisz si\u0119 jednym klikni\u0119ciem")}.` : " Aby si\u0119 wypisa\u0107, odpowiedz na ten list s\u0142owem STOP."}</p>` : `<p style="${small}">To wiadomo\u015B\u0107 dotycz\u0105ca Twojego konta, zam\xF3wienia lub zapisu na ${esc2(site.replace(/^https?:\/\//, ""))}. Mo\u017Cesz na ni\u0105 po prostu odpowiedzie\u0107.</p>`
  ].join("");
  return `<!DOCTYPE html>
<html lang="pl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>exmortis</title>
<style>
  body{margin:0;padding:0;background:${BRAND.bg};}
  a{color:${BRAND.gold};}
  img{border:0;line-height:100%;outline:none;text-decoration:none;}
  table{border-collapse:collapse;}
  .exm-body p,.exm-body li,.exm-body td{font-size:16px;}
  @media (max-width:620px){
    .exm-card{padding:28px 22px !important;}
    .exm-wrap{padding:16px 10px !important;}
    .exm-body h1{font-size:24px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.bg};font-size:1px;line-height:1px;">${esc2(pre)}${"&#8203;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};">
<tr><td align="center" class="exm-wrap" style="padding:32px 16px;">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
    <tr><td align="center" style="padding:8px 0 26px;">
      <a href="${esc2(site)}" target="_blank" style="text-decoration:none;">
        <img src="${esc2(site)}/exmortis-logo-500.png" width="64" height="64" alt="exmortis" style="display:block;width:64px;height:64px;margin:0 auto 12px;font-family:${BRAND.serif};font-size:18px;color:${BRAND.gold};">
        <span style="font-family:${BRAND.sans};font-size:12px;letter-spacing:6px;color:${BRAND.gold};">EXMORTIS</span>
      </a>
    </td></tr>
    <tr><td class="exm-card" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-top:2px solid ${BRAND.gold};padding:44px 44px 36px;">
      <div class="exm-body" style="font-family:${BRAND.serif};font-size:16px;line-height:1.7;color:${BRAND.text};">
${body}
      </div>
    </td></tr>
    <tr><td align="center" style="padding:30px 12px 8px;text-align:center;">
${footer}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// functions/_shared/smtp.ts
var mailReady = (s) => !!(s && s.status === "dziala" && s.host && s.user && s.password);
var CFG2 = null;
var CFG_AT2 = 0;
async function mailConfig(base44) {
  if (CFG_AT2 && Date.now() - CFG_AT2 < 3e4) return CFG2;
  CFG2 = await getSetting(base44, "smtp").catch(() => null);
  CFG_AT2 = Date.now();
  return CFG2;
}
var MCFG = null;
var MCFG_AT = 0;
async function mailConfigMarketing(base44) {
  if (MCFG_AT && Date.now() - MCFG_AT < 3e4) return MCFG;
  MCFG = await getSetting(base44, "smtp_marketing").catch(() => null);
  MCFG_AT = Date.now();
  return MCFG;
}
var MARKETING_KINDS = /* @__PURE__ */ new Set([
  "listy",
  "ogloszenie"
]);
function htmlToText(html) {
  return String(html || "").replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
    const txt = t.replace(/<[^>]+>/g, "").trim();
    return !txt ? href : txt === href || href.startsWith("mailto:") || href.startsWith("tel:") ? txt : `${txt} (${href})`;
  }).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, "\n\n").replace(/<li[^>]*>/gi, "\u2022 ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}
var MAIL_BUDGET = 240;
var LIMIT_MARK = "Czeka na limit wysy\u0142ki (najwy\u017Cej 240 maili na 2 godziny)";
var SENT = {
  at: 0,
  n: 0
};
async function sentLast2h(base44) {
  if (Date.now() - SENT.at < 3e4) return SENT.n;
  const since = new Date(Date.now() - 2 * 36e5).toISOString();
  const rows = await base44.asServiceRole.entities.MailQueue.filter({
    status: "wyslany",
    sent_at: {
      $gte: since
    }
  }, "-created_date", 1e3).catch(() => null);
  SENT = {
    at: Date.now(),
    n: rows ? rows.filter((r) => r.blad !== "kana\u0142: newsletter").length : SENT.n
  };
  return SENT.n;
}
async function smtpSend(smtp, { to, subject, html, attachments, headers, kind = "", preheader = "" }) {
  if (!smtp || !smtp.host || !smtp.user || !smtp.password) throw new Error("Wysy\u0142ka e-mail nie jest skonfigurowana");
  const port = Number(smtp.port) || 587;
  const transporter = import_npm_nodemailer_6_92.default.createTransport({
    host: smtp.host,
    port,
    secure: port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.password
    }
  });
  const addr = smtp.from || smtp.user;
  const unsubUrl = String(headers?.["List-Unsubscribe"] || "").replace(/^<|>$/g, "");
  const full = emailLayout(html, {
    firma: FIRMA,
    kind,
    preheader,
    unsubUrl,
    appUrl: APP_URL
  });
  await transporter.sendMail({
    from: `"${String(smtp.from_name || "exmortis").replace(/"/g, "")}" <${addr}>`,
    ...smtp.reply_to ? {
      replyTo: smtp.reply_to
    } : {},
    to,
    subject,
    html: full,
    text: htmlToText(full.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<div style="display:none[^>]*>[\s\S]*?<\/div>/, "")),
    ...headers && typeof headers === "object" ? {
      headers
    } : {},
    ...Array.isArray(attachments) && attachments.length > 0 ? {
      attachments
    } : {}
  });
}
async function afterSent(base44, kind, to) {
  if (kind === "listy_potwierdzenie") {
    await runSql(base44, `UPDATE public.subscribers SET confirm_sent_at = now() WHERE email = ${escStr(String(to).toLowerCase())} AND status = 'pending'`).catch(() => {
    });
  }
}
async function sendMail(base44, { to, subject, html, attachments, kind = "inne", ref, waznyDo, headers, preheader = "" }) {
  if (!to) throw new Error("Brak adresata");
  const Q = base44.asServiceRole.entities.MailQueue;
  const base = {
    to_email: String(to || ""),
    subject,
    kind,
    ...ref ? {
      ref: String(ref)
    } : {},
    ...waznyDo ? {
      wazny_do: new Date(waznyDo).toISOString()
    } : {}
  };
  let smtp = await mailConfig(base44);
  let viaMarketing = false;
  if (MARKETING_KINDS.has(kind)) {
    const m = await mailConfigMarketing(base44);
    if (mailReady(m) && String(m.host || "").toLowerCase() !== String(smtp?.host || "").toLowerCase()) {
      smtp = m;
      viaMarketing = true;
    }
  }
  if (!mailReady(smtp)) {
    await Q.create({
      ...base,
      html,
      attachments: attachments || [],
      status: "kolejka"
    });
    return "kolejka";
  }
  if (!viaMarketing && await sentLast2h(base44) >= MAIL_BUDGET) {
    await Q.create({
      ...base,
      html,
      attachments: attachments || [],
      status: "kolejka",
      blad: LIMIT_MARK,
      ...headers ? {
        headers
      } : {}
    });
    return "kolejka";
  }
  try {
    await smtpSend(smtp, {
      to,
      subject,
      html,
      attachments,
      headers,
      kind,
      preheader
    });
    if (!viaMarketing) SENT.n++;
  } catch (e) {
    await Q.create({
      ...base,
      html,
      attachments: attachments || [],
      status: "blad",
      blad: String(e?.message || e).slice(0, 500)
    });
    throw e;
  }
  await Q.create({
    ...base,
    status: "wyslany",
    sent_at: (/* @__PURE__ */ new Date()).toISOString(),
    ...viaMarketing ? {
      blad: "kana\u0142: newsletter"
    } : {}
  });
  await afterSent(base44, kind, to);
  return "wyslany";
}

// functions/_shared/libraryNotify.ts
var FOOTER_REPLY = "Na t\u0119 wiadomo\u015B\u0107 odpowiesz e-mailem lub na WhatsAppie.";
var FOOTER_CRISIS = "Je\u015Bli jeste\u015B w kryzysie: 116 123 \xB7 800 70 2222 (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 112.";
var SEND_BATCH = 6;
function renderBody(html, name) {
  const n = String(name || "").trim();
  const token = /\{\s*imi[ęe]\s*\}/gi;
  let out = String(html == null ? "" : html);
  if (n) {
    out = out.replace(token, n);
  } else {
    out = out.replace(new RegExp(`(^|>)(\\s*)${token.source}\\s*([,.!?;:]+\\s*)?([a-z\u0105\u0107\u0119\u0142\u0144\xF3\u015B\u017A\u017C])?`, "gi"), (m, lead, sp, punct, ch) => lead + (lead === ">" ? "" : sp) + String(ch || "").toUpperCase()).replace(token, "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").replace(/\s+(<)/g, "$1");
}
var wrap = (title, inner, appUrl) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#E3E3E3;background:#0A0A0B;padding:24px">
  <p style="font-size:12px;letter-spacing:.18em;color:#C9A24A;margin:0 0 12px">EXMORTIS</p>
  <h1 style="font-size:20px;color:#F5EFE1;margin:0 0 16px">${title}</h1>
  ${inner}
  <p style="font-size:13px;color:#8A8A8C;margin:24px 0 0">${FOOTER_REPLY}<br>${FOOTER_CRISIS}</p>
  <p style="font-size:12px;color:#8A8A8C;margin:16px 0 0"><a href="${appUrl}/konto" style="color:#C9A24A">exmortis.pl \xB7 Moje konto</a></p>
</div>`;
async function sendMessageEmail(base44, message, emails) {
  if (!message || message.email_mode === "BRAK" || !emails || !emails.length) return {
    sent: 0
  };
  const appUrl = await loadAppUrl(base44);
  const title = message.title ? String(message.title) : "Nowa wiadomo\u015B\u0107";
  const html = message.email_mode === "PELNA" ? wrap(title, `<div style="font-size:15px;line-height:1.7">${sanitizeHtml(message.body_html)}</div>`, appUrl) : wrap("Masz now\u0105 wiadomo\u015B\u0107 na exmortis.pl", `<p style="font-size:15px;line-height:1.7">Zaloguj si\u0119, aby j\u0105 przeczyta\u0107.</p>`, appUrl);
  const subject = message.email_mode === "PELNA" ? title : "Masz now\u0105 wiadomo\u015B\u0107 na exmortis.pl";
  const results = await inBatches(emails.slice(0, 500), SEND_BATCH, (to) => sendMail(base44, {
    to,
    subject,
    html,
    kind: "biblioteka_wiadomosc",
    ref: String(message.id || "")
  }).catch(() => null));
  return {
    sent: results.filter(Boolean).length
  };
}
async function deliverMessage(base44, messageId, actor) {
  const m = await rpc(base44, "mb_admin_message_claim", {
    p_id: messageId,
    p_promote: true
  }).catch(() => null);
  if (!m || !m.id) return {
    ok: false,
    reason: "nie_przejeta"
  };
  const people = await resolveRecipients(base44, m.target || {}).catch(() => []) || [];
  const emails = [
    ...new Set(people.map((p) => String(p.email || "").toLowerCase()).filter(Boolean))
  ];
  await rpc(base44, "mb_admin_message_finish", {
    p_id: m.id,
    p_emails: emails,
    p_actor: String(actor || "system").slice(0, 200)
  }).catch(() => 0);
  await sendMessageEmail(base44, m, emails).catch(() => {
  });
  await libLog(base44, actor, "wiadomosc_wyslana", "message", m.id, `odbiorcy: ${emails.length}`);
  return {
    ok: true,
    id: m.id,
    odbiorcy: emails.length
  };
}
var libLog = (base44, actor, action, objectType, objectId, summary) => rpc(base44, "mb_log_add", {
  p_actor: String(actor || "system").slice(0, 200),
  p_action: String(action || "").slice(0, 60),
  p_object_type: objectType || null,
  p_object_id: objectId ? String(objectId) : null,
  p_summary: summary ? String(summary).slice(0, 500) : null
});

// functions/_shared/libraryView.ts
function itemOf(m) {
  const base = {
    id: m.id,
    title: m.title,
    kind: m.kind,
    description: m.description || null,
    duration_s: m.duration_s || null,
    pages: m.pages || null,
    stage: m.stage || null,
    tags: m.tags || [],
    note: m.note || null,
    visible_from: m.visible_from || null,
    visible_to: m.visible_to || null,
    collection_id: m.collection_id || null,
    position: m.position || 0,
    opened_at: m.opened_at || null,
    completed_at: m.completed_at || null,
    has_file: !!m.has_file,
    allow_download: !!m.allow_download
  };
  if (m.kind === "WIDEO") base.embed = embedUrl(m.video_provider, m.video_id);
  if (m.kind === "LINK") base.url = m.external_url || null;
  if (m.kind === "TEKST") base.text = sanitizeHtml(m.body_html);
  return base;
}
var EMPTY_COUNTS = {
  AUDIO: 0,
  WIDEO: 0,
  PDF: 0,
  LINK: 0,
  TEKST: 0
};
function libraryFromRpc(raw) {
  const items = ((raw || {}).items || []).map(itemOf);
  const byId = new Map(items.map((i) => [
    i.id,
    i
  ]));
  const collections = ((raw || {}).collections || []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description || null,
    items: (c.items || []).map((x) => byId.get(x.id)).filter(Boolean).sort((a, b) => a.position - b.position)
  }));
  return {
    items,
    collections,
    counts: Object.assign({
      ...EMPTY_COUNTS
    }, (raw || {}).counts || {}),
    unopened: (raw || {}).unopened || 0
  };
}
function messagesFromRpc(raw, me2) {
  const name = firstName(me2);
  const items = ((raw || {}).items || []).map((m) => ({
    id: m.id,
    title: m.title || null,
    text: sanitizeHtml(renderBody(m.body_html, name)),
    sent_at: m.sent_at || null,
    read_at: m.read_at || null,
    attachments: (m.attachments || []).map((a) => ({
      material_id: a.material_id || null,
      collection_id: a.collection_id || null,
      material_title: a.material_title || null,
      material_kind: a.material_kind || null,
      collection_title: a.collection_title || null,
      position: a.position || 0
    }))
  }));
  return {
    items,
    unread: (raw || {}).unread || 0
  };
}
async function libraryData(base44, email, admin, preview) {
  const raw = await rpc(base44, "mb_client_library", {
    p_email: String(email || ""),
    p_admin: !!admin,
    p_preview: !!preview
  });
  return libraryFromRpc(raw);
}
async function messagesData(base44, email, me2, preview) {
  const raw = await rpc(base44, "mb_client_messages", {
    p_email: String(email || ""),
    p_preview: !!preview
  });
  return messagesFromRpc(raw, me2);
}

// functions/libraryAdmin/index.ts
var NOT_FOUND = () => Response.json({
  error: "Nie znaleziono"
}, {
  status: 404
});
var bad = (m, s = 400) => Response.json({
  error: m
}, {
  status: s
});
var int = (v, min, max, def = null) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== "" && v !== null && v !== void 0 ? Math.min(max, Math.max(min, n)) : def;
};
var uuidOrNull = (v) => /^[0-9a-fA-F-]{36}$/.test(String(v || "").trim()) ? String(v).trim() : null;
var iso = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new Error("Niepoprawna data");
  return d.toISOString();
};
var emailsOf = (v, max = 2e3) => [
  ...new Set((Array.isArray(v) ? v : []).map((x) => String(x || "").trim().toLowerCase()).filter((x) => x.includes("@") && x.length <= 320))
].slice(0, max);
var lower = (v) => String(v || "").trim().toLowerCase();
async function verifyUpload(base44, kind, fileUri, fileName, declaredSize, pdfJsHint) {
  const allowed = ALLOWED_EXT[kind];
  if (!allowed) throw new Error("Ten rodzaj materia\u0142u nie przyjmuje pliku.");
  const ext = extOf(fileName);
  if (!allowed.includes(ext)) throw new Error(`Dozwolone rozszerzenia: ${allowed.map((x) => "." + x).join(", ")}.`);
  if (String(fileUri).includes("@")) throw new Error("Klucz pliku nie mo\u017Ce zawiera\u0107 adresu e-mail.");
  if (/^cf\/private\//.test(String(fileUri))) {
    const size2 = Number(declaredSize) || 0;
    if (!size2) throw new Error("Nie uda\u0142o si\u0119 odczyta\u0107 wgranego pliku.");
    if (size2 > MAX_BYTES[kind]) throw new Error(`Plik jest za du\u017Cy: ${mb(size2)} MB, a limit to ${MAX_MB[kind]} MB.`);
    return {
      size: size2,
      pdfJs: kind === "PDF" && pdfJsHint === true
    };
  }
  const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
    file_uri: fileUri,
    expires_in: 60
  });
  if (!signed || !signed.signed_url) throw new Error("Nie uda\u0142o si\u0119 odczyta\u0107 wgranego pliku.");
  const res = await fetch(signed.signed_url, {
    headers: {
      Range: `bytes=0-${SNIFF_BYTES - 1}`
    },
    signal: AbortSignal.timeout(25e3)
  }).catch(() => null);
  if (!res || !res.ok && res.status !== 206) throw new Error("Nie uda\u0142o si\u0119 odczyta\u0107 wgranego pliku.");
  const buf = new Uint8Array(await res.arrayBuffer());
  let size = Number(declaredSize) || 0;
  const cr = res.headers.get("content-range") || "";
  const m = /\/(\d+)\s*$/.exec(cr);
  if (m) size = Number(m[1]);
  else if (res.status === 200) size = buf.length;
  if (size > MAX_BYTES[kind]) throw new Error(`Plik jest za du\u017Cy: ${mb(size)} MB, a limit to ${MAX_MB[kind]} MB.`);
  if (!sniff(kind, buf)) throw new Error("Sygnatura pliku nie zgadza si\u0119 z rozszerzeniem \u2014 plik odrzucony.");
  return {
    size,
    pdfJs: kind === "PDF" ? pdfHasJs(buf) : false
  };
}
function cleanTarget(body) {
  const kind = body && body.kind === "grupa" ? "grupa" : "osoba";
  const t = {
    kind
  };
  if (kind === "osoba") {
    t.emails = emailsOf(body.emails);
    if (!t.emails.length) throw new Error("Wybierz osob\u0119.");
  } else {
    t.group_id = uuidOrNull(body.group_id);
    if (!t.group_id) throw new Error("Wybierz grup\u0119.");
    t.group_mode = body.group_mode === "TYLKO_OBECNI" ? "TYLKO_OBECNI" : "OBECNI_I_PRZYSZLI";
    t.snapshot_emails = t.group_mode === "TYLKO_OBECNI" ? emailsOf(body.snapshot_emails) : [];
    t.exceptions_add = emailsOf(body.exceptions_add);
    t.exceptions_drop = emailsOf(body.exceptions_drop);
  }
  return t;
}
async function namesOf(base44, emails) {
  const list = (emails || []).slice(0, 2e3);
  if (!list.length) return {};
  const users = await base44.asServiceRole.entities.User.list("-created_date", 2e3).catch(() => []);
  const out = {};
  for (const u of users || []) {
    const e = lower(u.email);
    if (list.includes(e)) out[e] = String(u.imie || u.full_name || "").trim();
  }
  return out;
}
async function imionaOf(base44, emails) {
  const list = (emails || []).slice(0, 200);
  if (!list.length) return {};
  const users = list.length <= 5 ? (await Promise.all(list.map((e) => base44.asServiceRole.entities.User.filter({
    email: e
  }).catch(() => [])))).flat() : await base44.asServiceRole.entities.User.list("-created_date", 2e3).catch(() => []);
  const out = {};
  for (const u of users || []) {
    const e = lower(u.email);
    if (!list.includes(e)) continue;
    const a = String(u.imie || "").trim();
    const b = String(u.full_name || "").trim();
    out[e] = a || (b ? b.split(/\s+/)[0] : "");
  }
  return out;
}
function maskEmail(v) {
  const s = String(v || "").trim();
  const at = s.indexOf("@");
  if (at < 1) return s;
  return `${s.slice(0, Math.min(2, at))}***@${s.slice(at + 1)}`;
}
var maskEmailsIn = (v) => v ? String(v).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => maskEmail(m)) : v;
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me2 = await requireAdmin(base44).catch(() => null);
    if (!me2) return Response.json({
      error: "Brak dost\u0119pu"
    }, {
      status: 403
    });
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    const sr = base44.asServiceRole.entities;
    if (a === "migrate") {
      await runSql(base44, SCHEMA_SQL);
      await runSql(base44, LIBRARY_RPC_SQL);
      await runSql(base44, SCHEMA_2B_SQL);
      await runSql(base44, RPC_2B_SQL);
      await runSql(base44, SEED_SQL);
      const t = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true);
      if (!t || !t[0] || !t[0].tick_token) {
        await runSql(base44, `UPDATE public.mb_settings SET tick_token = ${escStr(randomToken())} WHERE id = 1`);
      }
      await libLog(base44, me2.email, "migracja", "baza", "mb", "tabele mb_* i regu\u0142y dost\u0119pu");
      resetLibSettings();
      return Response.json({
        ok: true
      });
    }
    if (a === "checkpoint") {
      const [tables, funcs, rpcs] = await Promise.all([
        runSql(base44, CHECKPOINT_TABLES_SQL, true),
        runSql(base44, CHECKPOINT_FUNCS_SQL, true),
        runSql(base44, CHECKPOINT_RPC_SQL, true)
      ]);
      const space = await rpc(base44, "mb_admin_space", {});
      return Response.json({
        tabele: tables || [],
        funkcje: funcs || [],
        rpc: rpcs || [],
        przestrzen: space
      });
    }
    if (a === "settings") {
      const [s, sp] = await Promise.all([
        libSettings(base44, true),
        rpc(base44, "mb_admin_space", {})
      ]);
      return Response.json({
        settings: s,
        przestrzen: sp
      });
    }
    if (a === "save_settings") {
      const lib = MODES.includes(body.library_mode) ? body.library_mode : "off";
      const msg = MODES.includes(body.messages_mode) ? body.messages_mode : "off";
      const wa = String(body.whatsapp || "").trim();
      if (wa && !/^https:\/\/wa\.me\/[0-9]{6,20}$/.test(wa)) throw new Error("Adres WhatsApp: wy\u0142\u0105cznie format https://wa.me/cyfry");
      const limit = int(body.space_limit_mb, 64, 1048576, 5120);
      const podane = Array.isArray(body.video_domains) ? body.video_domains : (await libSettings(base44, true).catch(() => null) || {}).video_domains || [];
      const dom = videoDomains(podane);
      const odrzucone = podane.map((x) => String(x || "").trim()).filter((x) => x && !dom.includes(x.toLowerCase()));
      await rpc(base44, "mb_admin_settings_save", {
        p: {
          library_mode: lib,
          messages_mode: msg,
          email_notify: body.email_notify === true,
          whatsapp: wa,
          space_limit_mb: limit,
          video_domains: dom
        }
      });
      await libLog(base44, me2.email, "ustawienia", "settings", "1", `biblioteka=${lib} wiadomosci=${msg} mail=${body.email_notify === true ? "wl" : "wyl"} domeny=${dom.length}`);
      resetLibSettings();
      return Response.json({
        ok: true,
        video_domains: dom,
        odrzucone
      });
    }
    if (a === "add_video_domain") {
      const host = videoDomains([
        body.domain
      ])[0];
      if (!host) throw new Error("Podaj sam\u0105 nazw\u0119 domeny, np. wideo.exmortis.pl");
      const cur = await libSettings(base44, true);
      const dom = videoDomains([
        ...cur.video_domains || [],
        host
      ]);
      await rpc(base44, "mb_admin_settings_save", {
        p: {
          library_mode: cur.library_mode,
          messages_mode: cur.messages_mode,
          email_notify: cur.email_notify === true,
          whatsapp: cur.whatsapp || "",
          space_limit_mb: cur.space_limit_mb || 5120,
          video_domains: dom
        }
      });
      await libLog(base44, me2.email, "ustawienia", "settings", "1", `dodana domena wideo: ${host}`);
      resetLibSettings();
      return Response.json({
        ok: true,
        video_domains: dom
      });
    }
    if (a === "tick_token") {
      const t = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true);
      let token = t && t[0] ? t[0].tick_token : null;
      if (body.rotate === true || !token) {
        token = randomToken();
        await runSql(base44, `UPDATE public.mb_settings SET tick_token = ${escStr(token)} WHERE id = 1`);
        await libLog(base44, me2.email, "token_zadania", "settings", "1", body.rotate === true ? "obrot" : "utworzenie");
      }
      return Response.json({
        token,
        fresh: body.rotate === true || !t || !t[0] || !t[0].tick_token
      });
    }
    if (a === "materials_list") {
      const kind = [
        "AUDIO",
        "WIDEO",
        "PDF",
        "LINK",
        "TEKST"
      ].includes(body.kind) ? body.kind : null;
      const q = String(body.q || "").trim().slice(0, 100) || null;
      const [rows, sp] = await Promise.all([
        rpc(base44, "mb_admin_materials", {
          p_kind: kind,
          p_q: q
        }),
        rpc(base44, "mb_admin_space", {})
      ]);
      return Response.json({
        items: (rows || []).map((r) => ({
          ...r,
          preview: plainText(r.body_html)
        })),
        przestrzen: sp
      });
    }
    if (a === "material_register") {
      const kind = [
        "AUDIO",
        "PDF",
        "WIDEO"
      ].includes(body.kind) ? body.kind : null;
      if (!kind) return bad("Wybierz rodzaj pliku.");
      const fileUri = textField(body, "file_uri", {
        max: 500
      });
      const fileName = textField(body, "file_name", {
        max: 300
      });
      const title = String(body.title || fileName.replace(/\.[a-z0-9]{1,8}$/i, "")).trim().slice(0, 200);
      if (!title) return bad("Wpisz tytu\u0142 materia\u0142u.");
      const v = await verifyUpload(base44, kind, fileUri, fileName, body.file_size, body.pdf_js).catch((e) => ({
        err: e.message
      }));
      if (v.err) {
        await libLog(base44, me2.email, "plik_odrzucony", "material", null, `${kind}: ${v.err}`);
        return bad(v.err);
      }
      const reg = await rpc(base44, "mb_admin_material_register", {
        p: {
          kind,
          title,
          file_key: fileUri,
          file_name: fileName,
          file_size: v.size,
          pdf_js: v.pdfJs,
          actor: me2.email
        }
      });
      const id = reg.id;
      await libLog(base44, me2.email, "plik_wgrany", "material", id, `${kind} ${mb(v.size)} MB${v.pdfJs ? " \xB7 ostrzezenie: PDF z aktywna trescia" : ""}`);
      return Response.json({
        ok: true,
        id,
        file_size: v.size,
        pdf_js_warning: v.pdfJs
      });
    }
    if (a === "material_save") {
      const id = uuidOrNull(body.id);
      const kind = [
        "AUDIO",
        "WIDEO",
        "PDF",
        "LINK",
        "TEKST"
      ].includes(body.kind) ? body.kind : null;
      if (!kind) return bad("Nieznany rodzaj materia\u0142u.");
      const title = textField(body, "title", {
        max: 200
      });
      const desc = body.description ? String(body.description).trim().slice(0, 2e3) : null;
      const stage = body.stage ? String(body.stage).trim().slice(0, 60) : null;
      const tags = (Array.isArray(body.tags) ? body.tags : []).map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20);
      const allowDownload = body.allow_download === true;
      const payload = {
        id: id || null,
        kind,
        title,
        actor: me2.email
      };
      if (kind === "LINK") {
        const url = String(body.external_url || "").trim();
        if (!/^https:\/\/\S+$/.test(url)) return bad("Adres musi zaczyna\u0107 si\u0119 od https://");
        payload.external_url = url;
      } else if (kind === "WIDEO") {
        const src = [
          "link",
          "plik",
          "serwer"
        ].includes(body.video_source) ? body.video_source : "link";
        payload.video_source = src;
        if (src === "serwer") {
          const s = await libSettings(base44);
          const ok = normalizeServerVideo(body.server_url, s.video_domains);
          if (!ok) return bad("Adres musi by\u0107 https, ko\u0144czy\u0107 si\u0119 .mp4, .m4v albo .webm i pochodzi\u0107 z domeny wpisanej w ustawieniach.");
          payload.server_url = ok;
        } else if (src === "plik") {
          if (!id) return bad("Najpierw wgraj plik wideo.");
          payload.keep_video = true;
        } else {
          const v = normalizeVideo(body.external_url);
          if (!v && !id) return bad("Dozwolone s\u0105 tylko filmy z YouTube, Vimeo i Bunny \u2014 wklej poprawny adres https.");
          if (v) {
            payload.video_provider = v.provider;
            payload.video_id = v.id;
          } else payload.keep_video = true;
        }
      } else if (kind === "TEKST") {
        const html = sanitizeHtml(body.body_html);
        if (!html) return bad("Wpisz tre\u015B\u0107 materia\u0142u.");
        payload.body_html = html;
      } else if (!id) {
        return bad("Najpierw wgraj plik (PDF albo audio).");
      }
      const saved = await rpc(base44, "mb_admin_material_save", {
        p: {
          ...payload,
          description: desc,
          stage,
          tags,
          duration_s: int(body.duration_s, 0, 1e5, null),
          pages: int(body.pages, 0, 1e5, null),
          allow_download: allowDownload,
          source: body.source ? String(body.source).slice(0, 200) : null
        }
      });
      if (!saved || !saved.ok) return NOT_FOUND();
      await libLog(base44, me2.email, id ? "material_zmiana" : "material_dodany", "material", saved.id, id ? title : `${kind} ${title}`);
      return Response.json({
        ok: true,
        id: saved.id
      });
    }
    if (a === "material_replace") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const [m] = await runSql(base44, `SELECT id, kind, title FROM public.mb_materials WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL`, true);
      if (!m) return NOT_FOUND();
      if (m.kind !== "PDF" && m.kind !== "AUDIO" && m.kind !== "WIDEO") return bad("Plik mo\u017Cna zamieni\u0107 tylko w materiale PDF, audio albo wideo.");
      const fileUri = textField(body, "file_uri", {
        max: 500
      });
      const fileName = textField(body, "file_name", {
        max: 300
      });
      const v = await verifyUpload(base44, m.kind, fileUri, fileName, body.file_size, body.pdf_js).catch((e) => ({
        err: e.message
      }));
      if (v.err) {
        await libLog(base44, me2.email, "plik_odrzucony", "material", id, `${m.kind}: ${v.err}`);
        return bad(v.err);
      }
      await runSql(base44, `UPDATE public.mb_materials SET
        prev_file_key = file_key, prev_file_name = file_name, prev_file_size = file_size,
        file_key = ${escStr(fileUri)}, file_name = ${escStr(fileName)}, file_size = ${v.size},
        file_version = file_version + 1, pdf_js_warning = ${v.pdfJs ? "TRUE" : "FALSE"},
        video_provider = CASE WHEN kind = 'WIDEO' THEN 'plik' ELSE video_provider END,
        server_url = CASE WHEN kind = 'WIDEO' THEN NULL ELSE server_url END,
        updated_at = now()
        WHERE id = ${escStr(id)}::uuid`);
      await libLog(base44, me2.email, "plik_zamieniony", "material", id, `${m.kind} ${mb(v.size)} MB`);
      return Response.json({
        ok: true,
        id,
        file_size: v.size,
        pdf_js_warning: v.pdfJs
      });
    }
    if (a === "material_impact") {
      const materialId = uuidOrNull(body.material_id);
      if (!materialId) return NOT_FOUND();
      const r = await rpc(base44, "mb_admin_material_impact", {
        p_material: materialId
      });
      return Response.json({
        osoby: r && r.osoby || 0,
        przydzialy: r && r.przydzialy || 0
      });
    }
    if (a === "material_restore_prev") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_materials SET
        file_key = prev_file_key, file_name = prev_file_name, file_size = prev_file_size,
        prev_file_key = file_key, prev_file_name = file_name, prev_file_size = file_size,
        file_version = file_version + 1, updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL AND prev_file_key IS NOT NULL RETURNING id`);
      if (!r || !r.length) return bad("Nie ma poprzedniej wersji pliku do przywr\xF3cenia.");
      await libLog(base44, me2.email, "plik_przywrocony", "material", id, "przywrocono poprzednia wersje");
      return Response.json({
        ok: true,
        id
      });
    }
    if (a === "material_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_materials SET deleted_at = now(), updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL RETURNING title`);
      if (!r || !r.length) return NOT_FOUND();
      await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE material_id = ${escStr(id)}::uuid AND revoked_at IS NULL`);
      await libLog(base44, me2.email, "material_usuniety", "material", id, r[0].title);
      return Response.json({
        ok: true
      });
    }
    if (a === "collections_list") {
      const items = await rpc(base44, "mb_admin_collections", {});
      return Response.json({
        items: items || []
      });
    }
    if (a === "collection_save") {
      const id = uuidOrNull(body.id);
      const title = textField(body, "title", {
        max: 200
      });
      const desc = body.description ? String(body.description).trim().slice(0, 2e3) : null;
      const items = Array.isArray(body.items) ? body.items.map((x) => ({
        id: uuidOrNull(x && x.material_id),
        position: int(x && x.position, 0, 1e4, 0)
      })).filter((x) => x.id) : [];
      let colId = id;
      if (colId) {
        const r = await runSql(base44, `UPDATE public.mb_collections SET title = ${escStr(title)}, description = ${esc(desc)}, updated_at = now()
          WHERE id = ${escStr(colId)}::uuid AND deleted_at IS NULL RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
      } else {
        const r = await runSql(base44, `INSERT INTO public.mb_collections (title, description, sort, created_by)
          VALUES (${escStr(title)}, ${esc(desc)}, ${int(body.sort, 0, 1e4, 0)}, ${escStr(me2.email)}) RETURNING id`);
        colId = r[0].id;
      }
      await runSql(base44, `DELETE FROM public.mb_collection_items WHERE collection_id = ${escStr(colId)}::uuid`);
      if (items.length) {
        await runSql(base44, `INSERT INTO public.mb_collection_items (collection_id, material_id, position) VALUES
          ${items.map((x, i) => `(${escStr(colId)}::uuid, ${escStr(x.id)}::uuid, ${x.position || i})`).join(", ")}`);
      }
      await libLog(base44, me2.email, id ? "kolekcja_zmiana" : "kolekcja_dodana", "collection", colId, `${title} (${items.length})`);
      return Response.json({
        ok: true,
        id: colId
      });
    }
    if (a === "collection_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_collections SET deleted_at = now() WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL RETURNING title`);
      if (!r || !r.length) return NOT_FOUND();
      await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE collection_id = ${escStr(id)}::uuid AND revoked_at IS NULL`);
      await libLog(base44, me2.email, "kolekcja_usunieta", "collection", id, r[0].title);
      return Response.json({
        ok: true
      });
    }
    if (a === "groups_list") {
      const items = await rpc(base44, "mb_admin_groups", {});
      return Response.json({
        items: items || []
      });
    }
    if (a === "group_save") {
      const id = uuidOrNull(body.id);
      const name = textField(body, "name", {
        max: 120
      });
      const color = body.color ? String(body.color).trim() : null;
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return bad("Kolor w formacie #RRGGBB.");
      const desc = body.description ? String(body.description).trim().slice(0, 1e3) : null;
      const kind = body.kind === "AUTOMATYCZNA" ? "AUTOMATYCZNA" : "RECZNA";
      let rule = null;
      if (kind === "AUTOMATYCZNA") {
        const typ = body.rule && body.rule.typ === "aktywny_pakiet" ? "aktywny_pakiet" : "produkt";
        if (typ === "produkt" && !uuidOrNull(body.rule && body.rule.id)) return bad("Wybierz produkt.");
        const tid = uuidOrNull(body.rule && body.rule.type_id);
        rule = typ === "produkt" ? {
          typ,
          id: uuidOrNull(body.rule.id)
        } : {
          typ,
          ...tid ? {
            type_id: tid
          } : {}
        };
      }
      if (id) {
        const r = await runSql(base44, `UPDATE public.mb_groups SET name = ${escStr(name)}, color = ${esc(color)},
          description = ${esc(desc)}, kind = ${escStr(kind)}, rule = ${rule ? escStr(JSON.stringify(rule)) + "::jsonb" : "NULL"}, updated_at = now()
          WHERE id = ${escStr(id)}::uuid RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
        await libLog(base44, me2.email, "grupa_zmiana", "group", id, name);
        return Response.json({
          ok: true,
          id
        });
      }
      const created = await runSql(base44, `INSERT INTO public.mb_groups (name, color, description, kind, rule, accepted_at, created_by)
        VALUES (${escStr(name)}, ${esc(color)}, ${esc(desc)}, ${escStr(kind)}, ${rule ? escStr(JSON.stringify(rule)) + "::jsonb" : "NULL"}, now(), ${escStr(me2.email)}) RETURNING id`);
      await libLog(base44, me2.email, "grupa_dodana", "group", created[0].id, name);
      return Response.json({
        ok: true,
        id: created[0].id
      });
    }
    if (a === "group_accept") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_groups SET accepted_at = now(), updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND accepted_at IS NULL RETURNING name`);
      if (!r || !r.length) return NOT_FOUND();
      await libLog(base44, me2.email, "grupa_zatwierdzona", "group", id, r[0].name);
      return Response.json({
        ok: true
      });
    }
    if (a === "group_detail") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_group_detail", {
        p_group: id
      });
      if (!d || !d.group) return NOT_FOUND();
      const members = (d.members || []).map((x) => lower(x)).filter(Boolean);
      const names = await namesOf(base44, members);
      return Response.json({
        group: d.group,
        members: members.map((e) => ({
          email: e,
          name: names[e] || ""
        })),
        materials: d.materials || [],
        messages: d.messages || []
      });
    }
    if (a === "rule_options") {
      const [produkty, typy] = await Promise.all([
        runSql(base44, `SELECT id, name FROM public.products ORDER BY sort_order NULLS LAST, name LIMIT 500`, true).catch(() => []),
        runSql(base44, `SELECT id, name FROM public.bk_types ORDER BY name LIMIT 200`, true).catch(() => [])
      ]);
      return Response.json({
        produkty: produkty || [],
        typy: typy || []
      });
    }
    if (a === "group_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const take = body.materials === "odbierz";
      const [g] = await runSql(base44, `SELECT id, name, kind FROM public.mb_groups WHERE id = ${escStr(id)}::uuid`, true);
      if (!g) return NOT_FOUND();
      const members = (await rpc(base44, "mb_group_members_now", {
        p_group: id
      }).catch(() => []) || []).map((m) => lower(m.email));
      let assigned = 0;
      if (take) {
        const r = await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now()
          WHERE group_id = ${escStr(id)}::uuid AND revoked_at IS NULL RETURNING 1`);
        assigned = (r || []).length;
      } else {
        const rows = await runSql(base44, `SELECT id, target_kind, group_mode, snapshot_emails, exceptions_add, exceptions_drop FROM public.mb_assignments
          WHERE group_id = ${escStr(id)}::uuid AND revoked_at IS NULL`, true);
        for (const a2 of rows || []) {
          const list = a2.group_mode === "TYLKO_OBECNI" ? emailsOf(a2.snapshot_emails).filter((e) => !emailsOf(a2.exceptions_drop).includes(e)).concat(emailsOf(a2.exceptions_add)) : members.filter((e) => !emailsOf(a2.exceptions_drop).includes(e)).concat(emailsOf(a2.exceptions_add));
          for (const e of [
            ...new Set(list)
          ]) {
            await runSql(base44, `INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, visible_from, visible_to, created_by)
              SELECT material_id, collection_id, 'osoba', ${escStr(e)}, note, visible_from, visible_to, ${escStr(me2.email)}
              FROM public.mb_assignments WHERE id = ${escStr(a2.id)}::uuid`);
          }
          await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE id = ${escStr(a2.id)}::uuid`);
        }
        assigned = (rows || []).length;
      }
      await runSql(base44, `DELETE FROM public.mb_groups WHERE id = ${escStr(id)}::uuid`);
      await libLog(base44, me2.email, "grupa_usunieta", "group", id, `${g.name} \xB7 materialy: ${take ? "odebrane" : "zostawione indywidualnie"} (${assigned})`);
      return Response.json({
        ok: true,
        materials: take ? "odebrane" : "zostawione",
        przydzialy: assigned
      });
    }
    if (a === "group_members_add" || a === "group_members_remove") {
      const id = uuidOrNull(body.group_id);
      if (!id) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_group_detail", {
        p_group: id
      });
      const g = d && d.group;
      if (!g) return NOT_FOUND();
      if (g.kind === "AUTOMATYCZNA") return bad("Ta grupa jest automatyczna \u2014 cz\u0142onk\xF3w wyznaczaj\u0105 zakupy i pakiety.");
      const list = emailsOf(body.emails);
      if (!list.length) return bad("Wybierz osoby.");
      const n = Number(await rpc(base44, "mb_admin_group_members", {
        p_group: id,
        p_emails: list,
        p_add: a === "group_members_add",
        p_actor: me2.email
      }));
      await libLog(base44, me2.email, a === "group_members_add" ? "grupa_dodanie" : "grupa_usuniecie", "group", id, `${g.name} \xB7 ${list.length}`);
      return Response.json({
        ok: true,
        count: list.length,
        zmienione: n
      });
    }
    if (a === "clients_list") {
      const [users, mb2, groups] = await Promise.all([
        sr.User.list("-created_date", 2e3).catch(() => []),
        rpc(base44, "mb_admin_clients_mb", {}),
        rpc(base44, "mb_admin_groups", {})
      ]);
      const facts = new Map((mb2 || []).map((r) => [
        lower(r.email),
        r
      ]));
      const rows = [];
      for (const u of users || []) {
        const e = lower(u.email);
        if (!e || u.role === "zablokowane") continue;
        const f = facts.get(e) || {
          groups: [],
          package: false
        };
        rows.push({
          email: e,
          name: String(u.imie || u.full_name || "").trim(),
          joined: u.created_date || null,
          groups: f.groups || [],
          package: !!f.package,
          blocked: u.role === "zablokowane"
        });
      }
      const q = lower(body.q);
      const gids = [
        ...new Set((Array.isArray(body.group_ids) ? body.group_ids : [
          body.group_id
        ]).map(uuidOrNull).filter(Boolean))
      ];
      const mode = body.group_mode === "any" ? "any" : "all";
      let out = rows;
      if (q) out = out.filter((r) => r.email.includes(q) || lower(r.name).includes(q));
      if (gids.length) out = out.filter((r) => mode === "any" ? gids.some((g) => r.groups.some((x) => x.id === g)) : gids.every((g) => r.groups.some((x) => x.id === g)));
      if (body.no_group === true) out = out.filter((r) => !r.groups.length);
      if (body.has_package === true) out = out.filter((r) => r.package);
      const grupy = (groups || []).map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color || null,
        kind: g.kind,
        rule: g.rule || null
      }));
      return Response.json({
        items: out,
        total: out.length,
        grupy
      });
    }
    if (a === "client_detail") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const [users, mb2, lib] = await Promise.all([
        sr.User.filter({
          email
        }).catch(() => []),
        rpc(base44, "mb_admin_client_mb", {
          p_email: email
        }),
        libraryData(base44, email, true, true)
      ]);
      const u = (users || [])[0] || null;
      const msgs = await messagesData(base44, email, u || {
        email
      }, true);
      const d = mb2 || {};
      return Response.json({
        client: {
          email,
          name: u ? String(u.imie || u.full_name || "").trim() : "",
          joined: u ? u.created_date : null,
          role: u ? u.role : null
        },
        groups: d.groups || [],
        materials: lib.items,
        messages: msgs.items,
        sends: d.sends || [],
        packages: d.packages || [],
        assignments: d.assignments || []
      });
    }
    if (a === "assignment_preview") {
      const t = cleanTarget(body.target || {});
      const emails = [
        ...new Set((await rpc(base44, "mb_admin_assignment_preview", {
          p_target: t
        }) || []).map(lower).filter(Boolean))
      ];
      const names = await namesOf(base44, emails);
      return Response.json({
        count: emails.length,
        emails,
        names
      });
    }
    if (a === "assignment_bulk") {
      const materialId = uuidOrNull(body.material_id);
      if (!materialId) return bad("Wybierz materia\u0142.");
      const emails = emailsOf(body.emails, 500);
      if (!emails.length) return bad("Wybierz osoby.");
      const note = body.note ? String(body.note).slice(0, 2e3) : null;
      const n = await rpc(base44, "mb_admin_assignment_bulk", {
        p_material: materialId,
        p_emails: emails,
        p_note: note,
        p_from: iso(body.visible_from),
        p_to: iso(body.visible_to),
        p_actor: me2.email
      });
      await libLog(base44, me2.email, "przydzial_zbiorczy", "material", materialId, `osoby: ${emails.length}`);
      return Response.json({
        ok: true,
        count: Number(n) || 0
      });
    }
    if (a === "assign_many") {
      const ids = [
        ...new Set((Array.isArray(body.material_ids) ? body.material_ids : []).map(uuidOrNull).filter(Boolean))
      ].slice(0, 100);
      if (!ids.length) return bad("Zaznacz materia\u0142y.");
      const t = cleanTarget(body.target || {});
      const r = await rpc(base44, "mb_admin_assign_many", {
        p_materials: ids,
        p_target: t,
        p_note: body.note ? String(body.note).slice(0, 2e3) : null,
        p_from: iso(body.visible_from),
        p_to: iso(body.visible_to),
        p_actor: me2.email
      });
      await libLog(base44, me2.email, "przydzial_zbiorczy", "material", null, `materialy: ${ids.length} \xB7 odbiorcy: ${r && r.osoby || 0}`);
      return Response.json({
        ok: true,
        ...r || {}
      });
    }
    if (a === "assignment_save") {
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      if (!materialId && !collectionId) return bad("Wybierz materia\u0142 albo kolekcj\u0119.");
      if (materialId && collectionId) return bad("Wybierz materia\u0142 albo kolekcj\u0119 \u2014 nie oba.");
      const t = cleanTarget(body.target || {});
      if (t.kind === "osoba" && t.emails.length > 1) {
        const note = body.note ? String(body.note).slice(0, 2e3) : null;
        let count2 = 0;
        if (materialId) {
          const rm = await rpc(base44, "mb_admin_assign_many", {
            p_materials: [
              materialId
            ],
            p_target: t,
            p_note: note,
            p_from: iso(body.visible_from),
            p_to: iso(body.visible_to),
            p_actor: me2.email
          });
          count2 = Number(rm && rm.osoby || 0);
        } else {
          const from = iso(body.visible_from), to = iso(body.visible_to);
          const done = await inBatches(t.emails.slice(0, 500), 8, (e) => rpc(base44, "mb_admin_assignment_save", {
            p: {
              material_id: null,
              collection_id: collectionId,
              target_kind: "osoba",
              target_email: e,
              group_id: null,
              group_mode: null,
              snapshot_emails: [],
              exceptions_add: [],
              exceptions_drop: [],
              note,
              visible_from: from,
              visible_to: to,
              actor: me2.email
            }
          }));
          count2 = done.length;
        }
        await libLog(base44, me2.email, "przydzial", materialId ? "material" : "collection", materialId || collectionId, `osoby \xB7 odbiorcy: ${count2}`);
        return Response.json({
          ok: true,
          count: count2
        });
      }
      const r = await rpc(base44, "mb_admin_assignment_save", {
        p: {
          material_id: materialId,
          collection_id: collectionId,
          target_kind: t.kind,
          target_email: t.kind === "osoba" ? t.emails[0] : null,
          group_id: t.kind === "grupa" ? t.group_id : null,
          group_mode: t.kind === "grupa" ? t.group_mode : null,
          snapshot_emails: t.kind === "grupa" ? t.snapshot_emails : [],
          exceptions_add: t.kind === "grupa" ? t.exceptions_add : [],
          exceptions_drop: t.kind === "grupa" ? t.exceptions_drop : [],
          note: body.note ? String(body.note).slice(0, 2e3) : null,
          visible_from: iso(body.visible_from),
          visible_to: iso(body.visible_to),
          actor: me2.email
        }
      });
      const count = Number(r && r.count || 0);
      await libLog(base44, me2.email, "przydzial", materialId ? "material" : "collection", materialId || collectionId, `${t.kind === "grupa" ? "grupa" : "osoba"} \xB7 odbiorcy: ${count}`);
      return Response.json({
        ok: true,
        id: r && r.id,
        count
      });
    }
    if (a === "assignment_revoke") {
      const id = uuidOrNull(body.id);
      if (id) {
        const n2 = Number(await rpc(base44, "mb_admin_assignment_revoke", {
          p_id: id
        }));
        if (!n2) return NOT_FOUND();
        await libLog(base44, me2.email, "przydzial_odebrany", "przydzial", id, "pojedynczy");
        return Response.json({
          ok: true,
          count: n2
        });
      }
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      const groupId = uuidOrNull(body.group_id);
      if (!materialId && !collectionId || !groupId) return bad("Wska\u017C materia\u0142 i grup\u0119.");
      const n = Number(await rpc(base44, "mb_admin_assignment_revoke", {
        p_material: materialId,
        p_collection: collectionId,
        p_group: groupId
      }));
      await libLog(base44, me2.email, "przydzial_odebrany", materialId ? "material" : "collection", materialId || collectionId, `grupa \xB7 ${n}`);
      return Response.json({
        ok: true,
        count: n
      });
    }
    if (a === "assignments_of_material") {
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      if (!materialId && !collectionId) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_assignments_of", {
        p_material: materialId,
        p_collection: collectionId
      }) || {};
      return Response.json({
        items: d.items || [],
        odbiorcy: d.odbiorcy || 0,
        otwarte: d.otwarte === void 0 ? null : d.otwarte
      });
    }
    if (a === "assignments_of_client") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const lib = await libraryData(base44, email, true, true);
      return Response.json(lib);
    }
    if (a === "messages_list") {
      const d = await rpc(base44, "mb_admin_messages", {}) || {
        items: [],
        liczniki: null
      };
      const items = (d.items || []).map((m) => ({
        ...m,
        preview: plainText(m.body_html),
        target_label: m.target && m.target.kind === "grupa" ? `Grupa: ${m.group_name || "\u2014"}${m.target.group_mode === "TYLKO_OBECNI" ? " (tylko obecni)" : ""}` : m.target && m.target.emails && m.target.emails.length ? `Osoby: ${m.target.emails.length}` : "\u2014"
      }));
      return Response.json({
        items,
        liczniki: d.liczniki || {
          wyslane: 0,
          zaplanowane: 0,
          szkice: 0,
          wycofane: 0
        }
      });
    }
    if (a === "message_preview") {
      const html = sanitizeHtml(body.body_html);
      const t = cleanTarget(body.target || {});
      const people = await resolveRecipients(base44, t).catch(() => []) || [];
      const emails = [
        ...new Set(people.map((p) => lower(p.email)).filter(Boolean))
      ];
      const want = lower(body.email);
      const pick = want && emails.includes(want) ? want : emails[0] || null;
      const imiona = pick ? await imionaOf(base44, [
        pick
      ]) : {};
      const imie = pick ? imiona[pick] || "" : "";
      const s = await libSettings(base44);
      return Response.json({
        count: emails.length,
        emails: emails.slice(0, 500),
        email: pick,
        imie: imie || null,
        html: pick ? sanitizeHtml(renderBody(html, imie)) : null,
        stopka: footerData(s, (await getSettingsFast(base44, [
          "firma"
        ]).catch(() => ({}))).firma)
      });
    }
    if (a === "message_save") {
      const id = uuidOrNull(body.id);
      const status = body.status === "ZAPLANOWANA" ? "ZAPLANOWANA" : "SZKIC";
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz tre\u015B\u0107 wiadomo\u015Bci.");
      const emailMode = [
        "BRAK",
        "POWIADOMIENIE",
        "PELNA"
      ].includes(body.email_mode) ? body.email_mode : "BRAK";
      const sendAt = status === "ZAPLANOWANA" ? iso(body.send_at) : null;
      if (status === "ZAPLANOWANA" && !sendAt) return bad("Podaj termin wysy\u0142ki.");
      const t = cleanTarget(body.target || {});
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      let attIn = body.attachments;
      if (!Array.isArray(attIn)) {
        attIn = id && !body.attached_material_id && !body.attached_collection_id ? await rpc(base44, "mb_admin_message_attachments", {
          p_id: id
        }).catch(() => []) || [] : [];
      }
      const att = attIn.slice(0, 10).map((x) => ({
        material_id: uuidOrNull(x && x.material_id),
        collection_id: uuidOrNull(x && x.collection_id)
      })).filter((x) => (x.material_id ? 1 : 0) + (x.collection_id ? 1 : 0) === 1);
      const matId = uuidOrNull(body.attached_material_id);
      const colId = uuidOrNull(body.attached_collection_id);
      if (matId && colId) return bad("Do\u0142\u0105cz materia\u0142 albo kolekcj\u0119 \u2014 nie oba.");
      const saved = await rpc(base44, "mb_admin_message_save", {
        p: {
          id: id || null,
          title,
          body_html: html,
          email_mode: emailMode,
          target: t,
          attachments: att,
          attached_material_id: matId,
          attached_collection_id: colId,
          status,
          send_at: sendAt,
          actor: me2.email
        }
      });
      if (!saved || !saved.ok) return NOT_FOUND();
      await libLog(base44, me2.email, id ? "wiadomosc_zmiana" : "wiadomosc_szkic", "message", saved.id, `${status} \xB7 odbiorcy: ${saved.count} \xB7 zalaczniki: ${att.length}`);
      return Response.json({
        ok: true,
        id: saved.id,
        count: saved.count
      });
    }
    if (a === "message_send") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const used = Number(await rpc(base44, "mb_admin_message_send_rate", {}).catch(() => 0)) || 0;
      if (used >= 20) {
        return bad("Wykorzystany limit 20 wys\u0142anych wiadomo\u015Bci na godzin\u0119. Kolejn\u0105 wy\u015Blesz po godzinie.", 429);
      }
      if (body.confirm !== true && body.count > 10) return bad("Potwierd\u017A wysy\u0142k\u0119 do ponad 10 os\xF3b.");
      const r = await deliverMessage(base44, id, me2.email);
      if (!r.ok) return bad("Ta wiadomo\u015B\u0107 nie jest ju\u017C do wys\u0142ania.", 409);
      return Response.json(r);
    }
    if (a === "message_edit_sent") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz tre\u015B\u0107 wiadomo\u015Bci.");
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      const ok = await rpc(base44, "mb_admin_message_edit", {
        p_id: id,
        p_title: title,
        p_body_html: html
      });
      if (!ok) return NOT_FOUND();
      await libLog(base44, me2.email, "wiadomosc_poprawiona", "message", id, "poprawka tresci po wyslaniu, bez ponownego e-maila");
      return Response.json({
        ok: true
      });
    }
    if (a === "message_cancel") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_cancel", {
        p_id: id
      });
      if (!ok) return bad("Tej wiadomo\u015Bci nie mo\u017Cna ju\u017C anulowa\u0107 \u2014 zadanie j\u0105 przej\u0119\u0142o.", 409);
      await libLog(base44, me2.email, "wiadomosc_anulowana", "message", id, "zaplanowana wrocila do szkicow");
      return Response.json({
        ok: true
      });
    }
    if (a === "message_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_delete", {
        p_id: id
      });
      if (!ok) return bad("Usun\u0105\u0107 mo\u017Cna tylko szkic albo wiadomo\u015B\u0107 wycofan\u0105.", 409);
      await libLog(base44, me2.email, "wiadomosc_usunieta", "message", id, null);
      return Response.json({
        ok: true
      });
    }
    if (a === "message_withdraw") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_withdraw", {
        p_id: id
      });
      if (!ok) return NOT_FOUND();
      await libLog(base44, me2.email, "wiadomosc_wycofana", "message", id, null);
      return Response.json({
        ok: true,
        uwaga: "Wys\u0142anego e-maila nie da si\u0119 cofn\u0105\u0107."
      });
    }
    if (a === "message_notify_unread") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_message_notify", {
        p_id: id
      });
      if (!d || !d.message) return NOT_FOUND();
      if (d.message.email_mode === "BRAK") return bad("Ta wiadomo\u015B\u0107 nie ma w\u0142\u0105czonej kopii e-mail.");
      if (d.niedawno) return bad("Powiadomienie do nieprzeczytanych zosta\u0142o ju\u017C wys\u0142ane w ci\u0105gu ostatnich 24 godzin.", 429);
      const emails = (d.emails || []).map(lower);
      const sent = await sendMessageEmail(base44, d.message, emails);
      await libLog(base44, me2.email, "powiadomienie_ponowne", "message", id, `nieprzeczytane: ${emails.length}`);
      return Response.json({
        ok: true,
        ...sent,
        nieprzeczytane: emails.length
      });
    }
    if (a === "message_stats") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const rows = await rpc(base44, "mb_admin_message_stats", {
        p_id: id
      });
      const users = await sr.User.list("-created_date", 2e3).catch(() => []);
      const names = {};
      for (const u of users || []) names[lower(u.email)] = String(u.imie || u.full_name || "").trim();
      return Response.json({
        items: (rows || []).map((r) => ({
          ...r,
          name: names[lower(r.client_email)] || ""
        })),
        total: (rows || []).length
      });
    }
    if (a === "templates_list") {
      const rows = await rpc(base44, "mb_admin_templates", {});
      return Response.json({
        items: (rows || []).map((t) => ({
          ...t,
          preview: plainText(t.body_html)
        }))
      });
    }
    if (a === "template_save") {
      const name = textField(body, "name", {
        max: 120
      });
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz tre\u015B\u0107 szablonu.");
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      const id = uuidOrNull(body.id);
      const saved = await rpc(base44, "mb_admin_template_save", {
        p: {
          id: id || null,
          name,
          title,
          body_html: html,
          actor: me2.email
        }
      });
      if (!saved || !saved.ok) return NOT_FOUND();
      return Response.json({
        ok: true,
        id: saved.id
      });
    }
    if (a === "template_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      await rpc(base44, "mb_admin_template_delete", {
        p_id: id
      });
      return Response.json({
        ok: true
      });
    }
    if (a === "dashboard") {
      const d = await rpc(base44, "mb_admin_dashboard", {}) || {};
      return Response.json({
        zaplanowane_dzis: d.zaplanowane_dzis || 0,
        ostatnia: d.ostatnia || null,
        odblokowuje_sie: d.odblokowuje_sie || 0,
        przestrzen: d.przestrzen || null,
        tryby: d.tryby || null
      });
    }
    if (a === "history") {
      const filterAction = body.action_filter ? String(body.action_filter).slice(0, 60) : null;
      const days = int(body.days, 1, 3650, null);
      const d = await rpc(base44, "mb_admin_history", {
        p_action: filterAction,
        p_days: days
      }) || {};
      return Response.json({
        items: (d.items || []).map((r) => ({
          ...r,
          actor: maskEmail(r.actor),
          summary: maskEmailsIn(r.summary)
        })),
        akcje: d.akcje || []
      });
    }
    if (a === "preview_client") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const users = await sr.User.filter({
        email
      }).catch(() => []);
      const u = (users || [])[0] || {
        email
      };
      const [lib, msgs] = await Promise.all([
        libraryData(base44, email, true, true),
        messagesData(base44, email, u, true)
      ]);
      await libLog(base44, me2.email, "podglad_klienta", "klient", null, "podglad oczami klienta");
      return Response.json({
        library: lib,
        messages: msgs
      });
    }
    return NOT_FOUND();
  } catch (e) {
    if (e && e.message === "FORBIDDEN") return Response.json({
      error: "Brak dost\u0119pu"
    }, {
      status: 403
    });
    const msg = String(e && e.message || e);
    console.error("libraryAdmin:", msg.slice(0, 300));
    const known = /^(Niepoprawn|Wybierz|Wpisz|Podaj|Dozwolone|Sygnatura|Plik|Adres|Klucz|Ten rodzaj|Kolor|Ta grupa|Grupy|Dołącz|Potwierdź|Wskaż|Nieznany)/.test(msg);
    return Response.json({
      error: known ? msg : "Nie uda\u0142o si\u0119 zapisa\u0107."
    }, {
      status: 400
    });
  }
};
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: CORS
  });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: h
    });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({
      error: msg.slice(0, 300)
    }, {
      status,
      headers: CORS
    });
  }
});

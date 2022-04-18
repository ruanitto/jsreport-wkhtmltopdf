/*!
 * Copyright(c) 2014 Jan Blaha
 *
 * Recipe rendering pdf files using wkhtmltopdf.
 */

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var extend = require('node.extend.without.arrays')
var Promise = require('bluebird')
var wkhtmltopdf = require('wkhtmltopdf-installer')

var HtmlToPdf = function (reporter, definition) {
  this.reporter = reporter
  this.definition = definition

  this.execOptions = definition.options.execOptions || {}
  this.execOptions.env = extend(true, {}, process.env, this.execOptions.env)
  this.execOptions.maxBuffer = this.execOptions.maxBuffer || (1000 * 1024)
  this.allowLocalFilesAccess = definition.options.hasOwnProperty('allowLocalFilesAccess') ? definition.options.allowLocalFilesAccess : false
  this.wkhtmltopdfVersions = definition.options.wkhtmltopdfVersions = [{ version: wkhtmltopdf.version }]

  reporter.extensionsManager.recipes.push({
    name: 'wkhtmltopdf',
    execute: HtmlToPdf.prototype.execute.bind(this)
  })

  reporter.documentStore.registerComplexType('wkHtmlToPdfType', {
    orientation: { type: 'Edm.String' },
    header: { type: 'Edm.String' },
    footer: { type: 'Edm.String' },
    footerLeft: { type: 'Edm.String' },
    footerRight: { type: 'Edm.String' },
    footerFontSize: { type: 'Edm.String' },
    headerHeight: { type: 'Edm.String' },
    footerHeight: { type: 'Edm.String' },
    dpi: { type: 'Edm.String' },
    marginBottom: { type: 'Edm.String' },
    marginLeft: { type: 'Edm.String' },
    marginRight: { type: 'Edm.String' },
    marginTop: { type: 'Edm.String' },
    pageSize: { type: 'Edm.String' },
    pageHeight: { type: 'Edm.String' },
    pageWidth: { type: 'Edm.String' },
    cover: { type: 'Edm.String' },
    toc: { type: 'Edm.Boolean' },
    tocHeaderText: { type: 'Edm.String' },
    tocLevelIndentation: { type: 'Edm.String' },
    tocTextSizeShrink: { type: 'Edm.String' },
    title: { type: 'Edm.String' },
    keepRelativeLinks: { type: 'Edm.Boolean' },
    disableSmartShrinking: { type: 'Edm.Boolean' },
    printMediaType: { type: 'Edm.Boolean' },
    javascriptDelay: { type: 'Edm.String' },
    windowStatus: { type: 'Edm.String' },
    wkhtmltopdfVersion: { type: 'Edm.String' },
    zoom: { type: 'Edn.String' }
  })

  if (reporter.documentStore.model.entityTypes['TemplateType']) {
    reporter.documentStore.model.entityTypes['TemplateType'].wkhtmltopdf = { type: 'jsreport.wkHtmlToPdfType' }
  }

  reporter.initializeListeners.add(definition.name, () => {
    if (reporter.express) {
      reporter.express.exposeOptionsToApi(definition.name, {
        wkhtmltopdfVersions: definition.options.wkhtmltopdfVersions
      })
    }
  })
}

function createParams(reporter, request, options, definition, paths) {
  var params = []

  params.push('--debug-javascript')

  if (!options.allowLocalFilesAccess) {
    params.push('--disable-local-file-access')
  }

  Object.keys(definition.options).forEach(function (k) {
    if (k === 'allowLocalFilesAccess' || k === 'wkhtmltopdfVersions' || k === 'execOptions') {
      return
    }

    params.push('--' + k)

    if (definition.options[k] !== true) {
      params.push(definition.options[k])
    }
  })

  if (options.dpi) {
    params.push('--dpi')
    params.push(options.dpi)
  }

  if (options.javascriptDelay) {
    params.push('--javascript-delay')
    params.push(options.javascriptDelay)
  }

  if (options.windowStatus) {
    params.push('--window-status')
    params.push(options.windowStatus)
  }

  if (options.pageHeight) {
    params.push('--page-height')
    params.push(options.pageHeight)
  }

  if (options.pageWidth) {
    params.push('--page-width')
    params.push(options.pageWidth)
  }

  if (options.pageSize) {
    params.push('--page-size')
    params.push(options.pageSize)
  }

  if (options.marginBottom || options.marginBottom === 0) {
    params.push('--margin-bottom')
    params.push(options.marginBottom)
  }

  if (options.marginLeft || options.marginLeft === 0) {
    params.push('--margin-left')
    params.push(options.marginLeft)
  }

  if (options.marginRight || options.marginRight === 0) {
    params.push('--margin-right')
    params.push(options.marginRight)
  }

  if (options.marginTop || options.marginTop === 0) {
    params.push('--margin-top')
    params.push(options.marginTop)
  }

  if (options.orientation) {
    params.push('--orientation')
    params.push(options.orientation)
  }

  if (options.title) {
    params.push('--title')
    params.push(options.title)
  }

  if (options.header) {
    if (options.headerHeight) {
      params.push('--header-spacing')
      params.push(options.headerHeight)
    }

    params.push('--header-html')
    params.push('file:///' + paths['template-header'])
  }

  if (options.footer) {
    if (options.footerHeight && !params.includes('--footer-spacing')) {
      params.push('--footer-spacing')
      params.push(options.footerHeight)
    }

    params.push('--footer-html')
    params.push('file:///' + paths['template-footer'])
  }

  if (options.footerLeft) {
    if (options.footerHeight && !params.includes('--footer-spacing')) {
      params.push('--footer-spacing')
      params.push(options.footerHeight)
    }

    params.push('--footer-left')
    params.push(options.footerLeft)
  }

  if (options.footerRight) {
    if (options.footerHeight && !params.includes('--footer-spacing')) {
      params.push('--footer-spacing')
      params.push(options.footerHeight)
    }

    params.push('--footer-right')
    params.push(options.footerRight)
  }

  if (options.footerFontSize) {
    if (options.footerHeight && !params.includes('--footer-spacing')) {
      params.push('--footer-spacing')
      params.push(options.footerHeight)
    }

    params.push('--footer-font-size')
    params.push(options.footerFontSize)
  }

  if (options.cover) {
    params.push('cover')
    params.push('file:///' + paths['template-cover'])
  }

  if (options.keepRelativeLinks && JSON.parse(options.keepRelativeLinks)) {
    params.push('--keep-relative-links')
  }

  if (options.printMediaType && JSON.parse(options.printMediaType)) {
    params.push('--print-media-type')
  }

  if (options.disableSmartShrinking && JSON.parse(options.disableSmartShrinking)) {
    params.push('--disable-smart-shrinking')
  }

  if (options.zoom) {
    params.push('--zoom')
    params.push(options.zoom)
  }

  if (options.toc && JSON.parse(options.toc)) {
    params.push('toc')

    if (options.tocHeaderText) {
      params.push('--toc-header-text')
      params.push(options.tocHeaderText)
    }

    if (options.tocLevelIndentation) {
      params.push('--toc-level-indentation ')
      params.push(options.tocLevelIndentation)
    }

    if (options.tocTextSizeShrink) {
      params.push('--toc-text-size-shrink ')
      params.push(options.tocTextSizeShrink)
    }
  }

  params.push(paths.template)

  const outputPath = path.join(
    path.dirname(paths.template),
    `${path.basename(paths.template, '.html')}.pdf`
  )

  params.push(outputPath)

  return params
}

function processPart(reporter, options, req, type, paths) {
  if (!options[type]) {
    return Promise.resolve()
  }

  reporter.logger.debug('Starting child request to render pdf ' + type, req)

  // do an anonymous render
  const template = {
    content: options[type],
    engine: req.template.engine,
    recipe: 'html',
    helpers: req.template.helpers
  }

  return reporter.render({
    template
  }, req).then(function (res) {
    return reporter.writeTempFile((uuid) => `${uuid}-${type}.html`, res.content.toString()).then(function (result) {
      paths[`template-${type}`] = result.pathToFile
    })
  })
}

function processHeaderAndFooter(reporter, options, req, paths) {
  return processPart(reporter, options, req, 'header', paths).then(function () {
    return processPart(reporter, options, req, 'footer', paths).then(function () {
      return processPart(reporter, options, req, 'cover', paths)
    })
  })
}

HtmlToPdf.prototype.execute = function (request, response) {
  var self = this
  var reporter = self.reporter
  request.template.wkhtmltopdf = request.template.wkhtmltopdf || {}
  var options = request.template.wkhtmltopdf
  options.allowLocalFilesAccess = self.allowLocalFilesAccess
  options.proxy = self.proxy

  var paths = {}

  return reporter.writeTempFile((uuid) => `${uuid}.html`, response.content.toString()).then(function (result) {
    paths.template = result.pathToFile

    return processHeaderAndFooter(self.reporter, options, request, paths)
  }).then(function () {
    return self.conversion(createParams(self.reporter, request, options, self.definition, paths), request).then(function (buf) {
      response.meta.contentType = 'application/pdf'
      response.meta.fileExtension = 'pdf'

      response.content = buf
    })
  })
}

HtmlToPdf.prototype.conversion = function (parameters, request) {
  var reporter = this.reporter
  var exePath = wkhtmltopdf.path

  if (request.template.wkhtmltopdf.wkhtmltopdfVersion) {
    var wkhtmltopdfVersions = this.definition.options.wkhtmltopdfVersions.filter(function (p) {
      return p.version === request.template.wkhtmltopdf.wkhtmltopdfVersion
    })

    // default doesn't have a path
    if (wkhtmltopdfVersions.length === 1 && wkhtmltopdfVersions[0].path) {
      exePath = wkhtmltopdfVersions[0].path
    }
  }

  reporter.logger.debug('wkhtmltopdf  ' + parameters.join(' '), request)

  var self = this

  var timeout = reporter.getAvailableRenderTimeout(request, self.execOptions.timeout)

  var execOptions = Object.assign({}, self.execOptions)

  if (timeout != null) {
    execOptions.timeout = timeout
    execOptions.killSignal = 'SIGTERM'
  }

  return new Promise(function (resolve, reject) {
    childProcess.execFile(exePath, parameters, execOptions, function (err, stderr, stdout) {
      reporter.logger.debug((err || '') + (stderr || '') + (stdout || ''), request)

      if (err) {
        if (err.killed && err.signal === 'SIGTERM' && execOptions.timeout != null) {
          return reject(new Error('Timeout Error: wkhtmltopdf generation not completed after ' + execOptions.timeout + 'ms'))
        }

        return reject(err)
      }

      fs.readFile(parameters[parameters.length - 1], function (err, buf) {
        if (err) {
          return reject(err)
        }

        resolve(buf)
      })
    })
  })
}

module.exports = function (reporter, definition) {
  const versionSupported = /^2/

  if (!versionSupported.test(reporter.version)) {
    throw new Error(`${definition.name} extension version currently installed can only be used in jsreport v2, your current jsreport installation (${reporter.version
      }) is incompatible with this extension. please downgrade ${definition.name} extension to a version which works with jsreport ${reporter.version
      } or update jsreport to v2`)
  }

  if (definition.options.execOptions && definition.options.execOptions.timeout != null && reporter.options.reportTimeout != null) {
    reporter.logger.warn('"extensions.wkhtmltopdf.execOptions.timeout" configuration is ignored when "reportTimeout" is set')
  } else if (definition.options.execOptions && definition.options.execOptions.timeout != null) {
    reporter.logger.warn('"extensions.wkhtmltopdf.execOptions.timeout" configuration is deprecated and will be removed in the future, please use "reportTimeout" instead')
  }

  reporter.wkhtmltopdf = new HtmlToPdf(reporter, definition)
}

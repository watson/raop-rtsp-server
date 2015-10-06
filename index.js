'use strict'

var rtsp = require('rtsp-server')
var mdns = require('raop-mdns-server')
var xtend = require('xtend')
var randomMac = require('random-mac')
var rtspMethods = require('./lib/rtsp-methods')
var debug = require('./lib/debug')
var pkg = require('./package')

var serverAgent = 'AirTunes/105.1'

global._raopMacAddr = randomMac()

exports.sessions = require('./lib/sessions')

exports.start = function (opts) {
  opts = xtend({ port: 5000, name: pkg.name }, opts)

  var server = rtsp.createServer(function (req, res) {
    res.setHeader('Server', serverAgent)

    if (!~rtspMethods.METHODS.indexOf(req.method)) {
      res.statusCode = 501 // Not Implemented
      res.end()
      return
    }

    rtspMethods[req.method.toLowerCase()](req, res)
  })

  server.listen(opts.port, function () {
    var addr = server.address()
    debug('RAOP RTSP server listening', addr)

    var txt = {
      txtvers: '1',
      ch: '2',
      cn: '0,1',
      ek: '1',
      et: '0,1',
      sv: 'false',
      da: 'true',
      sr: '44100',
      ss: '16',
      pw: 'false',
      vn: '65537',
      tp: 'TCP,UDP',
      vs: '105.1',
      am: 'AirPort4,107',
      fv: '76400.10',
      sf: '0x0'
    }

    mdns({ name: opts.name, port: addr.port, txt: txt, mac: global._raopMacAddr }, function (err, result) {
      if (err) throw err
    })
  })

  return server
}

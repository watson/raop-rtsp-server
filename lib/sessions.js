'use strict'

var uuid = require('node-uuid')
var debug = require('./debug')

var uris = {} // TODO: Figure out the right connection between URI's and sessions ;)
var sessions = {}

exports.uri = function (uri, val) {
  if (!(uri in uris)) uris[uri] = val || {}
  else if (val) uris[uri] = val
  return uris[uri]
}

exports.get = function (req, init) {
  var uri = req.uri
  var id = req.headers['session'] || init && uuid.v4()
  var session = sessions[id]
  if (!session) {
    if (!init) throw new Error('Unknown session') // TODO: There must be a better way to handle this
    debug('creating new session', id)
    sessions[id] = session = { id: id, uris: {} }
  }
  if (!(uri in session.uris)) session.uris[uri] = uris[uri]
  return session
}

exports.end = function (req) {
  var id = req.headers['session']
  debug('clearing session', id)
  delete sessions[id]
}

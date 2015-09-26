'use strict'

var util = require('util')
var stream = require('readable-stream')
var EventEmitter = require('events').EventEmitter
var uuid = require('node-uuid')
var SequenceStream = require('./sequence-stream')
var debug = require('./debug')

var uris = {} // TODO: Figure out the right connection between URI's and sessions ;)
var pool = {}

var emitter = module.exports = new EventEmitter()

emitter.uri = function (uri, val) {
  if (!(uri in uris)) uris[uri] = val || {}
  else if (val) uris[uri] = val
  return uris[uri]
}

emitter.get = function (req, init) {
  var uri = req.uri
  var id = req.headers['session'] || init && uuid.v4()
  var session = pool[id]
  if (!session) {
    if (!init) throw new Error('Unknown session') // TODO: There must be a better way to handle this
    debug('creating new session', id)
    pool[id] = session = new Session(id)
    this.emit('new', session)
  }
  if (!(uri in session.uris)) session.uris[uri] = uris[uri]
  return session
}

emitter.end = function (req) {
  var id = req.headers['session']
  debug('clearing session', id)
  delete pool[id]
}

var Session = function (id, opts) {
  if (!(this instanceof Session)) return new Session(id, opts)

  stream.PassThrough.call(this, opts)

  this.id = id
  this.uris = {}
  this._rtpStream = new SequenceStream(this)
}

util.inherits(Session, stream.PassThrough)

Session.prototype.setDecoder = function (decoder) {
  this._decoder = decoder
  this._rtpStream.pipe(decoder).pipe(this)
}

Session.prototype.add = function (seq, chunk) {
  this._decoder.packets(chunk.length) // Someone should fix this API
  this._rtpStream.add(seq, chunk)
}

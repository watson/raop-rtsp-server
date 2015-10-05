'use strict'

var server = require('../index')
var Speaker = require('speaker')

var speaker = new Speaker({
  channels: 2,
  bitDepth: 16,
  sampleRate: 44100
})

server.sessions.on('new', function (session) {
  session.pipe(speaker)
  session.on('data', function (chunk) {
    console.log('received %d audio bytes on session %s', chunk.length, session.id)
  })
})

server.start({ name: 'NodeTunes' })

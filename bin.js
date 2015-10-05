#!/usr/bin/env node
'use strict'

var server = require('./')
var dest

if (process.argv[2] === '--stdout') {
  dest = process.stdout
} else {
  try {
    var Speaker = require('speaker')
    dest = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100
    })
  } catch (e) {
    console.error('Warning: Could not load speaker module')
  }
}

server.sessions.on('new', function (session) {
  if (!dest) return session.resume()

  session.on('data', function (chunk) {
    for (var offset = 0, blocks = chunk.length; offset < blocks; offset += 2) {
      chunk.writeInt16LE(Math.round(chunk.readInt16LE(offset) * session.volume), offset)
    }
    dest.write(chunk)
  })
})

server.start()

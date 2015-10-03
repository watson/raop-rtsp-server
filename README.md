# raop-rtsp-server

An attempt to create a RAOP (AirTunes) server in Node.js.

**This project is highly work-in-progress - use it at your own risk!**

[![Build status](https://travis-ci.org/watson/raop-rtsp-server.svg?branch=master)](https://travis-ci.org/watson/raop-rtsp-server)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Prerequisites

This server outputs raw [PCM
audio](https://en.wikipedia.org/wiki/Pulse-code_modulation) in STDOUT,
which not that many programs know how to play back. The best piece of
software that I've found to be up to the job is
[sox](http://sox.sourceforge.net).

Install via Homebrew:

```
brew install sox
```

FFmpeg can also parse PCM audio if you like that program better.

## Installation

For standalone usage, run:

```
npm install --global raop-rtsp-server
```

For programmatic usage, run:

```
npm install raop-rtsp-server
```

## CLI usage

Run and redirect output to STDOUT (it's important that you pipe or
redirect it somewhere safe):

```
raop-rtsp-server --stdout | sox -traw -L -c2 -r44100 -b16 -e signed-integer - -tcoreaudio
```

For `sox` to be able to interpret the raw ALAC audio data, you need to
help it a little. These are the command line arguments given in the
example above:

- `-t raw` - Set input type to `raw`. This means that sox shouldn't
  expect any headers in the data - just raw audio
- `-L` - The audio data is formatted using native byte ordering, which
  is little endian on Intel CPU's. Your system might use `-B` for big
  endian
- `-c 2` - Use 2 audio channels
- `-r 44100` - Use a 44.1khz sample rate
- `-b 16` - Use a bit-depth of 16
- `-e signed-integer` - The audio encoding type
- `-` - Set input source to STDIN
- `-t coreaudio` - Set output type to `coreaudio` (your system might
  differ, but this must always come after your input source)

To run in debug mode (shown here without writing audio data to STDOUT):

```
DEBUG=* raop-rtsp-server
```

## Programmatic usage

The module can also be access programmatically:

```js
var server = require('raop-rtsp-server')

server.sessions.on('new', function (session) {
  session.on('data', function (chunk) {
    console.log('received %d audio bytes on session %s', chunk.length, session.id)
  })
})

server.start({ name: 'NodeTunes' })
```

The `server.start()` function takes an optional options object:

- `name` - The name that the RAOP server (this will be shown on your
  iDevices). Defaults to `raop-rtsp-server`
- `port` - The port that the server should listen on. Defaults to `5000`

### Session

The `session` object emitted by the `new` event is a readable stream and
will output raw PCM audio data.

#### Properties

- `volume` - A float between 0 and 1 representing the current volume
  level (0 being muted and 1 being full volume)
- `volumeDb` - A float value representing the audio attenuation in dB.
  It ranges from `-30` (lowest) to `0` (highest). A special number
  `-144` represents mute.

#### Events

Besides the normal readable stream API, the session also emits the
following events:

##### `volume`

Emitted when ever the client changes the volume. The value emitted is
the volume as a float value representing the audio attenuation in dB. It
ranges from `-30` (lowest) to `0` (highest). A special number `-144`
represents mute.

## Todo's

- Implement proper RTP control server
- Implement proper timing server
- Implement `PAUSE` RTSP method
- Implement `GET_PARAMETER` RTSP method
- Implement non standard `POST` RTSP method
- Implement non standard `GET` RTSP method
- Don't use hardcoded ports
- Support other audio formats than ALAC

## License

MIT

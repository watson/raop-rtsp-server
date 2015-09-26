# raop-rtsp-server

An attempt to create a RAOP (AirTunes) server in Node.js.

*This project is highly work-in-progress - use it at your own risk!*

[![Build status](https://travis-ci.org/watson/raop-rtsp-server.svg?branch=master)](https://travis-ci.org/watson/raop-rtsp-server)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Prerequisites

This server outputs raw ALAC (Apple Lossless) audio in STDOUT, which not
that many programs know how to play back. The only piece of software
that I've found to be up to the job is
[sox](http://sox.sourceforge.net).

Install via Homebrew:

```
brew install sox
```

## Installation

```
git clone https://github.com/watson/raop-rtsp-server.git
cd raop-rtsp-server
```

## Run

Run and redirect output to STDOUT (it's important that you pipe or
redirect it somewhere safe):

```
node index.js --stdout | sox -traw -L -c2 -r44100 -b16 -e signed-integer - -tcoreaudio
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
DEBUG=* node index.js
```

## Todo's

- Implement proper RTP control server
- Implement proper timing server
- Add volume support
- Implement `PAUSE` RTSP method
- Implement `SET_PARAMETER` RTSP method
- Implement `GET_PARAMETER` RTSP method
- Implement non standard `POST` RTSP method
- Implement non standard `GET` RTSP method

## License

MIT

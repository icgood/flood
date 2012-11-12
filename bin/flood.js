#!/usr/bin/env node
// Copyright (c) 2012 Ian C. Good
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//

var cluster = require('cluster'),
    os = require('os'),
    vm = require('vm'),
    http = require('http'),
    url = require('url');

function Counter(names) {
  this.names = names;
  this.counters = {};
  this.reset();
}

Counter.prototype.reset = function () {
  var i;
  for (i=0; i<this.names.length; i++) {
    this.counters[this.names[i]] = 0;
  }
};

Counter.prototype.add = function (counters) {
  var i;
  for (i=0; i<worker.counters.length; i++) {
    this.counters[this.names[i]] += counters[this.names[i]];
  }
};

Counter.prototype.initialize = function () {
  var self = this;
  this.reset();
  setInterval(function () {
    process.send(self.counters);
    self.reset();
  }, config.interval);
};

Counter.prototype.increment = function (name) {
  this.counters[name]++;
};

function startTest(options, res) {
}

if (cluster.isMaster) {
  http.createServer(function (req, res) {
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    if (req.headers['content-type'] !== 'text/javascript') {
      res.writeHead(415);
      res.end();
      return;
    }
    var fileParts = [];
    req.on('data', function (buf) {
      fileParts.push(buf);
    });
    req.on('end', function () {
      var numWorkers = req.headers['x-workers'] || 0;
      var options = {
        filename: url.parse(req.url).pathname,
        snapshots: req.headers['x-snapshots'] || 10,
        snapshotLength: req.headers['x-snapshot-length'] || 1000,
        workers: numWorkers > 0 ? numWorkers : os.cpus().length + numWorkers,
        file: fileParts.join(''),
      };
      startTest(options, res);
    });
  }).listen(5143);
}
else {
  process.on('message', function (options) {
    var sandbox = {
      counters: [],
      setUp: null,
      run: null,
      tearDown: null,
    };
    vm.runInNewContext(options.file, sandbox, options.filename);

  });
}

// vim:ft=javascript:et:sw=2:ts=2:sts=2:

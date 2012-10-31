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
    net = require('net');

var configFile = process.argv[2] || 'config.json';
var config = require(configFile);

var worker = require(config.workerModule);

function Counter() {
  this.counter = null;
}

Counter.prototype.initialize = function () {
  var self = this;
  this.counter = 0;
  setInterval(function () {
    process.send(self.counter);
    self.counter = 0;
  }, config.interval);
};

Counter.prototype.increment = function () {
  this.counter++;
};

function writeCounter(counter, sock) {
  sock.write(counter+'\r\n');
}

var seenWorkers = 0;
var counter = 0;

function createAgent(sock, numWorkers) {
  var worker = cluster.fork();
  worker.on('message', function (count) {
    seenWorkers++;
    counter += count;
    if (seenWorkers >= numWorkers) {
      writeCounter(counter, sock);
      counter = 0;
      seenWorkers = 0;
    }
  });
  return worker;
}

if (cluster.isMaster) {
  var numWorkers = config.numWorkers > 0 ? config.numWorkers :
                   os.cpus().length + config.numWorkers;
  var workers = [];
  net.createServer(function (sock) {
    while (workers.length < numWorkers) {
      workers.push(createAgent(sock, numWorkers));
    }
    sock.on('end', function () {
      var i;
      for (i=0; i<workers.length; i++) {
        workers[i].destroy();
      }
      workers = [];
    });
  }).listen(config.clientPort);

  cluster.on('exit', function(worker, code, signal) {
    if (!worker.suicide) {
      console.log('worker ' + worker.process.pid + ' died');
      var i;
      for (i=0; i<workers.length; i++) {
        if (workers[i] == worker) {
          workers[i] = createAgent(sock, numWorkers);
        }
      }
    }
  });
}
else {
  var counter = new Counter();
  worker.start(config, counter);
}

// vim:ft=javascript:et:sw=2:ts=2:sts=2:

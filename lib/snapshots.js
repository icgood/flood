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

function Snapshots(names, numSnapshots) {
  this.names = names || [];
  this.current = 0;
  this.counters = [];
  this.counters.length = numSnapshots || 0;

  var i, j;
  for (i=0; i<this.counters.length; i++) {
    this.counters[i] = {};
    for (j=0; j<this.names.length; j++) {
      this.counters[i][this.names[j]] = [0, 0];
    }
  }
}

Snapshots.prototype.add = function (s2) {
  var i, j;
  this.names = s2.names;
  while (this.counters.length < s2.counters.length) {
    this.counters.push({});
  }
  for (i=0; i<this.counters.length; i++) {
    for (j=0; j<s2.names.length; j++) {
      var name = s2.names[j];
      if (this.counters[i][name] === undefined) {
        this.counters[i][name] = s2.counters[i][name].slice(0);
      }
      else {
        this.counters[i][name][0] += s2.counters[i][name][0];
        this.counters[i][name][1] += s2.counters[i][name][1];
      }
    }
  }
};

Snapshots.prototype.start = function (snapshotLength, callback) {
  var self = this;
  this.current = 0;
  var interval = setInterval(function () {
    self.current++;
    if (self.current === self.counters.length) {
      process.nextTick(callback);
    }
  }, snapshotLength);
};

Snapshots.prototype.counterInc = function (name) {
  if (this.current < this.counters.length) {
    this.counters[this.current][name][1]++;
  }
};

Snapshots.prototype.counterAdd = function (name, value) {
  if (this.current < this.counters.length) {
    this.counters[this.current][name][0]++;
    this.counters[this.current][name][1] += value;
  }
};

Snapshots.prototype.toJSON = function () {
  return {
    names: this.names,
    snapshots: this.counters,
  };
};

function fromJSON(data) {
  var ret = new Snapshots(data.names, data.snapshots.length);
  ret.counters = data.snapshots;
  return ret;
}

exports.Snapshots = Snapshots;
exports.fromJSON = fromJSON;

// vim:ft=javascript:et:sw=2:ts=2:sts=2:

'use strict';

var request = require('request');
var phantomjs = require('phantomjs');
var Nightmare = require('nightmare');
var path = require('path');
var homeDir = require('os-homedir');
var Promise = require('bluebird');
var cheerio = require('cheerio');

function Askfm(account) {
  this.account = account;
}

Askfm.prototype.getLog = function() {
  var account = this.account;
  return new Promise(function(resolve, reject) {
    request('http://ask.fm/feed/profile/' + account + '.rss', function(err, res, body) {
      if (err) {
        return reject(err);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('status code is ' + res.statusCode));
      }

      var $ = cheerio.load(body, {ignoreWhitespace: true, xmlMode: true});
      resolve(
        $('item').map(function(i, elem) {
          return {
            link : $(this).children('link').text(),
            title: $(this).children('title').text(),
            desc : $(this).children('description').text()
          };
        })
        .get()
        .reverse()
      );
    });
  });
}

Askfm.prototype.postQuestion = function(user, question) {
  var account = this.account;
  var cookiesFile = homeDir() + '/.askfm-cookies';
  var nightmare = new Nightmare({
    cookiesFile: cookiesFile,
    phantomPath: path.dirname(phantomjs.path) + '/'
  });
  return new Promise(function(resolve, reject) {
    var isLogin = false;
    nightmare
    .goto('https://ask.fm')
    .evaluate(function () {
      return window.location.href;
    }, function (url) {
      isLogin = url === 'https://ask.fm/account/wall';
    })
    .run(function(err) {
      return err ? reject(err) : resolve(isLogin);
    });
  })
  .then(function(isLogin) {
    if (isLogin) {
      return Promise.resolve();
    }
    return new Promise(function(resolve, reject) {
      nightmare
      .viewport(1024, 640)
      .goto('https://ask.fm/login')
      .type('input[name="login"]', user.login)
      .type('input[name="password"]', user.password)
      .click('input[type="submit"]')
      .wait('input[name="question[anonymous]"]')
      .run(function(err) {
        return err ? reject(err) : resolve();
      });
    });
  })
  .then(function() {
    return new Promise(function(resolve, reject) {
      nightmare
      .viewport(1024, 640)
      .goto('https://ask.fm/' + account)
      .wait('input[name="question[anonymous]"]')
      .type('textarea[name="question[question_text]"]', question)
      .click('input[type="submit"]')
      .run(function(err) {
        return err ? reject(err) : resolve();
      });
    });
  });
}

module.exports = Askfm;


"use strict";

var $ = require ('jquery');

window.jQuery = $;

var angular = require ('angular');
var angular_material = require ('angular-material');
var path = require ('path');
var katex = require ('katex');
var marked = require ('8fold-marked');
var brace = require ('brace');
var angularUiAce = require ('angular-ui-ace');
require('brace/mode/python');
require('brace/mode/markdown');
require('brace/mode/c_cpp');
require('brace/theme/chrome');
require('brace/ext/language_tools');
require('brace/ext/searchbox');
require('brace/ext/settings_menu');
require('./../tools/snippets/python.js');
require('./../tools/snippets/markdown.js');
require('./../tools/snippets/c_cpp.js');

var makefile = require ('makefile.js');

var highlight = require('highlight.js');

var DEVICES = require ('usb_mapping');

var FIRMWARE_TYPES = require ('firmware');

var FIRMWARE_MAX_LINES = 35;

var _ = require ('lodash');
var EventEmitter = require ('events').EventEmitter;
var uuid = require ('uuid');

var ITEM_SNIPPETS = {
  'markdown': '## New Item',
  'code':'print \'New Item\'',
  'arduino':'// firmata'
};
var wyliodrin = null;

var aceEdit = null;

var app = angular.module ("wyliodrinAppNotebook", ['ngMaterial', 'ui.ace'], function ($provide)
{
	$provide.decorator('$window', function($delegate) 
	{
      try
      {
        $delegate.history = null;
      }
      catch (e)
      {
        
      }
      return $delegate;
    });
});

app.factory ('$wydevice', function ($timeout)
{
  window.addEventListener ('message', function (message)
  {
    wyliodrin = message.source;
    if (message.data.type === 'wydevice-message')
    {
      deviceService.emit ('message', message.data.t, message.data.d);
    }
    else
    if (message.data.type === 'wydevice-status')
    {
      deviceService.emit ('status', message.data.s);
    }
    else
    if (message.data.type === 'file')
    {
      if (message.data.d.f === 'image')
      {
        $timeout (function ()
        {
          aceEdit.insert ('!['+message.data.d.n+']('+message.data.d.d+')');
        });
      }
      else
      if (message.data.d.f === 'arbitrary')
      {
        $timeout (function ()
        {
          var s = message.data.d.d;
          if (s.indexOf ('data:;')===0)
          {
            s = 'data:application/octet-stream'+s.substring (4);
          }
          aceEdit.insert ('['+message.data.d.n+']('+s+')'); 
        });
      }
    }
  });

  var deviceService = 
  {
    send: function (t, d)
    {
      if (wyliodrin)
      {
        wyliodrin.postMessage ({type:'wydevice-message', t:t, d:d}, '*');
      }
    }
  };
  deviceService = _.assign (new EventEmitter(), deviceService);
  return deviceService;
});

app.config( [
    '$compileProvider',
    function( $compileProvider )
    {   
        $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension):/);
    }
]);

app.controller ('NotebookController', function ($scope, $timeout, $mdDialog, $wydevice)
{
  var that = this;

  function store ()
  {
    if (wyliodrin) wyliodrin.postMessage ({type:'notebook', d:$scope.items}, '*');
  }

  function load (items)
  {
    that.firmwareEditors = [];
    if (!items) items = [];
    $scope.items = items;
    if ($scope.items.length === 0)
    {
      $scope.items.push ({
        type:'markdown',
        text:'',
        label: uuid.v4 ()
      });
    }
    $scope.activeLabel = ($scope.items.length === 1 && $scope.items[0].text.trim()==='')?$scope.items[0].label:null;
    $scope.editLabel = null;
    $scope.evaluatingLabel = null;
    $scope.flashingLabel = null;
    $scope.serialLabel = null;
  }

  $scope.connected = false;

  $scope.ports = [];
  $scope.firmwareTypes = FIRMWARE_TYPES;

  $scope.status = 'STOPPED';

  $scope.serialinput = '';

  $scope.serialrates = [300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200];

  load ([]);

  var platform = '';
  var category = '';

  this.firmwareEditors = [];

  window.addEventListener ('message', function (message)
  {
    if (message.data.type === 'notebook')
    {
      that.reset ();
      $timeout (function ()
      {
        var items = message.data.d;
        _.each (items, function (item)
        {
          if (!item.label)
          {
            item.label = uuid.v4 ();
          }
        });
        load (items);
      });
    }
  });

  $scope.aceCodeLoaded = function (_editor)
  {
    _editor.$blockScrolling = Infinity;
    _editor.getSession().setTabSize (2);
    _editor.getSession().setUseSoftTabs (true);
    _editor.setOptions ({minLines:3, maxLines: Infinity});
    _editor.commands.addCommand({
      name: "evaluate",
      bindKey: {win: "shift-enter", mac: "shift-enter"},
      exec: function(editor) {
          var item = findLabel ($scope.activeLabel);
          if (item)
          {
            if (item.type === 'code') that.evaluate ($scope.activeLabel);
            else
            if (item.type === 'firmware') that.flash ($scope.activeLabel);
          }
        }
      });
  };

  $scope.aceFirmwareLoaded = function (_editor)
  {
    _editor.$blockScrolling = Infinity;
    _editor.getSession().setTabSize (2);
    _editor.getSession().setUseSoftTabs (true);
    _editor.setOptions ({minLines:3, maxLines: FIRMWARE_MAX_LINES});
    _editor.commands.addCommand({
      name: "evaluate",
      bindKey: {win: "shift-enter", mac: "shift-enter"},
      exec: function(editor) {
          var item = findLabel ($scope.activeLabel);
          if (item)
          {
            if (item.type === 'code') that.evaluate ($scope.activeLabel);
            else
            if (item.type === 'firmware') that.flash ($scope.activeLabel);
          }
        }
      });
    that.firmwareEditors.push (_editor);
  };

  $scope.aceCodeChanged = function ()
  {
    store ();
  };

  $scope.aceFirmwareUnloaded = function (_editor)
  {
    console.log ('unload');
    _.remove (that.firmwareEditors, function (editor) { return editor === _editor;});
  };
  $scope.aceEditLoaded = function (_editor)
  {
    aceEdit = _editor;
    _editor.$blockScrolling = Infinity;
    _editor.getSession().setTabSize (2);
    _editor.getSession().setUseSoftTabs (true);
  };
  $scope.aceEditChanged = function (_editor)
  {
    store ();
  };

  this.activate = function (label)
  {
    if ($scope.activeLabel !== label)
    {
      $scope.activeLabel = label;
      $scope.editLabel = null;
    }
  };

  this.up = function (index)
  {
    if (index > 0)
    {
      var item = $scope.items[index];
      $scope.items[index] = $scope.items[index-1];
      $scope.items[index-1] = item;
      store ();
    }
  };

  this.down = function (index)
  {
    if (index < $scope.items.length-1)
    {
      var item = $scope.items[index];
      $scope.items[index] = $scope.items[index+1];
      $scope.items[index+1] = item;
      store ();
    }
  };

  this.edit = function (label)
  {
    if ($scope.editLabel !== label)
    {
      $scope.editLabel = label;
    }
    else
    {
      $scope.editLabel = null;
    }
  };

  this.link = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('[text](http://...)');
    });
  };

  this.numbered = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('\n1. Item\n2. Item \n3. Item');
    });
  };

  this.points = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('\n* Item\n* Item \n* Item');
    });
  };

  this.heading1 = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('\n# Title');
    });
  };

  this.heading2 = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('\n## Title');
    });
  };

  this.heading3 = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('\n### Title');
    });
  };

  this.source = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('\n```language\nsource\n```');
    });
  };

  this.bold = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('**text**');
    });
  };

  this.italics = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('*italics*');
    });
  };

  this.image = function (label)
  {
    wyliodrin.postMessage ({ type: 'file',
      t:'load',
      d:
      {
        f:[{mimeTypes:['image/*']}],
        e:'url',
        d:'image',
        l: label
      }
    }, '*');
  };

  this.imagelink = function (label)
  {
    $timeout (function ()
    {
      aceEdit.insert ('\n![image](http://...)');
    });
  };

  this.arbitraryfile = function (label)
  {
    wyliodrin.postMessage ({ type: 'file',
      t:'load',
      d:
      {
        f:[{mimeTypes:['*/*']}],
        e:'url',
        d:'arbitrary',
        l: label
      }
    }, '*');
  };

  this.insert = function (index)
  {
    var item = {
      type: $scope.items[index].type,
      text: ITEM_SNIPPETS[$scope.items[index].type],
      label: uuid.v4 (),
      port: {
        type: ($scope.items[index].type==='firmware'?'arduino/uno':'')
      }
    };
    $scope.items.splice (index+1, 0, item);
    $scope.activeIndex = index+1;
    $scope.editIndex = index+1;
    store ();
  };

  this.delete = function (index)
  {
    if ($scope.items.length > 1)
    {
      $mdDialog.hide ();
        var that = this;
        var message = $mdDialog.confirm()
                .title('Erase Item')
                .textContent('Are you sure you want to erase this item?')
                .ok('YES')
                .cancel('NO');
          $mdDialog.show(message).then(function() {
            $scope.items.splice (index, 1);
            $scope.activeIndex = -1;
            $scope.editIndex = -1;
            store ();
          }, function() {
          });
    }
  };

  this.deletestderr = function (label)
  {
    var item = findLabel (label);
    if (item) item.stderr = '';
  };

  this.deletestdout = function (label)
  {
    var item = findLabel (label);
    if (item) item.stdout = '';
  };

  this.deleteexception= function (label)
  {
    var item = findLabel (label);
    if (item) item.exception = '';
  };

  this.deleteresponse = function (label)
  {
    var item = findLabel (label);
    if (item) item.response = '';
  };

  this.evaluate = function (label)
  {
      var item = findLabel(label);
      if (item && item.type === 'code' && $scope.connected)
      {
        item.response = null;
        item.exception = '';
        item.stdout = '';
        item.stderr = '';
        $wydevice.send ('note', {
          a: 'r',
          l: item.label,
          s: item.text
        });
        $scope.evaluatingLabel = label;
      }
  };

  this.stop = function (label)
  {
    $wydevice.send ('note', {
      a:'s'
    });
  };

  this.flash = function (label)
  {
    var item = findLabel (label);
    if (item && $scope.connected)
    {
      var typedevice = item.port.type.split ('/');
      var type = typedevice[0];
      var device = typedevice[1];
      var m = '';
      if (makefile[platform].compileHere && makefile[platform].compileHere[category] && makefile[platform].compileHere[category][type])
      {
        m = makefile[platform].compileHere[category][type];
      }
      else if (makefile[platform].send)
      {
        m = makefile[platform].send[type];
      }
      if (makefile[platform].flash && makefile[platform].flash[category] && makefile[platform].flash[category][type])
      {
        m = m + '\n\n' + makefile[platform].flash[category][type];
      }
      $wydevice.send ('note', {
        a:'f',
        l: label,
        f: item.text,
        s: FIRMWARE_TYPES[type].source,
        d: device,
        p: item.port.path,
        m: m,
        mfl: makefile[platform].compileAway[type],
        b: item.port.baud || 9600
      });
      item.response = '';
      item.hasErrors = false;
      item.stdout = '';
      item.stderr = '';
      $scope.flashingLabel = label;
    }
  };

  this.stopflash = function (label)
  {
    if ($scope.flashingLabel)
    {
      $wydevice.send ('note', {
        a:'',
        f:''
      });
    }
    else
    if ($scope.serialLabel)
    {
      $wydevice.send ('note', {
        a:'serial',
        l:''
      });
    }
  };

  this.print = function ()
  {
    $('body').css ('height', 'initial');
    _.map (that.firmwareEditors, function (editor)
    {
      editor.setOptions ({minLines:3, maxLines: Infinity});
    });
    $timeout (function ()
    {
      window.print ();
      $('body').css ('height', '');
      _.map (that.firmwareEditors, function (editor)
      {
        editor.setOptions ({minLines:3, maxLines: FIRMWARE_MAX_LINES});
      });
    }, 400);
  };

  this.serial = function (label)
  {
    var item = findLabel (label);
    if (item && $scope.connected)
    {
      $wydevice.send ('note', {
        a:'serial',
        l: label,
        p: item.port.path,
        b: item.port.baud || 9600
      });
      item.response = '';
      item.stdout = '';
      item.stderr = '';
      $scope.serialLabel = label;
    }
  };

  this.serialinput = function (label)
  {
    $wydevice.send ('note', {
      a:'f',
      s:$scope.serialinput,
      l:label
    });
    $scope.serialinput = '';
  };

  this.itemType = function (label)
  {
    store ();
  };

  this.reset = function ()
  {
    $wydevice.send ('note', {
      a: 'reset'
    });
  };

  this.stop_python = function ()
  {
    $wydevice.send ('note', {
      a: 'stop'
    });
  };

  this.firmwareType = function (label)
  {
    store ();
  };

  this.port = function (label, port)
  {
    var type = findFirmwareType (port.vid, port.pid);
    if (type)
    {
      var item = findLabel (label);
      if (item)
      {
        item.port.type = type;
        item.port.path = port.p;
      }
    }
    store ();
  };

  function findLabel (label)
  {
    return _.find ($scope.items, function (item)
    {
      return item.label === label;
    });
  }

  function firmwareName (port)
  {
    var portName = port.s;
    if (port.vid)
    {
      if (DEVICES[port.vid]) portName = DEVICES[port.vid].name;
    }
    if (port.vid && port.pid && DEVICES[port.vid] && DEVICES[port.vid][port.pid])
    {
      portName = portName+' '+DEVICES[port.vid][port.pid].name;
    }
    return portName + ' ('+path.basename (port.p)+')';
  }

  function findFirmwareType (vid, pid)
  {
    var type = null;
    if (DEVICES[vid] && DEVICES[vid][pid])
    {
      type = DEVICES[vid].type+'/'+DEVICES[vid][pid].type;
    }
    return type;
  }

  $wydevice.on ('message', function (t, p)
  {
    var item = null;
    if (t === 'note')
    {
      if (p.l) item = findLabel (p.l);
      if (p.a === 'status')
      {
        if (p.r === 'r')
        {
          $timeout (function ()
          {
            if (p.l) 
            {
              $scope.evaluatingLabel = p.l;
              $scope.status = 'PROCESSING';
            }
            else
            {
              $scope.evaluatingLabel = null;
              $scope.status = 'READY';
            }
          });
        }
        if (p.r === 's')
        {
          $timeout (function ()
          {
            $scope.evaluatingLabel = null;
            $scope.status = 'STOPPED';
          });
        }
      }
      else
      if (p.a === 'r')
      {
        if (p.t === 's')
        {
          if (p.s === 'o')
          {
            if (item) $timeout (function ()
              {
                item.stdout = item.stdout + p.d;
                store ();
              });
          }
          else
          if (p.s === 'e')
          {
            if (item) $timeout (function ()
              {
                item.stderr = item.stderr + p.d;
                store ();
              });
          }
        }
        else
        if (p.t === 'd')
        {
          if (item) $timeout (function ()
            {
              $scope.evaluatingLabel = null;
            });
        }
        else
        if (p.t === 'e')
        {
          if (item) $timeout (function ()
            {
              item.exception = p.d.buf;
              store ();
            });
        }
        else
        if (p.t === 'r')
        {
          if (item) $timeout (function ()
            {
              item.response = p.d;
              store ();
            });
        }
      }
      else
      if (p.a === 'f')
      {
        if (p.s === 'o')
        {
          if (item) $timeout (function ()
          {
            item.stdout = item.stdout + p.d;
            store ();
          });
        }
        else
        if (p.s === 'e')
        {
          if (item) $timeout (function ()
          {
            item.stderr = item.stderr + p.d;
            store ();
          });
        }
        else
        if (p.s === 'r')
        {
          if (item) $timeout (function ()
          {
            item.hasErrors = false;
            item.response = item.response + p.d;
            store ();
          });
        }
        else
        if (p.s === 'f')
        {
          $timeout (function ()
          {
            if (p.e) item.hasErrors = true;
            $scope.flashingLabel = null;
          });
        }
      }
      else
      if (p.a === 'serial')
      {
        if (p.s === 'o')
        {
          if (item) $timeout (function ()
          {
            item.stdout = item.stdout + p.d;
            store ();
          });
        }
        else
        if (p.s === 'e')
        {
          if (item) $timeout (function ()
          {
            item.stderr = item.stderr + p.d;
            store ();
          });
        }
        else
        if (p.s === 'r')
        {
          if (item) $timeout (function ()
          {
            item.hasErrors = false;
            item.response = item.response + p.d;
            store ();
          });
        }
        if (p.s === 'f')
        {
          $timeout (function ()
          {
            $scope.serialLabel = null;
          });
        }
      }
    }
    else
    if (t === 'i')
    {
      $timeout (function ()
      {
        platform = p.p;
        category = p.c;
        if (p.pf && $scope.ports.length !== p.pf.length) 
        {
          $scope.ports = p.pf;
          _.each ($scope.ports, function (port)
          {
            try
            {
              port.vid = parseInt (port.vid, 16);
              port.pid = parseInt (port.pid, 16);
            }
            catch (e)
            {

            }
            port.s = firmwareName (port);
          });
        }
      });
    }
  });
  $wydevice.on ('status', function (status)
  {
    $timeout (function ()
    {
      $scope.connected = (status === 'CONNECTED');
      if (status === 'CONNECTED')
      {
        $wydevice.send ('note', {
          a:'status'
        });
      }
      else if (status === 'DISCONNECTED')
      {
        $scope.evaluatingLabel = null;
        $scope.flashingLabel = null;
      }
    });
  });
});

app.filter ('markdown', function ($sce)
{
  var renderer = new marked.Renderer();
  renderer.link = function (href, title, text)
  {
    /*jshint scripturl:true*/
    if (this.options.sanitize) {
      var prot = '';
      try {
        prot = decodeURIComponent(window.unescape(href))
          .replace(/[^\w:]/g, '')
          .toLowerCase();
      } catch (e) {
        return '';
      }
      if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
        return '';
      }
    }
    var download = '';
    if (href.startsWith ('data:application/octet-stream'))
    {
      download = 'download="'+text+'"';
    }
    var out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + title + '"';
    }
    out += ' target="_blank"';
    out += ' '+download;
    out += '>' + text + '</a>';
    return out;
  };

  

  marked.setOptions({
      renderer: renderer,
      gfm: true,
      tables: true,
      breaks: false,
      pedantic: false,
      sanitize: false,
      smartLists: true,
      smartypants: false,
      highlight: function (code, lang) {
        try
        {
          var html = code;
          if (!lang) html = highlight.highlightAuto (code).value;
          else html = highlight.highlight(lang, code).value;
          return html;
        }
        catch (e)
        {
          return code;
        }
      },
      latex: function (text, style)
      {
        try
        {
          var web = katex.renderToString (text, (style?{displayMode: true}:null));
          if (style) web = '<span style="font-size: 20px">'+web+'</span>';
          return web;
        }
        catch (e)
        {
          return text;
        }
      },
    });

  return function (item)
  {
    return $sce.trustAsHtml(marked (item));
  };
});

function EscapeTex(text) {
  var re = /(`+)(\s*)([\s\S]*?[^`])(\s*)(\1)(?!`)/g;
  var out = text.replace(re, function(m, p1, p2, p3, p4, p5, offset, string) {
    return p1 + p2 + p3.replace(/\$/g, '\\$') + p4 + p5;
  });

  re = /^( {4}[^\n]+\n*)+/g;
  out = out.replace(re, function(m, p1, offset, string) {
    return p1.replace(/\$/g, '\\$');
  });

  re = /([^\\\$]|^)(\${1,2})(?!\$)(\s*)([\s\S]*?[^$])(\s*)(\2)(?!\2)/g;
  out = out.replace(re, function(m, p1, p2, p3, p4, p5, p6, offset, string) {
    return p1 + p2 + p3 + p4.replace(/(.)/g, '\\$1') + p5 + p6;
  });

  return out;
}

app.filter ('renderHtml', function ($sce)
{
  return function (item)
  {
    return $sce.trustAsHtml(item);
  };
});

app.directive ('response', function ($timeout)
  {
    return {
      restrict: 'E',
      scope: {
        value: '=',
      },
      controller: function ($scope, $element)
      {
        $scope.wider = false;
        $scope.$watch ('value', function ()
        {
          if ($scope.value && $scope.value.type)
          {
            var format = $scope.value.type.f;
            var str = $scope.value.type.s;
            if (format === 'format')
            {
              $element[0].innerHTML = $scope.value.buf;
            }
            else
            {
              $element[0].innerHTML = '<pre>'+$scope.value.buf+'</pre>';
            }
          }
          else
          {
            $element[0].innerHTML = '';
          }
        });
      },

      controllerAs: 's',
      replace: true,
    };
  });

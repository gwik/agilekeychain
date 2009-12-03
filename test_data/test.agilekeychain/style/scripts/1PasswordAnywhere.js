var keychain;
var baseUrl;
var keychainFolder, dataFolder, styleFolder;
var current_profile = null;
var devmode;

function mainPageDidFinishLoading() {
	try {
		setup();
		keychain = new Keychain();
		showLockedScreen();
	} catch(e) {
		showFatalException(e);
	}
}

function showLockedScreen() {
	try {
		var locked = styleFolder + "/html/login.html";
		loadFile(locked, loginHtmlDidFinishLoading);
	} catch(e) {
		showFatalException(e);
	}
}

function loginHtmlDidFinishLoading(txt) {
	if (!txt || txt == "") {
		var file = styleFolder + "/html/login.html";
		showFatalMessage("Problem loading 1Password data file", "<p>A <a href='" + file + "'>key data file</a> could not be loaded and 1PasswordAnywhere cannot continue without it.</p><p>Please see <a href='http://help.agile.ws/1Password3/1passwordanywhere_troubleshooting.html'>this help guide</a> for troubleshooting tips.</p>");
		return;
	}

	try {
		$('mainBody').innerHTML = txt;

		var allProfiles = ["default"];
		selectProfile(allProfiles[0]);
		$("masterPassword").focus();
	} catch(e) {
		showFatalException(e);
	}
}

function verifyPassword(password) {
	try {
		if (keychain.verifyPassword(password)) {
			var opened = styleFolder + "/html/main.html";
			loadFile(opened, unlockedHtmlDidFinishLoading);
		}
		else {
			login_failed();
		}
	} catch(e) {
		showFatalException(e);
	}
}

function unlockedHtmlDidFinishLoading(txt) {
	if (!txt || txt == "") {
		var file = styleFolder + "/html/main.html";
		alert("Unable to load the '" + file + "' file. This is a critical file and 1PasswordAnywhere cannot proceed without it.");
		return;
	}

	try {
		$('mainBody').innerHTML = txt;
		loadFile(fullKeychainFilePath('contents.js'), profileContentsDidFinishLoading);
	} catch(e) {
		showFatalException(e);
	}
}

function encryptionKeysDidFinishLoading(json) {
	if (!json || json == "") {
		var keysFilePath = fullKeychainFilePath('encryptionKeys.js');
		showFatalMessage("Problem loading 1Password data file", "<p>A <a href='" + keysFilePath + "'>key data file</a> could not be loaded and 1PasswordAnywhere cannot continue without it.</p><p>Please see <a href='http://help.agile.ws/1Password3/1passwordanywhere_troubleshooting.html'>this help guide</a> for troubleshooting tips.</p>");
		return;
	}

	try {
		var keys;
		try {
			json = "(" + json + ")";
			keys = eval(json);
		}
		catch(e) {
			showFatalMessage("Problem parsing 1Password data file", "<p>There was a problem parsing the data contained in encryptionKeys.js.</p><p>Please <a href='mailto:1PAnywhere@agile.ws?subject=1PasswordAnywhere%20problem%20parsing%20encryptionKeys.js&body=Please let us know what you were doing when this problem occurred.'>report this problem</a> to the Agile team.</p>")
		}

		keychain.setEncryptionKeys(keys);
	} catch(e) {
		showFatalException(e);
	}
}

function selectProfile(profile_name) {
	try {
		top.current_profile = profile_name;
		loadFile(fullKeychainFilePath('encryptionKeys.js'), encryptionKeysDidFinishLoading);
	} catch(e) {
		showFatalException(e);
	}
}

function setup() {
	try {
		_setup();
	} catch(e) {
		showFatalException(e);
	}
}

function _setup() {
	baseUrl = window.location.href.substring(0, window.location.href.indexOf("1Password.html"));
	keychainFolder = baseUrl;

	var parameters = window.location.search.substring(1).split("&");

	for (var i=0; i < parameters.length; i++) {
		var nvp = parameters[i].split("=");
		var name = nvp[0], value = nvp[1];

		if (name == "keychainFolder") {
			keychainFolder = value;
			if (keychainFolder[keychainFolder.length-1] != "/") keychainFolder += "/";
		}
		if (name == "keychainFolder" && navigator && navigator.userAgent.match("Firefox") ) {
			alert("FATAL: The keychainFolder parameter is NOT supported in Firefox. Accessing files from outside the folder that opens you is apparently against the mozilla security model. Symlinks do not work either.");
		}
		if (name == "devmode") {
			devmode = true;
		}
	}

	if (devmode) {
		styleFolder = "./style";
	}
	else {
		styleFolder = keychainFolder + "/style";
	}
	dataFolder = keychainFolder + "/data";
}

function logout(autologout) {
	try {
		encryptionKey = null;
		keychain.lock();

		var params = [];

		if (devmode) {
			if (keychainFolder != "") params.push("keychainFolder=" + keychainFolder);
			if (devmode) params.push("devmode=true");
		}
		if (autologout) params.push("autolocked=true");
		params.push("ts=" + (new Date()).getTime());

		var url = baseUrl + "1Password.html"
		if (params.length > 0) {
			url += "?" + params.join("&");
		}

		window.location.href = url;
	} catch(e) {
		showFatalException(e);
	}
}

function setFocus()
{
	$('password').focus();
}

function fullKeychainFilePath(filename) {
	return top.keychainFolder + "data/" + top.current_profile + "/" + filename;
}

function loadFile(file, onSuccess) {
	enableFirefoxPrivileges();
	new Ajax.Request(file,
	  {
		method: 'get',
	    onSuccess: function(transport){ onSuccess(transport.responseText);},
		onFailure: function() { alert('A problem occurred when loading the "' + file + '" file.'); },
	  });
}

function enableFirefoxPrivileges() {
	try {
			try {
				netscape;
				netscape.security.PrivilegeManager.enablePrivilege("UniversalFileRead");
			}
			catch(e) {}
	} catch (e) {
			alert("Permission to read file was denied. If in Firefox you must allow this script to load local files.");
	}
}

function showFatalException(exc) {
	try {
		var error_desc = "Exception was nil."
		if (exc) {
			var file = exc.sourceURL;
			if (!file) file = exc.fileName;
			if (file && file.match(/^.*\/(.*)\?ts=.*$/)) {
				file = RegExp.$1;
			}
			error_desc = exc.name + " occurred in " + file + " on line #" + exc.line + ":\n" + exc.message;
		}

		if (OPANYWHERE_VERSION) error_desc += "\nYou are running 1PasswordAnywhere version #" + OPANYWHERE_VERSION;

		var html_msg = "<p>" + error_desc.gsub(/\n/, "<br/>") + "</p><p>Please <a href='mailto:1PAnywhere@agile.ws?subject=1PasswordAnywhere%20Problem&body=Please let us know what you were doing when this problem occurred.%0A%0AError details:%0A" + escape(error_desc) + "'>report this error</a> so Agile can investigate.</p>";
		_showMessageBox("1PasswordAnywhere experienced an error", html_msg, 'messageBox_error', {'fatal':true});
	}
	catch(e) {
		var msg = 'An exception occurred during error processing! Please report this issue to Agile at 1PAnywhere@agile.ws along with a description of what you were doing when this error happened.';
		if (OPANYWHERE_VERSION) msg += ' You are running version #' + OPANYWHERE_VERSION;
		alert(msg);
	}
}

function showMessage(title, message) {
	_showMessageBox(title, message, 'messageBox_error', {});
}

function showFatalMessage(title, message) {
	_showMessageBox(title, message, 'messageBox_error', { 'fatal' : true });
}

function _showMessageBox (title, message, cssClass, options) {
	var help_url = options['help_url'];
	if (help_url) {
		$("messageBox_help").href = help_url;
	}
	else {
		$("messageBox_help").hide();
	}

	$('messageBox').writeAttribute('class', cssClass);
	$('messageBox_title').innerHTML = title;
	$('messageBox_message').innerHTML = message;

	$('messageBox_wrapper').show();
	Effect.Appear('messageBox');

	var fatal = options['fatal'];
	if (fatal) {
		$("messageBox_dismiss").hide();
	}
	else {
		Event.observe('messageBox_dismiss', 'click', function(){
			Effect.Fade('messageBox_wrapper', {queue:"end"});
			Effect.Fade('messageBox', {queue:"end"});

			$('messageBox_dismiss').stopObserving('click');
		});
		Event.observe('messageBox_wrapper', 'click', function(){
			Effect.Fade('messageBox_wrapper', {queue:"end"});
			Effect.Fade('messageBox', {queue:"end"});

			$('messageBox_dismiss').stopObserving('click');
		});
	}
}

function login_failed()
{
	try {
		$('passwordLabel').setAttribute('class', 'error');
		$('masterPassword').setAttribute('class', 'error');
		$('masterPassword').value = "";

		var hint = fullKeychainFilePath(".password.hint");
		new Ajax.Request(hint, {
			onComplete: function(transport){showPasswordHintIfAvailable(transport)},
		  });

		Effect.Shake('passwordLabel');
	}
	catch(e) {
		showFatalException(e);
	}
}

function showPasswordHintIfAvailable(transport) {
	if (transport.responseText.length != 0) {
		$('passwordError').style.display = '';
		$('masterPasswordHint').innerHTML = transport.responseText.escapeHTML();
	}
}
OPANYWHERE_VERSION = 3043;
var dateFormat = function () {
	var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
		timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
		timezoneClip = /[^-+\dA-Z]/g,
		pad = function (val, len) {
			val = String(val);
			len = len || 2;
			while (val.length < len) val = "0" + val;
			return val;
		};

	return function (date, mask, utc) {
		var dF = dateFormat;

		if (arguments.length == 1 && (typeof date == "string" || date instanceof String) && !/\d/.test(date)) {
			mask = date;
			date = undefined;
		}

		date = date ? new Date(date) : new Date();
		if (isNaN(date)) throw new SyntaxError("invalid date");

		mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		if (mask.slice(0, 4) == "UTC:") {
			mask = mask.slice(4);
			utc = true;
		}

		var	_ = utc ? "getUTC" : "get",
			d = date[_ + "Date"](),
			D = date[_ + "Day"](),
			m = date[_ + "Month"](),
			y = date[_ + "FullYear"](),
			H = date[_ + "Hours"](),
			M = date[_ + "Minutes"](),
			s = date[_ + "Seconds"](),
			L = date[_ + "Milliseconds"](),
			o = utc ? 0 : date.getTimezoneOffset(),
			flags = {
				d:    d,
				dd:   pad(d),
				ddd:  dF.i18n.dayNames[D],
				dddd: dF.i18n.dayNames[D + 7],
				m:    m + 1,
				mm:   pad(m + 1),
				mmm:  dF.i18n.monthNames[m],
				mmmm: dF.i18n.monthNames[m + 12],
				yy:   String(y).slice(2),
				yyyy: y,
				h:    H % 12 || 12,
				hh:   pad(H % 12 || 12),
				H:    H,
				HH:   pad(H),
				M:    M,
				MM:   pad(M),
				s:    s,
				ss:   pad(s),
				l:    pad(L, 3),
				L:    pad(L > 99 ? Math.round(L / 10) : L),
				t:    H < 12 ? "a"  : "p",
				tt:   H < 12 ? "am" : "pm",
				T:    H < 12 ? "A"  : "P",
				TT:   H < 12 ? "AM" : "PM",
				Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			};

		return mask.replace(token, function ($0) {
			return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		});
	};
}();

dateFormat.masks = {
	"default":      "ddd mmm dd yyyy HH:MM:ss",
	shortDate:      "m/d/yy",
	mediumDate:     "mmm d, yyyy",
	longDate:       "mmmm d, yyyy",
	fullDate:       "dddd, mmmm d, yyyy",
	shortTime:      "h:MM TT",
	mediumTime:     "h:MM:ss TT",
	longTime:       "h:MM:ss TT Z",
	isoDate:        "yyyy-mm-dd",
	isoTime:        "HH:MM:ss",
	isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
	isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
};

dateFormat.i18n = {
	dayNames: [
		"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
		"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
	],
	monthNames: [
		"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
		"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
	]
};

Date.prototype.format = function (mask, utc) {
	return dateFormat(this, mask, utc);
};


String.prototype.parseColor = function() {
  var color = '#';
  if (this.slice(0,4) == 'rgb(') {
    var cols = this.slice(4,this.length-1).split(',');
    var i=0; do { color += parseInt(cols[i]).toColorPart() } while (++i<3);
  } else {
    if (this.slice(0,1) == '#') {
      if (this.length==4) for(var i=1;i<4;i++) color += (this.charAt(i) + this.charAt(i)).toLowerCase();
      if (this.length==7) color = this.toLowerCase();
    }
  }
  return (color.length==7 ? color : (arguments[0] || this));
};

Element.collectTextNodes = function(element) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      (node.hasChildNodes() ? Element.collectTextNodes(node) : ''));
  }).flatten().join('');
};

Element.collectTextNodesIgnoreClass = function(element, className) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      ((node.hasChildNodes() && !Element.hasClassName(node,className)) ?
        Element.collectTextNodesIgnoreClass(node, className) : ''));
  }).flatten().join('');
};

Element.setContentZoom = function(element, percent) {
  element = $(element);
  element.setStyle({fontSize: (percent/100) + 'em'});
  if (Prototype.Browser.WebKit) window.scrollBy(0,0);
  return element;
};

Element.getInlineOpacity = function(element){
  return $(element).style.opacity || '';
};

Element.forceRerendering = function(element) {
  try {
    element = $(element);
    var n = document.createTextNode(' ');
    element.appendChild(n);
    element.removeChild(n);
  } catch(e) { }
};

var Effect = {
  _elementDoesNotExistError: {
    name: 'ElementDoesNotExistError',
    message: 'The specified DOM element does not exist, but is required for this effect to operate'
  },
  Transitions: {
    linear: Prototype.K,
    sinoidal: function(pos) {
      return (-Math.cos(pos*Math.PI)/2) + 0.5;
    },
    reverse: function(pos) {
      return 1-pos;
    },
    flicker: function(pos) {
      var pos = ((-Math.cos(pos*Math.PI)/4) + 0.75) + Math.random()/4;
      return pos > 1 ? 1 : pos;
    },
    wobble: function(pos) {
      return (-Math.cos(pos*Math.PI*(9*pos))/2) + 0.5;
    },
    pulse: function(pos, pulses) {
      pulses = pulses || 5;
      return (
        ((pos % (1/pulses)) * pulses).round() == 0 ?
              ((pos * pulses * 2) - (pos * pulses * 2).floor()) :
          1 - ((pos * pulses * 2) - (pos * pulses * 2).floor())
        );
    },
    spring: function(pos) {
      return 1 - (Math.cos(pos * 4.5 * Math.PI) * Math.exp(-pos * 6));
    },
    none: function(pos) {
      return 0;
    },
    full: function(pos) {
      return 1;
    }
  },
  DefaultOptions: {
    duration:   1.0,   // seconds
    fps:        100,   // 100= assume 66fps max.
    sync:       false, // true for combining
    from:       0.0,
    to:         1.0,
    delay:      0.0,
    queue:      'parallel'
  },
  tagifyText: function(element) {
    var tagifyStyle = 'position:relative';
    if (Prototype.Browser.IE) tagifyStyle += ';zoom:1';

    element = $(element);
    $A(element.childNodes).each( function(child) {
      if (child.nodeType==3) {
        child.nodeValue.toArray().each( function(character) {
          element.insertBefore(
            new Element('span', {style: tagifyStyle}).update(
              character == ' ' ? String.fromCharCode(160) : character),
              child);
        });
        Element.remove(child);
      }
    });
  },
  multiple: function(element, effect) {
    var elements;
    if (((typeof element == 'object') ||
        Object.isFunction(element)) &&
       (element.length))
      elements = element;
    else
      elements = $(element).childNodes;

    var options = Object.extend({
      speed: 0.1,
      delay: 0.0
    }, arguments[2] || { });
    var masterDelay = options.delay;

    $A(elements).each( function(element, index) {
      new effect(element, Object.extend(options, { delay: index * options.speed + masterDelay }));
    });
  },
  PAIRS: {
    'slide':  ['SlideDown','SlideUp'],
    'blind':  ['BlindDown','BlindUp'],
    'appear': ['Appear','Fade']
  },
  toggle: function(element, effect) {
    element = $(element);
    effect = (effect || 'appear').toLowerCase();
    var options = Object.extend({
      queue: { position:'end', scope:(element.id || 'global'), limit: 1 }
    }, arguments[2] || { });
    Effect[element.visible() ?
      Effect.PAIRS[effect][1] : Effect.PAIRS[effect][0]](element, options);
  }
};

Effect.DefaultOptions.transition = Effect.Transitions.sinoidal;

Effect.ScopedQueue = Class.create(Enumerable, {
  initialize: function() {
    this.effects  = [];
    this.interval = null;
  },
  _each: function(iterator) {
    this.effects._each(iterator);
  },
  add: function(effect) {
    var timestamp = new Date().getTime();

    var position = Object.isString(effect.options.queue) ?
      effect.options.queue : effect.options.queue.position;

    switch(position) {
      case 'front':
        this.effects.findAll(function(e){ return e.state=='idle' }).each( function(e) {
            e.startOn  += effect.finishOn;
            e.finishOn += effect.finishOn;
          });
        break;
      case 'with-last':
        timestamp = this.effects.pluck('startOn').max() || timestamp;
        break;
      case 'end':
        timestamp = this.effects.pluck('finishOn').max() || timestamp;
        break;
    }

    effect.startOn  += timestamp;
    effect.finishOn += timestamp;

    if (!effect.options.queue.limit || (this.effects.length < effect.options.queue.limit))
      this.effects.push(effect);

    if (!this.interval)
      this.interval = setInterval(this.loop.bind(this), 15);
  },
  remove: function(effect) {
    this.effects = this.effects.reject(function(e) { return e==effect });
    if (this.effects.length == 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  loop: function() {
    var timePos = new Date().getTime();
    for(var i=0, len=this.effects.length;i<len;i++)
      this.effects[i] && this.effects[i].loop(timePos);
  }
});

Effect.Queues = {
  instances: $H(),
  get: function(queueName) {
    if (!Object.isString(queueName)) return queueName;

    return this.instances.get(queueName) ||
      this.instances.set(queueName, new Effect.ScopedQueue());
  }
};
Effect.Queue = Effect.Queues.get('global');

Effect.Base = Class.create({
  position: null,
  start: function(options) {
    function codeForEvent(options,eventName){
      return (
        (options[eventName+'Internal'] ? 'this.options.'+eventName+'Internal(this);' : '') +
        (options[eventName] ? 'this.options.'+eventName+'(this);' : '')
      );
    }
    if (options && options.transition === false) options.transition = Effect.Transitions.linear;
    this.options      = Object.extend(Object.extend({ },Effect.DefaultOptions), options || { });
    this.currentFrame = 0;
    this.state        = 'idle';
    this.startOn      = this.options.delay*1000;
    this.finishOn     = this.startOn+(this.options.duration*1000);
    this.fromToDelta  = this.options.to-this.options.from;
    this.totalTime    = this.finishOn-this.startOn;
    this.totalFrames  = this.options.fps*this.options.duration;

    eval('this.render = function(pos){ '+
      'if (this.state=="idle"){this.state="running";'+
      codeForEvent(this.options,'beforeSetup')+
      (this.setup ? 'this.setup();':'')+
      codeForEvent(this.options,'afterSetup')+
      '};if (this.state=="running"){'+
      'pos=this.options.transition(pos)*'+this.fromToDelta+'+'+this.options.from+';'+
      'this.position=pos;'+
      codeForEvent(this.options,'beforeUpdate')+
      (this.update ? 'this.update(pos);':'')+
      codeForEvent(this.options,'afterUpdate')+
      '}}');

    this.event('beforeStart');
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).add(this);
  },
  loop: function(timePos) {
    if (timePos >= this.startOn) {
      if (timePos >= this.finishOn) {
        this.render(1.0);
        this.cancel();
        this.event('beforeFinish');
        if (this.finish) this.finish();
        this.event('afterFinish');
        return;
      }
      var pos   = (timePos - this.startOn) / this.totalTime,
          frame = (pos * this.totalFrames).round();
      if (frame > this.currentFrame) {
        this.render(pos);
        this.currentFrame = frame;
      }
    }
  },
  cancel: function() {
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).remove(this);
    this.state = 'finished';
  },
  event: function(eventName) {
    if (this.options[eventName + 'Internal']) this.options[eventName + 'Internal'](this);
    if (this.options[eventName]) this.options[eventName](this);
  },
  inspect: function() {
    var data = $H();
    for(property in this)
      if (!Object.isFunction(this[property])) data.set(property, this[property]);
    return '#<Effect:' + data.inspect() + ',options:' + $H(this.options).inspect() + '>';
  }
});

Effect.Parallel = Class.create(Effect.Base, {
  initialize: function(effects) {
    this.effects = effects || [];
    this.start(arguments[1]);
  },
  update: function(position) {
    this.effects.invoke('render', position);
  },
  finish: function(position) {
    this.effects.each( function(effect) {
      effect.render(1.0);
      effect.cancel();
      effect.event('beforeFinish');
      if (effect.finish) effect.finish(position);
      effect.event('afterFinish');
    });
  }
});

Effect.Tween = Class.create(Effect.Base, {
  initialize: function(object, from, to) {
    object = Object.isString(object) ? $(object) : object;
    var args = $A(arguments), method = args.last(),
      options = args.length == 5 ? args[3] : null;
    this.method = Object.isFunction(method) ? method.bind(object) :
      Object.isFunction(object[method]) ? object[method].bind(object) :
      function(value) { object[method] = value };
    this.start(Object.extend({ from: from, to: to }, options || { }));
  },
  update: function(position) {
    this.method(position);
  }
});

Effect.Event = Class.create(Effect.Base, {
  initialize: function() {
    this.start(Object.extend({ duration: 0 }, arguments[0] || { }));
  },
  update: Prototype.emptyFunction
});

Effect.Opacity = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
      this.element.setStyle({zoom: 1});
    var options = Object.extend({
      from: this.element.getOpacity() || 0.0,
      to:   1.0
    }, arguments[1] || { });
    this.start(options);
  },
  update: function(position) {
    this.element.setOpacity(position);
  }
});

Effect.Move = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      x:    0,
      y:    0,
      mode: 'relative'
    }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    this.element.makePositioned();
    this.originalLeft = parseFloat(this.element.getStyle('left') || '0');
    this.originalTop  = parseFloat(this.element.getStyle('top')  || '0');
    if (this.options.mode == 'absolute') {
      this.options.x = this.options.x - this.originalLeft;
      this.options.y = this.options.y - this.originalTop;
    }
  },
  update: function(position) {
    this.element.setStyle({
      left: (this.options.x  * position + this.originalLeft).round() + 'px',
      top:  (this.options.y  * position + this.originalTop).round()  + 'px'
    });
  }
});

Effect.MoveBy = function(element, toTop, toLeft) {
  return new Effect.Move(element,
    Object.extend({ x: toLeft, y: toTop }, arguments[3] || { }));
};

Effect.Scale = Class.create(Effect.Base, {
  initialize: function(element, percent) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      scaleX: true,
      scaleY: true,
      scaleContent: true,
      scaleFromCenter: false,
      scaleMode: 'box',        // 'box' or 'contents' or { } with provided values
      scaleFrom: 100.0,
      scaleTo:   percent
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.restoreAfterFinish = this.options.restoreAfterFinish || false;
    this.elementPositioning = this.element.getStyle('position');

    this.originalStyle = { };
    ['top','left','width','height','fontSize'].each( function(k) {
      this.originalStyle[k] = this.element.style[k];
    }.bind(this));

    this.originalTop  = this.element.offsetTop;
    this.originalLeft = this.element.offsetLeft;

    var fontSize = this.element.getStyle('font-size') || '100%';
    ['em','px','%','pt'].each( function(fontSizeType) {
      if (fontSize.indexOf(fontSizeType)>0) {
        this.fontSize     = parseFloat(fontSize);
        this.fontSizeType = fontSizeType;
      }
    }.bind(this));

    this.factor = (this.options.scaleTo - this.options.scaleFrom)/100;

    this.dims = null;
    if (this.options.scaleMode=='box')
      this.dims = [this.element.offsetHeight, this.element.offsetWidth];
    if (/^content/.test(this.options.scaleMode))
      this.dims = [this.element.scrollHeight, this.element.scrollWidth];
    if (!this.dims)
      this.dims = [this.options.scaleMode.originalHeight,
                   this.options.scaleMode.originalWidth];
  },
  update: function(position) {
    var currentScale = (this.options.scaleFrom/100.0) + (this.factor * position);
    if (this.options.scaleContent && this.fontSize)
      this.element.setStyle({fontSize: this.fontSize * currentScale + this.fontSizeType });
    this.setDimensions(this.dims[0] * currentScale, this.dims[1] * currentScale);
  },
  finish: function(position) {
    if (this.restoreAfterFinish) this.element.setStyle(this.originalStyle);
  },
  setDimensions: function(height, width) {
    var d = { };
    if (this.options.scaleX) d.width = width.round() + 'px';
    if (this.options.scaleY) d.height = height.round() + 'px';
    if (this.options.scaleFromCenter) {
      var topd  = (height - this.dims[0])/2;
      var leftd = (width  - this.dims[1])/2;
      if (this.elementPositioning == 'absolute') {
        if (this.options.scaleY) d.top = this.originalTop-topd + 'px';
        if (this.options.scaleX) d.left = this.originalLeft-leftd + 'px';
      } else {
        if (this.options.scaleY) d.top = -topd + 'px';
        if (this.options.scaleX) d.left = -leftd + 'px';
      }
    }
    this.element.setStyle(d);
  }
});

Effect.Highlight = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({ startcolor: '#ffff99' }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    if (this.element.getStyle('display')=='none') { this.cancel(); return; }
    this.oldStyle = { };
    if (!this.options.keepBackgroundImage) {
      this.oldStyle.backgroundImage = this.element.getStyle('background-image');
      this.element.setStyle({backgroundImage: 'none'});
    }
    if (!this.options.endcolor)
      this.options.endcolor = this.element.getStyle('background-color').parseColor('#ffffff');
    if (!this.options.restorecolor)
      this.options.restorecolor = this.element.getStyle('background-color');
    this._base  = $R(0,2).map(function(i){ return parseInt(this.options.startcolor.slice(i*2+1,i*2+3),16) }.bind(this));
    this._delta = $R(0,2).map(function(i){ return parseInt(this.options.endcolor.slice(i*2+1,i*2+3),16)-this._base[i] }.bind(this));
  },
  update: function(position) {
    this.element.setStyle({backgroundColor: $R(0,2).inject('#',function(m,v,i){
      return m+((this._base[i]+(this._delta[i]*position)).round().toColorPart()); }.bind(this)) });
  },
  finish: function() {
    this.element.setStyle(Object.extend(this.oldStyle, {
      backgroundColor: this.options.restorecolor
    }));
  }
});

Effect.ScrollTo = function(element) {
  var options = arguments[1] || { },
    scrollOffsets = document.viewport.getScrollOffsets(),
    elementOffsets = $(element).cumulativeOffset(),
    max = (window.height || document.body.scrollHeight) - document.viewport.getHeight();

  if (options.offset) elementOffsets[1] += options.offset;

  return new Effect.Tween(null,
    scrollOffsets.top,
    elementOffsets[1] > max ? max : elementOffsets[1],
    options,
    function(p){ scrollTo(scrollOffsets.left, p.round()) }
  );
};

Effect.Fade = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  var options = Object.extend({
    from: element.getOpacity() || 1.0,
    to:   0.0,
    afterFinishInternal: function(effect) {
      if (effect.options.to!=0) return;
      effect.element.hide().setStyle({opacity: oldOpacity});
    }
  }, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Appear = function(element) {
  element = $(element);
  var options = Object.extend({
  from: (element.getStyle('display') == 'none' ? 0.0 : element.getOpacity() || 0.0),
  to:   1.0,
  afterFinishInternal: function(effect) {
    effect.element.forceRerendering();
  },
  beforeSetup: function(effect) {
    effect.element.setOpacity(effect.options.from).show();
  }}, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Puff = function(element) {
  element = $(element);
  var oldStyle = {
    opacity: element.getInlineOpacity(),
    position: element.getStyle('position'),
    top:  element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height
  };
  return new Effect.Parallel(
   [ new Effect.Scale(element, 200,
      { sync: true, scaleFromCenter: true, scaleContent: true, restoreAfterFinish: true }),
     new Effect.Opacity(element, { sync: true, to: 0.0 } ) ],
     Object.extend({ duration: 1.0,
      beforeSetupInternal: function(effect) {
        Position.absolutize(effect.effects[0].element)
      },
      afterFinishInternal: function(effect) {
         effect.effects[0].element.hide().setStyle(oldStyle); }
     }, arguments[1] || { })
   );
};

Effect.BlindUp = function(element) {
  element = $(element);
  element.makeClipping();
  return new Effect.Scale(element, 0,
    Object.extend({ scaleContent: false,
      scaleX: false,
      restoreAfterFinish: true,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping();
      }
    }, arguments[1] || { })
  );
};

Effect.BlindDown = function(element) {
  element = $(element);
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: 0,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping();
    }
  }, arguments[1] || { }));
};

Effect.SwitchOff = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  return new Effect.Appear(element, Object.extend({
    duration: 0.4,
    from: 0,
    transition: Effect.Transitions.flicker,
    afterFinishInternal: function(effect) {
      new Effect.Scale(effect.element, 1, {
        duration: 0.3, scaleFromCenter: true,
        scaleX: false, scaleContent: false, restoreAfterFinish: true,
        beforeSetup: function(effect) {
          effect.element.makePositioned().makeClipping();
        },
        afterFinishInternal: function(effect) {
          effect.element.hide().undoClipping().undoPositioned().setStyle({opacity: oldOpacity});
        }
      })
    }
  }, arguments[1] || { }));
};

Effect.DropOut = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left'),
    opacity: element.getInlineOpacity() };
  return new Effect.Parallel(
    [ new Effect.Move(element, {x: 0, y: 100, sync: true }),
      new Effect.Opacity(element, { sync: true, to: 0.0 }) ],
    Object.extend(
      { duration: 0.5,
        beforeSetup: function(effect) {
          effect.effects[0].element.makePositioned();
        },
        afterFinishInternal: function(effect) {
          effect.effects[0].element.hide().undoPositioned().setStyle(oldStyle);
        }
      }, arguments[1] || { }));
};

Effect.Shake = function(element) {
  element = $(element);
  var options = Object.extend({
    distance: 20,
    duration: 0.5
  }, arguments[1] || {});
  var distance = parseFloat(options.distance);
  var split = parseFloat(options.duration) / 10.0;
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left') };
    return new Effect.Move(element,
      { x:  distance, y: 0, duration: split, afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance, y: 0, duration: split, afterFinishInternal: function(effect) {
        effect.element.undoPositioned().setStyle(oldStyle);
  }}) }}) }}) }}) }}) }});
};

Effect.SlideDown = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: window.opera ? 0 : 1,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom}); }
    }, arguments[1] || { })
  );
};

Effect.SlideUp = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, window.opera ? 0 : 1,
   Object.extend({ scaleContent: false,
    scaleX: false,
    scaleMode: 'box',
    scaleFrom: 100,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom});
    }
   }, arguments[1] || { })
  );
};

Effect.Squish = function(element) {
  return new Effect.Scale(element, window.opera ? 1 : 0, {
    restoreAfterFinish: true,
    beforeSetup: function(effect) {
      effect.element.makeClipping();
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping();
    }
  });
};

Effect.Grow = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.full
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var initialMoveX, initialMoveY;
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      initialMoveX = initialMoveY = moveX = moveY = 0;
      break;
    case 'top-right':
      initialMoveX = dims.width;
      initialMoveY = moveY = 0;
      moveX = -dims.width;
      break;
    case 'bottom-left':
      initialMoveX = moveX = 0;
      initialMoveY = dims.height;
      moveY = -dims.height;
      break;
    case 'bottom-right':
      initialMoveX = dims.width;
      initialMoveY = dims.height;
      moveX = -dims.width;
      moveY = -dims.height;
      break;
    case 'center':
      initialMoveX = dims.width / 2;
      initialMoveY = dims.height / 2;
      moveX = -dims.width / 2;
      moveY = -dims.height / 2;
      break;
  }

  return new Effect.Move(element, {
    x: initialMoveX,
    y: initialMoveY,
    duration: 0.01,
    beforeSetup: function(effect) {
      effect.element.hide().makeClipping().makePositioned();
    },
    afterFinishInternal: function(effect) {
      new Effect.Parallel(
        [ new Effect.Opacity(effect.element, { sync: true, to: 1.0, from: 0.0, transition: options.opacityTransition }),
          new Effect.Move(effect.element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition }),
          new Effect.Scale(effect.element, 100, {
            scaleMode: { originalHeight: dims.height, originalWidth: dims.width },
            sync: true, scaleFrom: window.opera ? 1 : 0, transition: options.scaleTransition, restoreAfterFinish: true})
        ], Object.extend({
             beforeSetup: function(effect) {
               effect.effects[0].element.setStyle({height: '0px'}).show();
             },
             afterFinishInternal: function(effect) {
               effect.effects[0].element.undoClipping().undoPositioned().setStyle(oldStyle);
             }
           }, options)
      )
    }
  });
};

Effect.Shrink = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.none
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      moveX = moveY = 0;
      break;
    case 'top-right':
      moveX = dims.width;
      moveY = 0;
      break;
    case 'bottom-left':
      moveX = 0;
      moveY = dims.height;
      break;
    case 'bottom-right':
      moveX = dims.width;
      moveY = dims.height;
      break;
    case 'center':
      moveX = dims.width / 2;
      moveY = dims.height / 2;
      break;
  }

  return new Effect.Parallel(
    [ new Effect.Opacity(element, { sync: true, to: 0.0, from: 1.0, transition: options.opacityTransition }),
      new Effect.Scale(element, window.opera ? 1 : 0, { sync: true, transition: options.scaleTransition, restoreAfterFinish: true}),
      new Effect.Move(element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition })
    ], Object.extend({
         beforeStartInternal: function(effect) {
           effect.effects[0].element.makePositioned().makeClipping();
         },
         afterFinishInternal: function(effect) {
           effect.effects[0].element.hide().undoClipping().undoPositioned().setStyle(oldStyle); }
       }, options)
  );
};

Effect.Pulsate = function(element) {
  element = $(element);
  var options    = arguments[1] || { };
  var oldOpacity = element.getInlineOpacity();
  var transition = options.transition || Effect.Transitions.sinoidal;
  var reverser   = function(pos){ return transition(1-Effect.Transitions.pulse(pos, options.pulses)) };
  reverser.bind(transition);
  return new Effect.Opacity(element,
    Object.extend(Object.extend({  duration: 2.0, from: 0,
      afterFinishInternal: function(effect) { effect.element.setStyle({opacity: oldOpacity}); }
    }, options), {transition: reverser}));
};

Effect.Fold = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height };
  element.makeClipping();
  return new Effect.Scale(element, 5, Object.extend({
    scaleContent: false,
    scaleX: false,
    afterFinishInternal: function(effect) {
    new Effect.Scale(element, 1, {
      scaleContent: false,
      scaleY: false,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping().setStyle(oldStyle);
      } });
  }}, arguments[1] || { }));
};

Effect.Morph = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      style: { }
    }, arguments[1] || { });

    if (!Object.isString(options.style)) this.style = $H(options.style);
    else {
      if (options.style.include(':'))
        this.style = options.style.parseStyle();
      else {
        this.element.addClassName(options.style);
        this.style = $H(this.element.getStyles());
        this.element.removeClassName(options.style);
        var css = this.element.getStyles();
        this.style = this.style.reject(function(style) {
          return style.value == css[style.key];
        });
        options.afterFinishInternal = function(effect) {
          effect.element.addClassName(effect.options.style);
          effect.transforms.each(function(transform) {
            effect.element.style[transform.style] = '';
          });
        }
      }
    }
    this.start(options);
  },

  setup: function(){
    function parseColor(color){
      if (!color || ['rgba(0, 0, 0, 0)','transparent'].include(color)) color = '#ffffff';
      color = color.parseColor();
      return $R(0,2).map(function(i){
        return parseInt( color.slice(i*2+1,i*2+3), 16 )
      });
    }
    this.transforms = this.style.map(function(pair){
      var property = pair[0], value = pair[1], unit = null;

      if (value.parseColor('#zzzzzz') != '#zzzzzz') {
        value = value.parseColor();
        unit  = 'color';
      } else if (property == 'opacity') {
        value = parseFloat(value);
        if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
          this.element.setStyle({zoom: 1});
      } else if (Element.CSS_LENGTH.test(value)) {
          var components = value.match(/^([\+\-]?[0-9\.]+)(.*)$/);
          value = parseFloat(components[1]);
          unit = (components.length == 3) ? components[2] : null;
      }

      var originalValue = this.element.getStyle(property);
      return {
        style: property.camelize(),
        originalValue: unit=='color' ? parseColor(originalValue) : parseFloat(originalValue || 0),
        targetValue: unit=='color' ? parseColor(value) : value,
        unit: unit
      };
    }.bind(this)).reject(function(transform){
      return (
        (transform.originalValue == transform.targetValue) ||
        (
          transform.unit != 'color' &&
          (isNaN(transform.originalValue) || isNaN(transform.targetValue))
        )
      )
    });
  },
  update: function(position) {
    var style = { }, transform, i = this.transforms.length;
    while(i--)
      style[(transform = this.transforms[i]).style] =
        transform.unit=='color' ? '#'+
          (Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)).toColorPart() +
          (Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position)).toColorPart() +
          (Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)).toColorPart() :
        (transform.originalValue +
          (transform.targetValue - transform.originalValue) * position).toFixed(3) +
            (transform.unit === null ? '' : transform.unit);
    this.element.setStyle(style, true);
  }
});

Effect.Transform = Class.create({
  initialize: function(tracks){
    this.tracks  = [];
    this.options = arguments[1] || { };
    this.addTracks(tracks);
  },
  addTracks: function(tracks){
    tracks.each(function(track){
      track = $H(track);
      var data = track.values().first();
      this.tracks.push($H({
        ids:     track.keys().first(),
        effect:  Effect.Morph,
        options: { style: data }
      }));
    }.bind(this));
    return this;
  },
  play: function(){
    return new Effect.Parallel(
      this.tracks.map(function(track){
        var ids = track.get('ids'), effect = track.get('effect'), options = track.get('options');
        var elements = [$(ids) || $$(ids)].flatten();
        return elements.map(function(e){ return new effect(e, Object.extend({ sync:true }, options)) });
      }).flatten(),
      this.options
    );
  }
});

Element.CSS_PROPERTIES = $w(
  'backgroundColor backgroundPosition borderBottomColor borderBottomStyle ' +
  'borderBottomWidth borderLeftColor borderLeftStyle borderLeftWidth ' +
  'borderRightColor borderRightStyle borderRightWidth borderSpacing ' +
  'borderTopColor borderTopStyle borderTopWidth bottom clip color ' +
  'fontSize fontWeight height left letterSpacing lineHeight ' +
  'marginBottom marginLeft marginRight marginTop markerOffset maxHeight '+
  'maxWidth minHeight minWidth opacity outlineColor outlineOffset ' +
  'outlineWidth paddingBottom paddingLeft paddingRight paddingTop ' +
  'right textIndent top width wordSpacing zIndex');

Element.CSS_LENGTH = /^(([\+\-]?[0-9\.]+)(em|ex|px|in|cm|mm|pt|pc|\%))|0$/;

String.__parseStyleElement = document.createElement('div');
String.prototype.parseStyle = function(){
  var style, styleRules = $H();
  if (Prototype.Browser.WebKit)
    style = new Element('div',{style:this}).style;
  else {
    String.__parseStyleElement.innerHTML = '<div style="' + this + '"></div>';
    style = String.__parseStyleElement.childNodes[0].style;
  }

  Element.CSS_PROPERTIES.each(function(property){
    if (style[property]) styleRules.set(property, style[property]);
  });

  if (Prototype.Browser.IE && this.include('opacity'))
    styleRules.set('opacity', this.match(/opacity:\s*((?:0|1)?(?:\.\d*)?)/)[1]);

  return styleRules;
};

if (document.defaultView && document.defaultView.getComputedStyle) {
  Element.getStyles = function(element) {
    var css = document.defaultView.getComputedStyle($(element), null);
    return Element.CSS_PROPERTIES.inject({ }, function(styles, property) {
      styles[property] = css[property];
      return styles;
    });
  };
} else {
  Element.getStyles = function(element) {
    element = $(element);
    var css = element.currentStyle, styles;
    styles = Element.CSS_PROPERTIES.inject({ }, function(hash, property) {
      hash.set(property, css[property]);
      return hash;
    });
    if (!styles.opacity) styles.set('opacity', element.getOpacity());
    return styles;
  };
};

Effect.Methods = {
  morph: function(element, style) {
    element = $(element);
    new Effect.Morph(element, Object.extend({ style: style }, arguments[2] || { }));
    return element;
  },
  visualEffect: function(element, effect, options) {
    element = $(element)
    var s = effect.dasherize().camelize(), klass = s.charAt(0).toUpperCase() + s.substring(1);
    new Effect[klass](element, options);
    return element;
  },
  highlight: function(element, options) {
    element = $(element);
    new Effect.Highlight(element, options);
    return element;
  }
};

$w('fade appear grow shrink fold blindUp blindDown slideUp slideDown '+
  'pulsate shake puff squish switchOff dropOut').each(
  function(effect) {
    Effect.Methods[effect] = function(element, options){
      element = $(element);
      Effect[effect.charAt(0).toUpperCase() + effect.substring(1)](element, options);
      return element;
    }
  }
);

$w('getInlineOpacity forceRerendering setContentZoom collectTextNodes collectTextNodesIgnoreClass getStyles').each(
  function(f) { Effect.Methods[f] = Element[f]; }
);

Element.addMethods(Effect.Methods);

var GibberishAES = {
	SALTED_PREFIX: [83, 97, 108, 116, 101, 100, 95, 95],
	ZERO_IV: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

    Nr: 14,
    Nb: 4,
    Nk: 8,
    Decrypt: false,

    enc_utf8: function(s)
    {
        try {
            return unescape(encodeURIComponent(s));
        }
        catch(e) {
            throw 'Error on UTF-8 encode';
        }
    },

    dec_utf8: function(s)
    {
        try {
            return decodeURIComponent(escape(s));
        }
        catch(e) {
            throw ('Bad Key');
        }
    },

    padBlock: function(byteArr)
    {
        var array = [];
        if (byteArr.length < 16) {
            var cpad = 16 - byteArr.length;
            var array = [cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad, cpad];
        }
        for (var i = 0; i < byteArr.length; i++)
        {
            array[i] = byteArr[i]
        }
        return array;
    },

    block2s: function(block, lastBlock)
    {
        var string = '';
        if (lastBlock) {
            var padding = block[15];
            if (padding > 16) {
                throw ('Decryption error: Maybe bad key');
            }
            if (padding == 16) {
                return '';
            }
            for (var i = 0; i < 16 - padding; i++) {
                string += String.fromCharCode(block[i]);
            }
        } else {
            for (i = 0; i < 16; i++) {
                string += String.fromCharCode(block[i]);
            }
        }
        return string;
    },

    a2h: function(numArr)
    {
        var string = '';
        for (var i = 0; i < numArr.length; i++) {
            string += (numArr[i] < 16 ? '0': '') + numArr[i].toString(16);
        }
        return string;
    },

    h2a: function(s)
    {
        var ret = [];
        s.replace(/(..)/g,
        function(s) {
            ret.push(parseInt(s, 16));
        });
        return ret;
    },

    s2a: function(string) {
        var array = [];

        for (var i = 0; i < string.length; i++)
        {
            array[i] = string.charCodeAt(i);
        }
        return array;
    },

    a2s: function(inArray) {
        var result = "";

        for (var i = 0; i < inArray.length; i++)
        {
            result += String.fromCharCode(inArray[i]);
        }
        return result;
    },

    size: function(newsize)
    {
        switch (newsize)
        {
        case 128:
            this.Nr = 10;
            this.Nk = 4;
            break;
        case 192:
            this.Nr = 12;
            this.Nk = 6;
            break;
        case 256:
            this.Nr = 14;
            this.Nk = 8;
            break;
        default:
            throw ('Invalid Key Size Specified:' + newsize);
        }
    },

    randArr: function(num) {
        var result = []
        for (var i = 0; i < num; i++) {
            result = result.concat(Math.floor(Math.random() * 256));
        }
        return result;
    },

    openSSLKey: function(passwordArr, saltArr) {
        console.log('Nr:%d Nb:%d Nk:%d', this.Nr, this.Nb, this.Nk);
        var rounds = this.Nr >= 12 ? 3: 2;
        var key = [];
        var iv = [];
        var md5_hash = [];
        var result = [];
        data00 = passwordArr.concat(saltArr);
        md5_hash[0] = GibberishAES.Hash.MD5(data00);
        result = md5_hash[0];
        for (var i = 1; i < rounds; i++) {
            md5_hash[i] = GibberishAES.Hash.MD5(md5_hash[i - 1].concat(data00));
            result = result.concat(md5_hash[i]);
        }
        key = result.slice(0, 4 * this.Nk);
        iv = result.slice(4 * this.Nk, 4 * this.Nk + 16);
        return {
            key: key,
            iv: iv
        };
    },

    rawEncrypt: function(plaintext, key, iv) {
        key = this.expandKey(key);
        var numBlocks = Math.ceil(plaintext.length / 16);
        var blocks = [];
        for (var i = 0; i < numBlocks; i++) {
            blocks[i] = this.padBlock(plaintext.slice(i * 16, i * 16 + 16));
        }
        if (plaintext.length % 16 === 0) {
            blocks.push([16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]);
            numBlocks++;
        }
        var cipherBlocks = [];
        for (var i = 0; i < blocks.length; i++) {
            blocks[i] = (i === 0) ? this.xorBlocks(blocks[i], iv) : this.xorBlocks(blocks[i], cipherBlocks[i - 1]);
            cipherBlocks[i] = this.encryptBlock(blocks[i], key);
        }
        return cipherBlocks;
    },

    decryptBinaryUsingKeyAndIvec: function(cryptArr, key, iv) {

        key = this.expandKey(key);
        var numBlocks = cryptArr.length / 16;
        var cipherBlocks = [];
        for (var i = 0; i < numBlocks; i++) {
            cipherBlocks.push(cryptArr.slice(i * 16, (i + 1) * 16));
        }
        var plainBlocks = [];

        for (var i = cipherBlocks.length - 1; i >= 0; i--) {
            plainBlocks[i] = this.decryptBlock(cipherBlocks[i], key);
            plainBlocks[i] = (i === 0) ? this.xorBlocks(plainBlocks[i], iv) : this.xorBlocks(plainBlocks[i], cipherBlocks[i - 1]);
        }
        var string = '';
        for (var i = 0; i < numBlocks - 1; i++) {
            string += this.block2s(plainBlocks[i]);
        }
        string += this.block2s(plainBlocks[i], true);
        return string;
    },

    encryptBlock: function(block, words) {
        this.Decrypt = false;
        var state = this.addRoundKey(block, words, 0);
        for (var round = 1; round < (this.Nr + 1); round++) {
            state = this.subBytes(state);
            state = this.shiftRows(state);
            if (round < this.Nr) {
                state = this.mixColumns(state);
            }
            state = this.addRoundKey(state, words, round);
        }

        return state;
    },

    decryptBlock: function(block, words) {
        this.Decrypt = true;
        var state = this.addRoundKey(block, words, this.Nr);
        for (var round = this.Nr - 1; round > -1; round--) {
            state = this.shiftRows(state);
            state = this.subBytes(state);
            state = this.addRoundKey(state, words, round);
            if (round > 0) {
                state = this.mixColumns(state);
            }
        }

        return state;
    },

    subBytes: function(state) {
        var S = this.Decrypt ? this.SBoxInv: this.SBox;
        var temp = [];
        for (var i = 0; i < 16; i++) {
            temp[i] = S[state[i]];
        }
        return temp;
    },

    shiftRows: function(state) {
        var temp = [];
        var shiftBy = this.Decrypt ? [0, 13, 10, 7, 4, 1, 14, 11, 8, 5, 2, 15, 12, 9, 6, 3] : [0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12, 1, 6, 11];
        for (var i = 0; i < 16; i++) {
            temp[i] = state[shiftBy[i]];
        }
        return temp;
    },

    mixColumns: function(state) {
        var t = [];
				if (!this.Decrypt) {
	        for (var c = 0; c < 4; c++) {
	            t[c * 4] = this.G2X[state[c * 4]] ^ this.G3X[state[1 + c * 4]] ^ state[2 + c * 4] ^ state[3 + c * 4];
	            t[1 + c * 4] = state[c * 4] ^ this.G2X[state[1 + c * 4]] ^ this.G3X[state[2 + c * 4]] ^ state[3 + c * 4];
	            t[2 + c * 4] = state[c * 4] ^ state[1 + c * 4] ^ this.G2X[state[2 + c * 4]] ^ this.G3X[state[3 + c * 4]];
	            t[3 + c * 4] = this.G3X[state[c * 4]] ^ state[1 + c * 4] ^ state[2 + c * 4] ^ this.G2X[state[3 + c * 4]];
	        }
				}else {
					for (var c = 0; c < 4; c++) {
	            t[c*4] = this.GEX[state[c*4]] ^ this.GBX[state[1+c*4]] ^ this.GDX[state[2+c*4]] ^ this.G9X[state[3+c*4]];
	            t[1+c*4] = this.G9X[state[c*4]] ^ this.GEX[state[1+c*4]] ^ this.GBX[state[2+c*4]] ^ this.GDX[state[3+c*4]];
	            t[2+c*4] = this.GDX[state[c*4]] ^ this.G9X[state[1+c*4]] ^ this.GEX[state[2+c*4]] ^ this.GBX[state[3+c*4]];
	            t[3+c*4] = this.GBX[state[c*4]] ^ this.GDX[state[1+c*4]] ^ this.G9X[state[2+c*4]] ^ this.GEX[state[3+c*4]];
	        }
				}

        return t;
    },

    addRoundKey: function(state, words, round) {
        var temp = [];
        for (var i = 0; i < 16; i++) {
            temp[i] = state[i] ^ words[round][i];
        }
        return temp;
    },

    xorBlocks: function(block1, block2) {
        var temp = [];
        for (var i = 0; i < 16; i++) {
            temp[i] = block1[i] ^ block2[i];
        }
        return temp;
    },

    expandKey: function(key) {
        var Nb = this.Nb;
        var Nr = this.Nr;
        var Nk = this.Nk;

        var w = [];
        var temp = [];

        for (var i = 0; i < Nk; i++) {
            var r = [key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]];
            w[i] = r;
        }

        for (var i = Nk; i < (4 * (Nr + 1)); i++) {
            w[i] = [];
            for (var t = 0; t < 4; t++) {
                temp[t] = w[i - 1][t];
            }
            if (i % Nk === 0) {
                temp = this.subWord(this.rotWord(temp));
                temp[0] ^= this.Rcon[i / Nk - 1];
            } else if (Nk > 6 && i % Nk == 4) {
                temp = this.subWord(temp);
            }
            for (var t = 0; t < 4; t++) {
                w[i][t] = w[i - Nk][t] ^ temp[t];
            }
        }
        var flat = [];
        for (var i = 0; i < (Nr + 1); i++) {
            flat[i] = [];
            for (var j = 0; j < 4; j++) {
                flat[i].push(w[i * 4 + j][0], w[i * 4 + j][1], w[i * 4 + j][2], w[i * 4 + j][3]);
            }
        }
        return flat;
    },

    subWord: function(w) {
        for (var i = 0; i < 4; i++) {
            w[i] = this.SBox[w[i]];
        }
        return w;
    },

    rotWord: function(w) {
        var tmp = w[0];
        for (var i = 0; i < 4; i++) {
            w[i] = w[i + 1];
        }
        w[3] = tmp;
        return w;
    },


    SBox: [
    99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171,
    118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164,
    114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113,
    216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226,
    235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214,
    179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203,
    190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69,
    249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245,
    188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68,
    23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42,
    144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73,
    6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109,
    141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37,
    46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62,
    181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225,
    248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223,
    140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187,
    22],

    SBoxInv: [
    82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215,
    251, 124, 227, 57, 130, 155, 47, 255, 135, 52, 142, 67, 68, 196, 222,
    233, 203, 84, 123, 148, 50, 166, 194, 35, 61, 238, 76, 149, 11, 66,
    250, 195, 78, 8, 46, 161, 102, 40, 217, 36, 178, 118, 91, 162, 73,
    109, 139, 209, 37, 114, 248, 246, 100, 134, 104, 152, 22, 212, 164, 92,
    204, 93, 101, 182, 146, 108, 112, 72, 80, 253, 237, 185, 218, 94, 21,
    70, 87, 167, 141, 157, 132, 144, 216, 171, 0, 140, 188, 211, 10, 247,
    228, 88, 5, 184, 179, 69, 6, 208, 44, 30, 143, 202, 63, 15, 2,
    193, 175, 189, 3, 1, 19, 138, 107, 58, 145, 17, 65, 79, 103, 220,
    234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116, 34, 231, 173,
    53, 133, 226, 249, 55, 232, 28, 117, 223, 110, 71, 241, 26, 113, 29,
    41, 197, 137, 111, 183, 98, 14, 170, 24, 190, 27, 252, 86, 62, 75,
    198, 210, 121, 32, 154, 219, 192, 254, 120, 205, 90, 244, 31, 221, 168,
    51, 136, 7, 199, 49, 177, 18, 16, 89, 39, 128, 236, 95, 96, 81,
    127, 169, 25, 181, 74, 13, 45, 229, 122, 159, 147, 201, 156, 239, 160,
    224, 59, 77, 174, 42, 245, 176, 200, 235, 187, 60, 131, 83, 153, 97,
    23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85, 33, 12,
    125],
    Rcon: [1, 2, 4, 8, 16, 32, 64, 128, 27, 54, 108, 216, 171, 77, 154, 47, 94,
    188, 99, 198, 151, 53, 106, 212, 179, 125, 250, 239, 197, 145],

    G2X: [
    0x00, 0x02, 0x04, 0x06, 0x08, 0x0a, 0x0c, 0x0e, 0x10, 0x12, 0x14, 0x16,
    0x18, 0x1a, 0x1c, 0x1e, 0x20, 0x22, 0x24, 0x26, 0x28, 0x2a, 0x2c, 0x2e,
    0x30, 0x32, 0x34, 0x36, 0x38, 0x3a, 0x3c, 0x3e, 0x40, 0x42, 0x44, 0x46,
    0x48, 0x4a, 0x4c, 0x4e, 0x50, 0x52, 0x54, 0x56, 0x58, 0x5a, 0x5c, 0x5e,
    0x60, 0x62, 0x64, 0x66, 0x68, 0x6a, 0x6c, 0x6e, 0x70, 0x72, 0x74, 0x76,
    0x78, 0x7a, 0x7c, 0x7e, 0x80, 0x82, 0x84, 0x86, 0x88, 0x8a, 0x8c, 0x8e,
    0x90, 0x92, 0x94, 0x96, 0x98, 0x9a, 0x9c, 0x9e, 0xa0, 0xa2, 0xa4, 0xa6,
    0xa8, 0xaa, 0xac, 0xae, 0xb0, 0xb2, 0xb4, 0xb6, 0xb8, 0xba, 0xbc, 0xbe,
    0xc0, 0xc2, 0xc4, 0xc6, 0xc8, 0xca, 0xcc, 0xce, 0xd0, 0xd2, 0xd4, 0xd6,
    0xd8, 0xda, 0xdc, 0xde, 0xe0, 0xe2, 0xe4, 0xe6, 0xe8, 0xea, 0xec, 0xee,
    0xf0, 0xf2, 0xf4, 0xf6, 0xf8, 0xfa, 0xfc, 0xfe, 0x1b, 0x19, 0x1f, 0x1d,
    0x13, 0x11, 0x17, 0x15, 0x0b, 0x09, 0x0f, 0x0d, 0x03, 0x01, 0x07, 0x05,
    0x3b, 0x39, 0x3f, 0x3d, 0x33, 0x31, 0x37, 0x35, 0x2b, 0x29, 0x2f, 0x2d,
    0x23, 0x21, 0x27, 0x25, 0x5b, 0x59, 0x5f, 0x5d, 0x53, 0x51, 0x57, 0x55,
    0x4b, 0x49, 0x4f, 0x4d, 0x43, 0x41, 0x47, 0x45, 0x7b, 0x79, 0x7f, 0x7d,
    0x73, 0x71, 0x77, 0x75, 0x6b, 0x69, 0x6f, 0x6d, 0x63, 0x61, 0x67, 0x65,
    0x9b, 0x99, 0x9f, 0x9d, 0x93, 0x91, 0x97, 0x95, 0x8b, 0x89, 0x8f, 0x8d,
    0x83, 0x81, 0x87, 0x85, 0xbb, 0xb9, 0xbf, 0xbd, 0xb3, 0xb1, 0xb7, 0xb5,
    0xab, 0xa9, 0xaf, 0xad, 0xa3, 0xa1, 0xa7, 0xa5, 0xdb, 0xd9, 0xdf, 0xdd,
    0xd3, 0xd1, 0xd7, 0xd5, 0xcb, 0xc9, 0xcf, 0xcd, 0xc3, 0xc1, 0xc7, 0xc5,
    0xfb, 0xf9, 0xff, 0xfd, 0xf3, 0xf1, 0xf7, 0xf5, 0xeb, 0xe9, 0xef, 0xed,
    0xe3, 0xe1, 0xe7, 0xe5
    ],

    G3X: [
    0x00, 0x03, 0x06, 0x05, 0x0c, 0x0f, 0x0a, 0x09, 0x18, 0x1b, 0x1e, 0x1d,
    0x14, 0x17, 0x12, 0x11, 0x30, 0x33, 0x36, 0x35, 0x3c, 0x3f, 0x3a, 0x39,
    0x28, 0x2b, 0x2e, 0x2d, 0x24, 0x27, 0x22, 0x21, 0x60, 0x63, 0x66, 0x65,
    0x6c, 0x6f, 0x6a, 0x69, 0x78, 0x7b, 0x7e, 0x7d, 0x74, 0x77, 0x72, 0x71,
    0x50, 0x53, 0x56, 0x55, 0x5c, 0x5f, 0x5a, 0x59, 0x48, 0x4b, 0x4e, 0x4d,
    0x44, 0x47, 0x42, 0x41, 0xc0, 0xc3, 0xc6, 0xc5, 0xcc, 0xcf, 0xca, 0xc9,
    0xd8, 0xdb, 0xde, 0xdd, 0xd4, 0xd7, 0xd2, 0xd1, 0xf0, 0xf3, 0xf6, 0xf5,
    0xfc, 0xff, 0xfa, 0xf9, 0xe8, 0xeb, 0xee, 0xed, 0xe4, 0xe7, 0xe2, 0xe1,
    0xa0, 0xa3, 0xa6, 0xa5, 0xac, 0xaf, 0xaa, 0xa9, 0xb8, 0xbb, 0xbe, 0xbd,
    0xb4, 0xb7, 0xb2, 0xb1, 0x90, 0x93, 0x96, 0x95, 0x9c, 0x9f, 0x9a, 0x99,
    0x88, 0x8b, 0x8e, 0x8d, 0x84, 0x87, 0x82, 0x81, 0x9b, 0x98, 0x9d, 0x9e,
    0x97, 0x94, 0x91, 0x92, 0x83, 0x80, 0x85, 0x86, 0x8f, 0x8c, 0x89, 0x8a,
    0xab, 0xa8, 0xad, 0xae, 0xa7, 0xa4, 0xa1, 0xa2, 0xb3, 0xb0, 0xb5, 0xb6,
    0xbf, 0xbc, 0xb9, 0xba, 0xfb, 0xf8, 0xfd, 0xfe, 0xf7, 0xf4, 0xf1, 0xf2,
    0xe3, 0xe0, 0xe5, 0xe6, 0xef, 0xec, 0xe9, 0xea, 0xcb, 0xc8, 0xcd, 0xce,
    0xc7, 0xc4, 0xc1, 0xc2, 0xd3, 0xd0, 0xd5, 0xd6, 0xdf, 0xdc, 0xd9, 0xda,
    0x5b, 0x58, 0x5d, 0x5e, 0x57, 0x54, 0x51, 0x52, 0x43, 0x40, 0x45, 0x46,
    0x4f, 0x4c, 0x49, 0x4a, 0x6b, 0x68, 0x6d, 0x6e, 0x67, 0x64, 0x61, 0x62,
    0x73, 0x70, 0x75, 0x76, 0x7f, 0x7c, 0x79, 0x7a, 0x3b, 0x38, 0x3d, 0x3e,
    0x37, 0x34, 0x31, 0x32, 0x23, 0x20, 0x25, 0x26, 0x2f, 0x2c, 0x29, 0x2a,
    0x0b, 0x08, 0x0d, 0x0e, 0x07, 0x04, 0x01, 0x02, 0x13, 0x10, 0x15, 0x16,
    0x1f, 0x1c, 0x19, 0x1a
    ],

    G9X: [
    0x00, 0x09, 0x12, 0x1b, 0x24, 0x2d, 0x36, 0x3f, 0x48, 0x41, 0x5a, 0x53,
    0x6c, 0x65, 0x7e, 0x77, 0x90, 0x99, 0x82, 0x8b, 0xb4, 0xbd, 0xa6, 0xaf,
    0xd8, 0xd1, 0xca, 0xc3, 0xfc, 0xf5, 0xee, 0xe7, 0x3b, 0x32, 0x29, 0x20,
    0x1f, 0x16, 0x0d, 0x04, 0x73, 0x7a, 0x61, 0x68, 0x57, 0x5e, 0x45, 0x4c,
    0xab, 0xa2, 0xb9, 0xb0, 0x8f, 0x86, 0x9d, 0x94, 0xe3, 0xea, 0xf1, 0xf8,
    0xc7, 0xce, 0xd5, 0xdc, 0x76, 0x7f, 0x64, 0x6d, 0x52, 0x5b, 0x40, 0x49,
    0x3e, 0x37, 0x2c, 0x25, 0x1a, 0x13, 0x08, 0x01, 0xe6, 0xef, 0xf4, 0xfd,
    0xc2, 0xcb, 0xd0, 0xd9, 0xae, 0xa7, 0xbc, 0xb5, 0x8a, 0x83, 0x98, 0x91,
    0x4d, 0x44, 0x5f, 0x56, 0x69, 0x60, 0x7b, 0x72, 0x05, 0x0c, 0x17, 0x1e,
    0x21, 0x28, 0x33, 0x3a, 0xdd, 0xd4, 0xcf, 0xc6, 0xf9, 0xf0, 0xeb, 0xe2,
    0x95, 0x9c, 0x87, 0x8e, 0xb1, 0xb8, 0xa3, 0xaa, 0xec, 0xe5, 0xfe, 0xf7,
    0xc8, 0xc1, 0xda, 0xd3, 0xa4, 0xad, 0xb6, 0xbf, 0x80, 0x89, 0x92, 0x9b,
    0x7c, 0x75, 0x6e, 0x67, 0x58, 0x51, 0x4a, 0x43, 0x34, 0x3d, 0x26, 0x2f,
    0x10, 0x19, 0x02, 0x0b, 0xd7, 0xde, 0xc5, 0xcc, 0xf3, 0xfa, 0xe1, 0xe8,
    0x9f, 0x96, 0x8d, 0x84, 0xbb, 0xb2, 0xa9, 0xa0, 0x47, 0x4e, 0x55, 0x5c,
    0x63, 0x6a, 0x71, 0x78, 0x0f, 0x06, 0x1d, 0x14, 0x2b, 0x22, 0x39, 0x30,
    0x9a, 0x93, 0x88, 0x81, 0xbe, 0xb7, 0xac, 0xa5, 0xd2, 0xdb, 0xc0, 0xc9,
    0xf6, 0xff, 0xe4, 0xed, 0x0a, 0x03, 0x18, 0x11, 0x2e, 0x27, 0x3c, 0x35,
    0x42, 0x4b, 0x50, 0x59, 0x66, 0x6f, 0x74, 0x7d, 0xa1, 0xa8, 0xb3, 0xba,
    0x85, 0x8c, 0x97, 0x9e, 0xe9, 0xe0, 0xfb, 0xf2, 0xcd, 0xc4, 0xdf, 0xd6,
    0x31, 0x38, 0x23, 0x2a, 0x15, 0x1c, 0x07, 0x0e, 0x79, 0x70, 0x6b, 0x62,
    0x5d, 0x54, 0x4f, 0x46
    ],

    GBX: [
    0x00, 0x0b, 0x16, 0x1d, 0x2c, 0x27, 0x3a, 0x31, 0x58, 0x53, 0x4e, 0x45,
    0x74, 0x7f, 0x62, 0x69, 0xb0, 0xbb, 0xa6, 0xad, 0x9c, 0x97, 0x8a, 0x81,
    0xe8, 0xe3, 0xfe, 0xf5, 0xc4, 0xcf, 0xd2, 0xd9, 0x7b, 0x70, 0x6d, 0x66,
    0x57, 0x5c, 0x41, 0x4a, 0x23, 0x28, 0x35, 0x3e, 0x0f, 0x04, 0x19, 0x12,
    0xcb, 0xc0, 0xdd, 0xd6, 0xe7, 0xec, 0xf1, 0xfa, 0x93, 0x98, 0x85, 0x8e,
    0xbf, 0xb4, 0xa9, 0xa2, 0xf6, 0xfd, 0xe0, 0xeb, 0xda, 0xd1, 0xcc, 0xc7,
    0xae, 0xa5, 0xb8, 0xb3, 0x82, 0x89, 0x94, 0x9f, 0x46, 0x4d, 0x50, 0x5b,
    0x6a, 0x61, 0x7c, 0x77, 0x1e, 0x15, 0x08, 0x03, 0x32, 0x39, 0x24, 0x2f,
    0x8d, 0x86, 0x9b, 0x90, 0xa1, 0xaa, 0xb7, 0xbc, 0xd5, 0xde, 0xc3, 0xc8,
    0xf9, 0xf2, 0xef, 0xe4, 0x3d, 0x36, 0x2b, 0x20, 0x11, 0x1a, 0x07, 0x0c,
    0x65, 0x6e, 0x73, 0x78, 0x49, 0x42, 0x5f, 0x54, 0xf7, 0xfc, 0xe1, 0xea,
    0xdb, 0xd0, 0xcd, 0xc6, 0xaf, 0xa4, 0xb9, 0xb2, 0x83, 0x88, 0x95, 0x9e,
    0x47, 0x4c, 0x51, 0x5a, 0x6b, 0x60, 0x7d, 0x76, 0x1f, 0x14, 0x09, 0x02,
    0x33, 0x38, 0x25, 0x2e, 0x8c, 0x87, 0x9a, 0x91, 0xa0, 0xab, 0xb6, 0xbd,
    0xd4, 0xdf, 0xc2, 0xc9, 0xf8, 0xf3, 0xee, 0xe5, 0x3c, 0x37, 0x2a, 0x21,
    0x10, 0x1b, 0x06, 0x0d, 0x64, 0x6f, 0x72, 0x79, 0x48, 0x43, 0x5e, 0x55,
    0x01, 0x0a, 0x17, 0x1c, 0x2d, 0x26, 0x3b, 0x30, 0x59, 0x52, 0x4f, 0x44,
    0x75, 0x7e, 0x63, 0x68, 0xb1, 0xba, 0xa7, 0xac, 0x9d, 0x96, 0x8b, 0x80,
    0xe9, 0xe2, 0xff, 0xf4, 0xc5, 0xce, 0xd3, 0xd8, 0x7a, 0x71, 0x6c, 0x67,
    0x56, 0x5d, 0x40, 0x4b, 0x22, 0x29, 0x34, 0x3f, 0x0e, 0x05, 0x18, 0x13,
    0xca, 0xc1, 0xdc, 0xd7, 0xe6, 0xed, 0xf0, 0xfb, 0x92, 0x99, 0x84, 0x8f,
    0xbe, 0xb5, 0xa8, 0xa3
    ],

    GDX: [
    0x00, 0x0d, 0x1a, 0x17, 0x34, 0x39, 0x2e, 0x23, 0x68, 0x65, 0x72, 0x7f,
    0x5c, 0x51, 0x46, 0x4b, 0xd0, 0xdd, 0xca, 0xc7, 0xe4, 0xe9, 0xfe, 0xf3,
    0xb8, 0xb5, 0xa2, 0xaf, 0x8c, 0x81, 0x96, 0x9b, 0xbb, 0xb6, 0xa1, 0xac,
    0x8f, 0x82, 0x95, 0x98, 0xd3, 0xde, 0xc9, 0xc4, 0xe7, 0xea, 0xfd, 0xf0,
    0x6b, 0x66, 0x71, 0x7c, 0x5f, 0x52, 0x45, 0x48, 0x03, 0x0e, 0x19, 0x14,
    0x37, 0x3a, 0x2d, 0x20, 0x6d, 0x60, 0x77, 0x7a, 0x59, 0x54, 0x43, 0x4e,
    0x05, 0x08, 0x1f, 0x12, 0x31, 0x3c, 0x2b, 0x26, 0xbd, 0xb0, 0xa7, 0xaa,
    0x89, 0x84, 0x93, 0x9e, 0xd5, 0xd8, 0xcf, 0xc2, 0xe1, 0xec, 0xfb, 0xf6,
    0xd6, 0xdb, 0xcc, 0xc1, 0xe2, 0xef, 0xf8, 0xf5, 0xbe, 0xb3, 0xa4, 0xa9,
    0x8a, 0x87, 0x90, 0x9d, 0x06, 0x0b, 0x1c, 0x11, 0x32, 0x3f, 0x28, 0x25,
    0x6e, 0x63, 0x74, 0x79, 0x5a, 0x57, 0x40, 0x4d, 0xda, 0xd7, 0xc0, 0xcd,
    0xee, 0xe3, 0xf4, 0xf9, 0xb2, 0xbf, 0xa8, 0xa5, 0x86, 0x8b, 0x9c, 0x91,
    0x0a, 0x07, 0x10, 0x1d, 0x3e, 0x33, 0x24, 0x29, 0x62, 0x6f, 0x78, 0x75,
    0x56, 0x5b, 0x4c, 0x41, 0x61, 0x6c, 0x7b, 0x76, 0x55, 0x58, 0x4f, 0x42,
    0x09, 0x04, 0x13, 0x1e, 0x3d, 0x30, 0x27, 0x2a, 0xb1, 0xbc, 0xab, 0xa6,
    0x85, 0x88, 0x9f, 0x92, 0xd9, 0xd4, 0xc3, 0xce, 0xed, 0xe0, 0xf7, 0xfa,
    0xb7, 0xba, 0xad, 0xa0, 0x83, 0x8e, 0x99, 0x94, 0xdf, 0xd2, 0xc5, 0xc8,
    0xeb, 0xe6, 0xf1, 0xfc, 0x67, 0x6a, 0x7d, 0x70, 0x53, 0x5e, 0x49, 0x44,
    0x0f, 0x02, 0x15, 0x18, 0x3b, 0x36, 0x21, 0x2c, 0x0c, 0x01, 0x16, 0x1b,
    0x38, 0x35, 0x22, 0x2f, 0x64, 0x69, 0x7e, 0x73, 0x50, 0x5d, 0x4a, 0x47,
    0xdc, 0xd1, 0xc6, 0xcb, 0xe8, 0xe5, 0xf2, 0xff, 0xb4, 0xb9, 0xae, 0xa3,
    0x80, 0x8d, 0x9a, 0x97
    ],

    GEX: [
    0x00, 0x0e, 0x1c, 0x12, 0x38, 0x36, 0x24, 0x2a, 0x70, 0x7e, 0x6c, 0x62,
    0x48, 0x46, 0x54, 0x5a, 0xe0, 0xee, 0xfc, 0xf2, 0xd8, 0xd6, 0xc4, 0xca,
    0x90, 0x9e, 0x8c, 0x82, 0xa8, 0xa6, 0xb4, 0xba, 0xdb, 0xd5, 0xc7, 0xc9,
    0xe3, 0xed, 0xff, 0xf1, 0xab, 0xa5, 0xb7, 0xb9, 0x93, 0x9d, 0x8f, 0x81,
    0x3b, 0x35, 0x27, 0x29, 0x03, 0x0d, 0x1f, 0x11, 0x4b, 0x45, 0x57, 0x59,
    0x73, 0x7d, 0x6f, 0x61, 0xad, 0xa3, 0xb1, 0xbf, 0x95, 0x9b, 0x89, 0x87,
    0xdd, 0xd3, 0xc1, 0xcf, 0xe5, 0xeb, 0xf9, 0xf7, 0x4d, 0x43, 0x51, 0x5f,
    0x75, 0x7b, 0x69, 0x67, 0x3d, 0x33, 0x21, 0x2f, 0x05, 0x0b, 0x19, 0x17,
    0x76, 0x78, 0x6a, 0x64, 0x4e, 0x40, 0x52, 0x5c, 0x06, 0x08, 0x1a, 0x14,
    0x3e, 0x30, 0x22, 0x2c, 0x96, 0x98, 0x8a, 0x84, 0xae, 0xa0, 0xb2, 0xbc,
    0xe6, 0xe8, 0xfa, 0xf4, 0xde, 0xd0, 0xc2, 0xcc, 0x41, 0x4f, 0x5d, 0x53,
    0x79, 0x77, 0x65, 0x6b, 0x31, 0x3f, 0x2d, 0x23, 0x09, 0x07, 0x15, 0x1b,
    0xa1, 0xaf, 0xbd, 0xb3, 0x99, 0x97, 0x85, 0x8b, 0xd1, 0xdf, 0xcd, 0xc3,
    0xe9, 0xe7, 0xf5, 0xfb, 0x9a, 0x94, 0x86, 0x88, 0xa2, 0xac, 0xbe, 0xb0,
    0xea, 0xe4, 0xf6, 0xf8, 0xd2, 0xdc, 0xce, 0xc0, 0x7a, 0x74, 0x66, 0x68,
    0x42, 0x4c, 0x5e, 0x50, 0x0a, 0x04, 0x16, 0x18, 0x32, 0x3c, 0x2e, 0x20,
    0xec, 0xe2, 0xf0, 0xfe, 0xd4, 0xda, 0xc8, 0xc6, 0x9c, 0x92, 0x80, 0x8e,
    0xa4, 0xaa, 0xb8, 0xb6, 0x0c, 0x02, 0x10, 0x1e, 0x34, 0x3a, 0x28, 0x26,
    0x7c, 0x72, 0x60, 0x6e, 0x44, 0x4a, 0x58, 0x56, 0x37, 0x39, 0x2b, 0x25,
    0x0f, 0x01, 0x13, 0x1d, 0x47, 0x49, 0x5b, 0x55, 0x7f, 0x71, 0x63, 0x6d,
    0xd7, 0xd9, 0xcb, 0xc5, 0xef, 0xe1, 0xf3, 0xfd, 0xa7, 0xa9, 0xbb, 0xb5,
    0x9f, 0x91, 0x83, 0x8d
    ],

	enc: function(string, pass) {
		return this.encryptUsingPassword(string, pass, true);
    },

	encryptUsingPassword: function(string, password, salted) {
		var key = GibberishAES.Hash.MD5(this.s2a(password));
		return this.encryptUsingKey(string, key, salted);
	},

	encryptUsingKey: function(string, inKeyArray, salted) {
		var key, iv;

		if (salted) {
			var salt = this.randArr(8);
	        var pbe = this.openSSLKey(inKeyArray, salt);
	        key = pbe.key;
	        iv = pbe.iv;
		}
		else {
			key = inKeyArray;
	        iv = this.ZERO_IV;
		}

        string = this.s2a(string);
        var cipherBlocks = this.rawEncrypt(string, key, iv);

		if (salted) {
        	var saltBlock = [this.SALTED_PREFIX.concat(salt)];
        	cipherBlocks = saltBlock.concat(cipherBlocks);
		}

        return this.Base64.encode(cipherBlocks);
	},

    dec: function(string, pass) {
		return this.decryptBase64UsingKey(string, this.s2a(pass));
    },

	decryptUsingPBKDF2: function(data, password) {
		var binaryArr = GibberishAES.Base64.decode(data);

		var saltArr = this.ZERO_IV;
		if (this.isSalted(binaryArr)) {
			saltArr = binaryArr.slice(8, 16);
			binaryArr = binaryArr.slice(16);
		}

		var t0 = new Date();
		var mypbkdf2 = new PBKDF2(password, this.a2s(saltArr), 1000, 32);  // key is 16bytes; ivec is 16bytes
		var derivedKey = mypbkdf2.deriveKey();

		var t1 = new Date();

		var key = derivedKey.slice(0, 16);
		var iv = derivedKey.slice(16);
		try {
			return this.decryptBinaryUsingKeyAndIvec(binaryArr, key, iv);
		}catch(e) {
			return null;
		}
	},

	decryptBase64UsingKey: function(string, inKeyArray) {
	  console.log("b64validation : %o", string);
        var binaryArr = this.Base64.decode(string);
        console.log("validation : %o", binaryArr);
        var dec =this.decryptBinaryUsingKey(binaryArr, inKeyArray);
        console.log("dec: %o", GibberishAES.s2a(dec));
		    return dec;
	},

	decryptBinaryUsingKey: function(binaryArr, inKeyArray) {
		var salted = this.isSalted(binaryArr);
		var key, iv;

        if (salted) {
	        var salt = binaryArr.slice(8, 16);

	        var pbe = this.openSSLKey(inKeyArray, salt);
	        key = pbe.key;
	        iv = pbe.iv;
	        binaryArr = binaryArr.slice(16, binaryArr.length);
		}
		else {
			key =  GibberishAES.Hash.MD5(inKeyArray);
			iv = this.ZERO_IV;
		}

		try {
		      console.log("key: %o", key);
		      console.log("iv: %o", iv);
		      console.log("encdat : %o", binaryArr);
	        return this.decryptBinaryUsingKeyAndIvec(binaryArr, key, iv);
		}
		catch (e) {
			return null;
		}
	},

	isSalted: function(cryptArr) {
		for (var i=0; i < 8; i++) {
			if (this.SALTED_PREFIX[i] != cryptArr[i]) {
				return false;
			}
		}
		return true;
	}
};

GibberishAES.Hash = {

    MD5: function(numArr) {

        function RotateLeft(lValue, iShiftBits) {
            return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
        }

        function AddUnsigned(lX, lY) {
            var lX4,
            lY4,
            lX8,
            lY8,
            lResult;
            lX8 = (lX & 0x80000000);
            lY8 = (lY & 0x80000000);
            lX4 = (lX & 0x40000000);
            lY4 = (lY & 0x40000000);
            lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
            if (lX4 & lY4) {
                return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
            }
            if (lX4 | lY4) {
                if (lResult & 0x40000000) {
                    return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
                } else {
                    return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
                }
            } else {
                return (lResult ^ lX8 ^ lY8);
            }
        }

        function F(x, y, z) {
            return (x & y) | ((~x) & z);
        }
        function G(x, y, z) {
            return (x & z) | (y & (~z));
        }
        function H(x, y, z) {
            return (x ^ y ^ z);
        }
        function I(x, y, z) {
            return (y ^ (x | (~z)));
        }

        function FF(a, b, c, d, x, s, ac) {
            a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
            return AddUnsigned(RotateLeft(a, s), b);
        };

        function GG(a, b, c, d, x, s, ac) {
            a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
            return AddUnsigned(RotateLeft(a, s), b);
        };

        function HH(a, b, c, d, x, s, ac) {
            a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
            return AddUnsigned(RotateLeft(a, s), b);
        };

        function II(a, b, c, d, x, s, ac) {
            a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
            return AddUnsigned(RotateLeft(a, s), b);
        };

        function ConvertToWordArray(numArr) {
            var lWordCount;
            var lMessageLength = numArr.length;
            var lNumberOfWords_temp1 = lMessageLength + 8;
            var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
            var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
            var lWordArray = Array(lNumberOfWords - 1);
            var lBytePosition = 0;
            var lByteCount = 0;
            while (lByteCount < lMessageLength) {
                lWordCount = (lByteCount - (lByteCount % 4)) / 4;
                lBytePosition = (lByteCount % 4) * 8;
                lWordArray[lWordCount] = (lWordArray[lWordCount] | (numArr[lByteCount] << lBytePosition));
                lByteCount++;
            }
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
            lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
            lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
            return lWordArray;
        };

        function WordToHex(lValue) {
            var WordToHexValue = "",
            WordToHexValue_temp = "",
            lByte,
            lCount;
            var WordToHexArr = []
            for (lCount = 0; lCount <= 3; lCount++) {
                lByte = (lValue >>> (lCount * 8)) & 255;
                WordToHexArr = WordToHexArr.concat(lByte)
             }
            return WordToHexArr;
        };

        function Utf8Encode(string) {
            string = string.replace(/\r\n/g, "\n");
            var utftext = "";

            for (var n = 0; n < string.length; n++) {

                var c = string.charCodeAt(n);

                if (c < 128) {
                    utftext += String.fromCharCode(c);
                }
                else if ((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }

            }

            return utftext;
        };

        var x = Array();
        var k,
        AA,
        BB,
        CC,
        DD,
        a,
        b,
        c,
        d;
        var S11 = 7,
        S12 = 12,
        S13 = 17,
        S14 = 22;
        var S21 = 5,
        S22 = 9,
        S23 = 14,
        S24 = 20;
        var S31 = 4,
        S32 = 11,
        S33 = 16,
        S34 = 23;
        var S41 = 6,
        S42 = 10,
        S43 = 15,
        S44 = 21;

        x = ConvertToWordArray(numArr);

        a = 0x67452301;
        b = 0xEFCDAB89;
        c = 0x98BADCFE;
        d = 0x10325476;

        for (k = 0; k < x.length; k += 16) {
            AA = a;
            BB = b;
            CC = c;
            DD = d;
            a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
            d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
            c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
            b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
            a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
            d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
            c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
            b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
            a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
            d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
            c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
            b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
            a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
            d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
            c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
            b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
            a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
            d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
            c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
            b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
            a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
            d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
            c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
            b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
            a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
            d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
            c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
            b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
            a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
            d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
            c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
            b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
            a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
            d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
            c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
            b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
            a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
            d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
            c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
            b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
            a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
            d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
            c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
            b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
            a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
            d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
            c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
            b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
            a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
            d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
            c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
            b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
            a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
            d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
            c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
            b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
            a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
            d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
            c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
            b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
            a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
            d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
            c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
            b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
            a = AddUnsigned(a, AA);
            b = AddUnsigned(b, BB);
            c = AddUnsigned(c, CC);
            d = AddUnsigned(d, DD);
        }

        var temp = WordToHex(a).concat(WordToHex(b), WordToHex(c), WordToHex(d));
        return temp;
    }
};

GibberishAES.Base64 = {
    chars: [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
    'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
    'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
    'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
    'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
    'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
    'w', 'x', 'y', 'z', '0', '1', '2', '3',
    '4', '5', '6', '7', '8', '9', '+', '/'],

    encode: function(b, withBreaks) {
        var flatArr = [];
        var b64 = '';
        totalChunks = Math.floor(b.length * 16 / 3)
        for (var i = 0; i < b.length * 16; i++) {
            flatArr.push(b[Math.floor(i / 16)][i % 16]);
        }
        for (var i = 0; i < flatArr.length; i = i + 3) {
            b64 += this.chars[flatArr[i] >> 2];
            b64 += this.chars[((flatArr[i] & 3) << 4) | (flatArr[i + 1] >> 4)];
            if (! (flatArr[i + 1] == null)) {
                b64 += this.chars[((flatArr[i + 1] & 15) << 2) | (flatArr[i + 2] >> 6)];
            } else {
                b64 += '='
            }
            if (! (flatArr[i + 2] == null)) {
                b64 += this.chars[flatArr[i + 2] & 63];
            } else {
                b64 += '='
            }
        }
        var broken_b64 = b64.slice(0, 64) + '\n';
        for (var i = 1; i < (Math.ceil(b64.length / 64)); i++) {
            broken_b64 += b64.slice(i * 64, i * 64 + 64) + (Math.ceil(b64.length / 64) == i + 1 ? '': '\n');
        }
        return broken_b64
    },

    decode: function(string) {
        string = string.replace(/\n/g, '');
        var flatArr = [];
        var c = [];
        var b = [];
        for (var i = 0; i < string.length; i = i + 4) {
            c[0] = this.chars.indexOf(string.charAt(i));
            c[1] = this.chars.indexOf(string.charAt(i + 1));
            c[2] = this.chars.indexOf(string.charAt(i + 2));
            c[3] = this.chars.indexOf(string.charAt(i + 3));

            b[0] = (c[0] << 2) | (c[1] >> 4);
            b[1] = ((c[1] & 15) << 4) | (c[2] >> 2);
            b[2] = ((c[2] & 3) << 6) | c[3];
            flatArr.push(b[0], b[1], b[2]);
        }
        flatArr = flatArr.slice(0, flatArr.length - (flatArr.length % 16));
        return flatArr;
    },

};






function PBKDF2(password, salt, num_iterations, num_bytes)
{
	var m_bpassword = str2binb(password);
	var m_salt = salt;

	var m_total_iterations = num_iterations;

	var m_iterations_in_chunk = 100;

	var m_iterations_done = 0;

	var m_key_length = num_bytes;

	var m_hash_length = 20;

	var m_total_blocks = Math.ceil(m_key_length/m_hash_length);

	var m_current_block = 1;

	var m_ipad = new Array(16);
	var m_opad = new Array(16);

	var m_buffer = new Array(0x0,0x0,0x0,0x0,0x0);

	var m_key = "";

	var m_result_func;

	var m_status_func;

	if (m_bpassword.length > 16) m_bpassword = core_sha1(m_bpassword, password.length * chrsz);
	for(var i = 0; i < 16; ++i)
	{
		m_ipad[i] = m_bpassword[i] ^ 0x36363636;
		m_opad[i] = m_bpassword[i] ^ 0x5C5C5C5C;
	}

	this.deriveKey = function()
	{
 		return this.do_PBKDF2_iterations();
	}


	this.do_PBKDF2_iterations = function()
	{
		while(1) {
			var iterations = m_total_iterations;

			for(var i=0; i<iterations; ++i) {
				if (m_iterations_done == 0) {
					var salt_block = m_salt +
							String.fromCharCode(m_current_block >> 24 & 0xF) +
							String.fromCharCode(m_current_block >> 16 & 0xF) +
							String.fromCharCode(m_current_block >>  8 & 0xF) +
							String.fromCharCode(m_current_block       & 0xF);

					m_hash = core_sha1(m_ipad.concat(str2binb(salt_block)), 512 + salt_block.length * 8);
					m_hash = core_sha1(m_opad.concat(m_hash), 512 + 160);
				}
				else {
					m_hash = core_sha1(m_ipad.concat(m_hash), 512 + m_hash.length * 32);
					m_hash = core_sha1(m_opad.concat(m_hash), 512 + 160);
				}

	        	for(var j=0; j<m_hash.length; ++j)
	                m_buffer[j] ^= m_hash[j];

				m_iterations_done++;
			}

			if (m_current_block < m_total_blocks) {
				m_key += binb2hex(m_buffer);

				m_current_block++;
				m_buffer = new Array(0x0,0x0,0x0,0x0,0x0);
				m_iterations_done = 0;
			}
			else {
				var tmp = binb2hex(m_buffer);
				m_key += tmp.substr(0, (m_key_length - (m_total_blocks - 1) * m_hash_length) * 2 );

				return GibberishAES.s2a(hex2bin(m_key));
			}
		}
	}
}
var INDEX_UUID=0, INDEX_TYPE=1, INDEX_NAME=2, INDEX_URL=3, INDEX_DATE=4, INDEX_FOLDER=5, INDEX_PASSWORD_STRENGTH=6, INDEX_TRASHED=7;
var TYPE_WEBFORMS='webforms.WebForm', TYPE_FOLDERS='system.folder.Regular', TYPE_NOTES='securenotes.SecureNote', TYPE_IDENTITIES='identities.Identity', TYPE_PASSWORDS='passwords.Password', TYPE_WALLET='wallet', TYPE_SOFTWARE_LICENSES='wallet.computer.License', TYPE_TRASHED='trashed';
var ERROR_BAD_DECRYPT = "Decryption failed", ERROR_INVALID_JSON = "Decryption passed but JSON was invalid", ERROR_OK = "OK";

var Keychain = Class.create({
	AUTOLOCK_LENGTH: 5 * 60 * 1000, autoLogoutTime: null,
	contents: {webforms:[], wallet:[], notes:[], identities:[], passwords:[], folders:[]},
	encryptionKeys: null, _all: null, masterPassword: null,

	initialize: function() {
	},

	setEncryptionKeys: function(keys) {
		this.encryptionKeys = keys;
	},

	verifyPassword: function(password) {
		GibberishAES.size(128);
		this.encryptionKeys.decryptedKeys = {};

		var key = this.decryptEncryptionKey("SL5", password);
		if (!key) return false;

		this.masterPassword = password;
		return true;
	},

	decryptEncryptionKey: function(sl, password) {

		for (var i=0; i < this.encryptionKeys["list"].length; i++) {
			var item = this.encryptionKeys["list"][i];

			if (item['identifier'] == this.encryptionKeys[sl]) {
				var decryptedKey = GibberishAES.decryptUsingPBKDF2(item["data"], password);
				if (!decryptedKey) return null;

				var verification = GibberishAES.decryptBase64UsingKey(item["validation"],GibberishAES.s2a(decryptedKey));
				if (verification != decryptedKey) return null;
				this.encryptionKeys.decryptedKeys[sl] = decryptedKey;
				return decryptedKey;
			}
		}

		return null;
	},

	keyForItem: function(item) {
		if (item.securityLevel == null) {
			return this.encryptionKeys.decryptedKeys["SL5"]
		}

		var key = this.encryptionKeys.decryptedKeys[item.securityLevel];
		if (!key) {
			key = this.decryptEncryptionKey(item.securityLevel, this.masterPassword);
		}
		return key;
	},

	rescheduleAutoLogout: function () {
		this.autoLogoutTime = new Date().getTime() + this.AUTOLOCK_LENGTH;
	},

	setContents: function(items) {
		_all = items;
		this.contents[TYPE_WEBFORMS] = this._keychainItemsOfType(TYPE_WEBFORMS, false);
		this.contents[TYPE_NOTES] = this._keychainItemsOfType(TYPE_NOTES, false);
		this.contents[TYPE_WALLET] = this._keychainItemsOfType(TYPE_WALLET, false);
		this.contents[TYPE_PASSWORDS] = this._keychainItemsOfType(TYPE_PASSWORDS, false);
		this.contents[TYPE_IDENTITIES] = this._keychainItemsOfType(TYPE_IDENTITIES, false);
		this.contents[TYPE_SOFTWARE_LICENSES] = this._keychainItemsOfType(TYPE_SOFTWARE_LICENSES, false);
		this.contents['folders'] = this._keychainItemsOfType(TYPE_FOLDERS, false);
		this.contents[TYPE_TRASHED] = this._keychainItemsOfType("", true);

		this.rescheduleAutoLogout();
	},

	itemsOfType : function(name) {
		return this.contents[name];
	},

	itemWithUuid : function(uuid) {
		return _all.find(function(item){return item[INDEX_UUID] == this}, uuid);
	},

	_keychainItemsOfType : function(type, trashed) {

		if (_all[0][INDEX_TRASHED]==undefined) {
			alert("Your 1Password keychain was last used with version 2 and 1PasswordAnywhere requires version 3. Launch 1Password 3 and change something to force your keychain to be updated and then try again.");
			throw "Version 3 keychain required.";
		}

		var result = [];
		var rawList = _all.findAll(function(item) {return item[INDEX_TYPE].startsWith(this)}, type);
		var trash_state = trashed ? "Y" : "N";
		for (var i=0; i < rawList.length; i++) {

			var item = rawList[i];
			if (type == TYPE_WALLET && item[INDEX_TYPE] == TYPE_SOFTWARE_LICENSES) continue;

			if (item[INDEX_TRASHED] == trash_state) {
				result.push(new KeychainItemOverview(rawList[i]));
			}
		}
		return result;
	},

	_autoLogout: function() {
		var now = new Date();

		if (now.getTime() < this.autoLogoutTime) {
			window.setTimeout(this._autoLogout, 750);
			return;
		}
		logout(true);
	},

	lock: function() {
		if (this.encryptionKeys) {
			this.encryptionKeys.decryptedKeys = null;
		}
		this.masterPassword = null;
	}
});

var KeychainItemOverview = Class.create({
	uuid: null, type: null, title: null, domain: null, updatedAt: null, updatedAtMs: null, trashed: null,

	initialize: function(data) {
		this.uuid = data[INDEX_UUID];
		this.type = data[INDEX_TYPE];
		this.title = data[INDEX_NAME];
		this.domain = data[INDEX_URL];
		this.updatedAtMs = data[INDEX_DATE] * 1000;
		this.trashed = data[INDEX_TRASHED];

		var date = new Date();
		date.setTime(this.updatedAtMs);
		this.updatedAt = date.format("mmm d, yyyy, h:MM:ss TT");
	},

});

var KeychainItem = Class.create({
	uuid: null, type: null, title: null, domain: null, updatedAt: null, updatedAtMs: null,
	folderUuid: null, folderName: null, data: null,
	decrypted: false, encrypted_contents: null, decrypted_secure_contents: null,
	updatedAtMs: null,

	initialize: function(data) {
		this.data = data;
		this.folderUuid = data.folderUuid;
		this.encrypted_contents = data.encrypted;
		this.decrypted = false, this.decrypted_secure_contents = null;

		this.uuid = data.uuid;
		this.type = data.typeName;
		this.title = data.title;
		this.domain = data.location;
		this.securityLevel = data.openContents.securityLevel;
		this.updatedAtMs = data.updatedAt * 1000;

		folderName = keychain.itemWithUuid(this.folderUuid);

		if (!folderName) folderName = "None";
	},

	decrypt: function() {
		GibberishAES.size(128);
		var plainText = null;
		var key = keychain.keyForItem(this);
		plainText = GibberishAES.decryptBase64UsingKey(this.encrypted_contents, GibberishAES.s2a(key));

		if (!plainText) {
			return ERROR_BAD_DECRYPT;
		}

		var pt = '(' + plainText + ');';
		try { this.decrypted_secure_contents = eval(pt); }
		catch (e) { return ERROR_INVALID_JSON; }

		return ERROR_OK;
	},

	isWebForm: function()  {
		return this.data.typeName.indexOf(TYPE_WEBFORMS) == 0;
	},

	asHTML: function() {
		switch(this.type) {
			case TYPE_WEBFORMS: return this.webformHTML(); break;
			case TYPE_NOTES: return this.secureNoteHTML(); break;
			case TYPE_SOFTWARE_LICENSES: return this.walletHTML(); break;
			case TYPE_IDENTITIES: return this.identityHTML(); break;
			case TYPE_PASSWORDS: return this.passwordHTML();
		}

		if (this.type.startsWith(TYPE_WALLET)) {
			return this.walletHTML();
		}

		return "No asHTML defined for " + this.type+ " uuid:" + this.uuid;
	},

	passwordHTML: function() {
		var r = "<table><tr><th></th>";
		r += "<th><h1>" + this.title + "</h1></th></tr>";
		r += this.spacerTR();
		r += this.notesTR();
		r += this.spacerTR();
		r += "<tr><td class='label'>password</td><td>" + this.decrypted_secure_contents.password + "</td></tr></table>";
		return r;
	},

	identityHTML: function() {
		var r = "<table><tr><th></th>";
		r += "<th><h1>" + this.title + "</h1></th></tr>";
		r += this.spacerTR();
		r += this.notesTR();
		r += this.spacerTR();
		r += this.walletFields();
		r += "</table>";
		return r;
	},

	walletHTML: function() {
		var r = "<table><tr><th></th>";
		r += "<th><h1>" + this.title + "</h1></th></tr>";
		r += this.spacerTR();
		r += this.notesTR();
		r += this.spacerTR();
		r += this.walletFields();
		r += "</table>";
		return r;
	},

	walletFields: function() {
		var entryValues = "";
		for (var key in this.decrypted_secure_contents)
		{
			if (key == 'notesPlain') continue;
			var v = this.decrypted_secure_contents[key];
			entryValues += "<tr><td class='label'>" + key.escapeHTML() + "</td><td>";

			try {entryValues += v.escapeHTML();}
			catch(e) {entryValues += v;}
			entryValues += "</td></tr>";
		}
		return entryValues;
	},

	secureNoteHTML: function() {
		var r = "<table><tr colspan='2'>";
		r += "<th><h1>" + this.title + "</h1></th></tr>";

		var secure = this.decrypted_secure_contents;
		if (!secure.notesPlain || secure.notesPlain.length == 0) return "";

		return r + "<tr><td colspan='2'>" + convertNewLines(secure.notesPlain.escapeHTML()) + "</td></tr></table>";
	},

	webformHTML: function() {
		var r = "<table><tr><th></th>";
		r += "<th><h1>" + this.title + "</h1>" + this.domain + "</th></tr>";

		r += "<tr><td class='label'>Username</td><td>" + this.loginUsername() + "</td></tr>";
	    r += "<tr><td class='label'>Password</td><td>" + showAndHideConcealedField(this.uuid+'-password', this.loginPassword(), true) + "</td></tr>";

		r += this.spacerTR();
		if (devmode) {
			r += "<tr><td class='label'>UUID</td><td>" + this.uuid + "</td></tr>";
		}
		r += this.notesTR();
		r += this.spacerTR();
		r += this.loginFields();
		r += "</table>";
		return r;
	},

	findFieldWithDesignation: function(designation) {
		var count = this.decrypted_secure_contents.fields.length;
		for (var i = 0; i < count; ++i)
		{
			v = this.decrypted_secure_contents.fields[i];
			if (v.designation == designation) {
				return v.value;
			}
		}
		return null;
	},

	loginUsername: function() {
		var r = this.findFieldWithDesignation('username');
		if (r) return r;
		return "no field was designated as username";
	},

	loginPassword: function() {
		var r = this.findFieldWithDesignation('password');
		if (r) return r;
		return "no field was designated as password";
	},

	loginFields: function() {
		var entryValues = "";
		var count = this.decrypted_secure_contents.fields.length;
		for (var i = 0; i < count; ++i)
		{
			v = this.decrypted_secure_contents.fields[i];
			if (v.name == undefined || v.value == undefined) continue;
			entryValues += "<tr><td class='label'>" + v.name.escapeHTML() + "</td><td>";

			if (v.type == 'P') {
				var id = "concealedField-" + this.uuid + "-" + i;
				entryValues += showAndHideConcealedField(id, v.value, true);
			}
			else {
				entryValues += v.value.escapeHTML();
			}
			entryValues += "</td></tr>";
		}
		return entryValues;
	},

	spacerTR:function() {
		return "<tr><td class='spacer'></td></tr>";
	},

	notesTR:function() {
		var secure = this.decrypted_secure_contents;
		if (!secure.notesPlain || secure.notesPlain.length == 0) return "";

		return "<tr><td class='label'>Notes</td><td>" + convertNewLines(secure.notesPlain.escapeHTML()) + "</td></tr>";
	},
});

function encodeToHex(str){
    var r="";
    var e=str.length;
    var c=0;
    var h;
    while(c<e){
        h=str.charCodeAt(c++).toString(16);
        while(h.length<2) h="0"+h;
        r+=h;
    }
    return r.toUpperCase();
}


var hexcase = 0;

var b64pad  = "";

var chrsz   = 8;

function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

function sha1_vm_test()
{
  return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

function core_sha1(x, len)
{
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

function core_hmac_sha1(key, data)
{
  var bkey = str2binb(key);
  if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
  return core_sha1(opad.concat(hash), 512 + 160);
}

function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

function str2binb(str)
{
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
  return bin;
}

function binb2str(bin)
{
  var str = "";
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
  return str;
}

function binb2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
  }
  return str;
}

function hex2bin(hex_str)
{
	var char_str = "";
	var num_str = "";
	var i;
	for(i=0; i < hex_str.length; i+=2) {
		char_str += String.fromCharCode(parseInt(hex_str.substring(i, i+2), 16));
	}
	return char_str;
}


function binb2b64(binarray)
{
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
  }
  return str;
}

var chrsz   = 8;

var hexcase = 0;

function safe_add (x, y) {
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

function S (X, n) {return ( X >>> n ) | (X << (32 - n));}

function R (X, n) {return ( X >>> n );}

function Ch(x, y, z) {return ((x & y) ^ ((~x) & z));}

function Maj(x, y, z) {return ((x & y) ^ (x & z) ^ (y & z));}

function Sigma0256(x) {return (S(x, 2) ^ S(x, 13) ^ S(x, 22));}

function Sigma1256(x) {return (S(x, 6) ^ S(x, 11) ^ S(x, 25));}

function Gamma0256(x) {return (S(x, 7) ^ S(x, 18) ^ R(x, 3));}

function Gamma1256(x) {return (S(x, 17) ^ S(x, 19) ^ R(x, 10));}

function Sigma0512(x) {return (S(x, 28) ^ S(x, 34) ^ S(x, 39));}

function Sigma1512(x) {return (S(x, 14) ^ S(x, 18) ^ S(x, 41));}

function Gamma0512(x) {return (S(x, 1) ^ S(x, 8) ^ R(x, 7));}

function Gamma1512(x) {return (S(x, 19) ^ S(x, 61) ^ R(x, 6));}

function core_sha256 (m, l) {
    var K = new Array(0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0xFC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x6CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2);
    var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
    var W = new Array(64);
    var a, b, c, d, e, f, g, h, i, j;
    var T1, T2;

    m[l >> 5] |= 0x80 << (24 - l % 32);
    m[((l + 64 >> 9) << 4) + 15] = l;

    for ( var i = 0; i<m.length; i+=16 ) {
        a = HASH[0];
        b = HASH[1];
        c = HASH[2];
        d = HASH[3];
        e = HASH[4];
        f = HASH[5];
        g = HASH[6];
        h = HASH[7];

        for ( var j = 0; j<64; j++) {
            if (j < 16) W[j] = m[j + i];
            else W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);

            T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
            T2 = safe_add(Sigma0256(a), Maj(a, b, c));

            h = g;
            g = f;
            f = e;
            e = safe_add(d, T1);
            d = c;
            c = b;
            b = a;
            a = safe_add(T1, T2);
        }

        HASH[0] = safe_add(a, HASH[0]);
        HASH[1] = safe_add(b, HASH[1]);
        HASH[2] = safe_add(c, HASH[2]);
        HASH[3] = safe_add(d, HASH[3]);
        HASH[4] = safe_add(e, HASH[4]);
        HASH[5] = safe_add(f, HASH[5]);
        HASH[6] = safe_add(g, HASH[6]);
        HASH[7] = safe_add(h, HASH[7]);
    }
    return HASH;
}

function core_sha512 (m, l) {
    var K = new Array(0x428a2f98d728ae22, 0x7137449123ef65cd, 0xb5c0fbcfec4d3b2f, 0xe9b5dba58189dbbc, 0x3956c25bf348b538, 0x59f111f1b605d019, 0x923f82a4af194f9b, 0xab1c5ed5da6d8118, 0xd807aa98a3030242, 0x12835b0145706fbe, 0x243185be4ee4b28c, 0x550c7dc3d5ffb4e2, 0x72be5d74f27b896f, 0x80deb1fe3b1696b1, 0x9bdc06a725c71235, 0xc19bf174cf692694, 0xe49b69c19ef14ad2, 0xefbe4786384f25e3, 0x0fc19dc68b8cd5b5, 0x240ca1cc77ac9c65, 0x2de92c6f592b0275, 0x4a7484aa6ea6e483, 0x5cb0a9dcbd41fbd4, 0x76f988da831153b5, 0x983e5152ee66dfab, 0xa831c66d2db43210, 0xb00327c898fb213f, 0xbf597fc7beef0ee4, 0xc6e00bf33da88fc2, 0xd5a79147930aa725, 0x06ca6351e003826f, 0x142929670a0e6e70, 0x27b70a8546d22ffc, 0x2e1b21385c26c926, 0x4d2c6dfc5ac42aed, 0x53380d139d95b3df, 0x650a73548baf63de, 0x766a0abb3c77b2a8, 0x81c2c92e47edaee6, 0x92722c851482353b, 0xa2bfe8a14cf10364, 0xa81a664bbc423001, 0xc24b8b70d0f89791, 0xc76c51a30654be30, 0xd192e819d6ef5218, 0xd69906245565a910, 0xf40e35855771202a, 0x106aa07032bbd1b8, 0x19a4c116b8d2d0c8, 0x1e376c085141ab53, 0x2748774cdf8eeb99, 0x34b0bcb5e19b48a8, 0x391c0cb3c5c95a63, 0x4ed8aa4ae3418acb, 0x5b9cca4f7763e373, 0x682e6ff3d6b2b8a3, 0x748f82ee5defb2fc, 0x78a5636f43172f60, 0x84c87814a1f0ab72, 0x8cc702081a6439ec, 0x90befffa23631e28, 0xa4506cebde82bde9, 0xbef9a3f7b2c67915, 0xc67178f2e372532b, 0xca273eceea26619c, 0xd186b8c721c0c207, 0xeada7dd6cde0eb1e, 0xf57d4f7fee6ed178, 0x06f067aa72176fba, 0x0a637dc5a2c898a6, 0x113f9804bef90dae, 0x1b710b35131c471b, 0x28db77f523047d84, 0x32caab7b40c72493, 0x3c9ebe0a15c9bebc, 0x431d67c49c100d4c, 0x4cc5d4becb3e42b6, 0x597f299cfc657e2a, 0x5fcb6fab3ad6faec, 0x6c44198c4a475817);
    var HASH = new Array(0x6a09e667f3bcc908, 0xbb67ae8584caa73b, 0x3c6ef372fe94f82b, 0xa54ff53a5f1d36f1, 0x510e527fade682d1, 0x9b05688c2b3e6c1f, 0x1f83d9abfb41bd6b, 0x5be0cd19137e2179);
    var W = new Array(80);
    var a, b, c, d, e, f, g, h, i, j;
    var T1, T2;

}

function str2binb (str) {
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - i%32);
  return bin;
}

function binb2str (bin) {
  var str = "";
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i>>5] >>> (24 - i%32)) & mask);
  return str;
}

function binb2hex (binarray) {
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
  }
  return str;
}

function binb2b64 (binarray) {
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
  }
  return str;
}

function hex_sha256(s){return binb2hex(core_sha256(str2binb(s),s.length * chrsz));}
function b64_sha256(s){return binb2b64(core_sha256(str2binb(s),s.length * chrsz));}
function str_sha256(s){return binb2str(core_sha256(str2binb(s),s.length * chrsz));}
var selectedSection = "webforms";
var selectedEntry = null;
var selectedFolder = "";
var total_items = 0;
var current_sort_criteria = "Name";
var current_sort_ascending = true;
var entries = [];
var currentEntry = null;
var concealedFieldCount = 0;

function profileContentsDidFinishLoading(json) {
	if (!json || json == "") {
		alert("Could not find contents.js. Please try again.");
	}

	var allItems = eval(json);
	keychain.setContents(allItems);

	renderSectionList();
	selectSection(TYPE_WEBFORMS)
}

function renderSectionList() {
	var h = "";
	h += renderSectionListItem(TYPE_WEBFORMS, "Logins", "logins-20.png");
	h += renderSectionListItem(TYPE_IDENTITIES, "Identities", "identities-20.png");
	h += renderSectionListItem(TYPE_NOTES, "Secure Notes", "secure-notes-20.png");
	h += renderSectionListItem(TYPE_SOFTWARE_LICENSES, "Software", "software-20.png");
	h += renderSectionListItem(TYPE_WALLET, "Wallet", "wallet-20.png");
	h += renderSectionListItem(TYPE_PASSWORDS, "Passwords", "passwords-20.png");
	h += renderSectionListItem(TYPE_TRASHED, "Trash", "trash-20.png");
	$('sourcesPane').innerHTML = h;
}

function renderSectionListItem(name, displayName, img) {
	var r = "<li " + sectionOptions(name) + ">";
	r += "<img  src='./style/images/" + img + "' alt='' />" + displayName;
	r += sectionCount(name, displayName);
	r += "</li>";
	return r;
}

function sectionOptions(name) {
	var opts = "id='" + name + "' onclick='selectSection(\"" + name + "\")'"

	if (selectedSection == name) {
		opts += " class='selected' "
	}
	return opts;
}

function sectionCount(name, display_name) {
	var result = " <span class='sectionCount'>(" + keychain.itemsOfType(name).length + ")</span>";
	return result;
}

function selectFolder(el) {
	$('sections').setAttribute('class', 'inactivePane');
	$('folders').setAttribute('class', '');
	var oldSelectedSection = selectedSection;
	selectedSection = "";
	styleSection(oldSelectedSection);

	if (selectedFolder != "") $(selectedFolder).setAttribute("class", "");
	el.parentNode.setAttribute("class", "selectedFolder");
	selectedFolder = el.parentNode.id;

	loadSection(selectedFolder);
}

function toggleSubfolder(el) {
	var id = el.parentNode.id.substring(7);

	if ($('subfolder-'+id).style.display == '') {
		$('subfolder-'+id).style.display = 'none';
		el.setAttribute('class', 'folderArrowClosed');
	}
	else {
		$('subfolder-'+id).style.display = '';
		el.setAttribute('class', 'folderArrowOpen');
	}
}

function showAndHideConcealedField(id, clearText, concealed) {
	var revealHide = concealed ? "Reveal" : "Hide";

	var htmlValue = clearText.escapeHTML();
	var jsValue = htmlValue.gsub(/\\/, "\\\\");


	var r = "<span class='hideRevealButton' id='" + id + "'><a class='copy'>";
	r += concealed ? concealedField(clearText) : htmlValue;
	r += "<a class='revealButton' href='#' style='text-decoration:none' onclick='showAndHideConcealedField(\"" + id + "\", \"" + jsValue + "\", " + !concealed + ")'>" + revealHide + "</a>";
	r += "</a></span>"

	if ($(id)) $(id).innerHTML = r;

	return r;
}

function concealedField(clearText) {
	var r = "";
	for (var i=0; i < 10; i++) {
		r += "&bull;";
	}
	return r;
}

function showPassword(data)
{
	if (data.notesPlain && data.notesPlain.length > 0) {
		$('entryNotesDecryptedValue').innerHTML = '<p>' + convertNewLines(data.notesPlain.escapeHTML()) + '</p>';
		$('entryNotesDecryptedValue').parentNode.style.display = "";
	}

	var passwd = "<tr><td class='fieldName'>Password</td><td class='fieldValue'>" + data.password.escapeHTML() + "</td></tr>";
	$('dynamicFields').innerHTML = passwd;
}

function convertNewLines(txt) {
	return txt.gsub("\n\r", "\n").gsub("\r\n", "\n").gsub("\r", "\n").gsub("\n", "<br/>");
}

function sortBy(criteria) {
	keychain.rescheduleAutoLogout();
	if (criteria == current_sort_criteria) {
		current_sort_ascending = !current_sort_ascending;
	}
	else {
		current_sort_criteria = criteria;
	}

	displayEntries();
}

function updateEntryListHeader(name) {
	var header = $('listHeader' + name);
	var sort_img = header.childNodes[0].childNodes[0];

	if (name == current_sort_criteria) {
		header.setAttribute("class", "selectedHeader");
		sort_img.style.display = "";
		var img = "./style/images/interface/table_arrow_";
		if (current_sort_ascending) img += "down.png"
		else img += "up.png";

		sort_img.src = img;
	}
	else {
		header.setAttribute("class", "normalHeader");
		sort_img.style.display = "none";
	}
}

function updateEntryListHeaders() {
	updateEntryListHeader("Name");
	updateEntryListHeader("Domain");
	updateEntryListHeader("Modified");
}

function sortCompareFunction(a, b) {
	if (current_sort_criteria == "Domain") {
		a = a.domain;
		b = b.domain;
	}
	else if (current_sort_criteria == "Modified") {
		a = a.updatedAtMs + "";
		b = b.updatedAtMs + "";
	}
	else {
		a = a.title;
		b = b.title;
	}

	var result = 0;
    if ( a.toLowerCase() < b.toLowerCase() ) {
		result = -1;
    }
    else if ( a.toLowerCase() > b.toLowerCase() ) {
		result = 1;
    }

	if (!current_sort_ascending) result = result * -1;

	return result;
}

function styleSectionCount(id)
{
	var current_count = $(id + "-count");
	if (!current_count) return;

	var color = "gray";
	var clazz = "itemNumberTotal";

	if (id == selectedSection) {
		color = "white"
		clazz = "itemNumberTotalSelected"
    }

	var children = current_count.childNodes;
	children[1].src = "/images/sections/item_number_right_" + color + ".png";
	children[3].setAttribute("class", clazz);
	children[5].src = "/images/sections/item_number_left_" + color + ".png";
}

function styleSection(id) {
	if (id == "" || id.indexOf("folder") == 0) return;

	if (id == selectedSection) {
		$(id).className = "selectedSection";
		$(id).childNodes[1].className = "sectionLinkSelected";
	}
	else {
		$(id).className = "";
		$(id).childNodes[1].className = "sectionLink";
	}
	styleSectionCount(id);
}

function selectSection(section_id)
{
	if (selectedFolder != "") $(selectedFolder).setAttribute('class', '');

	keychain.rescheduleAutoLogout();

	if (selectedSection != section_id)
	{
		selectedSection = section_id;
		renderSectionList();
		displayEntries({'select_first':true});
	}
}

function selectEntry(entry_id)
{
	keychain.rescheduleAutoLogout();
	selectedEntryId = entry_id;

	var highlighted = $$('#listPane .selected');
	for (var i=0; i < highlighted.length; i++) {
		highlighted[i].removeClassName('selected');
	}

	$('entry_' + entry_id).addClassName('selected');
	var file = fullKeychainFilePath(entry_id + ".1password");
	loadFile(file, entryDidFinishLoading);
}

function entryDidFinishLoading(json) {
	if (!json || json == "") {
		alert("The data file for this entry could not be loaded.")
		return;
	}

	var entry;
	try {
		var json = "(" + json + ")";
		entry = eval(json);
	}
	catch (e) {alert('Error evaluating data for this entry! Error: ' + e);}

	selectedEntry = new KeychainItem(entry);
	showEntryDetails();
}

function displayEntries(opts)
{
	var select_first = false;
	if (opts) {
		select_first = opts['select_first']
	}

	var entries = keychain.itemsOfType(selectedSection);
	keychain.rescheduleAutoLogout();

	entries.sort(sortCompareFunction);
	var i, len = entries.length;
	var displayCount = 0;
	var html = ""
	for (i = 0; i < len; ++i) {
		e = entries[i];

		displayCount++;
		var title = e.title;
		var domain = e.domain;
		var date = e.updatedAt;
		var uuid = e.uuid;
		var clazz = "";

		html += '<li id="entry_' + uuid + '" onclick="selectEntry(\''+uuid+'\')"><strong>'+title.escapeHTML()+'</strong><br/>'+domain+'</li>';
	}
	$('listPane').innerHTML = html;

	if (select_first) selectEntry(entries[0].uuid);
}

function showEntryDetails() {
	keychain.rescheduleAutoLogout();
	$('emptyDetailsPane').style.display = "none";
	$('detailsPane').style.display = "";

	concealedFieldCount = 0;

	var decryption_status;
	try { decryption_status = selectedEntry.decrypt() }
	catch (e) {alert("error " + e);}

	if (decryption_status != ERROR_OK) {
		alert("An error occurred while processing item '" + selectedEntry.uuid + "'.\n\n" + decryption_status );
		return;
	}

	$('detailsPane').innerHTML = "";
	$('detailsPane').innerHTML = selectedEntry.asHTML();
}

function searchEntries()
{
	keychain.rescheduleAutoLogout();
	var s = $("search").value.toLowerCase();
	entries = [];

	if (s.length > 0) {
		$('clearSearch').style.display = "";
	}
	else {
		$('clearSearch').style.display = "none";
	}

	var i, len = allEntries.length - 1;
	for (i=0; i<len; ++i) {
		var e = allEntries[i];

		if (e[1].toLowerCase().indexOf(s) >= 0 || e[2].toLowerCase().indexOf(s) >= 0)
			entries.push(e);
	}

	displayEntries();

	if (selectedEntryId) {
		if ($("entry_" + selectedEntryId)) {
			$("entry_" + selectedEntryId).setAttribute("class", "selectedRow");
		}
		else {
			selectedEntryId = null;
		}
	}
}

function clearSearch() {
	$("search").value = "";
	$("search").focus();
	searchEntries();
}

function onClientLoad()
{
	$('loadingHUD').style.display = "";
	loadSection(selectedSection);
	updateLockStatus();
	keychain.rescheduleAutoLogout();
	$("search").value = ""; // Sometimes reload does not clear the search criteria

	document.onkeydown = handleHotkeys;

	if (selectedSection.indexOf('folder-') == 0) {
		selectedFolder = selectedSection;
		selectFolder($(selectedFolder).childNodes[0]);
	}
	else {
		selectSection(selectedSection);
	}
}

function handleHotkeys(e)
{
	if (!e) e = window.event;
	var key = String.fromCharCode(e['keyCode']);

	if (e['ctrlKey']) {
		if (key == 'F') {
			$("search").focus();
		}
	}
}

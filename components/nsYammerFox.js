const CLASS_ID = Components.ID("8d09b431-8d73-4683-a570-8374f7b795dc");
const CLASS_NAME = "Yammer Fox";
const CONTRACT_ID = "@yammer.inc/yammerfox;1";
const NETWORK_TIMEOUT_TIME = 120;
const MAX_STORED_MESSAGES = 40;

//const BASE_URL = "http://localhost:3000/";
//const BASE_URL = "http://aa.com:3000/";
//const BASE_URL = "https://staging.yammer.com/";
const BASE_URL = "https://www.yammer.com/";
const API_URL  = BASE_URL+"api/v1/";
const APP_NAME = "YammerFox";
const YAMMERFOXV = "1.0.3";

const STATE_ACTIVE  = 0;
const STATE_IDLE    = 1;
const STATE_SUSPEND = 2;

const APPEND_TIMELINE = 0;
const APPEND_MESSAGES = 1;
const APPEND_IGNORE   = 2;

function HttpRequest() {
  this.responseText = "";
  this.status = 0;

  var observer = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
  observer.addObserver(this, "http-on-modify-request", false);
  observer.addObserver(this, "http-on-examine-response", false);
}

HttpRequest.prototype = {

  httpChannel: function() {
    return this.channel.QueryInterface(Components.interfaces.nsIHttpChannel);
  },

  setURI: function(url) {
    this.__url = url;
    var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var URI = ioService.newURI(url, null, null);

    this.channel = ioService.newChannelFromURI(URI);
  },

  setRedirectLimitation: function(num) {
    this.httpChannel().redirectionLimit = num;
  },

  asyncOpen: function() {
    this.channel.notificationCallbacks = this;
    this.channel.asyncOpen(this, null);
  },

  setPostData: function(data) {
    var upStream = Components.classes["@mozilla.org/io/string-input-stream;1"].createInstance(Components.interfaces.nsIStringInputStream);
    upStream.setData(data, data.length);
    var upChannel = this.channel.QueryInterface(Components.interfaces.nsIUploadChannel);
    upChannel.setUploadStream(upStream, "application/x-www-form-urlencoded", -1);

    this.httpChannel().requestMethod = "POST";
  },

  setRequestHeader: function(header, param) {
    this.httpChannel().setRequestHeader(header, param, true);
  },

  getResponseHeader: function(header) {
    this.httpChannel().getResponseHeader(header);
  },

  setAuthHeader: function(user, pass) {
    this.user = user;
    this.pass = pass;
  },

  abort: function() {
    if (this.timer) {
      this.timer.cancel();
    }
    this.channel.cancel(Components.results.NS_BINDING_ABORTED);
    this.cannnel = null;
  },

  onStartRequest: function(request, context) {
    this.responseText = "";
    try {
      this.status = this.httpChannel().responseStatus;
      this.date   = this.httpChannel().getResponseHeader("Date");
    }
    catch (e) {}
  },

  onDataAvailable: function(request, context, stream, offset, length) {
    var scriptableInputStream = 
      Components.classes["@mozilla.org/scriptableinputstream;1"]
        .createInstance(Components.interfaces.nsIScriptableInputStream);
    scriptableInputStream.init(stream);

    this.responseText += scriptableInputStream.read(length);
  },
  
  onStopRequest: function(request, context, status) {
    if (Components.isSuccessCode(status)) {
      if (this.onload) this.onload(this);
    }
    else if (status != Components.results.NS_BINDING_ABORTED) {
      if (this.onerror) this.onerror(this);
    }
    var observer = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    observer.removeObserver(this, "http-on-modify-request");
    observer.removeObserver(this, "http-on-examine-response");
  },

  onChannelRedirect: function(oldChannel, newChannel, flags) {
    if (this._onredirect) {
      this._onredirect(oldChannel, newChannel, flags);
    }
    else {
      this.channel = newChannel;
    }
  },

  observe: function(subject, topic, data) {
    if (subject == this.channel) {
      if (topic == "http-on-modify-request") {
        this.httpChannel().setRequestHeader("User-Agent", this.httpChannel().getRequestHeader("User-Agent") + " YammerFox/" + YAMMERFOXV, false);
      }
    }
  },  

  // nsIInterfaceRequestor
  getInterface: function(aIID) {
    try {
      return this.QueryInterface(aIID);
    }
    catch (e) {
      throw Components.results.NS_NOINTERFACE;
    }
  },

  // nsIProgressEventSink (to shut up annoying debug exceptions
  onProgress: function(request, context, progress, progressmax) {},
  onStatus: function(request, context, status, statusArg) {},
  
  // nsIHttpEventSink (to shut up annoying debug exceptions
  onRedirect: function(oldChannel, newChannel) {},

  // nsIAuthPromptProvider (to shut up annoying debug exceptions
  getAuthPrompt: function(reason) {},

  QueryInterface: function(aIID) {
    if (aIID.equals(Components.interfaces.nsISupports) ||
        aIID.equals(Components.interfaces.nsIObserver) ||
        aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
        aIID.equals(Components.interfaces.nsIWebProgress) ||
        aIID.equals(Components.interfaces.nsIDocShell) ||
        aIID.equals(Components.interfaces.nsIDocShellTreeItem) ||
        aIID.equals(Components.interfaces.nsIPrompt) ||
        aIID.equals(Components.interfaces.nsIAuthPrompt) ||
        aIID.equals(Components.interfaces.nsIAuthPromptProvider) ||
        aIID.equals(Components.interfaces.nsIInterfaceRequestor) ||
        aIID.equals(Components.interfaces.nsIChannelEventSink) ||
        aIID.equals(Components.interfaces.nsIProgressEventSink) ||
        aIID.equals(Components.interfaces.nsIHttpEventSink) ||
        aIID.equals(Components.interfaces.nsIStreamListener))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};

/////////////////////////////////////////////////////////////////////////
//
// Session manager.
//
function Session() {
  this._lastAccess = {};
  this._console = null;
}

Session.prototype = {
  setDelayTask: function(delay, func, data, type) {
    var timer = Components.classes["@mozilla.org/timer;1"] 
      .createInstance(Components.interfaces.nsITimer); 

    var target = this;

    if (type == null) {
      type = Components.interfaces.nsITimer.TYPE_ONE_SHOT;
    }

    timer.initWithCallback({
      notify: function() {
          target[func](data);
        }
      },
      delay,
      type);
    return timer;
  },

  createRequest: function(func, param, isPost) {
    var ns = func.split(".");
    var requestURL = "";
    var requestParam = "";

    var request = new HttpRequest;

    if (ns.length > 1) {
      request.callback = ns[0] + "_" + ns[1];
      requestURL       = ns.join("/");
    }
    else {
      request.callback = func;
      requestURL       = func;
    }

    if (!param) param = {};

    for (var attr in param) {
      if (requestParam) requestParam += "&";
      requestParam += attr + "=" + encodeURIComponent(param[attr]);
    }

    if (isPost) {
      requestURL = API_URL + requestURL;
      request.setURI(requestURL);
    }
    else {
      requestURL = API_URL + requestURL + ".json";
      request.setURI(requestURL + '?' + requestParam);
    }

    var target = this;
    request.onload  = function(p) { target._onload(p)  };
    request.onerror = function(p) { target._onerror(p) };

    if (isPost) {
      request.setPostData(requestParam);
    }
    else if (this._lastAccess[request.callback]) {
      request.setRequestHeader("If-Modified-Since", this._lastAccess[request.callback]);
    }

    this.log(requestURL + ":" + this._lastAccess[request.callback]);

    request.timer = this.setDelayTask(NETWORK_TIMEOUT_TIME * 1000, "_ontimeout", request);

    var pref = Components.classes['@mozilla.org/preferences-service;1']
      .getService(Components.interfaces.nsIPrefBranch);

    request.asyncOpen();
    return request;
  },

  post: function(func, params) {
    this.createRequest(func, params, true);
  },

  get: function(func, params) {
    this._req = this.createRequest(func, params, false);
  },

  notifyStatus: function(sts, obj) {

    var msg = {"state": sts, "data": obj};

    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
    .notifyObservers(null, "yammerfox-status", msg.toSource());
  },

  _onload: function(req) {
    if (req.timer) {
      req.timer.cancel();
    }

    this.log(req.__url + ": " + req.status);

    this.onLoad(req);
  },

  _onerror: function(req) {
    this.reportError("Request error occurred in " + req.callback + ": " + req.status);
    if (req.timer) {
      req.timer.cancel();
    }

    if (this[req.callback + "_error"]) {
      this[req.callback + "_error"](req);
    }
    else {
      this.onError(req);
    }

  },

  _ontimeout: function(req) {
    this.reportError("Request timeout occurred in " + req.__url);
    req.abort();

    if (this[req.callback + "_timeout"]) {
      this[req.callback + "_timeout"](req);
    }
    else {
      this.onTimeout(req);
    }

  },

  onLoad:    function(req) {},
  onError:   function(req) {},
  onTimeout: function(req) {},

  reportError: function(msg) {
    var pref = Components.classes['@mozilla.org/preferences-service;1']
      .getService(Components.interfaces.nsIPrefBranch);

    if (pref.getBoolPref("extensions.yammerfox.debug")) {
      Components.utils.reportError(msg);
    }
    this.log(msg);
  },

  log: function(msg) {
    var pref = Components.classes['@mozilla.org/preferences-service;1']
      .getService(Components.interfaces.nsIPrefBranch);

    if (pref.getBoolPref("extensions.yammerfox.debug")) {
      if (this._console == null) 
        this._console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
      this._console.logStringMessage(msg);
      dump(msg + "\n");
    }
  }
};

/////////////////////////////////////////////////////////////////////////
//
// YammerFox main component.
//
function YammerFox() {
  var obs = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

  obs.addObserver(this, "xpcom-shutdown", false);
  obs.addObserver(this, "yammerfox-command", false);

  /*
   * Disable this feature
   *
  try {
    var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
      .getService(Components.interfaces.nsIIdleService);
    idleService.addIdleObserver(this, 15 * 60); // Now it's fixed. 15 minutes.
  }
  catch (e) {}
  */

  // Setup sound notification
  this._sound = Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound);

}

// This is the implementation of your component.
var yammerfox_prototypes = {
  _timer: null,
  _accounts: [],
  _sessions: [],
  _newMessages: [],
  _allMessages: {},
  _idle: STATE_ACTIVE,
  _getDirectMessage: true,

  // for nsISupports
  QueryInterface: function(aIID) {
    // add any other interfaces you support here
    if (!aIID.equals(Components.interfaces.nsISupports) && 
        !aIID.equals(Components.interfaces.nsIObserver) &&
        !aIID.equals(Components.interfaces.nsIYammerFox))
        throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  },

  // for nsIObserver
  //
  observe: function(subject, topic, data) { 
    switch (topic) {

    case "yammerfox-command":
      this.handleCommand(data);
      break;

    case "xpcom-shutdown":
      this.destroy();
      break;

    case "idle":
      this._idle = STATE_IDLE;
      break;

    case "back":
      if (this._idle == STATE_SUSPEND) {
        this._idle = STATE_ACTIVE;
        this.updateYams();
      }
      this._idle = STATE_ACTIVE;
      break;

    }
  },

  handleCommand: function(data) {
    var msg = eval('(' + data + ')');
    this[msg.command](msg);
  },

  //
  // commands
  //
  initSession: function() {
    if (this._timer) {
      this._timer.cancel();
    }

    this._user = 'default';
    
    this.updatePref();
    this.updateYams();
  },

  updatePref: function() {
    var pref = Components.classes['@mozilla.org/preferences-service;1']
      .getService(Components.interfaces.nsIPrefBranch);

    this._interval = pref.getIntPref("extensions.yammerfox.interval") * 60 * 1000;
    // fail safe
    if (this._interval < 60 * 1000) {
      this._interval = 60 * 1000;
    }

    if (this._rateLimit) {
      this.setInterval();
    }

    var session = pref.getCharPref("extensions.yammerfox.session").split(/;/);
    for (var i in session) {
      var ids = session[i].split(/,/);
      if (ids[0]) {
        this._sessions[ids[0]] = {
          timeline: ids[1] || 0,
          messages: ids[2] || 0,
          replies:  ids[3] || 0,
        };
      }
    }
  },

  setNextTimer: function() {
    this._timer = this.setDelayTask(this._interval, "updateYams", null);
  },
  
  updateYams: function() {
    if (this._user == null) return;

    if (this._timer) {
      this._timer.cancel();
    }

    this._newMessages = [];
    
    if (!this._accounts[this._user]) {
    
      this._accounts[this._user] = {
        timeline: [],
        messages: [],
        replies:  [],
        username: "",
        lastAccess: null,
      };

      if (!this._sessions[this._user]) {
        this._sessions[this._user] = {timeline: 0, messages: 0, replies: 0};
      }

      if (this._user.match(/@/) && 
          !this._accounts[this._user].username) {
        this.get("statuses.user_timeline", {"count": 1});
      }
      else {
        this._accounts[this._user].username = this._user;
        this.getYams();
      }

    }
    else {
      this.getYams();
    }
  },

  getYams: function() {
    if (this._idle == STATE_ACTIVE) {
      if (this._allMessages.__count__ != 0)
        this.get("messages.following", {"newer_than": this._sessions[this._user]['timeline']});
      else
        this.get("messages.following");
    }
    else {
      this._idle = STATE_SUSPEND;
    }
  },

  getReplies: function() {
    this.get("statuses.replies");
  },

  getDirectMessages: function() {
    if (this._getDirectMessage) {
      this.get("direct_messages");
    }
    else {
      this.updateTimeline();
    }
    this._getDirectMessage = !this._getDirectMessage;
  },

  getRecent: function(obj) {
    var type = obj.type;
    if (this._accounts[this._user]) {
      var msg = this.getNumUnread();
      msg['msgs'] = this._accounts[this._user][type];
      msg['type'] = type;
      this.notifyStatus("showPopup", msg);
    }
  },

  getNumUnread: function() {
    if (!this._accounts[this._user]) return 0;

    var result = {};
    var types = ['timeline', 'replies', 'messages'];
    for (var i in types) {
      result[types[i]] = this.countUnread(this._accounts[this._user][types[i]]);
    }
    return result;
  },

  getUnreadCount: function() {
    var ret = this.getNumUnread();
    var unread = 0;
    for (var i in ret) {
      unread += ret[i];
    }
    return unread;
  },
  
  getCookieStatus: function() {
    if (this._no_cookie)
      return 0;
    return 1;
  },
  
  getBaseURL: function() {
    return BASE_URL;
  },

  markRead: function(obj) {
    var type = obj.type;
    for (var i in this._accounts[this._user][type]) {
      this._accounts[this._user][type][i].unread = false;
    }
  },

  markAllRead: function() {
    var types = ['timeline', 'replies', 'messages'];
    for (var i in types) {
      this.markRead({type:types[i]});
    }
  },

  countUnread: function(msgs) {
    var count = 0;
    for (var i in msgs) {
      try {
        if (msgs[i].unread) {
          count++;
        }
      }
      catch (e) {}
    }
    return count;
  },

  sendMessage: function(msg) {
    if (this._no_cookie) {
      this.notifyStatus("sentMessage");
      return;
    }
    
    var params = {body:msg.body, client_type_id:8};
    if (msg.inReplyTo != 0)
      params = {body:msg.body, client_type_id:8, replied_to_id:msg.inReplyTo};
    this.post("messages", params);
  },

  setFavorite: function(msg) {
    this.post("favorites."  + msg.method + "." + msg.id);
  },

  deleteYam: function(obj) {
    if (obj.type == 'timeline' || obj.type == 'replies') {
      this.post("statuses.destroy", {id:obj.id});
    }
    else {
      this.post("direct_messages.destroy", {id:obj.id});
    }
  },

  //
  // Private methods.
  //
  destroy: function(e) {
    if (this._timer) {
      this._timer.cancel();
      this._timer = null;
    }
    if (this._req) {
      this._req.abort();
    }

    var obs = Components.classes["@mozilla.org/observer-service;1"]
      .getService(Components.interfaces.nsIObserverService);

    obs.removeObserver(this, "xpcom-shutdown");
    obs.removeObserver(this, "yammerfox-command");

    try {
      var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
        .getService(Components.interfaces.nsIIdleService);
      idleService.removeIdleObserver(this, 15 * 60); // Now it's fixed. 15 minutes.
    }
    catch (e) {}

 },

  sortById: function(a, b) {
    return b.id - a.id;
  },

  sortByDate: function(a, b) {
    var ta = new Date(a.created_at);
    var tb = new Date(b.created_at);
    return tb - ta;
  },

  retrieveTimeline: function(obj, req, method) {
    var hash = {};

    var stored = this._accounts[this._user][method];
    
    // Avoid duplicate messages.
    for (var i in stored) {
      hash[stored[i].id] = 1;
    }

    // Added 'unread' flag if the message is new in any of stored messages
    for (var i in obj) {
      if (typeof obj[i].id != 'undefined' && !hash[obj[i].id]) {

        if (obj[i].id > this._sessions[this._user][method] && !this._allMessages[obj[i].id]) {
          obj[i].unread = true;
          this._newMessages.push(obj[i]);
        }
        stored.unshift(obj[i]);
      }
      try {
        this._allMessages[obj[i].id] = 1;
      }
      catch (e) {}
    }
    stored.sort(this.sortByDate);

    while (stored.length > MAX_STORED_MESSAGES) {
      if (!stored[stored.length - 1].unread) {
        stored.pop();
      }
      else {
        break;
      }
    }

    if (req.date) {
      this._lastAccess[req.callback] = req.date;
    }
  },

  updateTimeline: function() {
    if (this._newMessages.length) {
      this.playSound();
      this.notifyStatus("updateFriendsTimeline", this._newMessages);
    }
    else {
      if (!this._hasError) {
        this.notifyStatus("noUpdate");
      }
    }
    this._hasError = false;

    this.storeSession();
    this._newMessages = [];
    this.setNextTimer();
  },

  playSound: function() {
    var pref = Components.classes['@mozilla.org/preferences-service;1']
      .getService(Components.interfaces.nsIPrefBranch);

    if (pref.getBoolPref("extensions.yammerfox.sound")) {

      try {
        var IOService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
        this._sound.play(IOService.newURI("chrome://yammerfox/content/yammer_sound.wav", null, null));
      }
      catch (e) {
      }
    }
  },

  storeSession: function() {

    var account = this._accounts[this._user];

    var types = ['timeline', 'replies', 'messages'];
    for (var i in types) {
      if (account[types[i]].length) {
        this._sessions[this._user][types[i]] = account[types[i]][0].id;
      }
    }

    var storage = [];

    for (var i in this._sessions) {
      storage.push([i, 
                    this._sessions[i].timeline,
                    this._sessions[i].messages, 
                    this._sessions[i].replies].join(','));
    }
    var pref = Components.classes['@mozilla.org/preferences-service;1']
      .getService(Components.interfaces.nsIPrefBranch);

    pref.setCharPref("extensions.yammerfox.session", storage.join(';'));
  },

  deleteMessage: function(obj, type) {
    var msgs = this._accounts[this._user][type];
    for (var i = 0; i < msgs.length; ++i) {
      if (msgs[i].id == obj.id) {
        this._accounts[this._user][type].splice(i, 1);
        break;
      }
    }
  },

  // Network handler
  //
  onLoad: function(req) {
    if (this._user == null) {
      this.reportError("No account information");
      return;
    }

    switch (Number(req.status)) {
    case 400:
      this.rateLimitExceeded(req);
      break;

    case 401:
      if (req.callback == "statuses_friends_timeline" ||
          !this.dispatchError(req)) {
        this._accounts[this._user] = null;
        this._user = null;
        this._pass = null;
        this.notifyStatus("authFail");
      }
      break;

    case 406:
      this._no_cookie = true;
      this.setNextTimer();
      break;

    case 403:
    case 404:
    case 500:
    case 502:
    case 503:
      this.handleError(req, "Yammer server responded with an error (" + req.status + ")");
      break;

    case 201:
      this._no_cookie = false;
      this[req.callback](null, req);
      break;
 
    case 200:
    case 304:
    default:
      this._no_cookie = false;
      
      var resp = null;
      if (!req.responseText.match(/^\s*$/)) {
        req.responseText = req.responseText.replace(/Couldn\'t find Status with ID=\d+,/, '');
        try {
          var resp = eval('(' + req.responseText + ')');
        }
        catch (e) {
          this.reportError("An error occurred while requesting " + req.__url);
          this.log("Response text: " + e.message);
          this.handleError(req, "Can't parse JSON. Yammer server responded with an error.");
        }
      }

      if (resp == null || (resp && resp.error)) {
        if (resp && resp.error) {
          this.notifyStatus("internalError", resp.error);
          this.setNextTimer();
        }
        else {
          this.handleError(req, "Yammer server responded with an error");
        }
      }
      else {
        this[req.callback](resp, req);
      }
      break;
    }
  },

  handleError: function(req, msg) {
    if (this[req.callback + "_error"]) {
      this[req.callback + "_error"](req);
    }
    else {
      if (!this.dispatchError(req)) {
        this.notifyStatus("internalError", msg);
        this.setNextTimer();
      }
    }
  },

  dispatchError: function(req) {

    this._hasError = true;

    switch (req.callback) {
    case "direct_messages":
      this.updateTimeline();
      break;
    
    case "statuses_replies":
      this.getDirectMessages();
      break;
    
    case "statuses_friends_timeline":
      this.getReplies();
      break;
    
    default:
      return false;
    }
    return true;
  },

  onError: function(req) {

    this.notifyStatus("internalError", "Network error with " + req.callback);
    if (this.dispatchError(req)) return;

    if (this._timer) {
      this._timer.cancel();
    }
    this.setNextTimer();
  },

  onTimeout: function (req) {
    this.notifyStatus("internalError", "Request timeout with " + req.callback);
    if (this.dispatchError(req)) return;

    if (this._timer) {
      this._timer.cancel();
    }
    this.setNextTimer();
  },

  rateLimitExceeded: function(req) {
    try {
      var resp = eval('(' + req.responseText + ')');
      this.notifyStatus("internalError", resp.error);
    }
    catch (e) {}

    this.get('account.rate_limit_status');
  },

  setInterval: function() {
    var interval = this._rateLimit / 3;
    interval = Math.ceil((60 / interval) * 60 * 1000);
    
    if (this._interval < interval) {
      this._interval = interval;
    }

    // fail safe
    if (this._interval < 180 * 1000) {
      this._interval = 180 * 1000;
    }
  },

  //
  // TwitterAPI callbacks.
  //
  account_rate_limit_status: function(obj, req) {
    this._rateLimit = obj.hourly_limit;
    this.log("Rate limit is " + this._rateLimit + " requests per hour");
    if (this._rateLimit <= 3) {
      this._rateLimit = 3;
    }

    this.setInterval();

    var nextTime = new Date(obj.reset_time) - Date.now();
    if (nextTime < 180 * 1000) {
      nextTime = 180 * 1000;
    }
    else if (nextTime > 3600 * 1000) {
      nextTime = 3600 * 1000;
    }
    this._timer = this.setDelayTask(nextTime, "updateYams", null);

    var msg = "Twitter lower rate limit (less than " + this._rateLimit + 
              " requests per hour), request interval has been changed to " + this._interval / 60 / 1000 + " minutes"; 
    this.notifyStatus("showMessage", msg);
    this.log(msg);
    this.log("Auto rate limit control:" + obj.remaining_hits + "/" + obj.hourly_limit + 
             ", reset time: " + obj.reset_time + "(" + Math.ceil(nextTime / 1000 / 60) + " minutes)");
  },

  direct_messages: function(obj, req) {
    this.retrieveTimeline(obj, req, "messages");

    try {
      this._accounts[this._user].usericon = obj[0].recipient.profile_image_url;
      this.notifyStatus("setUserIcon", obj[0].recipient.profile_image_url);
    }
    catch (e) {}
    

    this.updateTimeline();
  },

  statuses_replies: function(obj, req) {
    this.retrieveTimeline(obj, req, "replies");
    this.getDirectMessages();
  },

  setRefs: function(references) {
    this._user_refs = {}
    this._group_refs = {}
    this._message_refs = {}
    this._thread_refs = {}
    this._guide_refs = {}
    for (i in references) {
      if (references[i].type == 'user')
        this._user_refs[references[i].id] = references[i];
      else if (references[i].type == 'group')
        this._group_refs[references[i].id] = references[i];
      else if (references[i].type == 'message')
        this._message_refs[references[i].id] = references[i];
      else if (references[i].type == 'thread')
        this._thread_refs[references[i].id] = references[i];
      else if (references[i].type == 'guide')
        this._guide_refs[references[i].id] = references[i];
    }
  },
  
  guide_or_user_info: function(type, id) {
    if (type == 'guide')
      return this._guide_refs[id];
    if (type == 'user')
      return this._user_refs[id];
  },
  
  messages_following: function(obj, req) {  
    this.setRefs(obj.references);
    
    for (i in obj.messages) {
      try {
        var guide_or_user = this.guide_or_user_info(obj.messages[i].sender_type, obj.messages[i].sender_id);
        obj.messages[i].full_name = guide_or_user.full_name;
        obj.messages[i].name = guide_or_user.name;
        obj.messages[i].mugshot_url = guide_or_user.mugshot_url;
  
        if (obj.messages[i].replied_to_id) {
          guide_or_user = this.guide_or_user_info(this._message_refs[obj.messages[i].replied_to_id].sender_type, this._message_refs[obj.messages[i].replied_to_id].sender_id);
          obj.messages[i].reply_name = guide_or_user.name;
          var trimed_text = this._message_refs[obj.messages[i].replied_to_id].body.plain;
          if (trimed_text.length > 160)
            trimed_text = trimed_text.substr(0, 160) + "...";
   
          obj.messages[i].reply_txt = trimed_text;
          obj.messages[i].thread_url = this._thread_refs[obj.messages[i].thread_id].web_url;
        }
        if (obj.messages[i].group_id)
          obj.messages[i].group_name = this._group_refs[obj.messages[i].group_id].name;
      } catch (e) { }
    }
    
    this.retrieveTimeline(obj.messages, req, "timeline");
    this.updateTimeline();
  },

  statuses_user_timeline: function(obj) {
    try {
      this._accounts[this._user].username = obj[0].user.screen_name;
      this.notifyStatus("updateUsername", obj[0].user.screen_name);
      this.updateYams();
    }
    catch (e) {
      this.setNextTimer();
    }
  },

  statuses_destroy: function(obj) {
    this.notifyStatus("messageDeleted", {id:obj.id});
    this.deleteMessage(obj, 'timeline');
    this.deleteMessage(obj, 'replies');
  },

  favorites_destroy: function(obj) {
    this.toggleFavorite(obj.id, null);
    this.notifyStatus("updateFavorite", {id: obj.id, state:null});
  },

  favorites_create: function(obj) {
    this.toggleFavorite(obj.id, true);
    this.notifyStatus("updateFavorite", {id: obj.id, state:true});
  },

  toggleFavorite: function(id, flag) {
    var types = ['timeline', 'replies'];
    for (var i in types) {
      var msgs = this._accounts[this._user][types[i]];
      for (var j in msgs) {
        if (msgs[j].id == id) {
          msgs[j].favorited = flag;
          break;
        }
      }
    }
  },

  messages: function(obj, req) {
    this.notifyStatus("sentMessage");
  },

  statuses_update_error: function(req) {
    this.reportError("Send error occurred: " + req.status);
    this.log(req.responseText);
    this.notifyStatus("errorOnSendMessage");
  },

  statuses_update_timeout: function() {
    this.reportError("Send timeout occurred");
    this.notifyStatus("errorOnSendMessage");
  },

  direct_messages_new: function(obj, req) {
    if (obj.id) {
      this.notifyStatus("sentMessage", obj);
    }
    else {
      this.notifyStatus("errorOnSendMessage");
    }
  },

  direct_messages_destroy: function(obj) {
    this.notifyStatus("messageDeleted", {id:obj.id});
    this.deleteMessage(obj, 'messages');
  },

  direct_messages_new_error: function(req) {
    this.reportError("Send error occurred: " + req.status);
    this.log(req.responseText);
    this.notifyStatus("errorOnSendMessage");
  },

  direct_messages_new_timeout: function() {
    this.reportError("Send timeout occurred");
    this.notifyStatus("errorOnSendMessage");
  },
}

YammerFox.prototype = new Session;

for (var i in yammerfox_prototypes) {
  YammerFox.prototype[i] = yammerfox_prototypes[i];
}

//=================================================
// Note: You probably don't want to edit anything
// below this unless you know what you're doing.
//
// Singleton
var gYammerFox = null;

// Factory
var YammerFoxFactory = {
  createInstance: function (aOuter, aIID)
  {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    if (gYammerFox === null) {
      gYammerFox = new YammerFox().QueryInterface(aIID);
    }
    return gYammerFox;
  }
};

// Module
var YammerFoxModule = {
  registerSelf: function(aCompMgr, aFileSpec, aLocation, aType) {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(CLASS_ID, CLASS_NAME, CONTRACT_ID, aFileSpec, aLocation, aType);

    Components.classes["@mozilla.org/categorymanager;1"]
      .getService(Components.interfaces.nsICategoryManager)
        .addCategoryEntry("app-startup", 
                          CLASS_NAME,
                          "service," + CONTRACT_ID,
                          true, true);
  },

  unregisterSelf: function(aCompMgr, aLocation, aType)
  {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(CLASS_ID, aLocation);        

    Components.classes["@mozilla.org/categorymanager;1"]
      .getService(Components.interfaces.nsICategoryManager)
        .deleteCategoryEntry("app-startup", 
                             CLASS_NAME,
                             true);
  },
  
  getClassObject: function(aCompMgr, aCID, aIID)  {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (aCID.equals(CLASS_ID))
      return YammerFoxFactory;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function(aCompMgr) { return true; }
};

//module initialization
function NSGetModule(aCompMgr, aFileSpec) { return YammerFoxModule; }

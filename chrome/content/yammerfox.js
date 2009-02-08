
var YammerFoxPopupPrototypes = {
 init: function(FFversion3) {

    this.isFF3 = FFversion3;

    if (this.isFF3) {
      var panel = this.parentNode;
      panel.setAttribute("onpopuphidden", "gYammerFox.onPopupHidden(event)");
      var button = document.getElementById("yammerfox-statusbar-button");
      panel.openPopup(button, "before_end", 0, 0, false, false);
      panel.hidePopup();
    }
    else {
      this.style.display = "none";
    }

    this.isOpen = false;
  },

  openPopup: function() {
    this.show();
    if (this.isFF3) {
      var panel = this.parentNode;
      var button = document.getElementById("yammerfox-statusbar-button");
      panel.openPopup(button, "before_end", 0, 0, false, false);
    }
    this.isOpen = true;
  },

  hidePopup: function() {
    this.hide();
    if (this.isFF3) {
      this.parentNode.hidePopup();
    }
    this.isOpen = false;
  }
};

function YammerFox() {
  this._prefWindow = null;
  this._showBalloon = true;
  this._timer = null;
  this._messageQueue = new Array();
  this._util = new yammerFoxExUtils("yammerfox");
  this._onFocus = false;
  this._needToUpdate = false;
  this._inReplyTo = 0;
}

YammerFox.prototype = {

  $: function(name) {
    return document.getElementById(name);
  },

  load: function() {
    
    // Don't init YammerFox when the window is popup.
    if (window.toolbar.visible == false) {
      var btn = this.$("yammerfox-statusbar-button");;
      var parent = btn.parentNode;
      parent.removeChild(btn);
      return;
    }

    this._strings = this.$("yammerfox-strings");

    var target = this;

    if (gBrowser.mPanelContainer) {
      var container = gBrowser.mPanelContainer;
      container.addEventListener("select",
                                 function(e) {target.onTabSelect(e)},
                                 false);
    }

    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
        .addObserver(gYammerFox, "yammerfox-status", false);

    // Setup menuitem
    var menu = this.$("yammerfox-menuitem-togglepopup");
    this._showBalloon = this._util.pref().getBoolPref("popup");
    menu.setAttribute("checked", this._showBalloon);

    // Create panel
    this._panel = this._util.getPanel();

    // Create popup window
    this._popup = document.createElement("vbox");
    this._popup.className = "yammerfox-popup";
    this._popup.style.display = "none";
    this._popup.text = "";
    this._panel.appendChild(this._popup);

    for (var i in YammerFoxPopupPrototypes) {
      this._popup[i] = YammerFoxPopupPrototypes[i];
    }

    this._unescapeHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
                           .getService(Components.interfaces.nsIScriptableUnescapeHTML);

    setTimeout("gYammerFox.delayInit()", 500);
  },

  delayInit: function() {

    this._popup.init(this._util.isFF3());
    this._util.notify("initSession");
  },

  unload: function() {
    if (window.toolbar.visible == false) return;

    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
          .removeObserver(gYammerFox, "yammerfox-status");
  },

  observe: function(subject, topic, data) {
    if (topic != "yammerfox-status") return;

    var msg = eval('(' + data + ')');
    if (this[msg.state]) {
      this[msg.state](msg.data);
    }
  },

  updateFriendsTimeline: function(data) {
    // Update balloon
    this._messageQueue = data.reverse();
    this.updateBalloon();
    this.showMessage();
  },

  updateUsername: function(data) {
    this._username = data.toLowerCase();
    this.showMessage();
  },

  setUserIcon: function(data) {
    this._currentUserIcon = data;
  },

  noUpdate: function(data) {
    this.showMessage();
  },

  accountChanged: function(data) {
    if (this._popup.isOpen) {
      this._util.notify("getRecent", {type:this._popup.activeTab});
    }
  },

  authFail: function(data) {
    if (!this._prefWindow) {
      var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);
      var user = this._util.pref().getCharPref("yammerUser");
      var msg = this._strings.getFormattedString("AuthFail", [user]);
      prompt.alert(window, "YammerFox", msg);
      this.logout();
    }
    else {
      this._prefWindow.focus();
    }
    this.showMessage(msg);
  },

  internalError: function(data) {
    this.showMessage(data);
  },

  //
  // event handlers and observer receivers
  //
  onTabSelect: function(e) {
    if (!this._util.isFF3()) {
      try {

        var elm = this._util.getPanel().parentNode;
        var marker = elm.nextSibling;
        var parent = elm.parentNode;
        parent.insertBefore(elm, marker);

      }
      catch (e) {}

      setTimeout("gYammerFox.onTimeoutTabChange()", 10);
    }
  },

  onTimeoutTabChange: function() {
    this._popup.resetTab();
  },

  onTimeoutBalloon: function() {

    if (this._onFocus) {
      this._needToUpdate = true;
      return;
    }

    this.removeBalloon();
    if (this._messageQueue.length) {
      this.updateBalloon();
    }
    else {
      this.showUnreadCount(0);
    }
  },

  showMessage: function(message) {
    var elem = this.$("yammerfox-status-tooltip");
    if (message) {
      this.setButtonState("error");
      elem.setAttribute("value", message);
    }
    else {
      this.setButtonState("active");
      elem.setAttribute("value", "YammerFox");
    }
  },

  showUnreadCount: function(count) {
    var msg = {"state": "setUnreadCount", "data": count};

    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
    .notifyObservers(null, "yammerfox-status", msg.toSource());
  },

  setUnreadCount: function(count) {
    var elem = this.$("yammerfox-statusbar-text");
    var value;

    var notifier = Components.classes['@yammer.inc/yammerfox;1']
      .getService(Components.interfaces.nsIYammerFox);

    var unread = notifier.getUnreadCount();
     
    if (count == 0) {
      value = unread || "";
    }
    else if (count > 0) {
      value = count + "/" + unread;
    }
    else {
      value = "";
    }
    elem.setAttribute("value", value);
  },

  setButtonState: function(state) {
    var btn = this.$("yammerfox-statusbar-button");
    btn.setAttribute("state", state);
  },

  updateBalloon: function() {
    if (!this.isActiveWindow()) {
      this.showUnreadCount(0);
      return;
    }

    if (this._popup.isOpen) {

      var msgs = this._messageQueue;
      for (var i = 0; i < msgs.length; ++i) {
        var msg = msgs[i];
        var elem = this.createMessageBalloon(msg, true);
        this._popup.addBalloon(elem);
      }
      this.showUnreadCount(0);
      this._popup.recalcScrollbar(false);
      return;
    }

    var unread = 0;
    for (var i = 0; i < this._messageQueue.length; ++i) {
      var msg = this._messageQueue[i];
      unread++;
    }

    if (!this._showBalloon) {
      this.showUnreadCount(0);
      return;
    }
    else {
      this.showUnreadCount(unread);
    }

    var count = this._messageQueue.length;

    if (count == 0) {
      return;
    }

    if (count > 5) {
      this._messageQueue = new Array();
      this.showNotice(this._strings.getFormattedString("MoreThan5Yams", [unread]));
    }
    else {
      this.showBalloon();
    }
  },

  showBalloon: function() {
    var elem = this.createMessageBalloon(this._messageQueue.shift(), false);
    elem.setAttribute("type", "balloon");
    this.popupBalloon(elem);
  },

  showNotice: function(msg) {
    var elem = document.createElement("vbox");
    elem.className = "yammerfox-notice";
    elem.setAttribute("value", msg);

    this.popupBalloon(elem);
  },

  popupBalloon: function(elem) {
    var box = document.createElement("vbox");
    box.id = "yammerfox-balloon";

    box.appendChild(elem);
    this._panel.appendChild(box);

    var interval = this._util.pref().getIntPref("popup-interval");
    if (!interval) {
      interval = 3;
    }
    this._timer = setTimeout("gYammerFox.onTimeoutBalloon()", interval * 1000);

    if (this._util.isFF3()) {
      elem.setAttribute("boxstyle", "FF3");
      var statusbar = this.$("status-bar");
      this._panel.openPopup(statusbar, "before_end", -16, 2, false, true);
    }
  },

  showPopup: function(data) {
    if (!this.isActiveWindow()) {
      return;
    }

    // remove balloon
    this.removeBalloon();

    this.showUnreadCount(0);

    var msgs = data.msgs;
    var type = data.type;

    this._popup.removeStatuses();

    if (this.cookieStatus() == 1) {
      for (var i in msgs) {
        if (msgs.hasOwnProperty(i)) {
          var elem = this.createMessageBalloon(msgs[i], true);
          this._popup.appendChild(elem);
        }
      }
    } else {
       var elem = document.createTextNode(this._strings.getString("LoginFirst"));
       this._popup.appendChild(elem);
    }

    this._popup.openPopup();

    if (navigator.platform.match("Mac")) {
      this._popup.input.style.padding = "0px";
    }

    this._popup.setActiveTab(data);
    var currentUser = this._util.pref().getCharPref("yammerUser");
    this._popup.currentUser = currentUser;
    this._popup.currentUserIcon = this._currentUserIcon;
    this._popup.signedInAs = this._strings.getFormattedString("SignedInAs", [currentUser]);
  },

  onPopupHidden: function(event) {
    if (event.target.nodeName == "panel") {
      this.closePopup(true);
    }
  },

  closePopup: function(force) {

    if (this._popup.isOpen) {
      this._util.notify("markRead", {type: this._popup.activeTab});
      this.showUnreadCount(0);
      if (force || this._util.pref().getBoolPref("autoClose")) {
        this._popup.hidePopup();
      }
    }
  },

  removeBalloon: function() {
    if (this._timer) {
      clearTimeout(this._timer);
    }

    try {
      this._panel.removeChild(this.$("yammerfox-balloon"));
      this._panel.hidePopup();
    }
    catch (e) {}
  },

  createMessageBalloon: function(msg, highlight) {

    var elem = document.createElement("vbox");
    elem.className = "yammerfox-status";
    elem.id = "tooltip-balloon-" + msg.id;
    elem.setAttribute("attr", "timeline");

    elem.setAttribute("messageId", msg.id);

    try {
      elem.setAttribute("href", this.baseURLFromComponent() + "users/" + msg.name);

      if (msg.reply_name)
        elem.setAttribute("screen_name", msg.name + " re: " + msg.reply_name);
      else
        elem.setAttribute("screen_name", msg.name);
      elem.setAttribute("name", msg.name);

      if (highlight) {
        elem.setAttribute("unread", !msg.unread);
      }
      
      var time_and_group = this.getLocalTimeForDate(msg.created_at);
      if (msg.group_name)
        time_and_group += " in " + msg.group_name;

      elem.setAttribute("time", time_and_group);
      
      var trimed_text = msg.body.plain;
      if (trimed_text.length > 160) {
        var next_space = 0;
        for (var i=160; i<trimed_text.length; i++) {
          if (trimed_text.charAt(i) == ' ') {
            next_space = i;
            break;
          }
        }
        if (next_space == 0)
          next_space = trimed_text.length-1;
        
        trimed_text = trimed_text.substr(0, next_space) + " ...";
      }
      
      var textnode = this.replaceLinkText(trimed_text);
      for (i in msg.attachments) {
        var anchor = this.createAnchorText(msg.attachments[i].web_url, msg.attachments[i].name);
        textnode.appendChild(document.createTextNode(" "));
        textnode.appendChild(anchor);
      }
      elem.appendChild(textnode);
      elem.setAttribute("text", trimed_text);
      
      if (msg.reply_txt) {
        textnode.setAttribute("tooltiptext", msg.reply_txt);
        elem.setAttribute("tooltip", msg.reply_txt);
      } else {
        elem.setAttribute("tooltip", "");
      }

      elem.setAttribute("profile_image_url", msg.mugshot_url);
      if (msg.thread_url)
        elem.setAttribute("thread_url", msg.thread_url);
      else
        elem.setAttribute("thread_url", msg.web_url);
      elem.setAttribute("web_url", msg.web_url);
    }
    catch (e) {
      this.log("Failed to create message balloon: " + e.message);
    }

    return elem;
  },

  /* workaround for Fx2 */
  setFocusToInput: function() {
    this._popup.input.value = this._popup.text;
    this._popup.input.select();
    var pos = this._popup.input.value.length;
    try {
      this._popup.input.setSelectionRange(pos, pos);
    }
    catch (e) {};
  },

  hideProgress: function() {
    this._popup.showProgress(false);

    var input = this._popup.input;
    input.select();
    input.focus();
  },

  onSendMessage: function() {

    var input = this._popup.input;

    // Ignore autocomplete result
    var re = new RegExp('^@[^ ]+$');
    if (re.test(input.value)) {
      return true;
    }

    if (input.value == '') {
      return false;
    }

    this._sendText = input.value.replace(/[\n\r]/, '');
    this._popup.showProgress(true);
    this._util.notify("sendMessage", {body: this._sendText, inReplyTo:this._inReplyTo});
    return true;
  },

  sentMessage: function() {
    this._popup.resetText();
    this.hideProgress();
    this.resetInReplyTo();
    this.closePopup(false);
    this.showNotice(this._strings.getString("MessageSent"));
  },

  errorOnSendMessage: function(msg) {
    this._popup.setAttribute("errorMessage", this._strings.getString("SendMessageError"));
    this._popup.showErrorMessage(true);
    setTimeout("gYammerFox.retryInput()", 2 * 1000);
    this.showMessage(this._strings.getString("SendMessageError"));
  },

  retryInput: function() {
    this._popup.message = this._sendText;
    this._popup.showErrorMessage(false);

    var input = this._popup.input;
    input.select();
    input.focus();
  },

  onClickStatusbarIcon: function(e) {
    if (e.button == 0) {
      this.onOpenPopup();
      this.resetInReplyTo();
    }
  },

  baseURLFromComponent: function() {
    var notifier = Components.classes['@yammer.inc/yammerfox;1']
      .getService(Components.interfaces.nsIYammerFox);

    return notifier.getBaseURL();
  },

  cookieStatus: function() {
    var notifier = Components.classes['@yammer.inc/yammerfox;1']
      .getService(Components.interfaces.nsIYammerFox);

    return notifier.getCookieStatus();
  },
  
  openBaseURL: function() {
    this.openURL(this.baseURLFromComponent());
  },

  onOpenPopup: function() {
    if (this._popup.isOpen) {
      this.closePopup(true);
    }
    else {
      this._util.notify("getRecent", {type:"timeline"});
    }
  },

  changeTab: function(name) {
    this._util.notify("markRead", {type: this._popup.activeTab});
    this._util.notify("getRecent", {type: name});
  },

  onRevertText: function(text) {
    if (text.value == "") {
      this.closePopup(true);
    }
    else {
      this._popup.resetText();
      text.select();
    }
    return true;
  },

  onInsertURL: function() {
    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Components.interfaces.nsIClipboardHelper);

    clipboard.copyString(content.document.location.toString());

    var text = this.$("yammerfox-message-input");
    if (!text) {
      return;
    }

    text.focus();
    goDoCommand("cmd_paste");
  },

  onBalloonClick: function(e) {
    var node = e.target;
    if (e.button == 0) {
      var url = node.getAttribute('href');

      if (url) {
        this.showMessage();
        this.openURL(url);
        this.closePopup(false);
      }
    }
    else if (e.button == 2) {
      var menu = this.$("yammerfox-status-menupopup");
      while (!node.id) {
        node = node.parentNode;
      }
      menu.node = node;

      menu.childNodes[1].disabled = false;
      menu.childNodes[2].disabled = false;
      menu.lastChild.disabled = true;

      if (this._popup.activeTab == 'messages') {
        menu.lastChild.disabled = false;
        menu.childNodes[1].disabled = true;
        menu.childNodes[2].disabled = true;
      }
      if (this._username.toLowerCase() == node.getAttribute("screen_name").toLowerCase()) {
        menu.lastChild.disabled = false;
      }
    }
  },

  copyYam: function(target) {

    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Components.interfaces.nsIClipboardHelper);

    clipboard.copyString(target.parentNode.node.getAttribute("text"));
  },

  openYam: function(target) {
    var yam = target.parentNode.node;

    var url = this.baseURLFromComponent() + "threads/" + yam.getAttribute("messageId");
    this.openURL(url);
  },

  deleteYam: function(target) {
    var yam = target.parentNode.node;
    this._util.notify("deleteYam", 
                      {id:yam.getAttribute("messageId"), type:this._popup.activeTab});
  },

  messageDeleted: function(obj) {
    for (var i = 0; i < this._popup.childNodes.length; ++i) {
      var e = this._popup.childNodes[i];
      if (e.getAttribute("messageId") == obj.id) {
        this._popup.removeChild(e);
        break;
      }
    }
  },

  onBalloonMouseOver: function(e) {
    this._onFocus = true;
  },

  onBalloonMouseOut: function(e) {
    this._onFocus = false;
    if (this._needToUpdate) {
      this._needToUpdate = false;
      if (this._timer) {
        clearTimeout(this._timer);
      }
      this._timer = setTimeout("gYammerFox.onTimeoutBalloon()", 1000);
    }
  },

  resetInReplyTo: function() {
    this._inReplyTo = 0;
    document.getElementById("yammerfox-reply").value = '';
  },

  onReply: function(msg) {
    if (!this._popup.isOpen) {
      this.onOpenPopup();
    }
    
    if (msg.getAttribute("messageId") == this._inReplyTo)
      this.resetInReplyTo();
    else { 
      this._inReplyTo = msg.getAttribute("messageId");
      document.getElementById("yammerfox-reply").value = "replying to " + msg.getAttribute("name") + "... ";
    }
    
    var input = this._popup.input;
    this._popup.showTextBox(true);
    input.focus();
  },

  updateFavorite: function(msg) {
    var elem = this.$("tooltip-balloon-" + msg.id);
    if (elem) {
      elem.setAttribute("favorited", msg.state);
    }
  },

  openURL: function(url) {
    var tabbrowser = gBrowser;
    var tabs = tabbrowser.tabContainer.childNodes;
    for (var i = 0; i < tabs.length; ++i) {
      var tab = tabs[i];
      try {
        var browser = tabbrowser.getBrowserForTab(tab);
        if (browser) {
          var doc = browser.contentDocument;
          var loc = doc.location.toString();
          if (loc == url) {
            gBrowser.selectedTab = tab;
            return;
          }
        }
      }
      catch (e) {
      }
    }
    
    // There is no tab. open new tab...
    var tab = gBrowser.addTab(url, null, null);
    gBrowser.selectedTab = tab;
  },

  updateStatuses: function(e) {
    this._util.notify("updateYams");
  },

  markAllRead: function(e) {
    this.showUnreadCount(-1);
    
    for (var i = 0; i < this._popup.childNodes.length; ++i) {
      var e = this._popup.childNodes[i];
      e.setAttribute("unread", true);
    }
    this._util.notify("markAllRead");
    if (this._popup.isOpen) {
      this._popup.markRead();
    }
  },

  onPreference: function(e) {
    if (this._prefWindow) {
      this._prefWindow.focus();
      return true;
    }

    this._prefWindow = window.openDialog("chrome://yammerfox/content/yammer_preferences.xul", 
                                         "_blank",
                                         "chrome,resizable=no,dependent=yes");
    return true;
  },

  onTogglePopup: function(e) {
    var menu = this.$("yammerfox-menuitem-togglepopup");
    this._showBalloon = !this._showBalloon;
    menu.setAttribute("checked", this._showBalloon);
    this._util.pref().setBoolPref("popup", this._showBalloon);
  },

  onLogout: function() {
    this.logout();
    this._util.notify("logout");
  },

  logout: function() {
    this.showUnreadCount(-1);
    this.setButtonState("");
    this.$("yammerfox-menuitem-logout").setAttribute("disabled", true);
    this.$("yammerfox-menuitem-update").setAttribute("disabled", true);
    this.$("yammerfox-menuitem-account").setAttribute("label", this._strings.getString("SignIn"));

    this.checkMenuItem(null, "yammerfox-accounts");
    this.checkMenuItem(null, "yammerfox-accounts-popup");

    // Close balloon and popup window, reset window settings
    this.removeBalloon();
    this.closePopup(true);
    this._util.pref().setBoolPref("login", false);
    this._currentUserIcon = null;
  },

  onAccountMenuShowing: function(menu) {
    this._util.accounts = this._util.getPassword();
    var currentUser = this._util.pref().getCharPref("yammerUser");
    this.removeAllChild(menu);

    var loggedIn = this._util.pref().getBoolPref("login");

    for (var user in this._util.accounts) {
      if (this._util.accounts.hasOwnProperty(user)) {
        var item = document.createElement("menuitem");
        item.setAttribute("label", user);
        item.setAttribute("type", "radio");
        item.setAttribute("oncommand", "gYammerFox.onChangeAccount(this.label)");

        if (currentUser == null) {
          currentUser = user;
        }

        if (user == currentUser && loggedIn) {
          item.setAttribute("checked", true);
        }
        menu.appendChild(item);
      }
    }
  },

  onChangeAccount: function(user) {

    this._currentUserIcon = null;
    var currentUser = this._util.pref().getCharPref("yammerUser");

    if (user != currentUser || this._util.pref().getBoolPref("login") == false) {

      // Close balloon and popup window, reset window settings
      this.removeBalloon();
      this.showUnreadCount(-1);
      this._popup.removeStatuses();

      this._util.pref().setBoolPref("login", true);

      this.$("yammerfox-menuitem-logout").setAttribute("disabled", false);
      this.$("yammerfox-menuitem-update").setAttribute("disabled", false);
      this.$("yammerfox-menuitem-account").setAttribute("label", this._strings.getString("ChangeAccount"));

      this._util.accounts = this._util.getPassword();

      this._util.pref().setCharPref("yammerUser", user);
      this._util.notify("changeAccount", {user: user, pass: this._util.accounts[user]});
    }
  },

  //
  // Private utilities
  //
  isActiveWindow: function() {

    if (navigator.platform == "Win32" &&
        this._util.isFF3() &&
        window.screenX == -32000 &&
        window.screenY == -32000) {
        return false;
    }

    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
      .getService(Components.interfaces.nsIWindowMediator);
    var win = wm.getMostRecentWindow("");
    return (win == window) ? true : false;
  },

  replaceLinkText : function(text) {

    text = this._unescapeHTML.unescape(text.replace(/&amp;/g,"&"));

    var elem = document.createElement("description");
    elem.className = "yammerfox-message-body";

    var pat = /((http(s?))\:\/\/)([0-9a-zA-Z\-]+\.)+[a-zA-Z]{2,6}(\:[0-9]+)?(\/([\w#!:.?+=&%@~*\';,\-\/\$])*)?/g;
    var re = /[.,;:]$/;
    while (pat.exec(text) != null) {
      var left = RegExp.leftContext;
      var url = RegExp.lastMatch;
      text = RegExp.rightContext;
      if (re.test(url)) {
        text = RegExp.lastMatch + text;
        url = url.replace(re, '');
      }

      this.convertFollowLink(elem, left);

      var urltext = url;
      if (url.length > 27) {
        urltext = url.substr(0, 27) + "...";
      }
      var anchor = this.createAnchorText(url, urltext);
      elem.appendChild(anchor);
      pat.lastIndex = 0;
    }

    if (text) {
      this.convertFollowLink(elem, text);
    }

    return elem;
  },

  convertFollowLink: function(elem, text) {
    var pat = /@(\w+)/;

    while(pat.exec(text) != null) {
      var username = RegExp.$1;
      var atUsername = RegExp.lastMatch;
      text = RegExp.rightContext;

      elem.appendChild(document.createTextNode(RegExp.leftContext));

      var a = this.createAnchorText(this.baseURLFromComponent() + "users/"+ username, atUsername);
      elem.appendChild(a);
      pat.lastIndex = 0;
      if (username.toLowerCase() == this._username) {
        elem.setAttribute("attr", "replies");
      }
    }
    if (text) {
      elem.appendChild(document.createTextNode(text));
    }
  },

  createAnchorText: function(link, text) {
      var anchor = document.createElement("a");
      anchor.className = "yammerfox-hyperlink";
      anchor.setAttribute("href", link);

      anchor.setAttribute("tooltiptext", link);
      anchor.appendChild(document.createTextNode(text));

      return anchor;
  },

  checkMenuItem: function(user, container) {
    var menu = this.$(container);
    if (menu) {
      for (var i = 0; i < menu.childNodes.length; ++i) {
        if (menu.childNodes[i].getAttribute("label") == user) {
          menu.childNodes[i].setAttribute("checked", true);
        }
        else {
          menu.childNodes[i].setAttribute("checked", false);
        }
      }
    }
  },

  removeAllChild: function(obj) {
    while(obj.firstChild) obj.removeChild(obj.firstChild);
  },

  getLocalTimeForDate: function(time) {

    system_date = new Date(time);
    user_date = new Date();
    delta_minutes = Math.floor((user_date - system_date) / (60 * 1000));
    if (Math.abs(delta_minutes) <= (8 * 7 * 24 * 60)) { 
      distance = this.distanceOfTimeInWords(delta_minutes);
      if (delta_minutes < 0) {
        return this._strings.getFormattedString("DateTimeFromNow", [distance]);
      } else {
        return this._strings.getFormattedString("DateTimeAgo", [distance]);
      }
    } else {
      return this._strings.getFormattedString("OnDateTime", [system_date.toLocaleDateString()]);
    }
  },

  // a vague copy of rails' inbuilt function, 
  // but a bit more friendly with the hours.
  distanceOfTimeInWords: function(minutes) {
    if (minutes.isNaN) return "";

    var index;

    minutes = Math.abs(minutes);
    if (minutes < 1)         index = 'LessThanAMinute';
    else if (minutes < 50)   index = (minutes == 1 ? 'Minute' : 'Minutes');
    else if (minutes < 90)   index = 'AboutOneHour';
    else if (minutes < 1080) {
      minutes = Math.round(minutes / 60);
      index = 'Hours';
    }
    else if (minutes < 1440) index = 'OneDay';
    else if (minutes < 2880) index = 'AboutOneDay';
    else {
      minutes = Math.round(minutes / 1440);
      index = 'Days';
    }
    return this._strings.getFormattedString(index, [minutes]);
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

var gYammerFox = new YammerFox();

window.addEventListener("load", function(e) { gYammerFox.load(e); }, false);
window.addEventListener("unload", function(e) { gYammerFox.unload(e); }, false);

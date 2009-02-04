function yammerFoxExUtils(name) {
  this._exname = name;

  this._pref = Components.classes['@mozilla.org/preferences-service;1']
    .getService(Components.interfaces.nsIPrefService).getBranch("extensions." + name + ".");

  this._observer = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

  this.initPassword();

}

yammerFoxExUtils.prototype = {

  $: function(id) {
    return document.getElementById(id);
  },

  getPanel: function() {

    if (this._pass != null) {
      var panel = window.document.getElementById("yammerfox-infobubble");
      if (!panel) {
        panel = document.createElement("vbox");

        panel.id = "yammerfox-infobubble";
        panel.style.right  = "16px";
        panel.style.bottom = "16px";
        panel.style.position = "fixed";
        panel.style.zIndex = "1";
        panel.align = "end";

        var box = window.document.createElement("vbox");
        box.align = "end";
        panel.appendChild(box);

        var sts = window.document.getElementById("status-bar");
        sts.parentNode.insertBefore(panel, sts);
        return panel.firstChild;
      }
      return panel.firstChild;
    }
    else if (this._login != null) {
      panel = document.createElement("panel");
      panel.setAttribute("noautofocus", "true");
      panel.setAttribute("noautohide", "true");
      panel.id = "yammerfox-panel";
      var popupset = this.$("yammerfox-popupset");
      popupset.appendChild(panel);
      return panel;
    }

    // do not come here
    return null;
  },

  pref: function () {
    return this._pref;
  },

  notify: function(command) {
    var p = {
      "command": command
    };
    
    if (arguments[1]) {
      for (var i in arguments[1]) {
        p[i] = arguments[1][i];
      }
    }

    this._observer.notifyObservers(null,
                                   this._exname + "-command",
                                   p.toSource());
  },

  getPassword: function(path) {

    if (!path) path = "";

    var result = [];
    var n = 0;

    if (this._pass) {
      // for Firefox 2 Pdpassword Manager
      //
      var enumerator = this._pass.enumerator;

      while (enumerator.hasMoreElements()) {
        var nextPassword;
        try {
          nextPassword = enumerator.getNext();
        } catch(e) {
          dump("Can't retrieve password by Password Manager\n");
          break;
        }
        nextPassword = nextPassword.QueryInterface(Components.interfaces.nsIPassword);
        var host = nextPassword.host;

        if (host == "chrome://" + this._exname + "/" + path) {
          ++n;
          result[nextPassword.user] = nextPassword.password;
        }
      }
    }
    else if (this._login) {
      // for Firefox 3 Login Manager
      //
      try {
        var hostname = "chrome://" + this._exname;
        var logins = this._login.findLogins({}, hostname, "", null);
        n = logins.length;

        if (n == 0) {
          logins = this.migrateAccount();
        }

        for (var i = 0; i < logins.length; ++i) {
          result[logins[i].username] = logins[i].password;
        }
      }
      catch(e) {
        dump("Can't retrieve password by Login Manager\n");
      }
    }
    return (n > 0) ? result : null;
  },

  removePassword: function(user) {
    try {
      if (this._pass) {
        // for Password Manager
        var host = "chrome://" + this._exname + "/";
        this._pass.removeUser(host, user);
      }
      else if (this._login) {
        // for Login Manager
        var host = "chrome://" + this._exname;
        var logins = this._login.findLogins({}, host, "", null);
        for (var i = 0; i < logins.length; ++i) 
          if (logins[i].username == user) {
            this._login.removeLogin(logins[i]);
          }
      }
    }
    catch (e) {}
  },
  
  log: function(msg) {
    if (!this._console) {
      this._console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
    }
    this._console.logStringMessage(msg);
  },

  migrateAccount: function() {
    var logins = this._login.getAllLogins({});
    var host = "chrome://" + this._exname;

    for (var i = 0; i < logins.length; ++i) {
      if (logins[i].hostname == host + "/") {
        var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                     Components.interfaces.nsILoginInfo,
                                                     "init");

        var loginInfo = new nsLoginInfo(host, 
                                        host + "/" + logins[i].username, 
                                        null,
                                        logins[i].username,
                                        logins[i].password,
                                        "username",
                                        "password");
        this._login.modifyLogin(logins[i], loginInfo);
      }
    }
  },

  savePassword: function(user, pass) {
    var host = "chrome://" + this._exname;

    this.removePassword(user);
    try {
      if (this._pass) {
        this._pass.addUser(host + "/", user, pass);
      }
      else if (this._login) {
        var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                     Components.interfaces.nsILoginInfo,
                                                     "init");

        var loginInfo = new nsLoginInfo(host, host + "/" + user, null, user, pass, "username", "password");
        this._login.addLogin(loginInfo);
      }
    }
    catch (e) {}

  },

  getAccountInfo: function() {

    this.accounts = this.getPassword();
    if (this.accounts == null) {
      return null;
    }

    var currentUser = this.pref().getCharPref("yammerUser");
    var password = null;

    if (!this.accounts[currentUser]) {
      currentUser = null;
    }
    for (var user in this.accounts) {
      if (this.accounts.hasOwnProperty(user)) {
        if (currentUser == null) {
          currentUser = user;
        }
        if (user == currentUser) {
          password = this.accounts[user];
        }
      }
    }

    this.pref().setCharPref("yammerUser", currentUser);

    return {user:currentUser, pass:this.accounts[currentUser]};
  },

  initPassword: function() {
    var pass   = Components.classes["@mozilla.org/passwordmanager;1"];
    var login = Components.classes["@mozilla.org/login-manager;1"];

    if (pass != null) {
      // For firefox 2
      this._pass  = pass.createInstance(Components.interfaces.nsIPasswordManager);
    }
    else if (login != null) {
      this._login = login.getService(Components.interfaces.nsILoginManager);
    }
  },

  isFF3: function() {
    return (this._login) ? true : false;
  }
};

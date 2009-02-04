const YammerFoxPreferences = {

  util: new yammerFoxExUtils("yammerfox"),
 
  onLoad: function() {

    var $ = this.util.$;
    this.strings = document.getElementById("yammerfox-strings");

    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
        .addObserver(this, "yammerfox-status", false);

    var interval = this.util.pref().getIntPref("interval");
    if (!interval || interval < 1) {
      interval = 1;
    }
    $("refresh-interval").value = interval;

    var popup = this.util.pref().getIntPref("popup-interval");
    if (!popup) {
      popup = 3;
    }
    $("popup-interval").value = popup;

    $("popup-autoclose").checked = this.util.pref().getBoolPref("autoClose");
    $("balloon-popup").checked   = this.util.pref().getBoolPref("popup");
    $("sound").checked         = this.util.pref().getBoolPref("sound");
  },

  onUnload: function() {
    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
          .removeObserver(this, "yammerfox-status");
    try {
      window.opener.gYammerFox._prefWindow = null;
    }
    catch (e) {}
  },

  observe: function(subject, topic, data) {
    /* do nothing here */
    return;
  },

  onSubmit: function() {
    var $ = this.util.$;

    this.util.pref().setIntPref("interval", $("refresh-interval").value);
    this.util.pref().setIntPref("popup-interval", $("popup-interval").value);
    this.util.pref().setBoolPref("autoClose", $("popup-autoclose").checked);
    this.util.pref().setBoolPref("popup", $("balloon-popup").checked);

    this.util.pref().setBoolPref("sound", $("sound").checked);

    this.util.notify("updatePref");

    return true;
  },

  onCancel: function() {
    try {
      window.opener.gYammerFox._prefWindow = null;
    }
    catch (e) {}
  }
};


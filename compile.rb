
xpidl = '/Users/aa/ginc/mozilla/dist/bin/xpidl'
base = '/Users/aa/ginc/mozilla/xpcom/base'
output = 'components/nsIYammerFox.xpt'
idl = 'components/nsIYammerFox.idl'

exec("#{xpidl} -m typelib -w -v -I #{base} -e #{output} #{idl}")

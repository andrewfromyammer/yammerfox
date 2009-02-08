#!/opt/local/bin/ruby

# note:
# Failed to load XPCOM component: /Users/aa/ginc/yammerfox/components/nsIYammerFox.idl
# is normal to see, because the component doesn't exist when first run

file = 'yammerfox@yammer-inc.com'
base_path = '/Users/aa/Library/Application Support/Firefox/Profiles/ms918oqo.default/'
path = "#{base_path}extensions/"
content = '/Users/aa/ginc/yammerfox/'

begin
  File.delete("#{base_path}compreg.dat")
  File.delete("#{base_path}xpti.dat")
rescue
end

if false
  if File.exists?("#{path}#{file}")
    File.delete("#{path}#{file}")
  else
    f = File.open("#{path}#{file}", "w")
    f << content
    f.close
  end
end

exec('/Applications/Firefox.app/Contents/MacOS/firefox -P default')

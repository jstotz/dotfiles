#!/bin/sh
export PATH="$HOME/.luarocks/bin:$PATH"
export LUA_PATH="$HOMEBREW_CELLAR/luarocks/3.12.0/share/lua/5.4/?.lua;/usr/local/share/lua/5.4/?.lua;/usr/local/share/lua/5.4/?/init.lua;/usr/local/lib/lua/5.4/?.lua;/usr/local/lib/lua/5.4/?/init.lua;./?.lua;./?/init.lua;$HOME/.luarocks/share/lua/5.4/?.lua;$HOME/.luarocks/share/lua/5.4/?/init.lua"
export LUA_CPATH="/usr/local/lib/lua/5.4/?.so;/usr/local/lib/lua/5.4/loadall.so;./?.so;$HOME/.luarocks/lib/lua/5.4/?.so"

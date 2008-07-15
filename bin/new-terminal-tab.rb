#!/usr/bin/env ruby

require 'find'
require 'rubygems'
require 'appscript'
include Appscript

pwd = Dir.pwd
working_dirs = (ARGV.length > 0) ? ARGV.map{ |dir| File.join(pwd, dir) } : [pwd]

current_window = app("Terminal").windows.first
working_dirs.each do |working_dir|
  working_dir = Dir.pwd if working_dir == "."
  app("System Events").application_processes["Terminal.app"].keystroke("t", :using => :command_down)
  app("Terminal").do_script("cd \"#{working_dir}\" && clear", :in => current_window.tabs.last)
end


#!/usr/bin/ruby
puts output = `git pull`
`nub` if $?.exitstatus == 0 and output != "Already up-to-date.\n"
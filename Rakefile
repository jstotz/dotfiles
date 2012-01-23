desc "Install Vundle and bundles"
task :default do
  if !File.exists?('./bundle/vundle')
    sh "git clone http://github.com/gmarik/vundle.git ./bundle/vundle"
  end
  sh "vim +BundleInstall +qall"
end

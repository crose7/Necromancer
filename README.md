#Necromancer

## Installation
Download **NPM** and **Node** here: https://www.npmjs.com/get-npm  
Information about installing **Git** can be found here: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git  
You can check if you already have these installed by running these commands at the command line: `npm`, `node`, `git`

Once you've verified installation:
1) Open the command line
2) Navigate to the folder of your choice
3) Run the command `git clone https://github.com/crose7/Undertaker` — this will install the base files.
4) Navigate to the newly created Undertaker folder
5) Run the command `npm install` — this will download the libraries that Undertaker requires to function.

## Updating to the latest version
Necromancer is in rapid development. To update to the latest version, navigate to your Necromancer folder in the command line and run
````git pull https://github.com/crose7/Necromancer```

## General Use
```node Necromancer.js <archive name> <flag> <flag argument>
node Necromancer.js myArchive --query "author:myusername"   // indexes every post made by this username
node Necromancer.js myArchive --query "blog:myblog"         // indexes every post in this blog, i.e. https://myblog.kinja.com
node Necromancer.js myArchive --download                    // downloads articles and comments
node Necromancer.js myArchive --fastDownload                // downloads only articles; also use if --download refuses to download certain posts
node Necromancer.js myArchive --rssExport <rss export feed with fresh token>
                                                            // indexes every post present in the RSS export
```

Upon completion, Necromancer will inform you of any errors that occurred. These are likely failed download attempts. To retry, reissue the same command.

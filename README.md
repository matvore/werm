werm: Web-based terminal multiplexer

werm is a terminal multiplexer and emulator empowered by browser tabs and your
OS's desktop features.

WHAT ?

Usually we would use a terminal multiplexer to maintain sessions and manage
multiple terminals over a single SSH connection. The drawback to this approach
is you cannot take advantage of your window manager features or more generally,
the features of your OS's desktop environment.

In recent times, Chrome and other Chromium-based browsers introduced a feature
to search open tabs. If your shells were tabs, you would be able to search
them. If your shells are accessed and customized via URLs, you would be able to
access them with bookmarks. If your shells are first-class windows (and not
tmux or GNU screen panes), you can distribute them between multiple desktops and
multiple monitors and possibly snap them to the sides of your screens or tile
them, depending on what window manager you are using.

The purpose of werm is to unlock these features when working with terminal
sessions.

FEATURES

 * Ability to jump to different sessions using Ctrl+Shift+A (Chrome feature)

 * Macros. Macros start with left or right alt and are a sequence of keys of
   arbitrary length. No chording is required when typing the macro activator
   sequence.

 * Detachability (close the tab and the shell is still alive)

 * Pixel-perfect bitmap fonts of various sizes which can even render on high-DPI
   screens without blur.

 * Multiple shell "profiles," each cloneable and initialized with its own
   command or rc file

 * Profile name is in tab title so you can search for it

 * Most of what is in hterm (the engine for chromeOS SSH App and Crostini
   terminals)

 * Works on any OS with a Chromium-based browser, including chromeOS and LaCros
   chromeOS

 * Operate a terminal on your local machine or a remote one with a local
   browser.

 * Shows active shell sessions and available profiles at
   http://localhost:<port>/attach. (This page can also be opened from a terminal
   with macros.)

 * Overloaded decorator keys for easier coding and shell interaction: can type
   certain characters more easily

   * Done by pressing L/R shift keys, L/R ctrl keys, without chording with other
     keys; or the menu key
   * Look for "deadkey_map" or "menu_key_inserts" in index.html to customize the
     inserted characters.

QUICKSTART

 * chromeOS is the most thoroughly tested client OS at this time

 * Non-Chromium-based browsers have not been tested

 * The Werm server only runs on Linux

 * On your local or remote Linux machine, clone this repo to a convenient place
   and build. I recommend ~/.local/werm:

   $ cd ~/.local
   $ git clone <repo_url>
   $ cd werm
   $ ./build

   The first time you build it will download Go to compile a third-party
   component. This takes a little longer. It keeps Go inside the werm directory.

 * Start the server.

   FOR THE WEB SERVER TO OPERATE THE LOCAL MACHINE

   Run: $ ./run --port=8090 --address=localhost

   Note that any remotely logged in users will get access to your shells, since
   the port is accessible to any local user.

   FOR THE WEB SERVER TO OPERATE A REMOTE MACHINE, or your local machine on
   which other users may log in, you should host the server on a Unix domain
   socket (UDS) so only one user has access:

   $ umask 0077
   $ ./run --uds=/tmp/werm.$USER.sock

   And then use port forwarding in your SSH command arguments (works with Chrome
   SSH extension, and any port number) to connect from your local machine:

   $ ssh ... -L 8090:/tmp/werm.<USER>.sock

 * Open localhost:8090 in your browser to get an ephemeral shell. This will
   terminate the shell as soon as the tab is closed or the connection is lost.

 * To open a non-ephemeral shell, do one of the following:

   a) Open localhost:8090/attach in your browser and click on the one-letter
      links at the top of the page to open a non-ephemeral shell (using
      single-letter names at top of page)

   b) Open localhost:8090/attach and use a link in the "Active sessions" section
      to open an existing non-ephemeral session

 * You can open localhost:8090/attach by typing "rarsS T " (see HOW TO READ
   MACRO SHORTCUTS below) or "rarsA T " in a terminal tab. The former shortcut
   uses a new tab (Separate) w while the latter replaces the current tab.

 * Rather than use the attach page to reconnect to a shell, you can also re-open
   the URL e.g. with a bookmark or Ctrl+Shift+T.

 * While any shell is open, type "laH T " to start a new non-ephemeral shell

HOW TO READ MACRO SHORTCUTS

To understand macros cited in this guide, you will need to know how
to activate them with the noted shortcut. Each shortcut is a plain string with
an even number of characters (this is how they are expressed compactly in the
source in long lists).

This syntax is also important in defining your own macros.

Each macro starts with either left alt or right alt.

Each key is represented by two characters. Even if a key is a modifier such as
alt, shift, or ctrl, there is no need to hold down the modifier.

Left and right modifiers of each kind are distinguished in the shortcut, so you
have to press the right one. Here are the most common keys that are used in
shortcuts:

 * Capital letter followed by space, e.g. "X " or "A " indicates that alphabetic
   key.
 * Number followed by a space is that number on the top row of the keyboard.
 * Punctuation such as [ or , followed by a space is the non-numpad key which
   inserts that punction.
 * Numpad keys are indicated by a '#' followed usually but not always by a
   numeric digit.
 * la and ra are the alt keys, ls and rs are shift, and lc and rc are control.
 * sp is the spacebar

native_to_mn in index.html defines the complete mapping between two-character
mnemonics and the human-readable name used by the JS Event API.

BASIC USE

 * To close an ephemeral shell, just use Ctrl+W or close the tab.

 * To close a non-ephemeral shell, terminate the shell with Ctrl+D or the "exit"
   command before closing the tab.

 * To add or remove macros, look for macro_map in index.html.

   The left-hand side is the macro shortcut or mnemonic.

   The right-hand side is the string to enter or function to invoke. Use \r for
   return. Do not use mnemonics here, just the raw string. 

 * Fonts are changed with "raF N **" where ** is 'A ' to 'I ' in roughly
   increasing size. Ctrl-= and Ctrl-minus also work to change zoom, though this
   will cause blur if it is not 200% or 300% zoom.

 * Meta (i.e. super, apple on MacOS, search on ChromeOS) key is used in place of
   Alt for the terminal process. This is to allow Alt to be used for the start
   of macros. Note that on ChromeOS, meta pressed alone cannot be intercepted by
   Javascript, so meta is not used for macros.

SCROLLBACK FEATURES

 * To access the scrollback buffer, press "laH L ". This opens a new tab with
   $logfile shell variable set to the path of the scrollback file, (and for
   debugging werm, $logfile.raw has the raw stdout+stderr of the shell). In the
   scrollback tab, use "lel" as an alias for "less $logfile".

 * Open the scrollback in a new tab in an HTML <textarea> with macro "laH M " to
   get browser-native scrolling, searching, copying behavior. This does not use
   the alternate screen, but only the primary screen's scrollback, so you
   probably won't see editor or `less` content. This macro is defined in a tab
   with a terminal ID, but not an ephemeral terminal.

   * In the scrollback tab, to copy the selection, you may press Enter as an
     alternative to Ctrl+C followed by Ctrl+W.

 * Show the visible text only in an HTML <textarea> with 'laH N '. This works
   with editor and UI screens, unlike 'laH M '. But everything else about its
   use is the same (Enter to copy text and close the tab).

TODO document Advanced Usage and Configuration, add screenshots and videos. See
go/web-term until then.

/* Copyright 2025 Google LLC
 *
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file or at
 * https://developers.google.com/open-source/licenses/bsd */

var macro_map, vim_macros, git_macros;

#define REPEAT_BOX_CNT 8

(function() {
var barrier_dig = [], font_key, repeat_cnt, repsignal;

function set_repeat_key(code)
{
	var bo = 0.5;

	switch (code) {
	case 'bs': repsignal = '\177';		break;
	case 'vs': repsignal = '\x1b[3~';	break;
	case 'en': repsignal = '\r';		break;
	case '- ': repsignal = '-';		break;
	case 'sp': repsignal = ' ';		break;
	case 'ri': repsignal = '\\>';		break;
	case 'le': repsignal = '\\<';		break;
	case 'up': repsignal = '\\^';		break;
	case 'do': repsignal = '\\v';		break;
	case '. ': repsignal = '\t';		bo=-1; break;

	default:	return 0;
	}

	updaterepboxs(1, 1, bo, 0);

	return 'm';
}

function set_repeat_cnt(code)
{
	var boxi;

	// 'me' means don't hide the guide boxes, nor repeat
	boxi = code == 'me' ? 0 : REPEAT_BOX_CNT;
	updaterepboxs(0, 0, code == 'me' ? +0.25 : -1, 0);

	switch (code) {
	case 'ra': case 'me':	repeat_cnt = 0;		return 'm';
	case 'rs':		repeat_cnt = 40;	return 'm';
	}

	if (code.charAt(1) != ' ') return 0;

	repeat_cnt =	/*000000000111111111122222222223333333
			  123456789012345678901234567890123456789*/
			' 12345QWERTASDFGZXCVB7890-UIOP[JKL;"M,./'
		.indexOf(code.charAt(0));
	return repeat_cnt >= 1 ? 'm' : 0;
}

function repeat_keystroke()
{
	while (repeat_cnt--) signal(repsignal);
}

function set_font_key(key)
{
	if (!/^[A-Z] $/.test(key)) return 0;

	font_key = key.charCodeAt(0) - 65;
	return (font_key >= 0 && font_key < WERMFONT_CNT) ? 'm' : 0;
}

function set_barrier_dig(code)
{
	barrier_dig[this] = code[1];
	return /#[0-9]/.test(code) ? 'm' : 0;
}

macro_map = [
	/* Sample macros for C++ coding and shell use. */
	['raW ; ',	'std::'],
	['raA ',	'->'],
	['lavsU ',	'| grep '],
	['raD G ',	'grep -Irn '],

	/* Send Ctrl+T, do not open a new tab */
	['raT ',	'\x14'],

	['laH T ',	open_child_term],
	[['raF N ',	set_font_key], () => set_font(font_key, 0)],
	['raD U M P ',	signal.bind(0, '\\d')],
	['raS T ',	set_locked_title.bind(0, 'c')],
	['raS B T ',	set_locked_title.bind(0, 'b')],
	['laU T ',	unlock_title],
	['rarsA T ',	function() { window.open('/attach', '_top'); }],
	['rarsS T ',	function() { window.open('/attach', '_blank'); }],

	/* These cannot be added conditionally to macro_map, since
	 * termid may be set later by \@appendid */
	['laH L ', open_for_term.bind(0, '/?logview=')],
	['laH M ', open_for_term.bind(0, '/scrollback?termid=')],
	['laH N ', function()
	{
		var sbwin, rows, rsi, rstxt = deqmk();

		rows = term(t,row);
		for (rsi = 0; rsi < rows; rsi++) {
			rstxt = tpushlinestr(t,	rstxt, rsi);
			rstxt = deqpushbyt(	rstxt, ORD('\n'));
		}

		sbwin = window.open('/scrollback');
		sbwin.scrollbackcontent = deqtostring(rstxt, 0);
		tmfree(rstxt);
	}],

	[['ra', set_repeat_key, set_repeat_cnt], repeat_keystroke],
	[['la',
	 set_barrier_dig.bind(0),
	 set_barrier_dig.bind(1),
	 set_barrier_dig.bind(2)], function()
	{
		show_barrier(Number(barrier_dig.join('')));
	}],

	['ra5 ra', dopaste],
];

git_macros = [
	['laI F ',	'git status -s -uno\r'],
	['laI R V ',	'git remote -v\r'],
	['laI lsF ',	'git status -s -uall\r'],
	['laI D ',	'git diff '],
	['laI L ',	'git log --name-status '],
	['laI C O ',	'git checkout '],
	['laI C D ',	'git diff --cached '],
	['laI B R ',	'git branch '],
	['laI C M ',	'git commit '],
	['laI P S ',	'git push '],
	['laI P L ',	'git pull '],
	['laI S ',	'git show '],

	/* `git log` which shows full branching history with commit rather than
	author timestamps, in a format that doesn't require Git to do any
	preprocessing, so it is fast even for very complex branching patterns.
	Parent commits are shown as shortened 3-character hashes, which allows
	locating them easily enough. */
	['laI T ',	'|perl -pE\'/^([^0-9]*)(\\d{8,10})\\b(.*)/ and $_=$1.`date -d\\@$2 +"%F %T %Z"`."$3\\n" and s/\\n//\'|less \x01git log --graph --format="%ct %h %s" '],
];

vim_macros = [
	['raS D ', '\x1b:w\r'],		/* save buffer */
	['raS K ', '\x1b:wq\r'],	/* save buffer and quit */
	['la; P ', ':e %:p:h\t'],	/* open prepopulating path with current file's dir */
	['la; [ ', ':e \x12%'],		/* open prepopulating path with current file */
	['ralsI ', '\x1bI'],		/* insert mode at start of line, similar to Ctrl+O then I */
	['ralsE ', '\x1bA'],		/* insert mode at end of line, similar to Ctrl+O then E */
];
})();

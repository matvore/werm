/* Copyright 2023 Google LLC
 *
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file or at
 * https://developers.google.com/open-source/licenses/bsd */

#include <err.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <sys/stat.h>
#include <errno.h>

char *dtach_sock;
int first_attach;

int xasprintf(char **strp, const char *format, ...)
{
	int res;

	va_list argp;

	va_start(argp, format);
	res = vsnprintf(NULL, 0, format, argp);
	va_end(argp);
	if (res < 0) errx(1, "vsnprintf: failed to calc str length");

	*strp = malloc(res+1);

	va_start(argp, format);
	res = vsnprintf(*strp, res+1, format, argp);
	va_end(argp);
	if (res < 0) errx(1, "vsnprintf");

	return res;
}

const char *state_dir(void)
{
	static char *rd;
	const char *wermdir;

	if (rd) return rd;

	wermdir = getenv("WERMSRCDIR");
	if (!wermdir) errx(1, "$WERMSRCDIR is unset");

	xasprintf(&rd, "%s/var", wermdir);
	if (mkdir(rd, 0700) && errno != EEXIST) err(1, "cannot create %s", rd);

	return rd;
}

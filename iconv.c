#include <stdio.h>
#include <string.h>
#include <iconv.h>
#include <errno.h>
#include <inttypes.h>

#define BUFSIZE 1024

void show_utf32_info(char *buf)
{
	uint32_t unicode;
	char utf8[5] = { 0, 0, 0, 0, 0 };
	char *in = buf;
	char *out = utf8;
	size_t in_left = 4;
	size_t out_left = 5;

	iconv_t ic = iconv_open("UTF-8", "UTF-32BE");
	if (ic == (iconv_t)(-1)) {
		printf("iconv_open() error\n" );
		return;
	}
	int ret = iconv(ic, &in, &in_left, &out, &out_left);
	if (ret == (size_t)-1) {
		printf("iconv() error\n" );
		return;
	}
	iconv_close(ic);
	unicode = ((uint8_t)buf[0] << 24) | ((uint8_t)buf[1] << 16) |
		((uint8_t)buf[2] << 8) | ((uint8_t)buf[3]);
	printf("U+%04"PRIX32" ( %s )\n", unicode, utf8);
}

int main (int argc, char **argv) {
	char buf[BUFSIZE];
	iconv_t ic = iconv_open("UTF-32BE", "UTF-8");
	if (ic == (iconv_t)(-1)) {
		printf("iconv_open() error\n" );
		return 1;
	}
	if (fgets(buf, BUFSIZE, stdin) != NULL) {
		if (buf[strlen(buf)-1] == '\n') {
			buf[strlen(buf)-1] = '\0';
		}
		char *in = buf;
		size_t in_left = strlen(buf);
		do {
			char outbuf[5] = {0, 0, 0, 0, 0};
			char *out = outbuf;
			size_t out_left = 5;
			int ret = iconv(ic, &in, &in_left, &out, &out_left);
			if (ret == (size_t)-1) {
				switch (errno) {
				case E2BIG:
					break;
				case EILSEQ:
					fprintf(stderr, "error: Illegal byte sequence\n");
					return 1;
				case EINVAL:
					fprintf(stderr, "error: Invalid argument\n");
					return 1;
				defaults:
					fprintf(stderr, "error: errno=%d\n", errno);
					return 1;
				}
			}
			if (out_left < 5) {
				show_utf32_info(outbuf);
			}
		} while(in_left > 0);
	}
	iconv_close(ic);
}

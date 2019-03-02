#include <stdio.h>
#include <signal.h>
#include <errno.h>

#include <sys/mount.h>

int main(int argc, char ** argv) {
	printf("Hello, world!\n");
	int ret = kill(0,SIGINT);
	printf("ret=%d, errno=%d\n", ret, errno);
	FILE *fh = fopen("/foo/bar/baz/foo", "a");
	printf("fh=%p\n", fh);
	int ret2 = fputc('1', fh);
	printf("ret2=%d, errno=%d\n", ret2, errno);
	fclose(fh);
	FILE *fh2 = fopen("/tmp/foo", "r");
	printf("fh2=%p\n", fh2);
	int ret3 = fgetc(fh2);
	printf("ret3=%d, errno=%d\n", ret3, errno);
	fclose(fh2);
}

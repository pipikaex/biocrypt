/*
 * BioCrypt v1 Native Miner (DNA256 PoW, hot loop).
 *
 * Zero external deps beyond Apple CommonCrypto + pthreads.
 * This binary does NOT talk to the network. It only searches for PoW
 * solutions and emits JSON Lines to stdout. A companion Node process
 * (biocrypt-mine.mjs) signs each candidate with the miner wallet and
 * submits to the tracker over WebSocket.
 *
 * Compile:
 *   clang -O3 -o zcoin-miner-v1 zcoin-miner-v1.c
 *
 * Usage:
 *   ./zcoin-miner-v1                       (defaults: 16 leading Ts, ncpu-1 threads)
 *   ./zcoin-miner-v1 --leading-ts 16 --threads 8
 *   ./zcoin-miner-v1 -t 16 -j 8
 *
 * Output lines (one per valid PoW solution):
 *   {"type":"candidate","gene":"ATG...TAA","nonce":12345,"leadingTs":17,"mask":"T"}
 *
 * Status lines (every 10s):
 *   {"type":"stat","hashes":123456789,"rate":987654,"coins":3,"uptime":42}
 *
 * Reads control commands from stdin (one JSON per line):
 *   {"type":"set-leading-ts","value":17}     adjust difficulty live
 *   {"type":"quit"}                            graceful stop
 */

#include <CommonCrypto/CommonDigest.h>
#include <pthread.h>
#include <signal.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define MAX_GENE    4096
#define BODY_CODONS 60
#define HEADER      "ATGGGGTGGTGC"
#define HEADER_LEN  12
#define ROUND_NONCE 10000000ULL

/* 64 codons in TACG alphabet. A = bits 01 when TACG, but we use the same
 * lookup tables the JS side emits. Indices map to (b0*16 + b1*4 + b2). */
static const char CLT[64][3] = {
    {'T','T','T'},{'T','T','A'},{'T','T','C'},{'T','T','G'},
    {'T','A','T'},{'G','C','T'},{'T','A','C'},{'G','C','T'},
    {'T','C','T'},{'T','C','A'},{'T','C','C'},{'T','C','G'},
    {'T','G','T'},{'G','C','T'},{'T','G','C'},{'T','G','G'},
    {'A','T','T'},{'A','T','A'},{'A','T','C'},{'G','C','T'},
    {'A','A','T'},{'A','A','A'},{'A','A','C'},{'A','A','G'},
    {'A','C','T'},{'A','C','A'},{'A','C','C'},{'A','C','G'},
    {'A','G','T'},{'A','G','A'},{'A','G','C'},{'A','G','G'},
    {'C','T','T'},{'C','T','A'},{'C','T','C'},{'C','T','G'},
    {'C','A','T'},{'C','A','A'},{'C','A','C'},{'C','A','G'},
    {'C','C','T'},{'C','C','A'},{'C','C','C'},{'C','C','G'},
    {'C','G','T'},{'C','G','A'},{'C','G','C'},{'C','G','G'},
    {'G','T','T'},{'G','T','A'},{'G','T','C'},{'G','T','G'},
    {'G','A','T'},{'G','A','A'},{'G','A','C'},{'G','A','G'},
    {'G','C','T'},{'G','C','A'},{'G','C','C'},{'G','C','G'},
    {'G','G','T'},{'G','G','A'},{'G','G','C'},{'G','G','G'},
};

/* Valid body codon values: exclude STOP (TAA, TAG, TGA) and ATG. */
static const int BVAL[] = {
     0, 1, 2, 3, 4,    6,    8, 9,10,11,12,   14,15,
    16,17,18,   20,21,22,23,24,25,26,27,28,29,30,31,
    32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,
    48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,
};
#define N_BVAL (sizeof(BVAL)/sizeof(BVAL[0]))

/* Domain separator for the PoW layer. Must match core/dna256.ts. */
#define POW_DOMAIN      "GEMIX:PoW:v1:"
#define POW_DOMAIN_LEN  13

/* Fixed display mask (first 32 bytes of sha256("gemix/dna256/display-mix/v1")). */
static unsigned char g_mask32[32];

static _Atomic int g_leading_ts = 16;
static _Atomic long g_hashes = 0;
static _Atomic int  g_coins  = 0;
static volatile sig_atomic_t g_run = 1;

static void init_mask(void) {
    static const char *seed = "gemix/dna256/display-mix/v1";
    CC_SHA256((const unsigned char *)seed, (CC_LONG)strlen(seed), g_mask32);
}

static inline int count_leading_zero_bits(const unsigned char *b) {
    int n = 0;
    for (int i = 0; i < 32; i++) {
        if (b[i] == 0) { n += 8; continue; }
        unsigned x = b[i];
        if (!(x & 0x80)) n++; else return n;
        if (!(x & 0x40)) n++; else return n;
        if (!(x & 0x20)) n++; else return n;
        if (!(x & 0x10)) n++; else return n;
        if (!(x & 0x08)) n++; else return n;
        if (!(x & 0x04)) n++; else return n;
        if (!(x & 0x02)) n++; else return n;
        if (!(x & 0x01)) n++; else return n;
        return n;
    }
    return n;
}

static inline int dna256_leading_ts(const unsigned char *msg, CC_LONG msg_len) {
    unsigned char digest[32];
    CC_SHA256_CTX ctx;
    CC_SHA256_Init(&ctx);
    CC_SHA256_Update(&ctx, POW_DOMAIN, POW_DOMAIN_LEN);
    CC_SHA256_Update(&ctx, msg, msg_len);
    CC_SHA256_Final(digest, &ctx);

    unsigned char masked[32];
    for (int i = 0; i < 32; i++) masked[i] = digest[i] ^ g_mask32[i];
    return count_leading_zero_bits(masked) >> 1;
}

static inline int nonce_nc(uint64_t n) {
    if (n <= 4094ULL)            return 2;
    if (n <= 262142ULL)          return 3;
    if (n <= 16777214ULL)        return 4;
    if (n <= 1073741822ULL)      return 5;
    if (n <= 68719476734ULL)     return 6;
    if (n <= 4398046511102ULL)   return 7;
    return 8;
}

static inline int encode_nonce(uint64_t nonce, char *out) {
    int nc = nonce_nc(nonce);
    uint64_t n = nonce;
    int p = 0;
    for (int i = 0; i < nc; i++) {
        int v = (int)(n % 64); n /= 64;
        memcpy(out + p, CLT[v], 3); p += 3;
    }
    return p;
}

static int u64str(uint64_t n, char *o) {
    if (n == 0) { o[0] = '0'; o[1] = '\0'; return 1; }
    char t[21]; int l = 0;
    while (n) { t[l++] = '0' + (int)(n % 10); n /= 10; }
    for (int i = 0; i < l; i++) o[i] = t[l-1-i];
    o[l] = '\0';
    return l;
}

static int generate_coin_body(char *out) {
    int blen = 0;
    for (int c = 0; c < BODY_CODONS; c++) {
        int v = BVAL[arc4random_uniform((uint32_t)N_BVAL)];
        memcpy(out + blen, CLT[v], 3);
        blen += 3;
    }
    return blen;
}

/* ─── Lock-free-ish queue: candidates found → main thread ──────── */

typedef struct cnode {
    char gene[MAX_GENE];
    int gene_len;
    uint64_t nonce;
    int leading_ts;
    struct cnode *next;
} cnode_t;

static pthread_mutex_t g_qmu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t  g_qcv = PTHREAD_COND_INITIALIZER;
static cnode_t *g_qh = NULL, *g_qt = NULL;

static void q_push(cnode_t *n) {
    pthread_mutex_lock(&g_qmu);
    n->next = NULL;
    if (g_qt) g_qt->next = n; else g_qh = n;
    g_qt = n;
    pthread_cond_signal(&g_qcv);
    pthread_mutex_unlock(&g_qmu);
}

static cnode_t *q_pop(int ms) {
    pthread_mutex_lock(&g_qmu);
    if (!g_qh) {
        struct timespec ts;
        clock_gettime(CLOCK_REALTIME, &ts);
        ts.tv_sec  += ms / 1000;
        ts.tv_nsec += (ms % 1000) * 1000000L;
        if (ts.tv_nsec >= 1000000000L) { ts.tv_sec++; ts.tv_nsec -= 1000000000L; }
        pthread_cond_timedwait(&g_qcv, &g_qmu, &ts);
    }
    cnode_t *r = g_qh;
    if (r) {
        g_qh = r->next;
        if (!g_qh) g_qt = NULL;
    }
    pthread_mutex_unlock(&g_qmu);
    return r;
}

/* ─── Worker thread: search for valid PoW ──────── */

static void *mine_thread(void *arg) {
    (void)arg;
    char buf[MAX_GENE];
    long local = 0;

    while (g_run) {
        /* Fresh random body for this round */
        memcpy(buf, HEADER, HEADER_LEN);
        int blen = HEADER_LEN;
        blen += generate_coin_body(buf + blen);

        int target_ts = atomic_load(&g_leading_ts);

        for (uint64_t nonce = 0; nonce < ROUND_NONCE && g_run; nonce++) {
            int ncl = encode_nonce(nonce, buf + blen);
            int ge  = blen + ncl;
            buf[ge] = 'T'; buf[ge+1] = 'A'; buf[ge+2] = 'A';
            buf[ge+3] = '|';
            char ns[21];
            int nsl = u64str(nonce, ns);
            memcpy(buf + ge + 4, ns, nsl);

            int lts = dna256_leading_ts((const unsigned char *)buf,
                                        (CC_LONG)(ge + 4 + nsl));
            local++;

            if (lts >= target_ts) {
                cnode_t *cn = calloc(1, sizeof(cnode_t));
                if (cn) {
                    memcpy(cn->gene, buf, ge + 3);
                    cn->gene[ge+3] = '\0';
                    cn->gene_len = ge + 3;
                    cn->nonce = nonce;
                    cn->leading_ts = lts;
                    q_push(cn);
                }
            }

            if ((nonce & 0x1FFFF) == 0) {
                atomic_fetch_add(&g_hashes, local);
                local = 0;
                target_ts = atomic_load(&g_leading_ts);
                if (!g_run) break;
            }
        }

        atomic_fetch_add(&g_hashes, local);
        local = 0;
    }
    return NULL;
}

/* ─── stdin control thread ──────── */

static void *stdin_thread(void *arg) {
    (void)arg;
    char line[1024];
    while (fgets(line, sizeof(line), stdin)) {
        const char *p = strstr(line, "\"type\"");
        if (!p) continue;
        if (strstr(line, "\"quit\"")) { g_run = 0; break; }
        if (strstr(line, "\"set-leading-ts\"")) {
            const char *v = strstr(line, "\"value\":");
            if (v) {
                int n = atoi(v + 8);
                if (n > 0 && n < 128) {
                    atomic_store(&g_leading_ts, n);
                    fprintf(stderr, "[miner] leading-ts updated to %d\n", n);
                }
            }
        }
    }
    return NULL;
}

static void on_sig(int s) { (void)s; g_run = 0; }

int main(int argc, char **argv) {
    setvbuf(stdout, NULL, _IOLBF, 0);
    int ncpu = (int)sysconf(_SC_NPROCESSORS_ONLN);
    int nthreads = ncpu > 2 ? ncpu - 1 : 1;
    int leading_ts = 16;

    for (int i = 1; i < argc; i++) {
        if ((!strcmp(argv[i], "--leading-ts") || !strcmp(argv[i], "-t")) && i + 1 < argc) {
            leading_ts = atoi(argv[++i]);
        } else if ((!strcmp(argv[i], "--threads") || !strcmp(argv[i], "-j")) && i + 1 < argc) {
            nthreads = atoi(argv[++i]);
        } else if (!strcmp(argv[i], "--help") || !strcmp(argv[i], "-h")) {
            fprintf(stderr,
                "zcoin-miner-v1 — BioCrypt v1 PoW hot loop\n\n"
                "Usage: zcoin-miner-v1 [--leading-ts N] [--threads N]\n"
                "\n"
                "Emits JSON Lines to stdout; companion biocrypt-mine signs + submits.\n");
            return 0;
        }
    }

    if (leading_ts < 1) leading_ts = 16;
    if (nthreads < 1) nthreads = 1;
    atomic_store(&g_leading_ts, leading_ts);

    init_mask();
    fprintf(stderr, "[miner] starting threads=%d leading-ts=%d (of %d cores)\n",
            nthreads, leading_ts, ncpu);

    signal(SIGINT, on_sig);
    signal(SIGTERM, on_sig);
    signal(SIGPIPE, SIG_IGN);

    pthread_t stdin_tid;
    pthread_create(&stdin_tid, NULL, stdin_thread, NULL);

    pthread_t *tids = malloc(nthreads * sizeof(pthread_t));
    for (int i = 0; i < nthreads; i++)
        pthread_create(&tids[i], NULL, mine_thread, NULL);

    time_t t_start = time(NULL), t_log = t_start;
    long prev_h = 0;

    while (g_run) {
        cnode_t *cn = q_pop(3000);
        if (cn) {
            int c = atomic_fetch_add(&g_coins, 1) + 1;
            printf("{\"type\":\"candidate\",\"gene\":\"%s\",\"nonce\":%llu,\"leadingTs\":%d,\"seq\":%d}\n",
                   cn->gene, (unsigned long long)cn->nonce, cn->leading_ts, c);
            fflush(stdout);
            free(cn);
        }

        time_t now = time(NULL);
        if (now - t_log >= 10) {
            long h = atomic_load(&g_hashes);
            long dh = h - prev_h;
            double dt = difftime(now, t_log);
            long rate = dt > 0 ? (long)(dh / dt) : 0;
            int cc = atomic_load(&g_coins);
            long up = (long)difftime(now, t_start);
            printf("{\"type\":\"stat\",\"hashes\":%ld,\"rate\":%ld,\"coins\":%d,\"uptime\":%ld}\n",
                   h, rate, cc, up);
            fflush(stdout);
            prev_h = h; t_log = now;
        }
    }

    for (int i = 0; i < nthreads; i++) pthread_join(tids[i], NULL);
    free(tids);
    return 0;
}

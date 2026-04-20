/*
 * BioCrypt High-Performance Native Miner (Merkle Block Protocol)
 *
 * Mines blocks of N coins (1 primary + N-1 bonus) with a Merkle root
 * embedded in the primary coin gene. All bonus coins are cryptographically
 * bound to the same proof-of-work.
 *
 * Uses Apple CommonCrypto (hardware-accelerated SHA-256 on Apple Silicon),
 * multi-threaded via pthreads, submits via system curl.
 *
 * Compile:  clang -O3 -o zcoin-miner zcoin-miner.c
 * Run:      ./zcoin-miner
 *           ./zcoin-miner https://www.biocrypt.net/api 9
 */

#include <CommonCrypto/CommonDigest.h>
#include <math.h>
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

/* ─── Constants ─────────────────────────────────────────────── */

#define MAX_GENE    4096
#define MAX_PAYLOAD 8192
#define BODY_CODONS 60       /* 60 codons × 3 = 180 bases */
#define HEADER      "ATGGGGTGGTGC"
#define HEADER_LEN  12
#define ROUND_NONCE 10000000ULL
#define MAX_BONUS   128
#define MERKLE_MARKER "CGACGCCGA"
#define MERKLE_MARKER_LEN 9

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

static const int BVAL[] = {
     0, 1, 2, 3, 4,    6,    8, 9,10,11,12,   14,15,
    16,17,18,   20,21,22,23,24,25,26,27,28,29,30,31,
    32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,
    48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,
};
#define N_BVAL (sizeof(BVAL)/sizeof(BVAL[0]))

/* Hex char to Merkle DNA codon mapping */
static const char HEX_CODONS[16][3] = {
    {'T','T','T'}, {'T','T','C'}, {'T','T','A'}, {'T','T','G'},
    {'T','A','T'}, {'T','A','C'}, {'T','C','T'}, {'T','C','C'},
    {'T','C','A'}, {'T','C','G'}, {'T','G','T'}, {'T','G','C'},
    {'T','G','G'}, {'C','T','T'}, {'C','T','C'}, {'C','T','G'},
};

static int hex_val(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return 0;
}

/* ─── Globals ───────────────────────────────────────────────── */

static unsigned char g_target[32];
static char g_target_hex[65];
static char g_difficulty[65];
static pthread_rwlock_t g_trw = PTHREAD_RWLOCK_INITIALIZER;

static _Atomic long g_hashes = 0;
static _Atomic int  g_coins  = 0;
static volatile sig_atomic_t g_run = 1;

static _Atomic int g_reward = 1;

static char g_api[512]   = "https://www.biocrypt.net/api";
static char g_out[256]   = "zcoin-mined.jsonl";

/* ─── Coin queue ────────────────────────────────────────────── */

typedef struct bonus_info {
    char gene[MAX_GENE];
    int  gene_len;
    char proof_json[4096];
} bonus_info_t;

typedef struct cnode {
    char gene[MAX_GENE];
    int  gene_len;
    uint64_t nonce;
    char hash[65];
    char diff[65];
    int  bonus_count;
    bonus_info_t *bonuses;
    struct cnode *next;
} cnode_t;

static cnode_t *g_q = NULL;
static pthread_mutex_t g_ql = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t  g_qc = PTHREAD_COND_INITIALIZER;

static void q_push(cnode_t *n) {
    pthread_mutex_lock(&g_ql);
    n->next = g_q; g_q = n;
    pthread_cond_signal(&g_qc);
    pthread_mutex_unlock(&g_ql);
}

static cnode_t *q_pop(int ms) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    ts.tv_sec  += ms / 1000;
    ts.tv_nsec += (ms % 1000) * 1000000L;
    if (ts.tv_nsec >= 1000000000L) { ts.tv_sec++; ts.tv_nsec -= 1000000000L; }
    pthread_mutex_lock(&g_ql);
    while (!g_q && g_run) {
        if (pthread_cond_timedwait(&g_qc, &g_ql, &ts) != 0) break;
    }
    cnode_t *n = g_q;
    if (n) g_q = n->next;
    pthread_mutex_unlock(&g_ql);
    return n;
}

/* ─── Helpers ───────────────────────────────────────────────── */

static const char HX[] = "0123456789abcdef";

static void to_hex(const unsigned char *b, int n, char *o) {
    for (int i = 0; i < n; i++) {
        o[i*2]   = HX[b[i] >> 4];
        o[i*2+1] = HX[b[i] & 0xf];
    }
    o[n*2] = '\0';
}

static void from_hex(const char *h, unsigned char *o, int bytes) {
    for (int i = 0; i < bytes; i++) {
        unsigned v;
        sscanf(h + i*2, "%2x", &v);
        o[i] = (unsigned char)v;
    }
}

static void sha256_str(const char *input, int len, char *out_hex) {
    unsigned char hash[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(input, (CC_LONG)len, hash);
    to_hex(hash, 32, out_hex);
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

/* ─── Merkle tree ──────────────────────────────────────────── */

static void merkle_root(char leaves[][65], int count, char *root_out) {
    if (count == 0) { sha256_str("", 0, root_out); return; }
    char (*layer)[65] = malloc(count * 65);
    for (int i = 0; i < count; i++) {
        char prefixed[68];
        snprintf(prefixed, sizeof(prefixed), "L:%s", leaves[i]);
        sha256_str(prefixed, (int)strlen(prefixed), layer[i]);
    }
    int sz = count;
    char (*next_layer)[65] = malloc(((count + 1) / 2) * 65);

    while (sz > 1) {
        int nsz = 0;
        for (int i = 0; i < sz; i += 2) {
            char combined[134];
            snprintf(combined, sizeof(combined), "N:%s%s",
                     layer[i], (i + 1 < sz) ? layer[i + 1] : layer[i]);
            sha256_str(combined, (int)strlen(combined), next_layer[nsz]);
            nsz++;
        }
        char (*tmp)[65] = layer;
        layer = next_layer;
        next_layer = tmp;
        sz = nsz;
    }
    strcpy(root_out, layer[0]);
    free(layer);
    free(next_layer);
}

/* Build Merkle proof for a specific leaf index as JSON array string */
static void merkle_proof_json(char leaves[][65], int count, int index, char *json_out, int json_max) {
    if (count <= 1) { strcpy(json_out, "[]"); return; }

    typedef struct { char hash[65]; int position; } step_t;
    step_t steps[32];
    int nsteps = 0;

    char (*layer)[65] = malloc(count * 65);
    for (int i = 0; i < count; i++) {
        char prefixed[68];
        snprintf(prefixed, sizeof(prefixed), "L:%s", leaves[i]);
        sha256_str(prefixed, (int)strlen(prefixed), layer[i]);
    }
    int sz = count;
    int idx = index;
    char (*next_layer)[65] = malloc(((count + 1) / 2) * 65);

    while (sz > 1) {
        int nsz = 0;
        for (int i = 0; i < sz; i += 2) {
            char combined[134];
            snprintf(combined, sizeof(combined), "N:%s%s",
                     layer[i], (i + 1 < sz) ? layer[i + 1] : layer[i]);
            sha256_str(combined, (int)strlen(combined), next_layer[nsz]);

            if (i == idx || i + 1 == idx) {
                if (idx % 2 == 0) {
                    strcpy(steps[nsteps].hash, (i + 1 < sz) ? layer[i + 1] : layer[i]);
                    steps[nsteps].position = 1; /* right */
                } else {
                    strcpy(steps[nsteps].hash, layer[i]);
                    steps[nsteps].position = 0; /* left */
                }
                nsteps++;
            }
            nsz++;
        }
        char (*tmp)[65] = layer;
        layer = next_layer;
        next_layer = tmp;
        sz = nsz;
        idx = idx / 2;
    }
    free(layer);
    free(next_layer);

    int pos = 0;
    pos += snprintf(json_out + pos, json_max - pos, "[");
    for (int i = 0; i < nsteps; i++) {
        if (i > 0) pos += snprintf(json_out + pos, json_max - pos, ",");
        pos += snprintf(json_out + pos, json_max - pos,
            "{\"hash\":\"%s\",\"position\":\"%s\"}",
            steps[i].hash, steps[i].position ? "right" : "left");
    }
    snprintf(json_out + pos, json_max - pos, "]");
}

static int encode_merkle_root_as_dna(const char *root_hex, char *out) {
    memcpy(out, MERKLE_MARKER, MERKLE_MARKER_LEN);
    int p = MERKLE_MARKER_LEN;
    for (int i = 0; i < 64; i++) {
        int v = hex_val(root_hex[i]);
        memcpy(out + p, HEX_CODONS[v], 3);
        p += 3;
    }
    return p; /* 9 + 192 = 201 */
}

/* ─── Mining thread ─────────────────────────────────────────── */

static void *mine_thread(void *arg) {
    (void)arg;
    char buf[MAX_PAYLOAD];
    unsigned char hash[CC_SHA256_DIGEST_LENGTH];
    unsigned char tgt[32];
    long local = 0;

    while (g_run) {
        int reward = atomic_load(&g_reward);

        pthread_rwlock_rdlock(&g_trw);
        memcpy(tgt, g_target, 32);
        pthread_rwlock_unlock(&g_trw);

        if (reward <= 1) {
            /* Single coin — no Merkle needed */
            memcpy(buf, HEADER, HEADER_LEN);
            int blen = HEADER_LEN;
            blen += generate_coin_body(buf + blen);

            for (uint64_t nonce = 0; nonce < ROUND_NONCE && g_run; nonce++) {
                int ncl = encode_nonce(nonce, buf + blen);
                int ge  = blen + ncl;
                buf[ge] = 'T'; buf[ge+1] = 'A'; buf[ge+2] = 'A';
                buf[ge+3] = '|';
                char ns[21];
                int nsl = u64str(nonce, ns);
                memcpy(buf + ge + 4, ns, nsl);

                CC_SHA256(buf, (CC_LONG)(ge + 4 + nsl), hash);
                local++;

                if (memcmp(hash, tgt, 32) <= 0) {
                    cnode_t *cn = calloc(1, sizeof(cnode_t));
                    if (cn) {
                        memcpy(cn->gene, buf, ge + 3);
                        cn->gene[ge+3] = '\0';
                        cn->gene_len = ge + 3;
                        cn->nonce = nonce;
                        to_hex(hash, 32, cn->hash);
                        pthread_rwlock_rdlock(&g_trw);
                        strcpy(cn->diff, g_difficulty);
                        pthread_rwlock_unlock(&g_trw);
                        cn->bonus_count = 0;
                        cn->bonuses = NULL;
                        q_push(cn);
                    }
                }

                if ((nonce & 0x1FFFF) == 0) {
                    atomic_fetch_add(&g_hashes, local);
                    local = 0;
                    if (!g_run) break;
                }
            }
        } else {
            /* Multi-coin block with Merkle root */
            int bc = (reward - 1 < MAX_BONUS) ? reward - 1 : MAX_BONUS;

            /* Generate bonus coin genes */
            typedef struct { char gene[MAX_GENE]; int len; } bgene_t;
            bgene_t *bonus_genes = malloc(bc * sizeof(bgene_t));

            for (int i = 0; i < bc; i++) {
                memcpy(bonus_genes[i].gene, HEADER, HEADER_LEN);
                int bl = HEADER_LEN;
                bl += generate_coin_body(bonus_genes[i].gene + bl);
                bonus_genes[i].gene[bl] = 'T'; bonus_genes[i].gene[bl+1] = 'A'; bonus_genes[i].gene[bl+2] = 'A';
                bonus_genes[i].gene[bl+3] = '\0';
                bonus_genes[i].len = bl + 3;
            }

            /* Generate primary body */
            char primary_body[256];
            int pblen = generate_coin_body(primary_body);

            /* Compute Merkle leaves: primary leaf = sha256(HEADER + body), bonus leaf = sha256(gene) */
            int leaf_count = 1 + bc;
            char (*leaves)[65] = malloc(leaf_count * 65);

            char primary_prefix[HEADER_LEN + 256];
            memcpy(primary_prefix, HEADER, HEADER_LEN);
            memcpy(primary_prefix + HEADER_LEN, primary_body, pblen);
            sha256_str(primary_prefix, HEADER_LEN + pblen, leaves[0]);

            for (int i = 0; i < bc; i++) {
                sha256_str(bonus_genes[i].gene, bonus_genes[i].len, leaves[i + 1]);
            }

            char root_hex[65];
            merkle_root(leaves, leaf_count, root_hex);

            /* Build primary base: HEADER + body + merkle_root_dna */
            memcpy(buf, HEADER, HEADER_LEN);
            memcpy(buf + HEADER_LEN, primary_body, pblen);
            int blen = HEADER_LEN + pblen;
            blen += encode_merkle_root_as_dna(root_hex, buf + blen);

            for (uint64_t nonce = 0; nonce < ROUND_NONCE && g_run; nonce++) {
                int ncl = encode_nonce(nonce, buf + blen);
                int ge  = blen + ncl;
                buf[ge] = 'T'; buf[ge+1] = 'A'; buf[ge+2] = 'A';
                buf[ge+3] = '|';
                char ns[21];
                int nsl = u64str(nonce, ns);
                memcpy(buf + ge + 4, ns, nsl);

                CC_SHA256(buf, (CC_LONG)(ge + 4 + nsl), hash);
                local++;

                if (memcmp(hash, tgt, 32) <= 0) {
                    cnode_t *cn = calloc(1, sizeof(cnode_t));
                    if (cn) {
                        memcpy(cn->gene, buf, ge + 3);
                        cn->gene[ge+3] = '\0';
                        cn->gene_len = ge + 3;
                        cn->nonce = nonce;
                        to_hex(hash, 32, cn->hash);
                        pthread_rwlock_rdlock(&g_trw);
                        strcpy(cn->diff, g_difficulty);
                        pthread_rwlock_unlock(&g_trw);

                        cn->bonus_count = bc;
                        cn->bonuses = malloc(bc * sizeof(bonus_info_t));
                        for (int i = 0; i < bc; i++) {
                            memcpy(cn->bonuses[i].gene, bonus_genes[i].gene, bonus_genes[i].len + 1);
                            cn->bonuses[i].gene_len = bonus_genes[i].len;
                            merkle_proof_json(leaves, leaf_count, i + 1, cn->bonuses[i].proof_json, 4096);
                        }
                        q_push(cn);
                    }
                }

                if ((nonce & 0x1FFFF) == 0) {
                    atomic_fetch_add(&g_hashes, local);
                    local = 0;
                    if (!g_run) break;
                }
            }

            free(bonus_genes);
            free(leaves);
        }

        atomic_fetch_add(&g_hashes, local);
        local = 0;
    }
    return NULL;
}

/* ─── HTTP via system curl + temp file ─────────────────────── */

static char *read_file(const char *path) {
    FILE *f = fopen(path, "r");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    if (sz <= 0) { fclose(f); return NULL; }
    fseek(f, 0, SEEK_SET);
    char *buf = malloc(sz + 1);
    if (!buf) { fclose(f); return NULL; }
    size_t rd = fread(buf, 1, sz, f);
    buf[rd] = '\0';
    fclose(f);
    return buf;
}

static char *hget(const char *url) {
    char tmp[] = "/tmp/zcoin-rXXXXXX";
    int fd = mkstemp(tmp); close(fd);
    char cmd[1024];
    snprintf(cmd, sizeof(cmd),
        "/usr/bin/curl -s --max-time 15 '%s' -o '%s' 2>/dev/null", url, tmp);
    int rc = system(cmd);
    char *result = NULL;
    if (rc == 0) result = read_file(tmp);
    unlink(tmp);
    return result;
}

static char *hpost_file(const char *url, const char *body_file, const char *resp_file) {
    char cmd[1024];
    snprintf(cmd, sizeof(cmd),
        "/usr/bin/curl -s --max-time 30 -X POST -H 'Content-Type: application/json' "
        "-d @'%s' '%s' -o '%s' 2>/dev/null", body_file, url, resp_file);
    int rc = system(cmd);
    char *result = NULL;
    if (rc == 0) result = read_file(resp_file);
    return result;
}

/* Minimal JSON field extraction */
static int jstr(const char *j, const char *key, char *o, int mx) {
    char pat[128]; snprintf(pat, 128, "\"%s\":\"", key);
    const char *p = strstr(j, pat);
    if (!p) return 0;
    p += strlen(pat);
    int i = 0;
    while (*p && *p != '"' && i < mx - 1) o[i++] = *p++;
    o[i] = '\0';
    return 1;
}

static int jint(const char *j, const char *key, int *o) {
    char pat[128]; snprintf(pat, 128, "\"%s\":", key);
    const char *p = strstr(j, pat);
    if (!p) return 0;
    p += strlen(pat);
    while (*p == ' ') p++;
    *o = atoi(p);
    return 1;
}

static double jdbl(const char *j, const char *key) {
    char pat[128]; snprintf(pat, 128, "\"%s\":", key);
    const char *p = strstr(j, pat);
    if (!p) return 0;
    p += strlen(pat);
    while (*p == ' ') p++;
    return atof(p);
}

static int jbool(const char *j, const char *key) {
    char pat[128]; snprintf(pat, 128, "\"%s\":", key);
    const char *p = strstr(j, pat);
    if (!p) return 0;
    p += strlen(pat);
    while (*p == ' ') p++;
    return strncmp(p, "true", 4) == 0;
}

/* ─── macOS notification (streams to iPhone via iCloud) ────── */

static char g_sound_path[512] = "";

static void notify_block(int block_num, int reward, double telomere,
                         const char *era, const char *hash) {
    char subtitle[128], body[256];
    snprintf(subtitle, sizeof(subtitle),
        "Block #%d Mined — %d ZBIO", block_num, reward);
    snprintf(body, sizeof(body),
        "Hash: %.16s...  Era: %s  Telomere: %.2f%%",
        hash[0] ? hash : "?", era, telomere);

    char cmd[2048];
    snprintf(cmd, sizeof(cmd),
        "terminal-notifier -title 'BioCrypt Miner' "
        "-subtitle '%s' -message '%s' "
        "-sound default -group biocrypt "
        "-open 'https://www.biocrypt.net' "
        "2>/dev/null &",
        subtitle, body);
    system(cmd);

    if (g_sound_path[0]) {
        char scmd[600];
        snprintf(scmd, sizeof(scmd), "/usr/bin/afplay '%s' &", g_sound_path);
        system(scmd);
    }
}

/* ─── Signal / formatting ───────────────────────────────────── */

static void on_sig(int s) { (void)s; g_run = 0; }

static const char *fmtrate(long r) {
    static __thread char b[32];
    if (r >= 1000000) snprintf(b, 32, "%.2f MH/s", r / 1e6);
    else if (r >= 1000) snprintf(b, 32, "%.1f kH/s", r / 1e3);
    else snprintf(b, 32, "%ld H/s", r);
    return b;
}

/* ─── Main ──────────────────────────────────────────────────── */

int main(int argc, char **argv) {
    setvbuf(stdout, NULL, _IOLBF, 0);
    int ncpu = (int)sysconf(_SC_NPROCESSORS_ONLN);
    int nthreads = ncpu > 2 ? ncpu - 1 : 1;

    if (argc > 1) strncpy(g_api, argv[1], sizeof(g_api) - 1);
    if (argc > 2) nthreads = atoi(argv[2]);
    if (nthreads < 1) nthreads = 1;

    printf("\n");
    printf("  \033[32m╔══════════════════════════════════════════════╗\033[0m\n");
    printf("  \033[32m║\033[0m   BioCrypt Native Miner (Merkle Protocol)    \033[32m║\033[0m\n");
    printf("  \033[32m╚══════════════════════════════════════════════╝\033[0m\n\n");
    printf("  API:     %s\n", g_api);
    printf("  Threads: \033[1m%d\033[0m (of %d cores)\n", nthreads, ncpu);
    printf("  Output:  %s\n\n", g_out);

    /* ── Sound file detection ──────────── */
    {
        const char *exts[] = { ".mp3", ".aiff", ".m4a", ".wav", NULL };
        for (int i = 0; exts[i] && !g_sound_path[0]; i++) {
            char path[512];
            snprintf(path, sizeof(path), "zcoin-mined%s", exts[i]);
            if (access(path, R_OK) == 0) {
                realpath(path, g_sound_path);
            }
        }
        if (g_sound_path[0])
            printf("  Notify:  \033[32mmacOS + iCloud\033[0m  Sound: %s\n\n",
                   strrchr(g_sound_path, '/') ? strrchr(g_sound_path, '/') + 1 : g_sound_path);
        else
            printf("  Notify:  \033[32mmacOS + iCloud\033[0m  Sound: default\n\n");
    }

    /* ── Fetch difficulty ──────────── */

    char url[600];
    snprintf(url, sizeof(url), "%s/mine/difficulty", g_api);
    printf("  Connecting to network...\n");

    char *resp = NULL;
    for (int attempt = 0; g_run; attempt++) {
        resp = hget(url);
        if (resp && strlen(resp) > 10) break;
        free(resp); resp = NULL;
        printf("  \033[33mRetrying in 5s...\033[0m\n");
        sleep(5);
    }
    if (!resp || !g_run) { printf("  Aborted.\n"); return 1; }
    printf("  \033[32mConnected!\033[0m\n\n");

    char tgt_hex[65] = {0}, diff[65] = {0}, era[64] = {0}, nid[64] = {0};
    int reward = 0;

    jstr(resp, "target", tgt_hex, 65);
    jstr(resp, "difficulty", diff, 65);
    jstr(resp, "halvingEraName", era, 64);
    jstr(resp, "networkId", nid, 64);
    jint(resp, "currentReward", &reward);

    if (jbool(resp, "supplyExhausted")) {
        printf("  Supply exhausted — all 21M coins mined.\n");
        free(resp); return 0;
    }
    free(resp);

    if (strlen(tgt_hex) != 64) {
        printf("  \033[31mInvalid target: '%s'\033[0m\n", tgt_hex);
        return 1;
    }

    pthread_rwlock_wrlock(&g_trw);
    from_hex(tgt_hex, g_target, 32);
    strcpy(g_target_hex, tgt_hex);
    strcpy(g_difficulty, diff);
    pthread_rwlock_unlock(&g_trw);

    if (reward < 1) reward = 1;
    atomic_store(&g_reward, reward);

    printf("  Network:    %s\n", nid);
    printf("  Difficulty: \033[1;33m%s\033[0m (%lu leading zeros)\n", diff, strlen(diff));
    printf("  Target:     %.*s...\n", 16, tgt_hex);
    printf("  Reward:     \033[1;32m%d\033[0m coins/block  |  Era: %s\n", reward, era);
    if (reward > 1)
        printf("  Protocol:   \033[1;36mMerkle Block\033[0m (1 primary + %d bonus, cryptographically bound)\n", reward - 1);
    printf("\n  \033[1mMining started. Press Ctrl+C to stop.\033[0m\n\n");

    signal(SIGINT, on_sig);
    signal(SIGTERM, on_sig);

    /* ── Spawn workers ──────────── */

    pthread_t *tids = malloc(nthreads * sizeof(pthread_t));
    for (int i = 0; i < nthreads; i++)
        pthread_create(&tids[i], NULL, mine_thread, NULL);

    /* ── Main loop: process coins + stats ──────────── */

    time_t t_start = time(NULL), t_log = t_start, t_refresh = t_start;
    long prev_h = 0;

    while (g_run) {
        cnode_t *cn = q_pop(3000);

        if (cn) {
            int c = atomic_fetch_add(&g_coins, 1) + 1;
            printf("  \033[1;32m★ BLOCK #%d FOUND!\033[0m  nonce=%llu  hash=%.16s...  coins=%d\n",
                   c, (unsigned long long)cn->nonce, cn->hash, 1 + cn->bonus_count);

            /* Build submit JSON body */
            char body_tmp[] = "/tmp/zcoin-bXXXXXX";
            int bfd = mkstemp(body_tmp);
            if (bfd >= 0) {
                FILE *bf = fdopen(bfd, "w");
                fprintf(bf, "{\"coinGene\":\"%s\",\"nonce\":%llu,\"hash\":\"%s\",\"difficulty\":\"%s\"",
                        cn->gene, (unsigned long long)cn->nonce, cn->hash, cn->diff);

                if (cn->bonus_count > 0 && cn->bonuses) {
                    fprintf(bf, ",\"bonusCoinGenes\":[");
                    for (int i = 0; i < cn->bonus_count; i++) {
                        if (i > 0) fprintf(bf, ",");
                        fprintf(bf, "{\"coinGene\":\"%s\",\"merkleProof\":%s}",
                                cn->bonuses[i].gene, cn->bonuses[i].proof_json);
                    }
                    fprintf(bf, "]");
                }
                fprintf(bf, "}");
                fclose(bf);

                char resp_tmp[] = "/tmp/zcoin-rXXXXXX";
                int rfd = mkstemp(resp_tmp); close(rfd);

                snprintf(url, sizeof(url), "%s/mine/submit", g_api);
                char *sr = hpost_file(url, body_tmp, resp_tmp);
                unlink(body_tmp);
                unlink(resp_tmp);

                if (sr && strlen(sr) > 10) {
                    FILE *f = fopen(g_out, "a");
                    if (f) { fprintf(f, "%s\n", sr); fclose(f); }

                    char serial[128] = {0}, sn_era[64] = {0};
                    int br = 0;
                    jstr(sr, "serialHash", serial, 128);
                    jstr(sr, "halvingEraName", sn_era, 64);
                    jint(sr, "blockReward", &br);
                    double telo = jdbl(sr, "telomerePercent");
                    int merkle_ok = jbool(sr, "merkleVerified");

                    printf("  \033[32m✓ SIGNED\033[0m  serial=%.16s...  reward=%d  %s  era=%s  telomere=%.2f%%\n",
                           serial[0] ? serial : "?", br,
                           merkle_ok ? "\033[36mMerkle✓\033[0m" : "",
                           sn_era, telo);

                    notify_block(c, br, telo, sn_era, cn->hash);

                    if (jbool(sr, "difficultyAdjusted")) {
                        char nt[65] = {0}, nd[65] = {0};
                        jstr(sr, "currentTarget", nt, 65);
                        jstr(sr, "currentDifficulty", nd, 65);
                        if (strlen(nt) == 64) {
                            printf("  \033[33m⚡ Difficulty adjusted → %s (%lu zeros)\033[0m\n", nd, strlen(nd));
                            pthread_rwlock_wrlock(&g_trw);
                            from_hex(nt, g_target, 32);
                            strcpy(g_target_hex, nt);
                            strcpy(g_difficulty, nd);
                            pthread_rwlock_unlock(&g_trw);
                        }
                    }
                    if (br > 0) atomic_store(&g_reward, br);
                    free(sr);
                } else {
                    printf("  \033[31m✗ Submit failed — coin saved locally\033[0m\n");
                    free(sr);
                    FILE *f = fopen(g_out, "a");
                    if (f) {
                        fprintf(f, "{\"unsent\":true,\"coinGene\":\"%s\",\"nonce\":%llu,\"hash\":\"%s\",\"difficulty\":\"%s\"}\n",
                                cn->gene, (unsigned long long)cn->nonce, cn->hash, cn->diff);
                        fclose(f);
                    }
                }
            }
            if (cn->bonuses) free(cn->bonuses);
            free(cn);
        }

        /* Stats */
        time_t now = time(NULL);
        if (now - t_log >= 10) {
            long h = atomic_load(&g_hashes);
            long dh = h - prev_h;
            double dt = difftime(now, t_log);
            long rate = dt > 0 ? (long)(dh / dt) : 0;
            int cc = atomic_load(&g_coins);
            long up = (long)difftime(now, t_start);
            printf("  %s  |  %ld total  |  %d blocks  |  %02ld:%02ld:%02ld\n",
                   fmtrate(rate), h, cc, up/3600, (up%3600)/60, up%60);
            prev_h = h; t_log = now;
        }

        /* Difficulty refresh every 60s */
        if (now - t_refresh >= 60) {
            snprintf(url, sizeof(url), "%s/mine/difficulty", g_api);
            char *dr = hget(url);
            if (dr) {
                char nt[65] = {0}, nd[65] = {0};
                jstr(dr, "target", nt, 65);
                jstr(dr, "difficulty", nd, 65);
                if (strlen(nt) == 64 && strcmp(nt, g_target_hex) != 0) {
                    printf("  \033[33m⚡ Difficulty update: %s (%lu zeros)\033[0m\n", nd, strlen(nd));
                    pthread_rwlock_wrlock(&g_trw);
                    from_hex(nt, g_target, 32);
                    strcpy(g_target_hex, nt);
                    strcpy(g_difficulty, nd);
                    pthread_rwlock_unlock(&g_trw);
                }
                int new_reward = 0;
                if (jint(dr, "currentReward", &new_reward) && new_reward > 0) {
                    atomic_store(&g_reward, new_reward);
                }
                if (jbool(dr, "supplyExhausted")) {
                    printf("  Supply exhausted!\n");
                    g_run = 0;
                }
                free(dr);
            }
            t_refresh = now;
        }
    }

    /* ── Shutdown ──────────── */

    printf("\n  Shutting down...\n");
    for (int i = 0; i < nthreads; i++) pthread_join(tids[i], NULL);

    long h = atomic_load(&g_hashes);
    int cc = atomic_load(&g_coins);
    long up = (long)difftime(time(NULL), t_start);
    printf("  \033[1mTotal: %ld hashes, %d blocks, %ld seconds\033[0m\n\n", h, cc, up);

    free(tids);
    return 0;
}

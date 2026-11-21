import sys, re, json, collections
data = sys.stdin.buffer.read().decode('utf-8', 'replace')
rows = [r.split('\x1f') for r in data.split('\x1e') if r.strip()]
words_re = re.compile(r"[\wÀ-ÿ]+", re.U)
arts = []
for r in rows:
    if len(r) < 4: continue
    aid, lei, n, text = r[0].strip(), r[1], int(r[2]), r[3]
    w = [x.lower() for x in words_re.findall(text)]
    sh = set(tuple(w[i:i+5]) for i in range(max(0, len(w)-4)))
    arts.append(dict(id=aid, lei=lei, n=n, words=len(w), sh=sh))
by_lei = collections.defaultdict(list)
for a in arts: by_lei[a['lei']].append(a)
def jacc(a, b):
    if not a['sh'] or not b['sh']: return 0.0
    i = len(a['sh'] & b['sh']);  return i / len(a['sh'] | b['sh']) if i else 0.0
for lei, lst in by_lei.items():
    for a in lst: a['maxsim'] = 0.0
    for i in range(len(lst)):
        for j in range(i+1, len(lst)):
            s = jacc(lst[i], lst[j])
            if s > lst[i]['maxsim']: lst[i]['maxsim'] = s
            if s > lst[j]['maxsim']: lst[j]['maxsim'] = s
ok_words = [a for a in arts if a['words'] >= 250]
ok_all = [a for a in ok_words if a['maxsim'] < 0.5]
per_lei = collections.Counter(a['lei'] for a in ok_all)
out = dict(artigos_3q=len(arts), com_250_palavras=len(ok_words), com_250_e_sim_lt_05=len(ok_all),
           leis_com_10_artigos_indexaveis=sum(1 for v in per_lei.values() if v >= 10),
           top_leis=per_lei.most_common(12),
           mediana_palavras=sorted(a['words'] for a in arts)[len(arts)//2] if arts else 0,
           sim_ge_05=sum(1 for a in ok_words if a['maxsim'] >= 0.5))
print(json.dumps(out, ensure_ascii=False))

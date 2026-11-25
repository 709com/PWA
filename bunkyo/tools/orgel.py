# このファイルは、文京区歌のオルゴール版（試作）の音を、計算だけで作る道具です。録音や既存の音源は使いません。
# 使い方： python3 bunkyo/tools/orgel.py 出力先.wav
#
# 旋律（MELODY）：弘田龍太郎 作曲「文京区歌」（昭和26年制定。著作権は消滅。JASRAC作品コード 075-4363-8）。
#   区が公開している楽譜の「歌の段」だけを目で読み取ったもの。旋律は変えない。読み違いがないか、耳での確認が要る。
# 伴奏（CHORDS と分散和音）：このアプリのために新しく作ったもの。区の楽譜のピアノ伴奏（編曲）は使っていない。
# 速さ：楽譜は1分間に112拍。寝かしつけ用に、1回目は60拍、2回目は56拍で鳴らす（2回目は音も小さくする）。
#   根拠：眠りのための音楽は「1分間に60〜80拍・やわらかく・なめらか・単純」が最もよく支持されている（2025年の総説。主に大人の研究）。
#   赤ちゃんは、ゆっくりした子守唄で心拍が下がることが確かめられている（ハーバード大の研究など）。
#   「赤ちゃんには何拍が最適」と数字で確かめた研究は見つからなかったため、範囲のいちばん遅い側に置いた。
# 伴奏は1拍に1音だけ（ゆっくりした脈のように）。高い「チン」という成分は弱め、音の立ち上がりもやわらかくした。
import sys, wave
import numpy as np

SR = 44100
ROUNDS = [(60, 1.0), (56, 0.72)]   # （1分間の拍数, 音の大きさ）を、くり返しの回ごとに
N = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(name): return 12 * (int(name[-1]) + 1) + N[name[0]]

# 歌の旋律。1小節＝8（16分音符8つ）。'R' は休み。数字は長さ。
MELODY = '''
G4 3 E4 1 C4 2 D4 2 | E4 3 E4 1 D4 4 | E4 3 F4 1 G4 2 A4 2 | G4 4 R 4 |
A4 3 B4 1 C5 2 A4 2 | G4 3 G4 1 A4 2 A4 2 | G4 3 E4 1 C4 2 D4 2 | E4 2 R 2 D4 3 D4 1 |
E4 6 D4 2 | C4 3 E4 1 G4 4 | A4 3 A4 1 G4 2 E4 2 | G4 4 R 4 |
C5 3 C5 1 A4 2 G4 2 | E4 3 E4 1 G4 4 | D4 3 D4 1 E4 2 D4 2 | C4 2 R 2 G4 4 |
C5 6 B4 2 | A4 4 C5 4 | G4 6 A4 2 | G4 4 A4 4 |
G4 6 E4 2 | C4 3 D4 1 E4 4 | D4 8 | D4+ 4 D4 4 |
E4 6 D4 2 | C4 4 E4 4 | G4 6 G4 2 | E4 4 R 4 |
G4 4 C5 4 | B4 6 C5 2 | D5 8 | D5+ 4 C5 3 C5 1 |
A4 6 G4 2 | C5 3 C5 1 D5 2 D5 2 | E5 4 D5 2 C5 2 | D5 4 E5 3 D5 1 |
C5 6 A4 2 | G4 3 G4 1 A4 2 G4 2 | A4 3 A4 1 D5 4 | C5 4 R 4
'''
# 新しく作った伴奏の和音（1小節に2つ）
CHORDS = '''C C|C G|C C|C C| F F|C F|C C|C G| C C|C C|F C|C C| F C|C C|G G|C C|
C C|F F|C C|C F| C C|C C|G G|G G| C G|Am C|G G|C C| C C|G G|G G|G C| F C|C G|C C|G G| F F|C C|Dm G|C C'''
TONES = {'C': 'C4 E4 G4', 'G': 'G3 B3 D4', 'F': 'F3 A3 C4', 'Am': 'A3 C4 E4', 'Dm': 'D4 F4 A4'}

def tine(m, dur, vol):
    """オルゴールの櫛歯1本の音：倍音を重ね、はじいた瞬間から静かに消えていく"""
    f = 440 * 2 ** ((m - 69) / 12)
    t = np.arange(int(SR * dur)) / SR
    life = 1.6 * (523 / f) ** 0.35          # 低い音ほど長く響く
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / life)
         + 0.22 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / (life * 0.40))
         + 0.05 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / (life * 0.20))
         + 0.025 * np.sin(2 * np.pi * 5.43 * f * t) * np.exp(-t / 0.04))   # はじく瞬間の「チン」
    s[:260] *= np.linspace(0, 1, 260)        # 立ち上がりをやわらかく
    return vol * s

def build():
    bars = [b.split() for b in MELODY.replace('\n', ' ').split('|')]
    chords = [c.split() for c in CHORDS.replace('\n', '').split('|')]
    assert len(bars) == len(chords) == 40
    notes = []                                 # （鳴らす時刻・秒, 音の高さ, 強さ）
    t0 = 0.0
    for r, (bpm, vol) in enumerate(ROUNDS):
        U = 60 / bpm / 4                       # 16分音符1つの長さ（秒）
        last = r == len(ROUNDS) - 1
        intro = [['C', 'C'], ['G', 'G']] if r == 0 else [['C', 'C']]   # 前奏・つなぎ（新しく作ったもの）
        events = []
        pos = len(intro) * 8
        for b in bars:
            assert sum(int(x) for x in b[1::2]) == 8, b
            for name, n in zip(b[0::2], b[1::2]):
                if name != 'R' and not name.endswith('+'):      # '+' は前の音をのばす印（タイ）
                    events.append((pos, midi(name) + 12, 1.0))  # 旋律は1オクターブ上で鳴らす
                pos += int(n)
        for i, (x, y) in enumerate(intro + chords):             # 伴奏：1拍に1音
            a, b2 = [midi(k) for k in TONES[x].split()], [midi(k) for k in TONES[y].split()]
            events.append((i * 8, a[0] + 12, 0.30))
            events.append((i * 8 + 4, (b2[2] if x == y else b2[0]) + 12, 0.24))
        end = pos
        if last:
            for j, m in enumerate([midi('C4'), midi('G4'), midi('E5')]):   # 結びの和音
                events.append((end + j * 0.7, m + 12, 0.4))
        def when(p):                           # 最後の回の終わり2小節は、さらにゆっくり
            slow = max(0.0, p - (end - 16)) if last else 0.0
            return p * U + U * 0.014 * slow * slow
        notes += [(t0 + when(p), m, v * vol) for p, m, v in events]
        t0 += when(end)
    out = np.zeros(int(SR * (t0 + 9)))
    for t, m, v in notes:
        s = tine(m, 5.0, v); i = int(t * SR); out[i:i + len(s)] += s[:len(out) - i]
    # 箱の響きを少しだけ足す
    wet = np.zeros_like(out)
    for d, g in [(0.031, 0.25), (0.047, 0.18), (0.083, 0.12), (0.127, 0.08)]:
        k = int(d * SR); wet[k:] += out[:-k] * g
    out = out + wet
    fade = int(SR * 4); out[-fade:] *= np.linspace(1, 0, fade)
    return out / np.max(np.abs(out)) * 0.8

if __name__ == '__main__':
    data = (build() * 32767).astype('<i2')
    with wave.open(sys.argv[1], 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    print('できました：', sys.argv[1], round(len(data) / SR), '秒')

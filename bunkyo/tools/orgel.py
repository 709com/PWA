# このファイルは、文京区歌のオルゴール版（試作）の音を、計算だけで作る道具です。録音や既存の音源は使いません。
# 使い方： python3 bunkyo/tools/orgel.py 出力先.wav
#
# 旋律（MELODY）：弘田龍太郎 作曲「文京区歌」（昭和26年制定。著作権は消滅。JASRAC作品コード 075-4363-8）。
#   区が公開している楽譜の「歌の段」だけを目で読み取ったもの。旋律は変えない。読み違いがないか、耳での確認が要る。
# 伴奏（CHORDS と分散和音）：このアプリのために新しく作ったもの。区の楽譜のピアノ伴奏（編曲）は使っていない。
# 速さ：楽譜は1分間に112拍。寝かしつけ用に、ゆったり（72拍）で鳴らす。
import sys, wave
import numpy as np

SR = 44100
BPM = 72
U = 60 / BPM / 4          # 16分音符1つの長さ（秒）
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
         + 0.30 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / (life * 0.45))
         + 0.10 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / (life * 0.25))
         + 0.07 * np.sin(2 * np.pi * 5.43 * f * t) * np.exp(-t / 0.05))   # はじく瞬間の「チン」
    s[:60] *= np.linspace(0, 1, 60)
    return vol * s

def build():
    bars = [b.split() for b in MELODY.replace('\n', ' ').split('|')]
    chords = [c.split() for c in CHORDS.replace('\n', '').split('|')]
    assert len(bars) == len(chords) == 40
    events = []                                # （16分音符の位置, 音の高さ, 強さ）
    INTRO = 16                                 # 前奏2小節（新しく作ったもの）
    pos = INTRO
    for b in bars:
        assert sum(int(x) for x in b[1::2]) == 8, b
        for name, n in zip(b[0::2], b[1::2]):
            if name != 'R' and not name.endswith('+'):      # '+' は前の音をのばす印（タイ）
                events.append((pos, midi(name) + 12, 1.0))  # 旋律は1オクターブ上で鳴らす
            pos += int(n)
    for i, (x, y) in enumerate([['C', 'C'], ['G', 'G']] + chords):
        p = i * 8
        a, b2 = [midi(k) for k in TONES[x].split()], [midi(k) for k in TONES[y].split()]
        arp = [a[0], a[2], b2[1] + (12 if x == y else 0), b2[2]]
        for j, m in enumerate(arp):
            events.append((p + j * 2, m + 12, 0.34))
    end = pos
    for j, m in enumerate([midi('C4'), midi('G4'), midi('E5'), midi('C6')]):   # 結びの和音
        events.append((end + j * 0.5, m + 12, 0.5))
    # 最後の2小節は、ゆっくりにする
    def when(p):
        slow = max(0.0, p - (end - 16))
        return p * U + U * 0.012 * slow * slow
    out = np.zeros(int(SR * (when(end + 2) + 6)))
    for p, m, v in events:
        s = tine(m, 4.5, v); i = int(when(p) * SR); out[i:i + len(s)] += s[:len(out) - i]
    # 箱の響きを少しだけ足す
    wet = np.zeros_like(out)
    for d, g in [(0.031, 0.25), (0.047, 0.18), (0.083, 0.12), (0.127, 0.08)]:
        k = int(d * SR); wet[k:] += out[:-k] * g
    out = out + wet
    fade = int(SR * 2.5); out[-fade:] *= np.linspace(1, 0, fade)
    return out / np.max(np.abs(out)) * 0.85

if __name__ == '__main__':
    data = (build() * 32767).astype('<i2')
    with wave.open(sys.argv[1], 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    print('できました：', sys.argv[1], round(len(data) / SR), '秒')

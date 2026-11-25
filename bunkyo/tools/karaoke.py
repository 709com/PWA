# このファイルは、文京区歌のカラオケ用の伴奏（試作）の音を、計算だけで作る道具です。録音や既存の音源は使いません。
# 使い方： python3 bunkyo/tools/karaoke.py 出力先.wav [ガイドの大きさ 0〜1。0でガイドなし]
#
# 旋律は orgel.py と同じもの（弘田龍太郎 作曲。著作権は消滅）。ガイドとして小さく鳴らす。旋律は変えない。
# 前奏はなし（高浜さんの希望・2026年11月25日）。歌い出しまで約2秒の間を置く。
# 伴奏・間奏・結びは、このアプリのために新しく作ったもの。区の楽譜のピアノ伴奏（編曲）は使っていない。
# 速さは楽譜どおり、1分間に112拍。1番・2番の2回。
# 音色はピアノふう（高浜さんの希望・2026年11月25日。ラッパふうは不採用）。右手がガイドの旋律、左手が低い音と和音。
import sys, wave
import numpy as np
from orgel import MELODY, CHORDS, TONES, SR, midi

BPM = 112
U = 60 / BPM / 4
LEAD = 16                                                     # 歌い出しまでの間（2小節ぶん＝約2秒。音は鳴らさない）
BRIDGE = [['C', 'C'], ['G', 'G']]                             # 1番と2番の間の間奏2小節

def piano(m, dur, vol, bright=1.0):
    """ピアノふうの音：弦をたたいた音。高い倍音ほど早く消え、鍵盤を離すとすっと止まる"""
    f = 440 * 2 ** ((m - 69) / 12)
    n = int(SR * (dur + 0.5)); t = np.arange(n) / SR
    life = 2.4 * (262 / f) ** 0.5                                   # 低い音ほど長く響く
    s = np.zeros(n)
    for k in range(1, 15):
        fk = k * f * (1 + 0.0004 * k * k) ** 0.5                    # 弦の硬さによる、わずかな音のずれ
        if fk > 9000: break
        amp = np.exp(-k / (7.0 * bright)) / k ** 0.9
        dec = np.exp(-t / (life / (1 + 0.38 * (k - 1))))
        s += amp * dec * (np.sin(2 * np.pi * fk * t) + 0.6 * np.sin(2 * np.pi * fk * 1.0007 * t + 0.4))   # 弦2本ぶんのうなり
    s *= np.minimum(1, t / 0.004)                                   # たたいた瞬間
    s *= np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.11))          # 鍵盤を離す
    return vol * s

def build(guide=0.75):
    bars = [b.split() for b in MELODY.replace('\n', ' ').split('|')]
    chords = [c.split() for c in CHORDS.replace('\n', '').split('|')]
    ev = []                                    # （16分音符の位置, 音の高さ, 長さ, 強さ, 明るさ）
    def backing(start, prog):
        for i, (x, y) in enumerate(prog):
            for h, c in enumerate([x, y]):     # 半小節ごと：低い音（ブン）→和音（チャッ）
                t = [midi(k) for k in TONES[c].split()]
                p = start + i * 8 + h * 4
                ev.append((p, t[0] - 12 - (0 if h == 0 else 5 if c != 'Dm' else 0), 3.2, 0.55, 0.8))
                for m in t[1:]:
                    ev.append((p + 2, m, 1.7, 0.26, 0.8))
        return start + len(prog) * 8
    def verse(start):
        pos = start; cur = None
        for b in bars:
            for name, n in zip(b[0::2], b[1::2]):
                n = int(n)
                if name.endswith('+') and cur: cur[2] += n          # '+' は前の音をのばす印（タイ）
                elif name != 'R':
                    cur = [pos, midi(name) + 12, n * 0.95, guide, 1.1]   # ガイドは1オクターブ上（伴奏と重ならず聞き取りやすい）
                    if guide > 0: ev.append(cur)
                pos += n
        return backing(start, chords)
    pos = LEAD                                 # 前奏はなし。歌い出しまで、音のない間を置く
    pos = verse(pos)
    b0 = pos
    pos = backing(pos, BRIDGE)
    for q, m in [(0, 'E4'), (4, 'G4'), (8, 'D5'), (12, 'G4')]:
        ev.append((b0 + q, midi(m) + 12, 3.6, 0.5, 1.1))                # 間奏
    pos = verse(pos)
    for m in ['C3', 'G3', 'E4', 'C5']:                              # 結びの和音
        ev.append((pos, midi(m), 14, 0.5, 0.9))
    out = np.zeros(int(SR * (pos * U + 5)))
    for p, m, d, v, br in ev:
        s = piano(m, d * U, v, br); i = int(p * U * SR); out[i:i + len(s)] += s[:len(out) - i]
    wet = np.zeros_like(out)                   # ホールの響きを少し
    for d, g in [(0.037, 0.22), (0.061, 0.16), (0.109, 0.11), (0.173, 0.07)]:
        k = int(d * SR); wet[k:] += out[:-k] * g
    out = out + wet
    return out / np.max(np.abs(out)) * 0.8

if __name__ == '__main__':
    data = (build(float(sys.argv[2]) if len(sys.argv) > 2 else 0.75) * 32767).astype('<i2')
    with wave.open(sys.argv[1], 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    print('できました：', sys.argv[1], round(len(data) / SR), '秒')

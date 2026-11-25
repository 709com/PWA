# このファイルは、文京区歌のカラオケ用の伴奏（試作）の音を、計算だけで作る道具です。録音や既存の音源は使いません。
# 使い方： python3 bunkyo/tools/karaoke.py 出力先.wav [ガイドの大きさ 0〜1。0でガイドなし]
#
# 旋律は orgel.py と同じもの（弘田龍太郎 作曲。著作権は消滅）。ガイドとして小さく鳴らす。旋律は変えない。
# 伴奏・前奏・間奏・結びは、このアプリのために新しく作ったもの。区の楽譜のピアノ伴奏（編曲）は使っていない。
# 速さは楽譜どおり、1分間に112拍。1番・2番の2回。
# 音色はラッパふう（高浜さんの希望・2026年11月25日）。ガイドはトランペットふう、伴奏は低い金管ふうの「ブン・チャッ」。
import sys, wave
import numpy as np
from orgel import MELODY, CHORDS, TONES, SR, midi

BPM = 112
U = 60 / BPM / 4
INTRO = [['C', 'C'], ['F', 'F'], ['C', 'C'], ['G', 'G']]     # 前奏4小節（楽譜と同じく、歌は5小節目から）
BRIDGE = [['C', 'C'], ['G', 'G']]                             # 1番と2番の間の間奏2小節

def brass(m, dur, vol, bright=1.0):
    """ラッパふうの音：倍音をたくさん重ね、吹き始めは丸く、すぐに明るくなる。のばす音は少し揺らす"""
    f = 440 * 2 ** ((m - 69) / 12)
    n = int(SR * (dur + 0.09)); t = np.arange(n) / SR
    env = np.minimum(1, t / 0.045) * (0.82 + 0.18 * np.exp(-t / 0.12))      # 吹き始め→のばし
    rel = np.clip((dur + 0.08 - t) / 0.08, 0, 1); env = env * rel            # 吹き終わり
    vib = 0.0035 * np.clip((t - 0.22) / 0.2, 0, 1) * np.sin(2 * np.pi * 5.2 * t)
    ph = 2 * np.pi * f * (t + np.cumsum(vib) / SR * 0 ) + 2 * np.pi * f * np.cumsum(vib) / SR
    s = np.zeros(n)
    for k in range(1, 13):
        if k * f > 9000: break
        s += (1 / k ** (1.15 / bright)) * env ** (1 + 0.35 * k) * np.sin(k * ph)   # 高い倍音ほど遅れて立ち上がる
    return vol * s * env

def build(guide=0.6):
    bars = [b.split() for b in MELODY.replace('\n', ' ').split('|')]
    chords = [c.split() for c in CHORDS.replace('\n', '').split('|')]
    ev = []                                    # （16分音符の位置, 音の高さ, 長さ, 強さ, 明るさ）
    def backing(start, prog):
        for i, (x, y) in enumerate(prog):
            for h, c in enumerate([x, y]):     # 半小節ごと：低い音（ブン）→和音（チャッ）
                t = [midi(k) for k in TONES[c].split()]
                p = start + i * 8 + h * 4
                ev.append((p, t[0] - 12 - (0 if h == 0 else 5 if c != 'Dm' else 0), 1.5, 0.50, 0.7))
                for m in t[1:]:
                    ev.append((p + 2, m, 0.9, 0.20, 0.8))
        return start + len(prog) * 8
    def verse(start):
        pos = start; cur = None
        for b in bars:
            for name, n in zip(b[0::2], b[1::2]):
                n = int(n)
                if name.endswith('+') and cur: cur[2] += n          # '+' は前の音をのばす印（タイ）
                elif name != 'R':
                    cur = [pos, midi(name), n * 0.92, guide, 1.0]
                    if guide > 0: ev.append(cur)
                pos += n
        return backing(start, chords)
    pos = backing(0, INTRO)
    for q, m in [(0, 'G4'), (2, 'G4'), (3, 'G4'), (4, 'C5'), (8, 'A4'), (12, 'F4'), (16, 'G4'), (18, 'E4'), (20, 'G4'), (24, 'D5'), (28, 'G4')]:
        ev.append((q, midi(m), 1.6, 0.45, 1.0))                     # 前奏の合図のラッパ（新しく作ったもの）
    pos = verse(pos)
    b0 = pos
    pos = backing(pos, BRIDGE)
    for q, m in [(0, 'E4'), (4, 'G4'), (8, 'D5'), (12, 'G4')]:
        ev.append((b0 + q, midi(m), 2.6, 0.45, 1.0))                # 間奏
    pos = verse(pos)
    for m in ['C3', 'G3', 'E4', 'C5']:                              # 結びの和音
        ev.append((pos, midi(m), 8, 0.4, 0.9))
    out = np.zeros(int(SR * (pos * U + 4)))
    for p, m, d, v, br in ev:
        s = brass(m, d * U, v, br); i = int(p * U * SR); out[i:i + len(s)] += s[:len(out) - i]
    wet = np.zeros_like(out)                   # ホールの響きを少し
    for d, g in [(0.037, 0.22), (0.061, 0.16), (0.109, 0.11), (0.173, 0.07)]:
        k = int(d * SR); wet[k:] += out[:-k] * g
    out = out + wet
    return out / np.max(np.abs(out)) * 0.8

if __name__ == '__main__':
    data = (build(float(sys.argv[2]) if len(sys.argv) > 2 else 0.6) * 32767).astype('<i2')
    with wave.open(sys.argv[1], 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    print('できました：', sys.argv[1], round(len(data) / SR), '秒')

# このファイルは、文京区歌のカラオケ用の伴奏（試作）の音を、計算だけで作る道具です。録音や既存の音源は使いません。
# 使い方： python3 bunkyo/tools/karaoke.py 出力先.wav [ガイドの大きさ 0〜1。0でガイドなし]
#
# 旋律は orgel.py と同じもの（弘田龍太郎 作曲。著作権は消滅）。ガイドとして小さく鳴らす。旋律は変えない。
# 伴奏・前奏・間奏・結びは、このアプリのために新しく作ったもの。区の楽譜のピアノ伴奏（編曲）は使っていない。
# 速さは楽譜どおり、1分間に112拍。1番・2番の2回。
import sys, wave
import numpy as np
from orgel import MELODY, CHORDS, TONES, SR, midi, tine

BPM = 112
U = 60 / BPM / 4
INTRO = [['C', 'C'], ['F', 'F'], ['C', 'C'], ['G', 'G']]     # 前奏4小節（楽譜と同じく、歌は5小節目から）
BRIDGE = [['C', 'C'], ['G', 'G']]                             # 1番と2番の間の間奏2小節

def build(guide=0.5):
    bars = [b.split() for b in MELODY.replace('\n', ' ').split('|')]
    chords = [c.split() for c in CHORDS.replace('\n', '').split('|')]
    ev = []                                    # （16分音符の位置, 音の高さ, 強さ）
    def backing(start, prog):
        for i, (x, y) in enumerate(prog):
            for h, c in enumerate([x, y]):     # 半小節ごと：低い音→和音の音
                t = [midi(k) for k in TONES[c].split()]
                p = start + i * 8 + h * 4
                ev.append((p, t[0], 0.42))                 # 低い音（拍の頭）
                ev.append((p + 2, t[1] + 12, 0.22))        # 裏拍
                ev.append((p + 2, t[2] + 12, 0.22))
        return start + len(prog) * 8
    def verse(start):
        pos = start
        for b in bars:
            for name, n in zip(b[0::2], b[1::2]):
                if guide > 0 and name != 'R' and not name.endswith('+'):
                    ev.append((pos, midi(name) + 12, guide))
                pos += int(n)
        return backing(start, chords)
    pos = backing(0, INTRO)
    for p in (pos - 8, pos - 4):               # 歌い出しの合図（高い音を2つ）
        ev.append((p, midi('G5') + 12, 0.30))
    pos = verse(pos)
    pos = backing(pos, BRIDGE)
    for p in (pos - 8, pos - 4):
        ev.append((p, midi('G5') + 12, 0.30))
    pos = verse(pos)
    for j, m in enumerate([midi('C3'), midi('G3'), midi('E4'), midi('C5')]):   # 結びの和音
        ev.append((pos + j * 0.6, m + 12, 0.5))
    out = np.zeros(int(SR * (pos * U + 6)))
    for p, m, v in ev:
        s = tine(m, 3.0, v); i = int(p * U * SR); out[i:i + len(s)] += s[:len(out) - i]
    fade = int(SR * 3); out[-fade:] *= np.linspace(1, 0, fade)
    return out / np.max(np.abs(out)) * 0.8

if __name__ == '__main__':
    data = (build(float(sys.argv[2]) if len(sys.argv) > 2 else 0.5) * 32767).astype('<i2')
    with wave.open(sys.argv[1], 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    print('できました：', sys.argv[1], round(len(data) / SR), '秒')

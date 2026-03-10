# Knowledge: VID BUDDY テロップ区切りロジック品質改善

## 重要制約
- extractors.py は 963行ある大型ファイル。**chunk_telops 関数のみを修正せよ**
- 他の関数(transcribe, detect_silences等)には一切触れるな
- write_file で書く際は必ず既存ファイルの全行を読んで特定箇所だけ書き換える

## 問題
現在の chunk_telops が生成する telop が以下の問題を抱えている:
1. 接続形(〜て)で切れた後、次チャンクが「て〜」から始まる（視聴者が読みにくい）
2. 20字以上の巨大チャンクが量産されている
3. Stage 1 のポーズ閾値(中央値×1.5)が高すぎて細かいポーズで切れない

## 修正手順

### Step 1: ファイルを読む
run_command: cat "/Users/ryotarokonishi/Desktop/AntigravityWork/VID BUDDY/vidbuddy/extractors.py" | grep -n "pause_threshold\|max_chars\|min.*config\|CONNECTIVE_STARTS\|connective_start" | head -20

### Step 2: 以下の3箇所をピンポイント修正

**修正A: pause_threshold を固定80msに変更**
現行: `pause_threshold = max(150, int(median_gap * 1.5))`
変更後: `pause_threshold = 80  # 固定閾値: 呼吸ポーズで確実に分割`

**修正B: Stage 3 に接続形文頭チェックを追加**
「final_rule = []」の行の直前（no_particle_end ループの後）に以下を追加:

```python
    # 接続形(〜て/〜で)で始まるチャンクは前のチャンクに結合して再分割
    CONNECTIVE_STARTS = ("て", "で", "ても", "たり", "だり", "ながら")
    no_connective_start = []
    for chunk in merged_particles:
        text = chunk["text"]
        starts_with_connective = any(text.startswith(c) for c in CONNECTIVE_STARTS)
        if starts_with_connective and no_connective_start:
            prev = no_connective_start[-1]
            combined = prev["text"] + text
            total_ms = chunk["end_ms"] - prev["start_ms"]
            ms_pc = total_ms / max(len(combined), 1)
            max_c = config.telop.max_chars
            if len(combined) <= max_c:
                prev["text"] = combined
                prev["end_ms"] = chunk["end_ms"]
            else:
                # max_chars で強制分割
                s = 0
                no_connective_start.pop()
                while s < len(combined):
                    e = min(s + max_c, len(combined))
                    no_connective_start.append({
                        "text": combined[s:e],
                        "start_ms": prev["start_ms"] + int(s * ms_pc),
                        "end_ms": prev["start_ms"] + int(e * ms_pc) if e < len(combined) else chunk["end_ms"],
                    })
                    s = e
        else:
            no_connective_start.append(chunk)
    merged_particles = no_connective_start
```

**修正C: Stage 2 の force_split でオーバーサイズを確実に処理**
force_split ループのラストリゾートの `else` 節を確認して、max_chars で確実に切っているか確認せよ

### Step 3: 修正を適用してテロップ再生成

```bash
cd "/Users/ryotarokonishi/Desktop/AntigravityWork/VID BUDDY"
source .venv/bin/activate
python3 -c "
import asyncio, json, sys
sys.path.insert(0, '.')
from vidbuddy.config import PipelineConfig
from vidbuddy.extractors import chunk_telops

config = PipelineConfig.from_yaml('config.default.yaml')
with open('test_work/extraction/transcript.json') as f:
    transcript = json.load(f)

async def main():
    chunks = await chunk_telops(transcript, config)
    over_limit = [c for c in chunks if len(c['text']) > config.telop.max_chars]
    te_start = [c for c in chunks if c['text'].startswith('て') or c['text'].startswith('で')]
    print(f'Total chunks: {len(chunks)}')
    print(f'Over max_chars({config.telop.max_chars}): {len(over_limit)}')
    print(f'Starts with te/de: {len(te_start)}')
    print()
    print('=== SAMPLE (first 20) ===')
    for i, c in enumerate(chunks[:20]):
        mark = '❌' if len(c['text']) > config.telop.max_chars else '✅'
        print(f'{mark} {i+1:2d}. [{c["start_ms"]:6d}ms] {len(c["text"]):2d}字: {c["text"]}')
    with open('test_work/extraction/telop_chunks.json', 'w') as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)
    print(f'Saved {len(chunks)} chunks')

asyncio.run(main())
"
```

### Step 4: 品質チェック
- `Over max_chars: 0` であること（ゼロが必須）
- `Starts with te/de: 0` であること（ゼロが必須）
- Total chunks が 80〜200 の範囲であること

### Step 5: pytest 実行
```bash
cd "/Users/ryotarokonishi/Desktop/AntigravityWork/VID BUDDY" && source .venv/bin/activate && python3 -m pytest tests/ -x -q 2>&1 | tail -5
```

上記2条件がゼロでテストが通れば done。そうでなければ修正を繰り返せ。
Date: 2026-03-09

## 結果
❌ 失敗

## タスク
VID BUDDY テロップ区切りロジック品質改善

## 重要制約
- extractors.py は 963行ある大型ファイル。**chunk_telops 関数のみを修正せよ**
- 他の関数(transcribe, detect_silences等)には一切触れるな
- write_file で書く際は必ず既存ファイルの全行を読んで特定箇所だけ書き換える

## 問題
現在の chunk_telops が生成する telop が以下の問題を抱えている:
1. 接続形(〜て)で切れた後、次チャンクが「て〜」から始まる（視聴者が読みにくい）
2. 20字以上の巨大チャンクが量産されている
3. Stage 1 のポーズ閾値(中央値×1.5)が高すぎて細かいポーズで切れない

## 修正手順

### Step 1: ファイルを読む
run_command: cat "/Users/ryotarokonishi/Desktop/AntigravityWork/VID BUDDY/vidbuddy/extractors.py" | grep -n "pause_threshold\|max_chars\|min.*config\|CONNECTIVE_STARTS\|connective_start" | head -20

### Step 2: 以下の3箇所をピンポイント修正

**修正A: pause_threshold を固定80msに変更**
現行: `pause_threshold = max(150, int(median_gap * 1.5))`
変更後: `pause_threshold = 80  # 固定閾値: 呼吸ポーズで確実に分割`

**修正B: Stage 3 に接続形文頭チェックを追加**
「final_rule = []」の行の直前（no_particle_end ループの後）に以下を追加:

```python
    # 接続形(〜て/〜で)で始まるチャンクは前のチャンクに結合して再分割
    CONNECTIVE_STARTS = ("て", "で", "ても", "たり", "だり", "ながら")
    no_connective_start = []
    for chunk in merged_particles:
        text = chunk["text"]
        starts_with_connective = any(text.startswith(c) for c in CONNECTIVE_STARTS)
        if starts_with_connective and no_connective_start:
            prev = no_connective_start[-1]
            combined = prev["text"] + text
            total_ms = chunk["end_ms"] - prev["start_ms"]
            ms_pc = total_ms / max(len(combined), 1)
            max_c = config.telop.max_chars
            if len(combined) <= max_c:
                prev["text"] = combined
                prev["end_ms"] = chunk["end_ms"]
            else:
                # max_chars で強制分割
                s = 0
                no_connective_start.pop()
                while s < len(combined):
                    e = min(s + max_c, len(combined))
                    no_connective_start.append({
                        "text": combined[s:e],
                        "start_ms": prev["start_ms"] + int(s * ms_pc),
                        "end_ms": prev["start_ms"] + int(e * ms_pc) if e < len(combined) else chunk["end_ms"],
                    })
                    s = e
        else:
            no_connective_start.append(chunk)
    merged_particles = no_connective_start
```

**修正C: Stage 2 の force_split でオーバーサイズを確実に処理**
force_split ループのラストリゾートの `else` 節を確認して、max_chars で確実に切っているか確認せよ

### Step 3: 修正を適用してテロップ再生成

```bash
cd "/Users/ryotarokonishi/Desktop/AntigravityWork/VID BUDDY"
source .venv/bin/activate
python3 -c "
import asyncio, json, sys
sys.path.insert(0, '.')
from vidbuddy.config import PipelineConfig
from vidbuddy.extractors import chunk_telops

config = PipelineConfig.from_yaml('config.default.yaml')
with open('test_work/extraction/transcript.json') as f:
    transcript = json.load(f)

async def main():
    chunks = await chunk_telops(transcript, config)
    over_limit = [c for c in chunks if len(c['text']) > config.telop.max_chars]
    te_start = [c for c in chunks if c['text'].startswith('て') or c['text'].startswith('で')]
    print(f'Total chunks: {len(chunks)}')
    print(f'Over max_chars({config.telop.max_chars}): {len(over_limit)}')
    print(f'Starts with te/de: {len(te_start)}')
    print()
    print('=== SAMPLE (first 20) ===')
    for i, c in enumerate(chunks[:20]):
        mark = '❌' if len(c['text']) > config.telop.max_chars else '✅'
        print(f'{mark} {i+1:2d}. [{c["start_ms"]:6d}ms] {len(c["text"]):2d}字: {c["text"]}')
    with open('test_work/extraction/telop_chunks.json', 'w') as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)
    print(f'Saved {len(chunks)} chunks')

asyncio.run(main())
"
```

### Step 4: 品質チェック
- `Over max_chars: 0` であること（ゼロが必須）
- `Starts with te/de: 0` であること（ゼロが必須）
- Total chunks が 80〜200 の範囲であること

### Step 5: pytest 実行
```bash
cd "/Users/ryotarokonishi/Desktop/AntigravityWork/VID BUDDY" && source .venv/bin/activate && python3 -m pytest tests/ -x -q 2>&1 | tail -5
```

上記2条件がゼロでテストが通れば done。そうでなければ修正を繰り返せ。

## エラー履歴 (0件)


## 最終スコア
- Gates passed: 0/0

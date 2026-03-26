#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/check_chapters.sh [options] <markdown_file>

Options:
  --start N      Expected start chapter (default: infer from segment header, else first chapter)
  --end N        Expected end chapter (default: infer from segment header, else last chapter)
  --autofill     Write a new file with placeholder rows for missing chapters
  --output FILE  Output path used with --autofill
  -h, --help     Show this help

Examples:
  scripts/check_chapters.sh out.md
  scripts/check_chapters.sh --start 1 --end 83 out.md
  scripts/check_chapters.sh --start 1 --end 83 --autofill --output out.filled.md out.md
EOF
}

START=""
END=""
AUTOFILL=0
OUTPUT=""
INPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start)
      START="${2:-}"
      shift 2
      ;;
    --end)
      END="${2:-}"
      shift 2
      ;;
    --autofill)
      AUTOFILL=1
      shift
      ;;
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      INPUT="$1"
      shift
      ;;
  esac
done

if [[ -z "$INPUT" ]]; then
  echo "Missing markdown file path." >&2
  usage
  exit 2
fi

if [[ ! -f "$INPUT" ]]; then
  echo "File not found: $INPUT" >&2
  exit 2
fi

is_int() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

if [[ -n "$START" ]] && ! is_int "$START"; then
  echo "--start must be an integer." >&2
  exit 2
fi
if [[ -n "$END" ]] && ! is_int "$END"; then
  echo "--end must be an integer." >&2
  exit 2
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

CHAPTERS_IN_ORDER="$TMP_DIR/chapters_in_order.txt"
CHAPTERS_SORTED="$TMP_DIR/chapters_sorted.txt"
CHAPTERS_UNIQ="$TMP_DIR/chapters_uniq.txt"
SEGMENTS="$TMP_DIR/segments.txt"

awk -F'|' '
  /^\|[[:space:]]*[0-9]+[[:space:]]*\|/ {
    n=$2
    gsub(/[[:space:]]/, "", n)
    print n
  }
' "$INPUT" > "$CHAPTERS_IN_ORDER"

if [[ ! -s "$CHAPTERS_IN_ORDER" ]]; then
  echo "No chapter rows found. Expected rows like: | 12 | 标题 | ... |" >&2
  exit 1
fi

sort -n "$CHAPTERS_IN_ORDER" > "$CHAPTERS_SORTED"
uniq "$CHAPTERS_SORTED" > "$CHAPTERS_UNIQ"

awk '
  match($0, /^===== *第([0-9]+)-([0-9]+)章\.txt/, m) {
    print m[1] "|" m[2] "|" NR
  }
' "$INPUT" > "$SEGMENTS"

FIRST_CHAPTER="$(head -n1 "$CHAPTERS_SORTED")"
LAST_CHAPTER="$(tail -n1 "$CHAPTERS_SORTED")"

if [[ -z "$START" || -z "$END" ]]; then
  if [[ -s "$SEGMENTS" ]]; then
    SEG_START_MIN="$(cut -d'|' -f1 "$SEGMENTS" | sort -n | head -n1)"
    SEG_END_MAX="$(cut -d'|' -f2 "$SEGMENTS" | sort -n | tail -n1)"
    if [[ -z "$START" ]]; then
      START="$SEG_START_MIN"
    fi
    if [[ -z "$END" ]]; then
      END="$SEG_END_MAX"
    fi
  fi
fi

if [[ -z "$START" ]]; then
  START="$FIRST_CHAPTER"
fi
if [[ -z "$END" ]]; then
  END="$LAST_CHAPTER"
fi

if (( START > END )); then
  echo "Invalid range: start ($START) > end ($END)" >&2
  exit 2
fi

DUPLICATES="$TMP_DIR/duplicates.txt"
MISSING="$TMP_DIR/missing.txt"

uniq -d "$CHAPTERS_SORTED" > "$DUPLICATES" || true
comm -23 <(seq "$START" "$END") "$CHAPTERS_UNIQ" > "$MISSING"

TOTAL_ROWS="$(wc -l < "$CHAPTERS_IN_ORDER" | tr -d ' ')"
UNIQ_COUNT="$(wc -l < "$CHAPTERS_UNIQ" | tr -d ' ')"
DUP_COUNT="$(wc -l < "$DUPLICATES" | tr -d ' ')"
MISSING_COUNT="$(wc -l < "$MISSING" | tr -d ' ')"

echo "== Chapter Continuity Report =="
echo "File: $INPUT"
echo "Expected range: $START-$END"
echo "Found rows: $TOTAL_ROWS (unique: $UNIQ_COUNT)"
echo "Duplicates: $DUP_COUNT"
if (( DUP_COUNT > 0 )); then
  echo "Duplicate chapter numbers: $(tr '\n' ' ' < "$DUPLICATES" | sed 's/[[:space:]]*$//')"
fi
echo "Missing: $MISSING_COUNT"
if (( MISSING_COUNT > 0 )); then
  echo "Missing chapter numbers: $(tr '\n' ' ' < "$MISSING" | sed 's/[[:space:]]*$//')"
fi

if [[ -s "$SEGMENTS" ]]; then
  echo
  echo "== Segment Check =="
  awk -F'|' '
    /^\|[[:space:]]*[0-9]+[[:space:]]*\|/ {
      n=$2
      gsub(/[[:space:]]/, "", n)
      chap_line[NR]=n
    }
    match($0, /^===== *第([0-9]+)-([0-9]+)章\.txt/, m) {
      seg_count++
      s_start[seg_count]=m[1]
      s_end[seg_count]=m[2]
      s_line[seg_count]=NR
    }
    END {
      for (i=1; i<=seg_count; i++) {
        next_line = (i < seg_count ? s_line[i+1] : 10^9)
        have = 0
        min = -1
        max = -1
        delete seen
        for (ln=s_line[i]+1; ln<next_line; ln++) {
          if (ln in chap_line) {
            c=chap_line[ln] + 0
            seen[c]=1
            have++
            if (min==-1 || c<min) min=c
            if (max==-1 || c>max) max=c
          }
        }
        miss = ""
        extra = ""
        miss_n = 0
        extra_n = 0
        for (c=s_start[i]; c<=s_end[i]; c++) {
          if (!(c in seen)) {
            miss_n++
            miss = miss (miss=="" ? "" : " ") c
          }
        }
        for (c in seen) {
          if (c < s_start[i] || c > s_end[i]) {
            extra_n++
            extra = extra (extra=="" ? "" : " ") c
          }
        }
        if (have==0) {
          span="none"
        } else {
          span=min "-" max
        }
        printf("Segment %d-%d @line %d: count=%d, span=%s", s_start[i], s_end[i], s_line[i], have, span)
        if (miss_n>0) printf(", missing=[%s]", miss)
        if (extra_n>0) printf(", extra=[%s]", extra)
        printf("\n")
      }
    }
  ' "$INPUT"
fi

if (( AUTOFILL == 1 )) && (( MISSING_COUNT > 0 )); then
  if [[ -z "$OUTPUT" ]]; then
    case "$INPUT" in
      *.md) OUTPUT="${INPUT%.md}.filled.md" ;;
      *) OUTPUT="${INPUT}.filled.md" ;;
    esac
  fi

  cp "$INPUT" "$OUTPUT"
  {
    echo
    echo "===== 自动补洞（占位） ====="
    echo
    echo "| 章节号 | 章节标题 | 章节核心剧情梗概 | 本章核心功能/目的 | 画面感/镜头序列 | 关键情节点 (Key Points) | 本章氛围/情绪 | 结尾\"钩子\" (Hook) |"
    echo "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
    while IFS= read -r n; do
      [[ -z "$n" ]] && continue
      echo "| $n | TODO | TODO | TODO | \`[]\` | \`[]\` | \`[]\` | TODO |"
    done < "$MISSING"
  } >> "$OUTPUT"

  echo
  echo "Autofill output: $OUTPUT"
  echo "Filled chapters: $(tr '\n' ' ' < "$MISSING" | sed 's/[[:space:]]*$//')"
fi

if (( DUP_COUNT > 0 || MISSING_COUNT > 0 )); then
  exit 1
fi

exit 0

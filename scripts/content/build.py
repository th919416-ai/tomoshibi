"""運営が入稿するお題・手紙（scripts/content/*.py）から、Supabase に流す SQL を作る。
実行: python3 scripts/content/build.py
出力: supabase/content/*.sql（何度流しても重複しない）
"""
import datetime, importlib.util, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/content"
OUT = ROOT / "supabase/content"
OUT.mkdir(exist_ok=True)
GENRES = ["discovery", "memory", "values", "imagine", "senses"]

def load(name):
    spec = importlib.util.spec_from_file_location(name, SRC / f"{name}.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def q(s):
    assert 20 <= len(s.strip()) <= 400 or len(s) < 80, s
    return "'" + s.replace("'", "''") + "'"

def letters_sql(module_name, out_name):
    letters = load(module_name).LETTERS
    rows = []
    for question, bodies in letters.items():
        for b in bodies:
            assert 20 <= len(b.strip()) <= 400, b
            rows.append(f"  ({q(question)}, {q(b)})")
    sql = f"""-- 運営が用意した手紙（seed）。手紙が足りない日の補充に使う（CLAUDE.md §7.2）
-- 生成元: scripts/content/{module_name}.py（直接編集しない）
-- お題の本文で結び付ける。何度流しても重複しない。
insert into public.answers (user_id, question_id, day_key, body, status, is_seed)
select null, qs.id, qs.day_key, v.body, 'approved', true
from (values
{",\n".join(rows)}
) as v(question, body)
join public.questions qs on qs.body = v.question
where not exists (
  select 1 from public.answers a where a.question_id = qs.id and a.is_seed and a.body = v.body
);
"""
    (OUT / out_name).write_text(sql)
    return len(rows)

def questions_sql(module_name, out_name):
    m = load(module_name)
    start = datetime.date.fromisoformat(m.START)
    rows = []
    for i, (genre, body) in enumerate(m.QUESTIONS):
        assert genre in GENRES
        day = start + datetime.timedelta(days=i)
        rows.append(f"  ('{day.isoformat()}', '{genre}', {q(body)})")
    sql = f"""-- お題 {m.START} から {len(rows)} 日分
-- 生成元: scripts/content/{module_name}.py（直接編集しない）
-- すでに同じ日のお題があれば上書きしない。
insert into public.questions (day_key, genre, body) values
{",\n".join(rows)}
on conflict (day_key) do nothing;
"""
    (OUT / out_name).write_text(sql)
    return len(rows)

if __name__ == "__main__":
    print("questions:", questions_sql("questions_2026-12-16_to_2027-01-14", "001_questions_2026-12-16_to_2027-01-14.sql"))
    print("letters:", letters_sql("letters_2026-11-21_to_12-15", "002_letters_2026-11-21_to_12-15.sql"))

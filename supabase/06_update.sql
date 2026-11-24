-- =====================================================================
-- 06_update.sql : 교수님 피드백 반영 (이미 01~05를 실행한 DB에 추가 실행)
--  1) 상담기록은 담당 교사(작성 교사 + 해당 학생 담임)만 조회·수정
--  2) 미응답자 목록에 소속 표시: 학생은 학년·반·번호, 학부모는 자녀·관계
-- 여러 번 실행해도 안전함
-- =====================================================================

-- 1) 상담기록 접근 범위 -------------------------------------------------
-- 내가 담임인 학생인지
create or replace function is_my_homeroom(p char) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s join teachers t on t.teacher_no = s.homeroom_teacher_no
                  where s.student_no = p and t.user_id = auth.uid())
$$;

drop policy if exists teacher_all          on counselings;
drop policy if exists cns_teacher_read     on counselings;
drop policy if exists cns_teacher_insert   on counselings;
drop policy if exists cns_teacher_update   on counselings;
drop policy if exists cns_teacher_delete   on counselings;

-- 조회: 내가 작성했거나 내가 담임인 학생의 상담
create policy cns_teacher_read on counselings for select to authenticated
  using (is_teacher() and (teacher_no = my_teacher_no() or is_my_homeroom(student_no)));
-- 작성: 본인 이름으로만
create policy cns_teacher_insert on counselings for insert to authenticated
  with check (is_teacher() and teacher_no = my_teacher_no());
-- 수정·삭제: 작성한 교사만
create policy cns_teacher_update on counselings for update to authenticated
  using (teacher_no = my_teacher_no()) with check (teacher_no = my_teacher_no());
create policy cns_teacher_delete on counselings for delete to authenticated
  using (teacher_no = my_teacher_no());
-- (학생·학부모 본인/자녀 조회 정책 cns_read 는 그대로 유지)

-- 2) 미응답자 목록에 소속(자녀·관계) 추가 ---------------------------------
create or replace view v_nonresponders with (security_invoker = true) as
select r.doc_no, n.title, n.reply_deadline, r.user_id, u.name, u.user_type, u.phone,
       r.read_at, r.reminded_at, (current_date > n.reply_deadline) as deadline_passed,
       case u.user_type
         when '학생' then (
           select format('%s학년 %s반 %s번 (%s)', s.grade, s.class_no, s.number, s.student_no)
             from students s where s.user_id = u.user_id)
         when '학부모' then (
           select string_agg(format('%s(%s-%s-%s)', su.name, s.grade, s.class_no, s.number), '·' order by s.student_no)
                  || ' ' || case when count(distinct g.relation_type) = 1
                                 then case min(g.relation_type) when '모' then '어머니' when '부' then '아버지' else '보호자' end
                                 else '보호자' end
             from parents pa
             join guardianships g on g.parent_no = pa.parent_no
             join students s on s.student_no = g.student_no
             join users su on su.user_id = s.user_id
            where pa.user_id = u.user_id)
       end as affiliation
  from recipients r
  join notices n using (doc_no)
  join users u using (user_id)
 where n.has_survey
   and not exists (select 1 from survey_responses sr where sr.doc_no = r.doc_no and sr.user_id = r.user_id);

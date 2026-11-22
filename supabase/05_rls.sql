-- =====================================================================
-- 05_rls.sql : 역할별 행 수준 보안(RLS)
-- 학생: 본인 데이터 / 학부모: 보호관계 자녀 데이터 / 교사: 전체 + 처리 권한
-- (Supabase의 auth.uid() = users.user_id)
-- =====================================================================

-- 로그인 사용자에게 API 접근 권한 부여 (행 단위 제한은 아래 RLS 정책이 담당)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- 비로그인(anon)은 아무것도 못 봄
revoke all on all tables in schema public from anon;

-- 역할 판별 함수 (RLS 재귀 방지를 위해 security definer) ----------------
create or replace function app_role() returns text
language sql stable security definer set search_path = public as $$
  select user_type from users where user_id = auth.uid()
$$;
create or replace function is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select user_type = '교사' from users where user_id = auth.uid()), false)
$$;
create or replace function my_student_no() returns char(8)
language sql stable security definer set search_path = public as $$
  select student_no from students where user_id = auth.uid()
$$;
create or replace function my_teacher_no() returns char(5)
language sql stable security definer set search_path = public as $$
  select teacher_no from teachers where user_id = auth.uid()
$$;
create or replace function my_parent_no() returns bigint
language sql stable security definer set search_path = public as $$
  select parent_no from parents where user_id = auth.uid()
$$;
-- 내가 볼 수 있는 학생: 본인(학생) 또는 보호 자녀(학부모)
create or replace function can_see_student(p char) returns boolean
language sql stable security definer set search_path = public as $$
  select p = (select student_no from students where user_id = auth.uid())
      or exists (select 1 from guardianships g join parents pa using (parent_no)
                  where pa.user_id = auth.uid() and g.student_no = p)
$$;

-- 트리거 함수는 RLS와 무관하게 규칙 검사·연쇄 처리하도록 definer로 실행
do $$
declare f text;
begin
  foreach f in array array['chk_teacher_subtype','chk_user_type','chk_application','apply_closure_decision',
    'chk_timetable_conflict','chk_enrollment','chk_approval','sync_notice_status','chk_notice_publish','chk_survey_response']
  loop
    execute format('alter function %I() security definer set search_path = public', f);
  end loop;
end $$;

-- 개인 정보가 들어 있는 뷰는 조회자 권한으로 (RLS 적용)
alter view v_missing_required  set (security_invoker = true);
alter view v_nonresponders     set (security_invoker = true);
alter view v_student_timetable set (security_invoker = true);
-- v_offering_status · v_section_status · v_notice_stats 는 집계값만 공개 (실시간 신청 인원 공개 목적)

-- RLS 활성화 -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'users','teachers','students','parents','senior_teachers','junior_teachers','guardianships',
    'subjects','offered_courses','application_periods','applications','completions',
    'classrooms','sections','enrollments','timetables','counselings','closure_decisions',
    'notices','attachments','recipients','survey_responses','approvals']
  loop
    execute format('alter table %I enable row level security', t);
    -- 교사는 모든 테이블 전체 권한
    execute format('create policy teacher_all on %I for all to authenticated using (is_teacher()) with check (is_teacher())', t);
  end loop;
end $$;

-- 공개 기준 정보: 로그인 사용자 모두 조회 --------------------------------
do $$
declare t text;
begin
  foreach t in array array['teachers','senior_teachers','junior_teachers','subjects','offered_courses',
    'application_periods','classrooms','sections','timetables','closure_decisions']
  loop
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- 사용자: 본인, 교사 계정(이름 표시용), 내 자녀
create policy users_read on users for select to authenticated
  using (user_id = auth.uid() or user_type = '교사'
         or exists (select 1 from students s where s.user_id = users.user_id and can_see_student(s.student_no)));
create policy users_update_self on users for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and user_type = app_role());

-- 학생·학부모·보호관계
create policy students_read  on students      for select to authenticated using (can_see_student(student_no));
create policy parents_read   on parents       for select to authenticated using (user_id = auth.uid());
create policy guard_read     on guardianships for select to authenticated using (can_see_student(student_no));

-- 수강신청: 본인·자녀 조회, 학생 본인만 신청, '신청' 상태일 때만 취소
create policy app_read   on applications for select to authenticated using (can_see_student(student_no));
create policy app_insert on applications for insert to authenticated
  with check (student_no = my_student_no() and status = '신청');
create policy app_delete on applications for delete to authenticated
  using (student_no = my_student_no() and status = '신청');

-- 이수·배정·상담: 본인·자녀 조회
create policy comp_read on completions  for select to authenticated using (can_see_student(student_no));
create policy enr_read  on enrollments  for select to authenticated using (can_see_student(student_no));
create policy cns_read  on counselings  for select to authenticated using (can_see_student(student_no));

-- 가정통신문: 게시된 문서 중 내가 수신자인 것
create policy notice_read on notices for select to authenticated
  using (status = '게시' and exists (select 1 from recipients r where r.doc_no = notices.doc_no and r.user_id = auth.uid()));
create policy attach_read on attachments for select to authenticated
  using (exists (select 1 from recipients r where r.doc_no = attachments.doc_no and r.user_id = auth.uid()));

-- 수신: 본인 기록 조회, 열람일시 기록
create policy rcpt_read   on recipients for select to authenticated using (user_id = auth.uid());
create policy rcpt_update on recipients for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 설문응답: 본인만 조회·제출·수정 (기한·수신자 여부는 트리거가 검사)
create policy resp_read   on survey_responses for select to authenticated using (user_id = auth.uid());
create policy resp_insert on survey_responses for insert to authenticated with check (user_id = auth.uid());
create policy resp_update on survey_responses for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 결재이력: 교사만 (teacher_all 정책으로 처리)

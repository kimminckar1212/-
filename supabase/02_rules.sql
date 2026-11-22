-- =====================================================================
-- 02_rules.sql : 업무 규칙 트리거 · 조회 뷰 · 처리 함수
-- (보고서 표 Ⅵ-2 업무 규칙 R01~R26 중 '제약'·'처리' 항목 구현)
-- =====================================================================

-- ---------------------------------------------------------------------
-- R. 선임교사·후임교사는 배타적 (한 교사는 둘 중 하나만)
-- ---------------------------------------------------------------------
create or replace function chk_teacher_subtype() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'senior_teachers' and exists (select 1 from junior_teachers where teacher_no = new.teacher_no) then
    raise exception '교사 %는 이미 후임교사입니다 (선임·후임 배타)', new.teacher_no;
  elsif tg_table_name = 'junior_teachers' and exists (select 1 from senior_teachers where teacher_no = new.teacher_no) then
    raise exception '교사 %는 이미 선임교사입니다 (선임·후임 배타)', new.teacher_no;
  end if;
  return new;
end $$;
create trigger trg_senior_excl before insert or update on senior_teachers for each row execute function chk_teacher_subtype();
create trigger trg_junior_excl before insert or update on junior_teachers for each row execute function chk_teacher_subtype();

-- 하위 개체의 사용자구분 일치 (학생 계정은 학생 테이블에만)
create or replace function chk_user_type() returns trigger
language plpgsql as $$
declare expected text := case tg_table_name when 'students' then '학생' when 'teachers' then '교사' else '학부모' end;
begin
  if (select user_type from users where user_id = new.user_id) <> expected then
    raise exception '사용자구분이 %인 계정만 연결할 수 있습니다', expected;
  end if;
  return new;
end $$;
create trigger trg_students_type before insert or update on students for each row execute function chk_user_type();
create trigger trg_teachers_type before insert or update on teachers for each row execute function chk_user_type();
create trigger trg_parents_type  before insert or update on parents  for each row execute function chk_user_type();

-- ---------------------------------------------------------------------
-- 수강신청: 기간 내 신청, 3차만 1~3지망, 기이수 재신청 차단, 폐강 과목 차단
-- ---------------------------------------------------------------------
create or replace function chk_application() returns trigger
language plpgsql as $$
declare p application_periods; o offered_courses;
begin
  select * into p from application_periods where period_id = new.period_id;
  select * into o from offered_courses where offering_id = new.offering_id;

  if (o.school_year, o.semester) <> (p.school_year, p.semester) then
    raise exception '신청일정과 개설과목의 학년도·학기가 다릅니다';
  end if;
  if tg_op = 'INSERT' and new.applied_at not between p.starts_at and p.ends_at then
    raise exception '신청 기간(% ~ %)이 아닙니다', p.starts_at, p.ends_at;
  end if;
  if p.round = 3 and new.preference_rank is null then
    raise exception '3차 신청은 희망순위(1~3지망)를 입력해야 합니다';
  elsif p.round < 3 and new.preference_rank is not null then
    raise exception '희망순위는 3차 신청에서만 입력합니다';
  end if;
  if tg_op = 'INSERT' and o.status = '폐강' then
    raise exception '폐강된 과목은 신청할 수 없습니다';
  end if;
  if tg_op = 'INSERT' and exists (select 1 from completions c
                where c.student_no = new.student_no and c.subject_code = o.subject_code) then
    raise exception '이미 이수한 과목(%)은 다시 신청할 수 없습니다', o.subject_code;
  end if;
  return new;
end $$;
create trigger trg_applications_chk before insert or update on applications
  for each row execute function chk_application();

-- ---------------------------------------------------------------------
-- 폐강 판단 → 개설과목 상태 반영, 폐강 시 신청내역 '폐강' 처리
-- ---------------------------------------------------------------------
create or replace function apply_closure_decision() returns trigger
language plpgsql as $$
begin
  update offered_courses set status = new.result where offering_id = new.offering_id;
  if new.result = '폐강' then
    update applications set status = '폐강'
     where offering_id = new.offering_id and status in ('신청','확인완료');
  end if;
  return new;
end $$;
create trigger trg_closure_apply after insert on closure_decisions
  for each row execute function apply_closure_decision();

-- ---------------------------------------------------------------------
-- 시간 충돌 공통 함수: 같은 학년도·학기, 같은 요일·교시
-- ---------------------------------------------------------------------
-- 분반의 학년도·학기
create or replace function section_term(p_section bigint, out yr smallint, out sem smallint)
language sql stable as $$
  select o.school_year, o.semester from sections s join offered_courses o using (offering_id)
   where s.section_id = p_section
$$;

-- 시간표: 교실·교사·학생 중복 방지
create or replace function chk_timetable_conflict() returns trigger
language plpgsql as $$
declare t record; v_teacher char(5); clash text;
begin
  select * into t from section_term(new.section_id);
  select teacher_no into v_teacher from sections where section_id = new.section_id;

  -- 교실 중복
  select s.section_id::text into clash
    from timetables tt join sections s using (section_id) join offered_courses o using (offering_id)
   where tt.room_no = new.room_no and tt.day_of_week = new.day_of_week and tt.period = new.period
     and o.school_year = t.yr and o.semester = t.sem and tt.timetable_id is distinct from new.timetable_id
   limit 1;
  if clash is not null then
    raise exception '교실 % %요일 %교시는 이미 분반 %이(가) 사용 중입니다', new.room_no, new.day_of_week, new.period, clash;
  end if;

  -- 교사 중복
  select s.section_id::text into clash
    from timetables tt join sections s using (section_id) join offered_courses o using (offering_id)
   where s.teacher_no = v_teacher and tt.day_of_week = new.day_of_week and tt.period = new.period
     and o.school_year = t.yr and o.semester = t.sem and tt.timetable_id is distinct from new.timetable_id
     and tt.section_id <> new.section_id
   limit 1;
  if clash is not null then
    raise exception '교사 %는 %요일 %교시에 이미 분반 % 수업이 있습니다', v_teacher, new.day_of_week, new.period, clash;
  end if;

  -- 학생 중복 (이 분반 수강생이 같은 시간에 다른 분반 수업)
  select e1.student_no into clash
    from enrollments e1
    join enrollments e2 on e2.student_no = e1.student_no and e2.section_id <> e1.section_id
    join timetables tt on tt.section_id = e2.section_id
    join sections s on s.section_id = e2.section_id join offered_courses o using (offering_id)
   where e1.section_id = new.section_id and tt.day_of_week = new.day_of_week and tt.period = new.period
     and o.school_year = t.yr and o.semester = t.sem
   limit 1;
  if clash is not null then
    raise exception '학생 %의 %요일 %교시 수업이 겹칩니다', clash, new.day_of_week, new.period;
  end if;
  return new;
end $$;
create trigger trg_timetable_conflict before insert or update on timetables
  for each row execute function chk_timetable_conflict();

-- 수강배정: 정원 초과·폐강 분반·학생 시간 충돌 방지
create or replace function chk_enrollment() returns trigger
language plpgsql as $$
declare t record; v_cap smallint; v_cnt int; v_status text; clash text;
begin
  select s.max_capacity, o.status into v_cap, v_status
    from sections s join offered_courses o using (offering_id) where s.section_id = new.section_id;
  if v_status = '폐강' then
    raise exception '폐강된 과목에는 배정할 수 없습니다';
  end if;
  select count(*) into v_cnt from enrollments
   where section_id = new.section_id and enrollment_id is distinct from new.enrollment_id;
  if v_cnt >= v_cap then
    raise exception '분반 정원(%)이 가득 찼습니다', v_cap;
  end if;

  select * into t from section_term(new.section_id);
  select format('%s요일 %s교시', a.day_of_week, a.period) into clash
    from timetables a
    join timetables b on b.day_of_week = a.day_of_week and b.period = a.period
    join enrollments e on e.section_id = b.section_id
    join sections s on s.section_id = b.section_id join offered_courses o using (offering_id)
   where a.section_id = new.section_id and e.student_no = new.student_no
     and b.section_id <> new.section_id and o.school_year = t.yr and o.semester = t.sem
     and e.enrollment_id is distinct from new.enrollment_id
   limit 1;
  if clash is not null then
    raise exception '학생 %의 시간표가 겹칩니다 (%)', new.student_no, clash;
  end if;
  return new;
end $$;
create trigger trg_enrollment_chk before insert or update of section_id, student_no on enrollments
  for each row execute function chk_enrollment();

-- ---------------------------------------------------------------------
-- 결재: 작성자 제외, 1차(일반교사) → 최종(지정 부장교사), 반려 시 재상신
-- ---------------------------------------------------------------------
create or replace function chk_approval() returns trigger
language plpgsql as $$
declare n notices;
begin
  select * into n from notices where doc_no = new.doc_no;
  if new.teacher_no = n.writer_teacher_no then
    raise exception '작성자는 자신의 문서를 결재할 수 없습니다';
  end if;
  if new.step = '1차' and not exists (select 1 from junior_teachers where teacher_no = new.teacher_no) then
    raise exception '1차 결재자는 일반교사(후임교사)여야 합니다';
  end if;
  if new.step = '최종' and new.teacher_no <> n.reviewer_teacher_no then
    raise exception '최종 결재자는 문서에 지정된 검토 부장교사(%)여야 합니다', n.reviewer_teacher_no;
  end if;
  if new.step = '최종' and new.status = '결재완료' and not exists (
       select 1 from approvals where doc_no = new.doc_no and submit_round = new.submit_round
                                 and step = '1차' and status = '결재완료') then
    raise exception '1차 결재가 끝나야 최종 결재할 수 있습니다';
  end if;
  if tg_op = 'INSERT' and new.submit_round > 1 and not exists (
       select 1 from approvals where doc_no = new.doc_no and submit_round = new.submit_round - 1 and status = '반려') then
    if not exists (select 1 from approvals where doc_no = new.doc_no and submit_round = new.submit_round) then
      raise exception '이전 차수(%)가 반려된 경우에만 재상신할 수 있습니다', new.submit_round - 1;
    end if;
  end if;
  if new.status in ('결재완료','반려') and new.decided_at is null then
    new.decided_at := now();
  end if;
  return new;
end $$;
create trigger trg_approval_chk before insert or update on approvals
  for each row execute function chk_approval();

create or replace function sync_notice_status() returns trigger
language plpgsql as $$
begin
  if new.status = '반려' then
    update notices set status = '반려' where doc_no = new.doc_no;
  elsif new.step = '최종' and new.status = '결재완료' then
    update notices set status = '결재완료' where doc_no = new.doc_no;
  elsif new.status in ('기안','검토') then
    update notices set status = '결재중' where doc_no = new.doc_no and status in ('작성중','반려');
  end if;
  return new;
end $$;
create trigger trg_approval_sync after insert or update on approvals
  for each row execute function sync_notice_status();

-- 게시는 최종 결재완료 후에만
create or replace function chk_notice_publish() returns trigger
language plpgsql as $$
begin
  if new.status = '게시' and old.status <> '게시' and old.status <> '결재완료' then
    raise exception '최종 결재가 완료된 문서만 게시할 수 있습니다 (현재: %)', old.status;
  end if;
  return new;
end $$;
create trigger trg_notice_publish before update of status on notices
  for each row execute function chk_notice_publish();

-- ---------------------------------------------------------------------
-- 설문응답: 설문 문서·수신자 본인·회신기한 내만 (수정 시 최종제출일시 갱신)
-- ---------------------------------------------------------------------
create or replace function chk_survey_response() returns trigger
language plpgsql as $$
declare n notices;
begin
  select * into n from notices where doc_no = new.doc_no;
  if not n.has_survey then
    raise exception '설문이 없는 문서입니다';
  end if;
  if n.status <> '게시' then
    raise exception '게시된 문서에만 응답할 수 있습니다';
  end if;
  if not exists (select 1 from recipients where doc_no = new.doc_no and user_id = new.user_id) then
    raise exception '이 문서의 수신자만 응답할 수 있습니다';
  end if;
  if tg_op = 'UPDATE' then
    new.final_submitted_at := now();
  end if;
  if (new.final_submitted_at at time zone 'Asia/Seoul')::date > n.reply_deadline then
    raise exception '회신기한(%)이 지났습니다', n.reply_deadline;
  end if;
  return new;
end $$;
create trigger trg_survey_chk before insert or update on survey_responses
  for each row execute function chk_survey_response();

-- =====================================================================
-- 조회 뷰
-- =====================================================================

-- 분반별 현재 인원
create or replace view v_section_status as
select s.section_id, s.offering_id, s.section_no, s.teacher_no, s.max_capacity,
       count(e.enrollment_id)::int as current_count
  from sections s left join enrollments e using (section_id)
 group by s.section_id;

-- 개설과목 현황: 신청인원·정원·폐강기준 실시간 공개
create or replace view v_offering_status as
select o.offering_id, o.subject_code, sj.subject_name, sj.subject_category, sj.credits,
       sj.is_required, sj.is_small_class, o.school_year, o.semester, o.grade,
       o.status, o.closing_threshold,
       (select count(distinct a.student_no) from applications a
         where a.offering_id = o.offering_id and a.status not in ('폐강','추첨탈락'))::int as applicant_count,
       coalesce((select sum(max_capacity) from sections s where s.offering_id = o.offering_id), 0)::int as total_capacity,
       coalesce((select sum(current_count) from v_section_status v where v.offering_id = o.offering_id), 0)::int as enrolled_count
  from offered_courses o join subjects sj using (subject_code);

-- 필수 이수 누락자: 필수 과목을 이수·신청·배정 어디에도 없는 학생
create or replace view v_missing_required as
select st.student_no, u.name as student_name, st.grade, st.class_no, st.number,
       st.homeroom_teacher_no, sj.subject_code, sj.subject_name
  from students st join users u using (user_id)
  cross join subjects sj
 where sj.is_required
   and not exists (select 1 from completions c where c.student_no = st.student_no and c.subject_code = sj.subject_code)
   and not exists (select 1 from applications a join offered_courses o using (offering_id)
                    where a.student_no = st.student_no and o.subject_code = sj.subject_code
                      and a.status not in ('폐강','추첨탈락'))
   and not exists (select 1 from enrollments e join sections s using (section_id) join offered_courses o using (offering_id)
                    where e.student_no = st.student_no and o.subject_code = sj.subject_code);

-- 가정통신문 통계: 수신·열람·응답률 (수신내역 = 유도 속성)
create or replace view v_notice_stats as
select n.doc_no, n.title, n.status, n.has_survey, n.reply_deadline,
       count(r.user_id)::int                         as recipient_count,
       count(r.read_at)::int                         as read_count,
       count(sr.response_id)::int                    as response_count,
       case when count(r.user_id) = 0 then 0
            else round(100.0 * count(sr.response_id) / count(r.user_id), 2) end::numeric(5,2) as response_rate
  from notices n
  left join recipients r using (doc_no)
  left join survey_responses sr on sr.doc_no = r.doc_no and sr.user_id = r.user_id
 group by n.doc_no;

-- 설문 미응답자 (기한 경과 여부 포함) → 재안내 대상
create or replace view v_nonresponders as
select r.doc_no, n.title, n.reply_deadline, r.user_id, u.name, u.user_type, u.phone,
       r.read_at, r.reminded_at, (current_date > n.reply_deadline) as deadline_passed
  from recipients r
  join notices n using (doc_no)
  join users u using (user_id)
 where n.has_survey
   and not exists (select 1 from survey_responses sr where sr.doc_no = r.doc_no and sr.user_id = r.user_id);

-- 개인 시간표 (학생)
create or replace view v_student_timetable as
select e.student_no, o.school_year, o.semester, t.day_of_week, t.period,
       sj.subject_name, s.section_no, t.room_no, u.name as teacher_name, e.status as enrollment_status
  from enrollments e
  join sections s using (section_id)
  join offered_courses o using (offering_id)
  join subjects sj using (subject_code)
  join timetables t on t.section_id = s.section_id
  join teachers tc on tc.teacher_no = s.teacher_no
  join users u on u.user_id = tc.user_id;

-- =====================================================================
-- 처리 함수
-- =====================================================================

-- 처리 함수는 교사만 실행 (SQL Editor처럼 로그인 없이 실행하면 허용)
create or replace function assert_teacher() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not exists (select 1 from users where user_id = auth.uid() and user_type = '교사') then
    raise exception '교사만 실행할 수 있습니다';
  end if;
end $$;

-- 게시: 결재완료 문서를 게시하고 대상자에게 수신 기록 생성
create or replace function publish_notice(p_doc_no varchar) returns int
language plpgsql as $$
declare n notices; cnt int;
begin
  perform assert_teacher();
  select * into n from notices where doc_no = p_doc_no;
  update notices set status = '게시', posted_on = current_date where doc_no = p_doc_no;

  insert into recipients (doc_no, user_id, delivered_at)
  select p_doc_no, u.user_id, now()
    from users u
    left join students st on st.user_id = u.user_id
    left join parents  pa on pa.user_id = u.user_id
   where (n.target in ('학생','학생·학부모') and st.student_no is not null
          and (n.target_grade is null or st.grade = n.target_grade))
      or (n.target in ('학부모','학생·학부모') and pa.parent_no is not null
          and exists (select 1 from guardianships g join students s2 using (student_no)
                       where g.parent_no = pa.parent_no
                         and (n.target_grade is null or s2.grade = n.target_grade)))
  on conflict do nothing;
  get diagnostics cnt = row_count;
  return cnt;
end $$;

-- 미응답자 재안내: 재안내일시 기록
create or replace function remind_nonresponders(p_doc_no varchar) returns int
language plpgsql as $$
declare cnt int;
begin
  perform assert_teacher();
  update recipients r set reminded_at = now()
   where r.doc_no = p_doc_no
     and not exists (select 1 from survey_responses sr where sr.doc_no = r.doc_no and sr.user_id = r.user_id);
  get diagnostics cnt = row_count;
  return cnt;
end $$;

-- 빈자리가 가장 많은 분반에 배정 시도 (실패 시 false)
create or replace function try_enroll(p_student char, p_offering bigint, p_method text) returns boolean
language plpgsql as $$
declare v_section bigint;
begin
  for v_section in
    select v.section_id from v_section_status v
     where v.offering_id = p_offering and v.current_count < v.max_capacity
     order by (v.max_capacity - v.current_count) desc, v.section_no
  loop
    begin
      insert into enrollments (student_no, section_id, method) values (p_student, v_section, p_method);
      return true;
    exception when others then
      -- 시간 충돌 등 → 다음 분반 시도
    end;
  end loop;
  return false;
end $$;

-- 1·2차 신청 배정: 개설 확정 과목의 신청을 분반에 배정 (선착순 아님, 신청번호 무관 무작위)
create or replace function assign_applications(p_period bigint) returns table(assigned int, failed int)
language plpgsql as $$
declare a record; ok int := 0; ng int := 0;
begin
  perform assert_teacher();
  for a in
    select ap.application_id, ap.student_no, ap.offering_id
      from applications ap join offered_courses o using (offering_id)
     where ap.period_id = p_period and ap.status in ('신청','확인완료') and o.status = '개설'
     order by random()
  loop
    if try_enroll(a.student_no, a.offering_id, '신청배정') then
      update applications set status = '배정완료' where application_id = a.application_id;
      ok := ok + 1;
    else
      update applications set status = '재신청필요' where application_id = a.application_id;
      ng := ng + 1;
    end if;
  end loop;
  return query select ok, ng;
end $$;

-- 3차 추첨: 1지망부터 과목별 무작위 추첨, 탈락자는 차순위로 (접속 속도 무관)
create or replace function run_lottery(p_period bigint) returns table(rank smallint, assigned int, dropped int)
language plpgsql as $$
declare r smallint; a record; ok int; ng int;
begin
  perform assert_teacher();
  if (select round from application_periods where period_id = p_period) <> 3 then
    raise exception '추첨은 3차 신청일정에서만 실행합니다';
  end if;
  for r in 1..3 loop
    ok := 0; ng := 0;
    for a in
      select ap.application_id, ap.student_no, ap.offering_id
        from applications ap join offered_courses o using (offering_id)
       where ap.period_id = p_period and ap.preference_rank = r and ap.status in ('신청','확인완료')
         and o.status = '개설'
         -- 상위 지망에서 이미 배정된 학생 제외
         and not exists (select 1 from applications x where x.period_id = p_period
                          and x.student_no = ap.student_no and x.status = '배정완료')
       order by random()
    loop
      if try_enroll(a.student_no, a.offering_id, '추첨배정') then
        update applications set status = '배정완료' where application_id = a.application_id;
        ok := ok + 1;
      else
        update applications set status = '추첨탈락' where application_id = a.application_id;
        ng := ng + 1;
      end if;
    end loop;
    rank := r; assigned := ok; dropped := ng;
    return next;
  end loop;
  -- 상위 지망 배정으로 쓰이지 않은 하위 지망은 확인완료 처리
  update applications ap set status = '확인완료'
   where ap.period_id = p_period and ap.status = '신청'
     and exists (select 1 from applications x where x.period_id = p_period
                  and x.student_no = ap.student_no and x.status = '배정완료');
end $$;

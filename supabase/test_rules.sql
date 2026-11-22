-- 업무 규칙 검증 테스트 (각 블록은 실패해야 정상인 경우 '차단됨' 출력)
\set ON_ERROR_STOP 0
\echo '--- 필수 누락자 (20260005 정보) ---'
select student_no, student_name, subject_name from v_missing_required;

create or replace function expect_fail(p_sql text, p_label text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'X 통과됨(문제): ' || p_label;
exception when others then
  return 'O 차단됨: ' || p_label || ' → ' || sqlerrm;
end $$;

select expect_fail($$insert into applications (student_no, offering_id, period_id, applied_at)
  select '20260004', o.offering_id, 1, '2026-11-03 10:00+09' from offered_courses o where subject_code='MAT201'$$, '기이수 과목 재신청');
select expect_fail($$insert into applications (student_no, offering_id, period_id, applied_at)
  select '20260003', o.offering_id, 1, '2026-11-20 10:00+09' from offered_courses o where subject_code='CHE201'$$, '신청기간 외 신청');
select expect_fail($$insert into applications (student_no, offering_id, period_id)
  select '20260008', o.offering_id, 3 from offered_courses o where subject_code='CHE201'$$, '3차 희망순위 누락');
select expect_fail($$insert into applications (student_no, offering_id, period_id, preference_rank)
  select '20260008', o.offering_id, 3, 1 from offered_courses o where subject_code='PHI201'$$, '폐강 과목 신청');
select expect_fail($$insert into timetables (section_id, room_no, day_of_week, period)
  select s.section_id, 'LAB1', '화', 1 from sections s join offered_courses o using (offering_id) where subject_code='CHE201'$$, '교실 중복');
select expect_fail($$insert into timetables (section_id, room_no, day_of_week, period)
  select s.section_id, 'R202', '화', 4 from sections s join offered_courses o using (offering_id) where subject_code='PHY201'$$, '교사 중복 (T0005 화4 화학)');
select expect_fail($$insert into timetables (section_id, room_no, day_of_week, period)
  select s.section_id, 'R202', '월', 2 from sections s join offered_courses o using (offering_id) where subject_code='BIO201'$$, '학생 중복 (월2 대수 수강생)');
select expect_fail($$insert into senior_teachers values ('T0002')$$, '선임·후임 배타');
select expect_fail($$insert into approvals (teacher_no, doc_no, submit_round, step, status) values ('T0003','2026-52',1,'1차','검토')$$, '작성자 본인 결재');
select expect_fail($$insert into approvals (teacher_no, doc_no, submit_round, step, status) values ('T0004','2026-52',1,'최종','결재완료')$$, '지정되지 않은 최종 결재자');
select expect_fail($$update notices set status='게시', posted_on=current_date where doc_no='2026-51'$$, '결재 전 게시');
select expect_fail($$insert into survey_responses (doc_no, user_id, answers) values ('2026-50','20000000-0000-0000-0000-000000000001','{}')$$, '수신자 아닌 사람 응답');
select expect_fail($$insert into survey_responses (doc_no, user_id, answers) values ('2026-50','30000000-0000-0000-0000-000000000001','{}')$$, '같은 문서 중복 응답');
select expect_fail($$insert into closure_decisions (teacher_no, offering_id, applicant_count, threshold, is_small_class, teacher_willing, result, reason)
  values ('T0003', 1, 3, 5, false, false, '폐강', ' ')$$, '폐강 판단 사유 누락');

\echo '--- 시연 흐름: 20260005 정보 3차 신청 → 누락자 사라짐 ---'
insert into applications (student_no, offering_id, period_id, preference_rank)
  select '20260005', o.offering_id, 3, 1 from offered_courses o where subject_code='INF201';
select count(*) as missing_after from v_missing_required;

\echo '--- 3차 추첨 (경제 잔여 1석에 2명 1지망) ---'
select * from run_lottery(3);
select a.student_no, sj.subject_name, a.preference_rank, a.status
  from applications a join offered_courses o using (offering_id) join subjects sj using (subject_code)
 where a.period_id = 3 order by 1,3;

\echo '--- 반려 후 재상신 문서 최종 결재 → 게시 ---'
update approvals set status='결재완료' where doc_no='2026-51' and submit_round=2 and step='최종';
select publish_notice('2026-51') as recipients_created;
select doc_no, status, recipient_count from v_notice_stats where doc_no='2026-51';

\echo '--- 설문 수정 → 최종제출일시 갱신 / 미응답자 재안내 ---'
update survey_responses set answers='{"1":"참석"}' where doc_no='2026-50' and user_id='30000000-0000-0000-0000-000000000002';
select remind_nonresponders('2026-50') as reminded;
select name, deadline_passed, reminded_at is not null as reminded from v_nonresponders;

\echo '--- 학생 개인 시간표 (20260001) ---'
select day_of_week, period, subject_name, room_no, teacher_name from v_student_timetable where student_no='20260001' order by 1,2;
drop function expect_fail(text,text);

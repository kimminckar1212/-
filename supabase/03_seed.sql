-- =====================================================================
-- 03_seed.sql : 시연용 테스트 데이터 (가상 학교 / 2027학년도 1학기 수강신청)
-- 시나리오: 정상 신청 · 필수 누락 상담 · 폐강 처리 · 소인수 예외 개설
--           · 3차 추첨 · 가정통신문 게시·응답 · 반려 후 재상신
-- =====================================================================

-- 사용자 ---------------------------------------------------------------
insert into users (user_id, user_type, name, phone, email) values
 ('10000000-0000-0000-0000-000000000001','교사','김영호','010-1000-0001','t0001@school.example'),
 ('10000000-0000-0000-0000-000000000002','교사','이수진','010-1000-0002','t0002@school.example'),
 ('10000000-0000-0000-0000-000000000003','교사','박민준','010-1000-0003','t0003@school.example'),
 ('10000000-0000-0000-0000-000000000004','교사','최은정','010-1000-0004','t0004@school.example'),
 ('10000000-0000-0000-0000-000000000005','교사','정하늘','010-1000-0005','t0005@school.example'),
 ('20000000-0000-0000-0000-000000000001','학생','강지민','010-2000-0001','s20260001@school.example'),
 ('20000000-0000-0000-0000-000000000002','학생','강지호','010-2000-0002','s20260002@school.example'),
 ('20000000-0000-0000-0000-000000000003','학생','윤서연','010-2000-0003','s20260003@school.example'),
 ('20000000-0000-0000-0000-000000000004','학생','한도윤','010-2000-0004','s20260004@school.example'),
 ('20000000-0000-0000-0000-000000000005','학생','오하린','010-2000-0005','s20260005@school.example'),
 ('20000000-0000-0000-0000-000000000006','학생','임준서','010-2000-0006','s20260006@school.example'),
 ('20000000-0000-0000-0000-000000000007','학생','서예은','010-2000-0007','s20260007@school.example'),
 ('20000000-0000-0000-0000-000000000008','학생','조민재','010-2000-0008','s20260008@school.example'),
 ('30000000-0000-0000-0000-000000000001','학부모','강현주','010-3000-0001','p1@school.example'),
 ('30000000-0000-0000-0000-000000000002','학부모','윤성민','010-3000-0002','p2@school.example'),
 ('30000000-0000-0000-0000-000000000003','학부모','오미경','010-3000-0003','p3@school.example'),
 ('30000000-0000-0000-0000-000000000004','학부모','임재훈','010-3000-0004','p4@school.example');

-- 교사 · 선임/후임 ------------------------------------------------------
insert into teachers (teacher_no, user_id, subject_area, duty, department) values
 ('T0001','10000000-0000-0000-0000-000000000001','국어','교무기획','교무부'),
 ('T0002','10000000-0000-0000-0000-000000000002','수학','1학년 3반 담임','교무부'),
 ('T0003','10000000-0000-0000-0000-000000000003','영어·사회','교육과정 담당','교육과정부'),
 ('T0004','10000000-0000-0000-0000-000000000004','정보','정보부장','교육과정부'),
 ('T0005','10000000-0000-0000-0000-000000000005','과학','과학실 관리','교육과정부');
insert into senior_teachers (teacher_no) values ('T0001'),('T0004');
insert into junior_teachers (teacher_no) values ('T0002'),('T0003'),('T0005');

-- 학생 (현재 1학년 3반, 담임 T0002) -------------------------------------
insert into students (student_no, user_id, grade, class_no, number, homeroom_teacher_no) values
 ('20260001','20000000-0000-0000-0000-000000000001',1,3,1,'T0002'),
 ('20260002','20000000-0000-0000-0000-000000000002',1,3,2,'T0002'),
 ('20260003','20000000-0000-0000-0000-000000000003',1,3,3,'T0002'),
 ('20260004','20000000-0000-0000-0000-000000000004',1,3,4,'T0002'),
 ('20260005','20000000-0000-0000-0000-000000000005',1,3,5,'T0002'),
 ('20260006','20000000-0000-0000-0000-000000000006',1,3,6,'T0002'),
 ('20260007','20000000-0000-0000-0000-000000000007',1,3,7,'T0002'),
 ('20260008','20000000-0000-0000-0000-000000000008',1,3,8,'T0002');

-- 학부모 · 보호관계 (강현주 = 다자녀) -----------------------------------
insert into parents (user_id) values
 ('30000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003'),
 ('30000000-0000-0000-0000-000000000004');
insert into guardianships (student_no, parent_no, relation_type)
select s, (select parent_no from parents where user_id = u::uuid), rel
  from (values ('20260001','30000000-0000-0000-0000-000000000001','모'),
               ('20260002','30000000-0000-0000-0000-000000000001','모'),
               ('20260003','30000000-0000-0000-0000-000000000002','부'),
               ('20260005','30000000-0000-0000-0000-000000000003','모'),
               ('20260006','30000000-0000-0000-0000-000000000004','부')) v(s,u,rel);

-- 과목 -----------------------------------------------------------------
insert into subjects (subject_code, subject_name, subject_category, credits, is_required, is_small_class, choice_group, choice_n) values
 ('KOR101','공통국어','공통',4,true,false,null,null),
 ('HIS101','한국사','공통',3,true,false,null,null),
 ('INF201','정보','진로선택',2,true,false,null,null),
 ('MAT201','대수','일반선택',4,false,false,null,null),
 ('ENG201','영어Ⅰ','일반선택',4,false,false,null,null),
 ('PHY201','물리학','일반선택',3,false,false,'과학탐구',2),
 ('CHE201','화학','일반선택',3,false,false,'과학탐구',2),
 ('BIO201','생명과학','일반선택',3,false,false,'과학탐구',2),
 ('ECO201','경제','진로선택',3,false,true,null,null),
 ('PHI201','철학','진로선택',2,false,true,null,null);

-- 이수내역 (1학년 1학기) — 20260004는 대수를 공동교육과정으로 선이수
insert into completions (student_no, subject_code, school_year, grade, semester)
select s.student_no, c, 2026, 1, 1 from students s cross join (values ('KOR101'),('HIS101')) v(c);
insert into completions (student_no, subject_code, school_year, grade, semester) values ('20260004','MAT201',2026,1,2);

-- 개설과목 (2027학년도 1학기 2학년) -------------------------------------
insert into offered_courses (subject_code, school_year, grade, semester)
select c, 2027, 2, 1 from (values ('INF201'),('MAT201'),('ENG201'),('PHY201'),('CHE201'),('BIO201'),('ECO201'),('PHI201')) v(c);

-- 신청일정 (3차는 시연일 기준 접수 중) ----------------------------------
insert into application_periods (school_year, semester, round, starts_at, ends_at) values
 (2027,1,1,'2026-11-02 09:00+09','2026-11-06 18:00+09'),
 (2027,1,2,'2026-11-09 09:00+09','2026-11-13 18:00+09'),
 (2027,1,3,'2026-11-20 09:00+09','2026-11-30 18:00+09');

-- 1차 수강신청 ----------------------------------------------------------
create temp table _req(student_no char(8), subject_code varchar(10));
insert into _req values
 ('20260001','INF201'),('20260001','MAT201'),('20260001','ENG201'),('20260001','PHY201'),('20260001','CHE201'),('20260001','ECO201'),
 ('20260002','INF201'),('20260002','MAT201'),('20260002','ENG201'),('20260002','PHY201'),('20260002','BIO201'),('20260002','ECO201'),
 ('20260003','INF201'),('20260003','MAT201'),('20260003','ENG201'),('20260003','PHY201'),('20260003','BIO201'),('20260003','PHI201'),
 ('20260004','INF201'),                    ('20260004','ENG201'),('20260004','PHY201'),('20260004','BIO201'),('20260004','PHI201'),
 -- 20260005: 필수과목 '정보' 미신청 → 누락자
                       ('20260005','MAT201'),('20260005','ENG201'),('20260005','PHY201'),('20260005','BIO201'),
 ('20260006','INF201'),('20260006','MAT201'),('20260006','ENG201'),('20260006','CHE201'),('20260006','BIO201'),('20260006','ECO201'),
 ('20260007','INF201'),('20260007','MAT201'),('20260007','ENG201'),('20260007','CHE201'),('20260007','BIO201'),('20260007','ECO201'),
 ('20260008','INF201'),('20260008','MAT201'),('20260008','ENG201'),('20260008','CHE201'),('20260008','BIO201'),('20260008','PHI201');
insert into applications (student_no, offering_id, period_id, applied_at, status)
select r.student_no, o.offering_id, p.period_id, '2026-11-03 10:00+09', '확인완료'
  from _req r
  join offered_courses o on o.subject_code = r.subject_code and o.school_year = 2027 and o.semester = 1
  join application_periods p on p.school_year = 2027 and p.semester = 1 and p.round = 1;
drop table _req;

-- 교실 · 분반 · 시간표 ----------------------------------------------------
insert into classrooms (room_no, room_name, capacity) values
 ('R201','2학년 1반 교실',30),('R202','2학년 2반 교실',30),('LAB1','과학실',24),
 ('LAB2','컴퓨터실',30),('R301','소인수 교실',12);

insert into sections (offering_id, teacher_no, section_no, assigned_hours, max_capacity)
select o.offering_id, t, 1, h, cap
  from (values ('INF201','T0004',2,30),('MAT201','T0002',3,30),('ENG201','T0003',3,30),
               ('PHY201','T0005',2,24),('CHE201','T0005',2,24),('BIO201','T0005',2,24),
               ('ECO201','T0003',2,5),('PHI201','T0002',2,10)) v(c,t,h,cap)
  join offered_courses o on o.subject_code = v.c and o.school_year = 2027 and o.semester = 1;

insert into timetables (section_id, room_no, day_of_week, period)
select s.section_id, room, d, p
  from (values ('INF201','LAB2','월',1),('INF201','LAB2','수',1),
               ('MAT201','R201','월',2),('MAT201','R201','화',2),('MAT201','R201','목',2),
               ('ENG201','R202','월',3),('ENG201','R202','화',3),('ENG201','R202','금',3),
               ('PHY201','LAB1','화',1),('PHY201','LAB1','목',1),
               ('CHE201','LAB1','화',4),('CHE201','LAB1','목',4),
               ('BIO201','LAB1','수',2),('BIO201','LAB1','금',2),
               ('ECO201','R301','수',5),('ECO201','R301','금',5)) v(c,room,d,p)
  join offered_courses o on o.subject_code = v.c and o.school_year = 2027 and o.semester = 1
  join sections s on s.offering_id = o.offering_id;

-- 폐강 판단 (1차 마감 후) -------------------------------------------------
insert into closure_decisions (teacher_no, offering_id, decided_on, applicant_count, threshold, is_small_class, teacher_willing, result, reason)
select 'T0003', o.offering_id, '2026-11-07', 4, 5, true, true, '개설',
       '신청 4명으로 폐강 기준(5명 이하)에 해당하나 소인수 교과이며 담당 교사 진행 의사가 있어 예외 개설'
  from offered_courses o where o.subject_code = 'ECO201' and o.school_year = 2027;
insert into closure_decisions (teacher_no, offering_id, decided_on, applicant_count, threshold, is_small_class, teacher_willing, result, reason)
select 'T0002', o.offering_id, '2026-11-07', 3, 5, true, false, '폐강',
       '신청 3명으로 폐강 기준 이하이며 담당 교사 시수 부족으로 진행 불가. 신청자 3차 재신청 안내'
  from offered_courses o where o.subject_code = 'PHI201' and o.school_year = 2027;
update offered_courses set status = '개설' where school_year = 2027 and status = '개설예정';

-- 1차 신청 배정 실행
select * from assign_applications((select period_id from application_periods where school_year=2027 and semester=1 and round=1));

-- 필수 누락 상담 (20260005 → 정보 신청 지도)
insert into counselings (teacher_no, student_no, changed_offering_id, counsel_type, counseled_at, content)
select 'T0002','20260005', o.offering_id, '필수이수누락', '2026-11-10 15:30+09',
       '필수 이수 과목 정보 미신청 확인. 졸업 요건 안내 후 3차 신청 시 정보 1지망 신청하기로 함'
  from offered_courses o where o.subject_code = 'INF201' and o.school_year = 2027;

-- 3차 신청 (접수 중, 추첨 전) — 폐강된 철학 신청자
-- (20260005·20260008은 시연 중 직접 신청)
insert into applications (student_no, offering_id, period_id, preference_rank, applied_at)
select v.s, o.offering_id, p.period_id, v.rk, '2026-11-21 08:00+09'
  from (values ('20260003','ECO201',1),('20260003','CHE201',2),
               ('20260004','ECO201',1),('20260004','CHE201',2)) v(s,c,rk)
  join offered_courses o on o.subject_code = v.c and o.school_year = 2027 and o.semester = 1
  join application_periods p on p.school_year = 2027 and p.semester = 1 and p.round = 3;

-- 가정통신문 ------------------------------------------------------------
-- 2026-50: 게시 완료 + 설문 (학부모 대상)
insert into notices (doc_no, title, body, writer_teacher_no, reviewer_teacher_no, department, target, has_survey, survey_questions, reply_deadline)
values ('2026-50','학부모 대상 고교학점제 설명회 참석 안내',
        '2027학년도 고교학점제 운영과 과목 선택 방법을 안내하는 설명회를 아래와 같이 개최합니다. 일시: 2026. 11. 27.(금) 19:00 / 장소: 본교 시청각실',
        'T0002','T0001','교무부','학부모',true,
        '[{"no":1,"type":"단일선택","question":"설명회 참석 여부","options":["참석","불참"]},
          {"no":2,"type":"복수선택","question":"관심 주제","options":["과목 선택","진로 연계","대입 반영"]},
          {"no":3,"type":"서술형","question":"사전 질문"}]'::jsonb,
        '2026-11-28');
insert into approvals (teacher_no, doc_no, submit_round, step, status, decided_at) values
 ('T0003','2026-50',1,'1차','결재완료','2026-11-18 10:00+09'),
 ('T0001','2026-50',1,'최종','결재완료','2026-11-18 14:00+09');
select publish_notice('2026-50');
-- 시연용 시간 흐름: 이틀 전 게시·배부 → 하루 전 열람
update notices set posted_on = current_date - 2 where doc_no = '2026-50';
update recipients set delivered_at = now() - interval '2 days' where doc_no = '2026-50';
update recipients set read_at = now() - interval '1 day'
 where doc_no = '2026-50' and user_id in ('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003');
insert into survey_responses (doc_no, user_id, answers) values
 ('2026-50','30000000-0000-0000-0000-000000000001','{"1":"참석","2":["과목 선택","대입 반영"],"3":"두 자녀가 같은 과목을 들을 수 있나요?"}'),
 ('2026-50','30000000-0000-0000-0000-000000000002','{"1":"불참","2":["진로 연계"],"3":""}');

-- 2026-51: 1회차 반려 → 2회차 재상신, 최종 결재 대기
insert into notices (doc_no, title, body, writer_teacher_no, reviewer_teacher_no, department, target, target_grade, has_survey)
values ('2026-51','2027학년도 1학기 3차 수강신청(희망 순위 추첨) 안내',
        '3차 수강신청은 선착순이 아닌 1~3지망 희망 순위 추첨으로 진행합니다. 기간: 11. 20.(금) ~ 11. 30.(월) 18:00',
        'T0005','T0004','교육과정부','학생',1,false);
insert into approvals (teacher_no, doc_no, submit_round, step, status, decided_at, reject_reason) values
 ('T0002','2026-51',1,'1차','결재완료','2026-11-17 09:30+09',null),
 ('T0004','2026-51',1,'최종','반려','2026-11-17 16:00+09','추첨 방식(차순위 배정)과 결과 발표일이 빠져 있음. 보완 후 재상신 바람');
insert into approvals (teacher_no, doc_no, submit_round, step, status, decided_at) values
 ('T0002','2026-51',2,'1차','결재완료','2026-11-19 11:00+09');
insert into approvals (teacher_no, doc_no, submit_round, step, status) values
 ('T0004','2026-51',2,'최종','검토');

-- 2026-52: 작성중
insert into notices (doc_no, title, body, writer_teacher_no, reviewer_teacher_no, department, target, has_survey, survey_questions, reply_deadline)
values ('2026-52','겨울방학 방과후학교 수요 조사','겨울방학 방과후학교 개설 희망 강좌를 조사합니다.',
        'T0003','T0001','교육과정부','학생·학부모',true,
        '[{"no":1,"type":"복수선택","question":"희망 강좌","options":["수학 심화","영어 회화","코딩"]}]'::jsonb,
        '2026-12-10');

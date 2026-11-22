-- =====================================================================
-- 2조 무명 | 학교 수강신청 및 가정통신문 통합 관리 시스템
-- 01_schema.sql : 테이블 23개 (최종 ERD 그림 Ⅵ-4, 릴레이션 스키마 표 Ⅵ-21)
-- 대상: Supabase (PostgreSQL 15+)
-- 테이블·컬럼 이름은 영문(앱 코드 호환), 한글 이름은 COMMENT로 기록
-- =====================================================================

-- 공통: 수정일시 자동 갱신 -------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- 1. 사용자·인적 정보 (7)
-- =====================================================================

-- 사용자 (D02: Supabase Auth 계정 ID와 같은 값)
create table users (
  user_id     uuid primary key default gen_random_uuid(),
  user_type   varchar(5)   not null check (user_type in ('학생','교사','학부모')),
  name        varchar(20)  not null check (length(trim(name)) >= 1),
  phone       varchar(13)  check (phone ~ '^010-[0-9]{4}-[0-9]{4}$'),
  email       varchar(100) not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  updated_by  uuid
);

-- 교사 (학생보다 먼저: 담임교사번호 참조)
create table teachers (
  teacher_no    char(5)      primary key check (teacher_no ~ '^T[0-9]{4}$'),
  user_id       uuid         not null unique references users(user_id) on delete cascade,
  subject_area  varchar(100),          -- 담당교과
  duty          varchar(100),          -- 담당업무
  department    varchar(100),          -- 소속부서
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  updated_by    uuid
);

-- 학생
create table students (
  student_no           char(8)  primary key check (student_no ~ '^[0-9]{8}$'),
  user_id              uuid     not null unique references users(user_id) on delete cascade,
  grade                smallint not null check (grade between 1 and 3),
  class_no             smallint not null check (class_no between 1 and 99),
  number               smallint not null check (number between 1 and 99),
  homeroom_teacher_no  char(5)  references teachers(teacher_no),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid,
  unique (grade, class_no, number)
);

-- 학부모
create table parents (
  parent_no   bigint generated always as identity primary key,
  user_id     uuid not null unique references users(user_id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- 선임교사 (= 부장교사, 최종 결재·검토)
create table senior_teachers (
  teacher_no  char(5) primary key references teachers(teacher_no) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- 후임교사 (= 일반교사, 기안·1차 결재)
create table junior_teachers (
  teacher_no  char(5) primary key references teachers(teacher_no) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- 보호관계 (학부모 M:N 학생 해소)
create table guardianships (
  guardianship_id  bigint generated always as identity primary key,
  student_no       char(8) not null references students(student_no) on delete cascade,
  parent_no        bigint  not null references parents(parent_no) on delete cascade,
  relation_type    varchar(10) not null check (relation_type in ('부','모','기타 보호자')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  unique (student_no, parent_no)
);

-- =====================================================================
-- 2. 과목·수강신청·이수 (5)
-- =====================================================================

-- 필수과목 (교육과정 과목 목록. 필수이수여부로 필수 여부 구분)
create table subjects (
  subject_code      varchar(10)  primary key check (subject_code ~ '^[A-Z]{2,5}[0-9]{1,5}$'),
  subject_name      varchar(100) not null,
  subject_category  varchar(10)  not null check (subject_category in ('공통','일반선택','진로선택','융합선택')),
  credits           smallint     not null check (credits between 0 and 10),
  is_required       boolean      not null default false,  -- 필수이수여부
  is_small_class    boolean      not null default false,  -- 소인수교과여부
  choice_group      varchar(20),                          -- 택N 선택군 이름
  choice_n          smallint     check (choice_n between 1 and 10), -- 택N의 N
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),
  updated_by        uuid,
  check ((choice_group is null) = (choice_n is null))
);

-- 개설과목 (학년도·학기·학년별 개설)
create table offered_courses (
  offering_id        bigint generated always as identity primary key,
  subject_code       varchar(10) not null references subjects(subject_code),
  school_year        smallint    not null check (school_year between 2020 and 2100),
  grade              smallint    not null check (grade between 1 and 3),
  semester           smallint    not null check (semester between 1 and 2),
  closing_threshold  smallint    not null default 5 check (closing_threshold >= 0), -- 폐강기준인원 (이하 폐강)
  status             varchar(5)  not null default '개설예정' check (status in ('개설예정','개설','폐강')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  unique (subject_code, school_year, grade, semester)
);

-- 신청일정 (학년도·학기·차수별 접수 기간)
create table application_periods (
  period_id    bigint generated always as identity primary key,
  school_year  smallint    not null check (school_year between 2020 and 2100),
  semester     smallint    not null check (semester between 1 and 2),
  round        smallint    not null check (round between 1 and 3),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  check (ends_at > starts_at),
  unique (school_year, semester, round)
);

-- 수강신청내역
create table applications (
  application_id   bigint generated always as identity primary key,
  student_no       char(8)  not null references students(student_no) on delete cascade,
  offering_id      bigint   not null references offered_courses(offering_id),
  period_id        bigint   not null references application_periods(period_id),
  preference_rank  smallint check (preference_rank between 1 and 3), -- 3차만 1~3지망
  applied_at       timestamptz not null default now(),
  status           varchar(6) not null default '신청'
                   check (status in ('신청','확인완료','재신청필요','폐강','추첨탈락','배정완료')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  unique (period_id, student_no, offering_id),       -- 같은 일정·학생·과목 1건
  unique (period_id, student_no, preference_rank)    -- 같은 지망 순위 중복 불가 (NULL 제외)
);

-- 이수내역
create table completions (
  completion_id  bigint generated always as identity primary key,
  student_no     char(8)     not null references students(student_no) on delete cascade,
  subject_code   varchar(10) not null references subjects(subject_code),
  school_year    smallint    not null check (school_year between 2020 and 2100),
  grade          smallint    not null check (grade between 1 and 3),
  semester       smallint    not null check (semester between 1 and 2),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  unique (student_no, subject_code)
);

-- =====================================================================
-- 3. 수업 운영·상담·폐강 (6)
-- =====================================================================

-- 교실
create table classrooms (
  room_no     varchar(10)  primary key,
  room_name   varchar(100) not null,
  capacity    smallint     not null check (capacity >= 0),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  updated_by  uuid
);

-- 분반계획
create table sections (
  section_id      bigint generated always as identity primary key,
  offering_id     bigint   not null references offered_courses(offering_id) on delete cascade,
  teacher_no      char(5)  not null references teachers(teacher_no),
  section_no      smallint not null check (section_no between 1 and 99), -- 분반 번호
  assigned_hours  smallint not null check (assigned_hours between 0 and 10), -- 교사배정시수
  max_capacity    smallint not null check (max_capacity >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  unique (offering_id, section_no)
);

-- 수강배정
create table enrollments (
  enrollment_id  bigint generated always as identity primary key,
  student_no     char(8) not null references students(student_no) on delete cascade,
  section_id     bigint  not null references sections(section_id) on delete cascade,
  method         varchar(4) not null check (method in ('신청배정','추첨배정','자동배정','수정배정')),
  status         varchar(2) not null default '배정' check (status in ('배정','수정','확정')),
  change_reason  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  unique (student_no, section_id),
  check (method <> '수정배정' or change_reason is not null)
);

-- 시간표
create table timetables (
  timetable_id  bigint generated always as identity primary key,
  section_id    bigint      not null references sections(section_id) on delete cascade,
  room_no       varchar(10) not null references classrooms(room_no),
  day_of_week   char(1)     not null check (day_of_week in ('월','화','수','목','금')),
  period        smallint    not null check (period between 1 and 8),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  unique (section_id, day_of_week, period)
);

-- 상담기록 (교사·학생·변경 개설과목의 삼항 관계에서 올라온 개체)
create table counselings (
  counseling_id        bigint generated always as identity primary key,
  teacher_no           char(5) not null references teachers(teacher_no),
  student_no           char(8) not null references students(student_no) on delete cascade,
  changed_offering_id  bigint  references offered_courses(offering_id), -- 변경 대상 개설과목
  counsel_type         varchar(6) not null check (counsel_type in ('필수이수누락','과목변경','기타')),
  counseled_at         timestamptz not null default now(),
  content              text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid,
  check (counsel_type <> '과목변경' or changed_offering_id is not null)
);

-- 폐강판단기록
create table closure_decisions (
  decision_id      bigint generated always as identity primary key,
  teacher_no       char(5) not null references teachers(teacher_no),   -- 판단교사
  offering_id      bigint  not null references offered_courses(offering_id) on delete cascade,
  decided_on       date    not null default current_date,
  applicant_count  smallint not null check (applicant_count >= 0),     -- 판단 시 신청인원
  threshold        smallint not null check (threshold >= 0),           -- 폐강기준인원
  is_small_class   boolean  not null,                                  -- 소인수교과여부
  teacher_willing  boolean  not null,                                  -- 교사 진행 의사
  result           varchar(2) not null check (result in ('개설','폐강')),
  reason           text not null check (length(trim(reason)) > 0),     -- 판단사유 필수
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);

-- =====================================================================
-- 4. 가정통신문·결재·수신 (5)
-- =====================================================================

-- 가정통신문
create table notices (
  doc_no               varchar(12)  primary key check (doc_no ~ '^[0-9]{4}-[0-9]{1,7}$'),
  title                varchar(100) not null,
  body                 text         not null,
  writer_teacher_no    char(5)      not null references junior_teachers(teacher_no),  -- 작성(후임)
  reviewer_teacher_no  char(5)      not null references senior_teachers(teacher_no),  -- 검토(선임)
  department           varchar(100),
  target               varchar(7)   not null check (target in ('학생','학부모','학생·학부모')),
  target_grade         smallint     check (target_grade between 1 and 3),  -- NULL = 전 학년
  has_survey           boolean      not null default false,
  survey_questions     jsonb,       -- [{"no":1,"type":"단일선택","question":"...","options":[...]}]
  reply_deadline       date,
  delivery_method      varchar(10)  not null default 'e알리미·홈페이지'
                       check (delivery_method in ('e알리미','홈페이지','e알리미·홈페이지')),
  posted_on            date,
  status               varchar(4)   not null default '작성중'
                       check (status in ('작성중','결재중','반려','결재완료','게시','취소')),
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now(),
  updated_by           uuid,
  check (not has_survey or (survey_questions is not null and reply_deadline is not null)),
  check (status <> '게시' or posted_on is not null)
);

-- 첨부파일 (약한 개체: 문서번호 + 첨부번호)
create table attachments (
  doc_no        varchar(12)  not null references notices(doc_no) on delete cascade,
  attach_no     smallint     not null check (attach_no >= 1),
  file_name     varchar(100) not null,
  storage_path  varchar(255) not null,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  updated_by    uuid,
  primary key (doc_no, attach_no)
);

-- 수신 (사용자 M:N 가정통신문 관계 릴레이션)
create table recipients (
  doc_no        varchar(12) not null references notices(doc_no) on delete cascade,
  user_id       uuid        not null references users(user_id) on delete cascade,
  delivered_at  timestamptz,   -- 배부일시
  read_at       timestamptz,   -- 열람일시
  reminded_at   timestamptz,   -- 재안내일시
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  primary key (doc_no, user_id)
);

-- 설문응답 (수신자별 문서당 1건, 회신기한 내 수정)
create table survey_responses (
  response_id         bigint generated always as identity primary key,
  doc_no              varchar(12) not null references notices(doc_no) on delete cascade,
  user_id             uuid        not null references users(user_id) on delete cascade,
  answers             jsonb       not null,   -- {"1":"참석","2":["A","B"],"3":"서술"}
  final_submitted_at  timestamptz not null default now(), -- 최종제출일시
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  unique (doc_no, user_id)
);

-- 결재이력 (교사 M:N 가정통신문 + 차수별 결재이력)
create table approvals (
  teacher_no     char(5)     not null references teachers(teacher_no),
  doc_no         varchar(12) not null references notices(doc_no) on delete cascade,
  submit_round   smallint    not null check (submit_round >= 1),       -- 상신차수
  step           varchar(2)  not null check (step in ('1차','최종')),
  status         varchar(4)  not null default '검토' check (status in ('기안','검토','결재완료','반려')),
  decided_at     timestamptz,                                          -- 결재일시
  reject_reason  text,                                                 -- 반려사유
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  primary key (teacher_no, doc_no, submit_round),
  unique (doc_no, submit_round, step),
  check (status <> '반려' or (reject_reason is not null and length(trim(reject_reason)) > 0)),
  check (status not in ('결재완료','반려') or decided_at is not null)
);

-- 수정일시 트리거 일괄 부착 ------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'users','teachers','students','parents','senior_teachers','junior_teachers','guardianships',
    'subjects','offered_courses','application_periods','applications','completions',
    'classrooms','sections','enrollments','timetables','counselings','closure_decisions',
    'notices','attachments','recipients','survey_responses','approvals']
  loop
    execute format('create trigger trg_%1$s_updated before update on %1$I
                    for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- 한글 이름 주석 ----------------------------------------------------------
comment on table users               is '사용자';
comment on table teachers            is '교사';
comment on table students            is '학생';
comment on table parents             is '학부모';
comment on table senior_teachers     is '선임교사(부장교사)';
comment on table junior_teachers     is '후임교사(일반교사)';
comment on table guardianships       is '보호관계';
comment on table subjects            is '필수과목(교육과정 과목)';
comment on table offered_courses     is '개설과목';
comment on table application_periods is '신청일정';
comment on table applications        is '수강신청내역';
comment on table completions         is '이수내역';
comment on table classrooms          is '교실';
comment on table sections            is '분반계획';
comment on table enrollments         is '수강배정';
comment on table timetables          is '시간표';
comment on table counselings         is '상담기록';
comment on table closure_decisions   is '폐강판단기록';
comment on table notices             is '가정통신문';
comment on table attachments         is '첨부파일';
comment on table recipients          is '수신';
comment on table survey_responses    is '설문응답';
comment on table approvals           is '결재이력';

-- =====================================================================
-- 07_fix_dates.sql : 시연 데이터 날짜 보정 (v1.3)
-- 열람일시가 배부(게시)일시보다 앞선 기록을 배부 30분 뒤로 고침
-- 여러 번 실행해도 안전함
-- =====================================================================
update recipients
   set read_at = delivered_at + interval '30 minutes'
 where read_at is not null and delivered_at is not null and read_at < delivered_at;

-- 확인: 0이 나오면 정상
select count(*) as wrong_rows from recipients where read_at < delivered_at;

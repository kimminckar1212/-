-- =====================================================================
-- 04_auth.sql : 시드 사용자를 Supabase Auth 로그인 계정으로 등록
-- 비밀번호는 모두 test1234 (시연용). Supabase SQL Editor에서 실행.
-- 이미 등록된 이메일은 건너뜀.
-- =====================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', u.user_id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('test1234', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('name', u.name, 'user_type', u.user_type),
       now(), now(), '', '', '', ''
  from public.users u
 where not exists (select 1 from auth.users a where a.id = u.user_id or a.email = u.email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.user_id, u.user_id::text,
       jsonb_build_object('sub', u.user_id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from public.users u
 where not exists (select 1 from auth.identities i where i.user_id = u.user_id and i.provider = 'email');

begin;

alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('ADMIN', 'DOMAIN_EXPERT', 'GENERAL_USER'));

commit;

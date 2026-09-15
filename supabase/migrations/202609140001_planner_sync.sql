create table if not exists public.planner_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.planner_states add column if not exists revision bigint not null default 0;
alter table public.planner_states add column if not exists last_mutation_id uuid;
alter table public.planner_states enable row level security;

drop policy if exists planner_owner_read on public.planner_states;
create policy planner_owner_read on public.planner_states
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists planner_owner_fence on public.planner_states;
create policy planner_owner_fence on public.planner_states as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.planner_states from public, anon, authenticated;
grant select on public.planner_states to authenticated;

create or replace function public.save_planner_state(
  p_user_id uuid,
  p_state jsonb,
  p_expected_revision bigint,
  p_mutation_id uuid
)
returns table(outcome text, revision bigint, mutation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.planner_states%rowtype;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Planner owner does not match the authenticated user' using errcode = '42501';
  end if;
  if p_mutation_id is null or p_state is null or jsonb_typeof(p_state) <> 'object'
      or p_expected_revision < 0 then
    raise exception 'Invalid planner write' using errcode = '22023';
  end if;

  if p_expected_revision is null then
    insert into public.planner_states(user_id, state_json, revision, last_mutation_id, updated_at)
      values (p_user_id, p_state, 1, p_mutation_id, clock_timestamp())
      on conflict (user_id) do nothing
      returning * into current_row;
    if found then
      return query select 'saved'::text, current_row.revision, current_row.last_mutation_id;
      return;
    end if;
  end if;

  select * into current_row from public.planner_states where user_id = p_user_id for update;
  if not found then
    return query select 'conflict'::text, null::bigint, null::uuid;
    return;
  end if;

  if current_row.last_mutation_id = p_mutation_id then
    if current_row.state_json is distinct from p_state then
      raise exception 'Mutation ID was reused for different data' using errcode = '22023';
    end if;
    return query select 'saved'::text, current_row.revision, current_row.last_mutation_id;
    return;
  end if;

  if current_row.revision is distinct from p_expected_revision then
    return query select 'conflict'::text, current_row.revision, current_row.last_mutation_id;
    return;
  end if;

  update public.planner_states set
    state_json = p_state,
    revision = current_row.revision + 1,
    last_mutation_id = p_mutation_id,
    updated_at = clock_timestamp()
    where user_id = p_user_id
    returning * into current_row;
  return query select 'saved'::text, current_row.revision, current_row.last_mutation_id;
end;
$$;

revoke all on function public.save_planner_state(uuid, jsonb, bigint, uuid) from public, anon;
grant execute on function public.save_planner_state(uuid, jsonb, bigint, uuid) to authenticated;

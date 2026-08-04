create extension if not exists vector;

create table if not exists security_runs (
  id bigserial primary key,
  trace_id text not null unique,
  runtime text not null,
  scenario_id text not null,
  verdict text not null check (verdict in ('allow', 'redact', 'approval', 'block')),
  risk_score integer not null check (risk_score between 0 and 100),
  payload jsonb not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists security_runs_created_at_idx on security_runs (created_at desc);
create index if not exists security_runs_payload_idx on security_runs using gin (payload);
create index if not exists security_runs_embedding_idx
  on security_runs using hnsw (embedding vector_cosine_ops);

create table if not exists approval_decisions (
  id bigserial primary key,
  approval_request_id text not null unique,
  trace_id text not null,
  operator_id text not null,
  action text not null check (action in ('approve', 'reject')),
  decided_at timestamptz not null default now()
);

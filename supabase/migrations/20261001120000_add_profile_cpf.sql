-- CPF do dono da loja, informado na tela de boas-vindas (opcional).
-- Dado pessoal (LGPD): a coluna herda as policies de profiles (o próprio usuário e o master).
-- Só dígitos; nunca registrar em log.
-- Rollback: alter table public.profiles drop column if exists cpf;
alter table public.profiles add column if not exists cpf text;

do $$ begin
  alter table public.profiles
    add constraint profiles_cpf_digits check (cpf is null or cpf ~ '^[0-9]{11}$');
exception when duplicate_object then null; end $$;

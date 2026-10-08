-- Keep a single preference RPC signature so PostgREST never has to choose
-- between legacy and expanded overloads. The expanded functions retain
-- defaults for the optional preference fields.
drop function if exists public.update_my_preferences(text,text,text,boolean,boolean,boolean);
drop function if exists public.parent_update_kid(text,text,text,text,boolean,boolean,boolean);

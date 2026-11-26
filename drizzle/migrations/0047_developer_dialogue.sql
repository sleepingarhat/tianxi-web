-- DRAFT ONLY — 唔自動 apply 生產。
-- 「與開發者對話」：公開可讀嘅帖同分支回覆。寫入必須係已登入會員（auth.uid），
-- 唔經會籍閘、唔授予 Pro。管理帳號用現有 has_role(..., 'admin') 隱藏或關閉整串。
-- 套用前頁面會顯示「對話區尚未啟用」。

CREATE TABLE public.developer_dialogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_id uuid,
  parent_id uuid REFERENCES public.developer_dialogue(id),
  author_id uuid NOT NULL,
  author_label text NOT NULL DEFAULT '會員',
  staff boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  hidden_at timestamptz,
  hidden_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developer_dialogue_body_len CHECK (char_length(body) BETWEEN 1 AND 500),
  CONSTRAINT developer_dialogue_label_len CHECK (char_length(author_label) BETWEEN 1 AND 40),
  CONSTRAINT developer_dialogue_not_self CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT developer_dialogue_root_present CHECK (root_id IS NOT NULL),
  CONSTRAINT developer_dialogue_close_on_root CHECK (parent_id IS NULL OR (closed_at IS NULL AND closed_by IS NULL))
);

CREATE INDEX developer_dialogue_feed_idx ON public.developer_dialogue (created_at DESC) WHERE parent_id IS NULL;
CREATE INDEX developer_dialogue_thread_idx ON public.developer_dialogue (root_id, created_at);
CREATE INDEX developer_dialogue_author_recent_idx ON public.developer_dialogue (author_id, created_at DESC);

COMMENT ON TABLE public.developer_dialogue IS '與開發者對話：第一則係帖（parent 空），回覆用 parent_id 分支，root_id 指向開場帖。';

REVOKE ALL ON public.developer_dialogue FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.developer_dialogue TO anon, authenticated;
GRANT INSERT (body, parent_id, author_id, author_label, staff, root_id) ON public.developer_dialogue TO authenticated;
GRANT UPDATE (hidden_at, hidden_by, closed_at, closed_by) ON public.developer_dialogue TO authenticated;
GRANT ALL ON public.developer_dialogue TO service_role;

-- 唔加 FORCE：觸發器係 SECURITY DEFINER，要睇到已隱藏帖同 auth.users 先可以守規則。
ALTER TABLE public.developer_dialogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY developer_dialogue_read ON public.developer_dialogue
  FOR SELECT TO anon, authenticated
  USING (hidden_at IS NULL OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY developer_dialogue_insert ON public.developer_dialogue
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND hidden_at IS NULL
    AND hidden_by IS NULL
    AND closed_at IS NULL
    AND closed_by IS NULL
    AND staff = public.has_role(auth.uid(), 'admin')
    AND char_length(body) BETWEEN 1 AND 500
  );

CREATE POLICY developer_dialogue_moderate ON public.developer_dialogue
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE FUNCTION public.developer_dialogue_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent public.developer_dialogue%ROWTYPE;
  root public.developer_dialogue%ROWTYPE;
  meta jsonb;
  label text;
  recent integer;
  depth integer;
  walker uuid;
  seen integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'SIGN_IN_REQUIRED';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'ADMIN_ONLY';
    END IF;
    NEW.id := OLD.id;
    NEW.root_id := OLD.root_id;
    NEW.parent_id := OLD.parent_id;
    NEW.author_id := OLD.author_id;
    NEW.author_label := OLD.author_label;
    NEW.staff := OLD.staff;
    NEW.body := OLD.body;
    NEW.created_at := OLD.created_at;
    IF OLD.parent_id IS NOT NULL THEN
      NEW.closed_at := NULL;
      NEW.closed_by := NULL;
    ELSIF NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
      IF NEW.closed_at IS NULL THEN
        NEW.closed_by := NULL;
      ELSE
        NEW.closed_at := now();
        NEW.closed_by := auth.uid();
      END IF;
    END IF;
    IF NEW.hidden_at IS DISTINCT FROM OLD.hidden_at THEN
      IF NEW.hidden_at IS NULL THEN
        NEW.hidden_by := NULL;
      ELSE
        NEW.hidden_at := now();
        NEW.hidden_by := auth.uid();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  NEW.author_id := auth.uid();
  NEW.staff := public.has_role(auth.uid(), 'admin');
  NEW.hidden_at := NULL;
  NEW.hidden_by := NULL;
  NEW.closed_at := NULL;
  NEW.closed_by := NULL;
  NEW.created_at := now();
  NEW.body := replace(replace(NEW.body, chr(10), '{{tianxi-nl}}'), chr(13), '');
  NEW.body := btrim(replace(regexp_replace(NEW.body, '[[:cntrl:]]', '', 'g'), '{{tianxi-nl}}', chr(10)));
  IF char_length(NEW.body) < 1 OR char_length(NEW.body) > 500 THEN
    RAISE EXCEPTION 'BODY_LENGTH';
  END IF;

  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = auth.uid();
  label := btrim(coalesce(meta->>'full_name', meta->>'name', ''));
  label := regexp_replace(label, '[[:cntrl:]]', '', 'g');
  IF label = '' OR position('@' IN label) > 0 THEN
    label := '會員';
  END IF;
  NEW.author_label := left(label, 40);

  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 447));
  SELECT count(*) INTO recent FROM public.developer_dialogue
    WHERE author_id = auth.uid() AND created_at > now() - interval '1 hour';
  IF recent >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMIT';
  END IF;

  IF NEW.parent_id IS NULL THEN
    NEW.root_id := NEW.id;
    RETURN NEW;
  END IF;

  SELECT * INTO parent FROM public.developer_dialogue WHERE id = NEW.parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARENT_MISSING';
  END IF;
  IF parent.hidden_at IS NOT NULL THEN
    RAISE EXCEPTION 'PARENT_HIDDEN';
  END IF;
  NEW.root_id := parent.root_id;

  depth := 0;
  walker := NEW.parent_id;
  seen := 0;
  WHILE walker IS NOT NULL LOOP
    depth := depth + 1;
    seen := seen + 1;
    IF depth > 20 OR seen > 20 THEN
      RAISE EXCEPTION 'THREAD_TOO_DEEP';
    END IF;
    SELECT parent_id INTO walker FROM public.developer_dialogue WHERE id = walker;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PARENT_MISSING';
    END IF;
  END LOOP;

  SELECT * INTO root FROM public.developer_dialogue WHERE id = NEW.root_id AND parent_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOT_MISSING';
  END IF;
  IF root.hidden_at IS NOT NULL THEN
    RAISE EXCEPTION 'THREAD_HIDDEN';
  END IF;
  IF root.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'THREAD_CLOSED';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.developer_dialogue_before_write() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER developer_dialogue_before_write
  BEFORE INSERT OR UPDATE ON public.developer_dialogue
  FOR EACH ROW EXECUTE FUNCTION public.developer_dialogue_before_write();

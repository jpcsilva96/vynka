-- Lote D (escopo checkout/entrega/pagamento §5): estoque e prazo de pagamento.
-- * Produto sem variação passa a ter quantidade (products.stock_quantity).
-- * Baixa de estoque: pedido do site na criação (loja "ao fazer o pedido") ou na confirmação do
--   pagamento (loja "ao pagar", confirm_order_payment, chamada pelo webhook do lote E); venda manual
--   ao ser concluída (status delivered). Site exige estoque; venda manual não bloqueia (pode ficar
--   negativo: a peça está na mão do lojista).
-- * Devolução: qualquer cancelamento (manual ou por prazo) e exclusão do pedido devolvem as peças
--   que tinham baixado. Editar itens de um pedido que já baixou ajusta o estoque (gatilho nos itens).
-- * Prazo: pedido do site vence pelo prazo do Pix da loja até o pagamento começar;
--   set_order_payment_deadline (lote E) troca para o prazo do boleto ou tira o prazo (cartão).
--   expire_overdue_orders cancela os vencidos; o pg_cron roda a cada 10 minutos.
-- Sem status novo: cancelado por prazo = cancelled + cancel_reason 'deadline'; pago sem estoque =
-- status pago + stock_shortage.
-- Rollback: rollback.sql da janela (tira agendamento, gatilhos, funções novas, colunas e volta as
-- duas funções do checkout para a versão de 20261007120000).

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1) Colunas
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_deducted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text CHECK (cancel_reason IS NULL OR cancel_reason IN ('deadline', 'manual')),
  ADD COLUMN IF NOT EXISTS stock_shortage boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_payment_due
  ON public.orders (payment_due_at)
  WHERE status = 'pending' AND payment_due_at IS NOT NULL;

-- 2) Mexe no estoque de um item. _sign -1 baixa, +1 devolve. _strict: baixa só se houver
-- quantidade (senão erro). Produto sem controle de estoque: nada. Variação apagada: nada.
CREATE OR REPLACE FUNCTION public.apply_item_stock(
  _product_id uuid,
  _variant_id uuid,
  _quantity integer,
  _sign integer,
  _strict boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p record;
  _done integer;
BEGIN
  IF _product_id IS NULL OR coalesce(_quantity, 0) <= 0 THEN
    RETURN;
  END IF;
  SELECT p.id, p.name, p.manage_stock,
         EXISTS (SELECT 1 FROM public.product_options o WHERE o.product_id = p.id) AS has_options
    INTO _p
  FROM public.products p WHERE p.id = _product_id;
  IF NOT FOUND OR NOT _p.manage_stock THEN
    RETURN;
  END IF;

  IF _variant_id IS NOT NULL THEN
    UPDATE public.product_variants v
      SET stock_quantity = v.stock_quantity + _sign * _quantity
    WHERE v.id = _variant_id
      AND (_sign > 0 OR NOT _strict OR v.stock_quantity >= _quantity);
  ELSIF NOT _p.has_options THEN
    UPDATE public.products p
      SET stock_quantity = p.stock_quantity + _sign * _quantity
    WHERE p.id = _product_id
      AND (_sign > 0 OR NOT _strict OR p.stock_quantity >= _quantity);
  ELSE
    RETURN;
  END IF;
  GET DIAGNOSTICS _done = ROW_COUNT;
  IF _done = 0 AND _sign < 0 AND _strict
     AND (_variant_id IS NULL OR EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = _variant_id)) THEN
    RAISE EXCEPTION 'Estoque insuficiente de "%".', _p.name USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Todos os itens de um pedido de uma vez.
CREATE OR REPLACE FUNCTION public.apply_order_stock(_order_id uuid, _sign integer, _strict boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _i record;
BEGIN
  FOR _i IN
    SELECT product_id, variant_id, quantity FROM public.order_items
    WHERE order_id = _order_id
    ORDER BY product_id, variant_id
  LOOP
    PERFORM public.apply_item_stock(_i.product_id, _i.variant_id, _i.quantity, _sign, _strict);
  END LOOP;
END;
$$;

-- 3) Gatilho nos itens: pedido que já baixou o estoque acompanha inclusão, exclusão e edição.
CREATE OR REPLACE FUNCTION public.order_items_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o record;
BEGIN
  SELECT o.stock_deducted_at, o.source INTO _o
  FROM public.orders o WHERE o.id = coalesce(NEW.order_id, OLD.order_id);
  IF NOT FOUND OR _o.stock_deducted_at IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.apply_item_stock(OLD.product_id, OLD.variant_id, OLD.quantity, 1, false);
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    PERFORM public.apply_item_stock(NEW.product_id, NEW.variant_id, NEW.quantity, -1, _o.source = 'website');
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS t_order_items_stock ON public.order_items;
CREATE TRIGGER t_order_items_stock
  AFTER INSERT OR DELETE OR UPDATE OF product_id, variant_id, quantity ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_stock_sync();

-- 4) Gatilhos no pedido: venda manual baixa ao ser concluída; cancelamento e exclusão devolvem.
CREATE OR REPLACE FUNCTION public.orders_stock_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Venda manual já concluída: os itens entram depois e baixam pelo gatilho dos itens.
    IF NEW.source = 'manual' AND NEW.status = 'delivered' AND NEW.stock_deducted_at IS NULL THEN
      NEW.stock_deducted_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.stock_deducted_at IS NOT NULL THEN
      PERFORM public.apply_order_stock(OLD.id, 1, false);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' THEN
      NEW.cancel_reason := coalesce(NEW.cancel_reason, 'manual');
      IF OLD.stock_deducted_at IS NOT NULL THEN
        PERFORM public.apply_order_stock(OLD.id, 1, false);
        NEW.stock_deducted_at := NULL;
      END IF;
    ELSIF NEW.source = 'manual' AND NEW.status = 'delivered' AND OLD.stock_deducted_at IS NULL THEN
      PERFORM public.apply_order_stock(OLD.id, -1, false);
      NEW.stock_deducted_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_orders_stock_insert ON public.orders;
CREATE TRIGGER t_orders_stock_insert BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_stock_status();
DROP TRIGGER IF EXISTS t_orders_stock_update ON public.orders;
CREATE TRIGGER t_orders_stock_update BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_stock_status();
DROP TRIGGER IF EXISTS t_orders_stock_delete ON public.orders;
CREATE TRIGGER t_orders_stock_delete BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_stock_status();

-- 5) Itens do carrinho: mesma função de 20261007120000 + estoque do produto sem variação.
CREATE OR REPLACE FUNCTION public.checkout_cart_lines(_store_id uuid, _items jsonb)
RETURNS TABLE (
  product_id uuid,
  variant_id uuid,
  product_name text,
  variant_label text,
  quantity integer,
  unit_price numeric,
  unit_cost numeric,
  weight_kg numeric,
  height_cm numeric,
  width_cm numeric,
  length_cm numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _settings public.store_checkout_settings%ROWTYPE;
  _line record;
  _product public.products%ROWTYPE;
  _variant public.product_variants%ROWTYPE;
  _has_options boolean;
  _unit numeric;
  _label text;
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio.';
  END IF;
  IF jsonb_array_length(_items) > 100 THEN
    RAISE EXCEPTION 'Carrinho com itens demais.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_items) e
    WHERE jsonb_typeof(e) <> 'object'
       OR coalesce(e->>'product_id', '') = ''
       OR coalesce(e->>'quantity', '') !~ '^[0-9]{1,4}$'
       OR (e->>'quantity')::int < 1
  ) THEN
    RAISE EXCEPTION 'Item do carrinho inválido.';
  END IF;

  SELECT * INTO _settings FROM public.store_checkout_settings s WHERE s.store_id = _store_id;

  FOR _line IN
    SELECT x.product_id, x.variant_id, sum(x.quantity)::int AS quantity
    FROM jsonb_to_recordset(_items) AS x(product_id uuid, variant_id uuid, quantity int)
    GROUP BY x.product_id, x.variant_id
  LOOP
    IF _line.quantity > 999 THEN
      RAISE EXCEPTION 'Quantidade acima do permitido.';
    END IF;

    SELECT * INTO _product
    FROM public.products p
    WHERE p.id = _line.product_id AND p.store_id = _store_id AND p.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Um dos produtos do carrinho não está mais disponível.';
    END IF;

    _unit := CASE
      WHEN _product.promo_price IS NOT NULL AND _product.promo_price < _product.price
        THEN _product.promo_price
      ELSE _product.price
    END;
    _label := NULL;
    _variant := NULL;

    SELECT EXISTS (SELECT 1 FROM public.product_options o WHERE o.product_id = _product.id)
      INTO _has_options;
    IF _has_options THEN
      IF _line.variant_id IS NULL THEN
        RAISE EXCEPTION 'Escolha as opções de "%".', _product.name;
      END IF;
      SELECT * INTO _variant
      FROM public.product_variants v
      WHERE v.id = _line.variant_id AND v.product_id = _product.id;
      IF NOT FOUND OR NOT _variant.available THEN
        RAISE EXCEPTION 'A opção escolhida de "%" não está mais disponível.', _product.name;
      END IF;
      SELECT string_agg(o.name || ': ' || coalesce(_variant.options->>o.name, ''), ' / ' ORDER BY o.position)
        INTO _label
      FROM public.product_options o
      WHERE o.product_id = _product.id;
      IF _product.manage_stock AND _variant.stock_quantity < _line.quantity THEN
        RAISE EXCEPTION 'Estoque insuficiente de "%" (%): restam %.',
          _product.name, _label, greatest(_variant.stock_quantity, 0);
      END IF;
      _unit := coalesce(_variant.price, _unit);
    ELSIF _product.manage_stock AND _product.stock_quantity < _line.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente de "%": restam %.',
        _product.name, greatest(_product.stock_quantity, 0);
    END IF;

    product_id := _product.id;
    variant_id := _variant.id;
    product_name := _product.name;
    variant_label := _label;
    quantity := _line.quantity;
    unit_price := _unit;
    unit_cost := coalesce(_product.cost_price, 0);
    weight_kg := coalesce(_product.weight_kg, _settings.package_weight_kg, 0.3);
    height_cm := coalesce(_product.height_cm, _settings.package_height_cm, 4);
    width_cm := coalesce(_product.width_cm, _settings.package_width_cm, 12);
    length_cm := coalesce(_product.length_cm, _settings.package_length_cm, 17);
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 6) Pedido do site: mesma função de 20261007120000 + baixa (loja "ao fazer o pedido") e prazo.
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  _user_id uuid,
  _store_id uuid,
  _items jsonb,
  _delivery jsonb,
  _address jsonb DEFAULT NULL,
  _quotes jsonb DEFAULT '[]'::jsonb,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer public.customers%ROWTYPE;
  _order_id uuid;
  _l record;
  _subtotal numeric := 0;
  _method text := _delivery->>'method';
  _service integer;
  _opt record;
  _settings public.store_checkout_settings%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para finalizar o pedido.' USING ERRCODE = '28000';
  END IF;
  IF NOT public.store_is_public(_store_id) THEN
    RAISE EXCEPTION 'Esta loja não está recebendo pedidos no momento.';
  END IF;

  SELECT * INTO _customer
  FROM public.customers c
  WHERE c.store_id = _store_id AND c.user_id = _user_id
  ORDER BY c.created_at
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complete seu cadastro na loja antes de finalizar o pedido.';
  END IF;

  IF _method IS NULL OR _method NOT IN ('local', 'pickup', 'shipping') THEN
    RAISE EXCEPTION 'Escolha a forma de entrega.';
  END IF;
  IF coalesce(_delivery->>'service_id', '') ~ '^[0-9]{1,9}$' THEN
    _service := (_delivery->>'service_id')::int;
  END IF;
  IF _method = 'shipping' AND _service IS NULL THEN
    RAISE EXCEPTION 'Escolha a forma de entrega.';
  END IF;
  IF _method <> 'pickup' AND (
       _address IS NULL OR jsonb_typeof(_address) <> 'object'
       OR coalesce(_address->>'zip_code', '') !~ '^[0-9]{8}$'
       OR coalesce(btrim(_address->>'street'), '') = ''
       OR coalesce(btrim(_address->>'address_number'), '') = ''
       OR coalesce(btrim(_address->>'city'), '') = ''
       OR coalesce(_address->>'state', '') !~ '^[A-Z]{2}$'
     ) THEN
    RAISE EXCEPTION 'Informe o endereço de entrega completo.';
  END IF;

  SELECT * INTO _settings FROM public.store_checkout_settings s WHERE s.store_id = _store_id;

  -- Loja "ao fazer o pedido": marcado já na criação, os itens baixam (com conferência) ao entrar.
  -- Prazo inicial = prazo do Pix da loja (24 h se não houver configuração).
  INSERT INTO public.orders (
    store_id, customer_id, status, source, subtotal, total, notes, payment_details,
    stock_deducted_at, payment_due_at
  )
  VALUES (
    _store_id, _customer.id, 'pending', 'website', 0, 0,
    nullif(btrim(coalesce(_notes, '')), ''),
    jsonb_build_object(
      'delivery_address', CASE WHEN _method = 'pickup' THEN NULL ELSE _address END,
      'customer_snapshot', jsonb_build_object(
        'name', _customer.name, 'phone', _customer.phone, 'email', _customer.email
      )
    ),
    CASE WHEN coalesce(_settings.stock_deduction, 'on_order') = 'on_order' THEN now() END,
    now() + make_interval(hours => coalesce(_settings.pix_expiration_hours, 24))
  )
  RETURNING id INTO _order_id;

  FOR _l IN SELECT * FROM public.checkout_cart_lines(_store_id, _items) LOOP
    INSERT INTO public.order_items (
      store_id, order_id, product_id, variant_id, product_name, variant_name,
      quantity, unit_price, total_price, unit_cost, total_cost
    ) VALUES (
      _store_id, _order_id, _l.product_id, _l.variant_id, _l.product_name, _l.variant_label,
      _l.quantity, _l.unit_price, round(_l.unit_price * _l.quantity, 2),
      _l.unit_cost, round(_l.unit_cost * _l.quantity, 2)
    );
    _subtotal := _subtotal + round(_l.unit_price * _l.quantity, 2);
  END LOOP;

  SELECT * INTO _opt
  FROM public.checkout_delivery_options(_store_id, _address->>'ibge_code', _subtotal, _quotes) o
  WHERE o.method = _method AND o.service_id IS NOT DISTINCT FROM (CASE WHEN _method = 'shipping' THEN _service END)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta forma de entrega não está disponível para o seu endereço.';
  END IF;

  UPDATE public.orders SET
    subtotal = _subtotal,
    total = _subtotal + _opt.price,
    delivery_method = _method,
    shipping_service_id = _opt.service_id,
    shipping_service_name = _opt.name,
    shipping_amount = _opt.price,
    shipping_min_days = _opt.min_days,
    shipping_max_days = _opt.max_days,
    delivery_address = CASE WHEN _method = 'pickup' THEN NULL ELSE _address END
  WHERE id = _order_id;
  RETURN _order_id;
END;
$$;

-- 7) Pagamento confirmado pelo gateway (webhook do lote E; só service role).
-- Loja "ao pagar": baixa agora. Pedido cancelado por prazo que foi pago depois: volta a valer se
-- houver estoque. Sem estoque: fica pago com stock_shortage (a loja reembolsa).
-- Retorno: 'paid' | 'paid_out_of_stock' | 'already_paid' | 'not_found'.
CREATE OR REPLACE FUNCTION public.confirm_order_payment(_order_id uuid, _paid_at timestamptz DEFAULT now())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _shortage boolean := false;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF _o.paid_at IS NOT NULL OR _o.status NOT IN ('pending', 'confirmed', 'cancelled') THEN
    RETURN 'already_paid';
  END IF;

  IF _o.stock_deducted_at IS NULL THEN
    BEGIN
      PERFORM public.apply_order_stock(_order_id, -1, true);
    EXCEPTION WHEN raise_exception THEN
      _shortage := true; -- a baixa parcial é desfeita pelo bloco
    END;
  END IF;

  UPDATE public.orders SET
    status = 'paid',
    paid_at = coalesce(_paid_at, now()),
    payment_due_at = NULL,
    cancel_reason = NULL,
    stock_shortage = _shortage,
    stock_deducted_at = CASE WHEN _shortage THEN NULL ELSE coalesce(_o.stock_deducted_at, now()) END
  WHERE id = _order_id;
  RETURN CASE WHEN _shortage THEN 'paid_out_of_stock' ELSE 'paid' END;
END;
$$;

-- 8) Forma de pagamento escolhida no gateway (lote E): Pix e boleto têm o prazo da loja contado da
-- criação do pedido; cartão não vence por prazo.
CREATE OR REPLACE FUNCTION public.set_order_payment_deadline(_order_id uuid, _method text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _s public.store_checkout_settings%ROWTYPE;
  _due timestamptz;
BEGIN
  IF _method NOT IN ('pix', 'boleto', 'card') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida: %', _method;
  END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND status = 'pending' AND source = 'website' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT * INTO _s FROM public.store_checkout_settings WHERE store_id = _o.store_id;
  _due := CASE _method
    WHEN 'pix' THEN _o.created_at + make_interval(hours => coalesce(_s.pix_expiration_hours, 24))
    WHEN 'boleto' THEN _o.created_at + make_interval(days => coalesce(_s.boleto_expiration_days, 3))
    ELSE NULL
  END;
  UPDATE public.orders SET payment_due_at = _due WHERE id = _order_id;
  RETURN _due;
END;
$$;

-- 9) Cancela pedidos do site vencidos (o gatilho devolve as peças). Roda pelo pg_cron.
CREATE OR REPLACE FUNCTION public.expire_overdue_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  UPDATE public.orders SET status = 'cancelled', cancel_reason = 'deadline'
  WHERE status = 'pending' AND source = 'website'
    AND payment_due_at IS NOT NULL AND payment_due_at < now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- 10) Permissões: tudo só servidor/banco. As duas funções do checkout mantêm o grant de antes.
REVOKE ALL ON FUNCTION public.apply_item_stock(uuid, uuid, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_order_stock(uuid, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_items_stock_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orders_stock_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_payment_deadline(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_overdue_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_order_payment_deadline(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_overdue_orders() TO service_role;

-- 11) Agendamento: a cada 10 minutos (reaplicar não duplica).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'vynka-expirar-pedidos';
SELECT cron.schedule('vynka-expirar-pedidos', '*/10 * * * *', 'SELECT public.expire_overdue_orders()');

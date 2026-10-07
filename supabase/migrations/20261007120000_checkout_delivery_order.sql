-- Lote C1 (escopo checkout/entrega/pagamento): o pedido do site passa a ter entrega e frete.
-- O preço do frete nunca vem do navegador: o servidor do app descobre a cidade pelo CEP (código
-- IBGE), cota o Melhor Envio e chama estas funções, que só a service role executa. As regras de
-- entrega local, retirada e frete grátis ficam todas aqui (checkout_delivery_options), usadas tanto
-- para mostrar as opções na etapa de entrega quanto para gravar o pedido.
-- Status: sem valor novo no enum. Pedido do site em 'pending' = "Aguardando pagamento";
-- 'in_dispatch' com retirada = "Pronto para retirada" (rótulos na tela).
-- create_store_order (antiga) continua até a tela nova ser publicada; sai num passo seguinte.
-- Rollback: apagar as 3 funções e as 7 colunas de orders.

-- 1) Entrega no pedido. Pedidos antigos e manuais ficam com delivery_method NULL e frete 0.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method text
    CHECK (delivery_method IS NULL OR delivery_method IN ('local', 'pickup', 'shipping')),
  ADD COLUMN IF NOT EXISTS shipping_service_id integer,
  ADD COLUMN IF NOT EXISTS shipping_service_name text
    CHECK (shipping_service_name IS NULL OR length(shipping_service_name) <= 120),
  ADD COLUMN IF NOT EXISTS shipping_amount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  ADD COLUMN IF NOT EXISTS shipping_min_days integer CHECK (shipping_min_days IS NULL OR shipping_min_days >= 0),
  ADD COLUMN IF NOT EXISTS shipping_max_days integer CHECK (shipping_max_days IS NULL OR shipping_max_days >= 0),
  ADD COLUMN IF NOT EXISTS delivery_address jsonb;

-- 2) Itens do carrinho com preço e medidas, pela mesma regra de create_store_order (promoção,
-- preço da variação, opções obrigatórias, estoque). Produto sem peso/medidas usa a embalagem padrão.
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

-- 3) Opções de entrega para um subtotal e uma cidade (código IBGE descoberto pelo servidor a partir
-- do CEP). _quotes = cotação do Melhor Envio feita pelo servidor: [{id, name, price, min_days,
-- max_days}]. Só entram serviços que a loja escolheu. Frete grátis aplicado aqui.
CREATE OR REPLACE FUNCTION public.checkout_delivery_options(
  _store_id uuid,
  _ibge_code text,
  _subtotal numeric,
  _quotes jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  method text,
  service_id integer,
  name text,
  price numeric,
  original_price numeric,
  min_days integer,
  max_days integer,
  free boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.store_checkout_settings%ROWTYPE;
  _city public.store_delivery_cities%ROWTYPE;
  _free_ok boolean;
  _q record;
BEGIN
  SELECT * INTO _s FROM public.store_checkout_settings c WHERE c.store_id = _store_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  _free_ok := _s.free_shipping_min_amount IS NOT NULL AND coalesce(_subtotal, 0) >= _s.free_shipping_min_amount;

  IF _s.local_delivery_enabled AND _ibge_code IS NOT NULL THEN
    SELECT * INTO _city FROM public.store_delivery_cities d
    WHERE d.store_id = _store_id AND d.ibge_code = _ibge_code;
    IF FOUND THEN
      method := 'local';
      service_id := NULL;
      name := 'Entrega local';
      original_price := coalesce(_city.price, _s.local_delivery_price);
      free := _free_ok AND _s.free_shipping_local;
      price := CASE WHEN free THEN 0 ELSE original_price END;
      min_days := _s.local_delivery_min_days;
      max_days := _s.local_delivery_max_days;
      RETURN NEXT;
    END IF;
  END IF;

  IF _s.pickup_enabled THEN
    method := 'pickup';
    service_id := NULL;
    name := 'Retirar na loja';
    original_price := 0;
    price := 0;
    free := false;
    min_days := NULL;
    max_days := NULL;
    RETURN NEXT;
  END IF;

  IF _s.shipping_enabled AND _quotes IS NOT NULL AND jsonb_typeof(_quotes) = 'array'
     AND EXISTS (SELECT 1 FROM public.store_shipping_connections k WHERE k.store_id = _store_id) THEN
    FOR _q IN
      SELECT x.id, x.name, x.price, x.min_days, x.max_days
      FROM jsonb_to_recordset(_quotes) AS x(id integer, name text, price numeric, min_days integer, max_days integer)
      WHERE x.id IS NOT NULL AND x.price IS NOT NULL AND x.price >= 0
        AND (cardinality(_s.shipping_services) = 0 OR x.id = ANY (_s.shipping_services))
      ORDER BY x.price
    LOOP
      method := 'shipping';
      service_id := _q.id;
      name := left(coalesce(nullif(btrim(_q.name), ''), 'Transportadora'), 120);
      original_price := round(_q.price, 2);
      free := _free_ok AND _q.id = ANY (_s.free_shipping_services);
      price := CASE WHEN free THEN 0 ELSE original_price END;
      min_days := _q.min_days;
      max_days := coalesce(_q.max_days, _q.min_days);
      RETURN NEXT;
    END LOOP;
  END IF;
END;
$$;

-- 4) Cria o pedido do site com a entrega escolhida. Chamado só pelo servidor, que já conferiu o
-- usuário (_user_id = sessão), descobriu a cidade pelo CEP e cotou o Melhor Envio.
-- _delivery = {method, service_id?}; _address = endereço com zip_code e ibge_code (servidor);
-- _quotes = a cotação feita agora (mesmo formato de checkout_delivery_options).
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

  INSERT INTO public.orders (store_id, customer_id, status, source, subtotal, total, notes, payment_details)
  VALUES (
    _store_id, _customer.id, 'pending', 'website', 0, 0,
    nullif(btrim(coalesce(_notes, '')), ''),
    jsonb_build_object(
      'delivery_address', CASE WHEN _method = 'pickup' THEN NULL ELSE _address END,
      'customer_snapshot', jsonb_build_object(
        'name', _customer.name, 'phone', _customer.phone, 'email', _customer.email
      )
    )
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

REVOKE ALL ON FUNCTION public.checkout_cart_lines(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_delivery_options(uuid, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_cart_lines(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_delivery_options(uuid, text, numeric, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) TO service_role;

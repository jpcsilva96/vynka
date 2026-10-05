-- Pedido feito pela loja online passa a ser criado por esta função, não mais por INSERT direto
-- do navegador. O cliente informa só produto, variação e quantidade; preço, custo, total e status
-- saem do banco. Estoque é conferido (não baixa aqui).
-- Etapa 1 de 2: cria a função. A etapa 2 (retirar o INSERT direto do cliente em orders e
-- order_items) só roda depois que a tela nova estiver publicada.

CREATE OR REPLACE FUNCTION public.create_store_order(
  _store_id uuid,
  _items jsonb,
  _notes text DEFAULT NULL,
  _delivery_address jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _customer public.customers%ROWTYPE;
  _order_id uuid;
  _line record;
  _product public.products%ROWTYPE;
  _variant public.product_variants%ROWTYPE;
  _has_options boolean;
  _unit numeric;
  _line_total numeric;
  _cost numeric;
  _label text;
  _subtotal numeric := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para finalizar o pedido.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.store_is_public(_store_id) THEN
    RAISE EXCEPTION 'Esta loja não está recebendo pedidos no momento.';
  END IF;

  SELECT * INTO _customer
  FROM public.customers
  WHERE store_id = _store_id AND user_id = _uid
  ORDER BY created_at
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complete seu cadastro na loja antes de finalizar o pedido.';
  END IF;

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

  INSERT INTO public.orders (store_id, customer_id, status, source, subtotal, total, notes, payment_details)
  VALUES (
    _store_id,
    _customer.id,
    'pending',
    'website',
    0,
    0,
    nullif(btrim(coalesce(_notes, '')), ''),
    jsonb_build_object(
      'delivery_address', _delivery_address,
      'customer_snapshot', jsonb_build_object(
        'name', _customer.name, 'phone', _customer.phone, 'email', _customer.email
      )
    )
  )
  RETURNING id INTO _order_id;

  -- Mesmo produto/variação repetido no carrinho conta junto para o estoque.
  FOR _line IN
    SELECT x.product_id, x.variant_id, sum(x.quantity)::int AS quantity
    FROM jsonb_to_recordset(_items) AS x(product_id uuid, variant_id uuid, quantity int)
    GROUP BY x.product_id, x.variant_id
  LOOP
    IF _line.quantity > 999 THEN
      RAISE EXCEPTION 'Quantidade acima do permitido.';
    END IF;

    SELECT * INTO _product
    FROM public.products
    WHERE id = _line.product_id AND store_id = _store_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Um dos produtos do carrinho não está mais disponível.';
    END IF;

    -- Mesma regra da página do produto: promoção vale se for menor que o preço; preço da
    -- variação, quando existe, substitui os dois.
    _unit := CASE
      WHEN _product.promo_price IS NOT NULL AND _product.promo_price < _product.price
        THEN _product.promo_price
      ELSE _product.price
    END;
    _label := NULL;
    _variant := NULL;

    SELECT EXISTS (SELECT 1 FROM public.product_options WHERE product_id = _product.id)
      INTO _has_options;
    IF _has_options THEN
      IF _line.variant_id IS NULL THEN
        RAISE EXCEPTION 'Escolha as opções de "%".', _product.name;
      END IF;
      SELECT * INTO _variant
      FROM public.product_variants
      WHERE id = _line.variant_id AND product_id = _product.id
      FOR UPDATE;
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

    _line_total := round(_unit * _line.quantity, 2);
    _cost := coalesce(_product.cost_price, 0);

    INSERT INTO public.order_items (
      store_id, order_id, product_id, variant_id, product_name, variant_name,
      quantity, unit_price, total_price, unit_cost, total_cost
    ) VALUES (
      _store_id, _order_id, _product.id, _variant.id, _product.name, _label,
      _line.quantity, _unit, _line_total, _cost, round(_cost * _line.quantity, 2)
    );
    _subtotal := _subtotal + _line_total;
  END LOOP;

  UPDATE public.orders SET subtotal = _subtotal, total = _subtotal WHERE id = _order_id;
  RETURN _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_order(uuid, jsonb, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_store_order(uuid, jsonb, text, jsonb) TO authenticated;

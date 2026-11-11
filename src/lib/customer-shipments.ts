import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomerShipments } from "@/lib/customer-tracking.functions";

// Rastreio do envio para o cliente (lote E5): "Minhas compras" pede de todos os pedidos de uma vez;
// a página do pedido pede só o dele.
export function useCustomerShipments(storeId: string, enabled: boolean, orderId?: string) {
  const list = useServerFn(listCustomerShipments);
  return useQuery({
    queryKey: ["customer-shipments", storeId, orderId ?? "all"],
    queryFn: () => list({ data: { store_id: storeId, order_id: orderId } }),
    enabled,
    staleTime: 60_000,
  });
}

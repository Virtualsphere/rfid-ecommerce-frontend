"use client";

import { useEffect, useState } from "react";
import { fetchAllOrders, updateOrderStatus } from "@/lib/api";
import { formatCurrency, cn, getServerUrl } from "@/lib/utils";
import { ORDER_STATUSES, ORDER_STATUS_META, orderStatusMeta } from "@/lib/status";
import { GST_PERCENT } from "@/lib/constants";
import { badgeVariants } from "@/components/ui/badge";
import { Package, Search, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await fetchAllOrders();
        setOrders(data);
      } catch (error) {
        console.error("Failed to load orders", error);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      
      await updateOrderStatus(orderId, newStatus);
      
      setOrders(orders.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      console.error("Failed to update status", error);
      alert("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Orders</h1>
          <p className="text-sm text-zinc-500">Manage all customer orders across the platform.</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search orders..."
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">Order ID</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Total</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <Package className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="hover:bg-zinc-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-zinc-900">
                      #{order._id.substring(order._id.length - 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900">{order.user?.name || "Unknown"}</div>
                      <div className="text-xs text-zinc-500 mb-2">{order.user?.email || "No email"}</div>
                      
                      {order.phoneNumber && (
                        <div className="text-xs font-medium text-zinc-700 mt-1">📞 {order.phoneNumber}</div>
                      )}
                      {order.shippingAddress && (
                        <div className="text-xs text-zinc-500 line-clamp-2 max-w-[250px] mt-0.5" title={order.shippingAddress}>
                          📍 {order.shippingAddress}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order._id, e.target.value)}
                        aria-label={`Status of order ${order._id.slice(-8).toUpperCase()}`}
                        className={cn(
                          badgeVariants({ tone: orderStatusMeta(order.status).tone, size: "md" }),
                          "cursor-pointer"
                        )}
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {ORDER_STATUS_META[status].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-900">
                      {formatCurrency(order.totalPrice)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-end gap-1 w-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Order #{selectedOrder?._id.substring(selectedOrder._id.length - 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 gap-6 bg-zinc-50 p-4 rounded-lg border border-zinc-100">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Customer Details</h4>
                  <div className="text-sm font-medium text-zinc-900">{selectedOrder.user?.name || "Unknown"}</div>
                  <div className="text-sm text-zinc-600">{selectedOrder.user?.email || "No email"}</div>
                  {selectedOrder.phoneNumber && (
                    <div className="text-sm text-zinc-600 mt-1">📞 {selectedOrder.phoneNumber}</div>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Shipping Address</h4>
                  <div className="text-sm text-zinc-600 whitespace-pre-wrap">
                    {selectedOrder.shippingAddress || "No shipping address provided"}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Order Items</h4>
                <ul className="space-y-4">
                  {selectedOrder.items.map((item: any, idx: number) => {
                    const product = item.product;
                    if (!product) return null;
                    const imageUrl = product.images?.[0] ? getServerUrl(product.images[0]) : "/placeholder.png";

                    return (
                      <li key={idx} className="flex gap-4">
                        <img src={imageUrl} alt={product.name} className="h-16 w-16 rounded-md object-cover border border-zinc-200" />
                        <div className="flex-1">
                          <h5 className="text-sm font-medium text-zinc-900">{product.name}</h5>
                          <p className="text-xs text-zinc-500">SKU: {product.sku}</p>
                          <div className="mt-1 flex justify-between items-center">
                            <span className="text-sm text-zinc-600">Qty: {item.quantity}</span>
                            <span className="text-sm font-medium text-zinc-900">{formatCurrency(item.priceAtPurchase * item.quantity)}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selectedOrder.gstAmount ? (
                <div className="border-t border-zinc-200 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Subtotal</span>
                    <span className="font-medium text-zinc-900">{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">GST ({GST_PERCENT}%)</span>
                    <span className="font-medium text-zinc-900">{formatCurrency(selectedOrder.gstAmount)}</span>
                  </div>
                </div>
              ) : null}

              <div className="border-t border-zinc-200 pt-4 flex justify-between items-center">
                <span className="text-sm font-medium text-zinc-600">Total Amount Paid</span>
                <span className="text-lg font-bold text-zinc-900">{formatCurrency(selectedOrder.totalPrice)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

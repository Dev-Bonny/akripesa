'use client';

import { useEffect, useRef } from 'react';
import { EnrichedOrder } from '@/actions/logistics.actions';

interface Props {
  orders: EnrichedOrder[];
  selectedOrderId: string | null;
}

/**
 * Leaflet map — rendered client-side only.
 *
 * Leaflet requires the DOM and window.L — it cannot run in SSR.
 * We import it dynamically inside useEffect so Next.js never
 * attempts to bundle it for the server.
 *
 * Marker colour convention:
 *   🔴 Red pickup/delivery  → AWAITING_DRIVER orders
 *   🟢 Green pickup          → All other active orders
 *   🔵 Blue delivery         → All other active orders
 *   ⭐ Pulsing ring          → Currently selected order
 */
export const LogisticsMap = ({ orders, selectedOrderId }: Props) => {
  const mapRef       = useRef<HTMLDivElement>(null);
  const mapInstance  = useRef<any>(null);
  const markersRef   = useRef<any[]>([]);

  useEffect(() => {
    // Dynamic import — Leaflet only runs in the browser
    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (!mapRef.current || mapInstance.current) return;

      // Centre on Nairobi by default
      mapInstance.current = L.map(mapRef.current).setView(
        [-1.2921, 36.8219],
        7
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current);
    };

    initMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update markers whenever orders or selection changes
  useEffect(() => {
    const updateMarkers = async () => {
      if (!mapInstance.current) return;

      const L = (await import('leaflet')).default;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      orders.forEach((order) => {
        const isAwaiting  = order.isAwaitingDriver;
        const isSelected  = order._id === selectedOrderId;

        // Pickup marker
        const pickupIcon = L.divIcon({
          className: '',
          html: `
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              ${isSelected ? `
                <div style="
                  position: absolute;
                  width: 32px;
                  height: 32px;
                  border-radius: 50%;
                  background: ${isAwaiting ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'};
                  animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
                "></div>
              ` : ''}
              <div style="
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: ${isAwaiting ? '#ef4444' : '#22c55e'};
                border: 2.5px solid white;
                box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                position: relative;
                z-index: 1;
              "></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const deliveryIcon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: ${isAwaiting ? '#dc2626' : '#2563eb'};
              border: 2.5px solid white;
              box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const [pickupLng, pickupLat]     = order.pickupLocation.coordinates;
        const [deliveryLng, deliveryLat] = order.deliveryLocation.coordinates;

        const pickupMarker = L.marker([pickupLat, pickupLng], {
          icon: pickupIcon,
        })
          .addTo(mapInstance.current)
          .bindPopup(
            `<div style="min-width:200px">
              <p style="font-weight:600;font-size:13px;margin-bottom:4px">
                ${isAwaiting ? '🔴 NO DRIVER' : '📦 Pickup'}
              </p>
              <p style="font-size:12px;color:#64748b">${order.pickupLocation.address}</p>
              <p style="font-size:12px;margin-top:4px">
                <strong>${order.commodity}</strong> — ${order.quantityKg}kg
              </p>
              ${isAwaiting ? `
                <p style="font-size:11px;color:#dc2626;margin-top:4px;font-weight:600">
                  ⚠ ${order.dispatchAttemptCount} drivers tried — needs manual re-route
                </p>
              ` : ''}
            </div>`
          );

        const deliveryMarker = L.marker([deliveryLat, deliveryLng], {
          icon: deliveryIcon,
        })
          .addTo(mapInstance.current)
          .bindPopup(
            `<div style="min-width:160px">
              <p style="font-weight:600;font-size:13px;margin-bottom:4px">
                🏁 Delivery
              </p>
              <p style="font-size:12px;color:#64748b">${order.deliveryLocation.address}</p>
            </div>`
          );

        // Route line between pickup and delivery
        const routeLine = L.polyline(
          [
            [pickupLat, pickupLng],
            [deliveryLat, deliveryLng],
          ],
          {
            color:  isAwaiting ? '#ef4444' : '#94a3b8',
            weight: isSelected ? 3 : 1.5,
            opacity: isSelected ? 0.9 : 0.5,
            dashArray: isAwaiting ? '6, 4' : undefined,
          }
        ).addTo(mapInstance.current);

        markersRef.current.push(pickupMarker, deliveryMarker, routeLine);

        // Pan to selected order
        if (isSelected) {
          mapInstance.current.panTo([pickupLat, pickupLng], {
            animate: true,
            duration: 0.5,
          });
          pickupMarker.openPopup();
        }
      });

      // If no orders, show a Kenya-wide view
      if (orders.length === 0) {
        mapInstance.current.setView([-1.2921, 36.8219], 7);
      }
    };

    updateMarkers();
  }, [orders, selectedOrderId]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 z-[400] rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
        <p className="mb-1.5 text-xs font-semibold text-slate-600">Legend</p>
        <div className="space-y-1.5">
          {[
            { color: '#22c55e', label: 'Pickup — In progress' },
            { color: '#2563eb', label: 'Delivery — In progress' },
            { color: '#ef4444', label: 'Awaiting driver — needs action' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="h-3 w-3 flex-shrink-0 rounded-full border-2 border-white shadow-sm"
                style={{ background: color }}
              />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="h-0 w-5 border-t-2 border-dashed border-red-400" />
            <span className="text-xs text-slate-600">No-driver route</span>
          </div>
        </div>
      </div>
    </div>
  );
};
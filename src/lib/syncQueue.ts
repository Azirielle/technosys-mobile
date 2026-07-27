import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as ExpoCrypto from 'expo-crypto';
import { supabase } from './supabase';

const QUEUE_KEY = 'OFFLINE_TRANSACTION_QUEUE';

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface QueueItem {
  id: string;
  type: 'time_in' | 'time_out' | 'parts_checkout' | 'leave_request' | 'ticket_submission' | 'post_comment' | 'close_ticket';
  payload: any;
  timestamp: string;
}

export const syncQueue = {
  async getQueue(): Promise<QueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to read queue:', e);
      return [];
    }
  },

  async addToQueue(type: QueueItem['type'], payload: any): Promise<void> {
    try {
      const queue = await this.getQueue();
      const newItem: QueueItem = {
        id: Math.random().toString(36).substring(2, 9),
        type,
        payload,
        timestamp: new Date().toISOString()
      };
      queue.push(newItem);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to add to queue:', e);
    }
  },

  async removeFromQueue(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter(item => item.id !== id);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to remove from queue:', e);
    }
  },

  async syncPendingQueue(onSyncSuccess?: (item: QueueItem) => void): Promise<{ success: boolean; syncedCount: number }> {
    const queue = await this.getQueue();
    if (queue.length === 0) return { success: true, syncedCount: 0 };

    let syncedCount = 0;

    for (const item of queue) {
      try {
        let error = null;

        if (item.type === 'time_in' || item.type === 'time_out') {
          let isSuspicious = false;
          let calculatedTimeIn = item.payload.app_time_in;
          let calculatedTimeOut = item.payload.app_time_out;
          let calculatedHours = item.payload.total_hours;

          try {
            // Verify Signature
            if (item.payload.uptime_at_creation && item.payload.signature) {
              const expectedSignature = await ExpoCrypto.digestStringAsync(
                ExpoCrypto.CryptoDigestAlgorithm.SHA256,
                `${item.payload.technician_id}:${item.payload.uptime_at_creation}:TECHNO_SECRET_SALT`
              );
              if (expectedSignature !== item.payload.signature) {
                console.error('Tampered payload signature detected! Discarding.');
                const tamperedError = new Error('Tampered payload signature');
                (tamperedError as any).status = 400;
                throw tamperedError;
              }
            }
            
            const currentUptime = await Device.getUptimeAsync();
            const { data: sTime, error: sErr } = await supabase.rpc('get_server_time');
            
            if (!sErr && sTime) {
              const serverTimeDate = new Date(sTime);
              
              if (item.payload.uptime_at_creation) {
                if (currentUptime >= item.payload.uptime_at_creation) {
                  // Condition 1 (No Reboot): Calculate True Time in UTC ms
                  const offsetMs = currentUptime - item.payload.uptime_at_creation;
                  const trueTimeMs = serverTimeDate.getTime() - offsetMs;
                  
                  if (item.type === 'time_in') {
                    calculatedTimeIn = new Date(trueTimeMs).toISOString();
                  } else {
                    calculatedTimeOut = new Date(trueTimeMs).toISOString();
                  }
                  isSuspicious = false; // Cryptographically sound
                } else {
                  // Condition 2 (Rebooted): Uptime reset
                  isSuspicious = true;
                  if (item.type === 'time_out') {
                    calculatedHours = 0; // Force manual HR intervention
                  }
                }
              } else {
                // Legacy records or tampered missing fields
                isSuspicious = true;
                if (item.type === 'time_out') {
                  calculatedHours = 0;
                }
              }
            } else {
              // Failed to get server time, use local time but flag
              isSuspicious = true;
            }
          } catch (err: any) {
            console.warn("Failed to perform clock tampering check:", err);
            isSuspicious = true;
            if (item.type === 'time_out') {
              calculatedHours = 0;
            }
            if (err.message === 'Tampered payload signature') {
               throw err;
            }
          }

          if (item.type === 'time_in') {
            const { error: err } = await supabase.from('time_logs').insert({
              technician_id: item.payload.technician_id,
              app_time_in: calculatedTimeIn,
              latitude: item.payload.latitude,
              longitude: item.payload.longitude,
              geofence_status: item.payload.geofence_status,
              is_mocked: item.payload.is_mocked,
              gps_accuracy: item.payload.gps_accuracy,
              app_time_out: calculatedTimeOut || null,
              total_hours: calculatedHours || null,
              is_suspicious: isSuspicious
            });
            error = err;
          } else {
            const { error: err } = await supabase.from('time_logs')
              .update({
                app_time_out: calculatedTimeOut,
                total_hours: calculatedHours,
                is_suspicious: isSuspicious
              })
              .eq('id', item.payload.log_id);
            error = err;
          }
        } else if (item.type === 'leave_request') {
          const { error: err } = await supabase.from('leaves').insert({
            technician_id: item.payload.technician_id,
            start_date: item.payload.start_date,
            end_date: item.payload.end_date,
            leave_type: item.payload.leave_type,
            reason: item.payload.reason,
            status: 'pending'
          });
          error = err;
        } else if (item.type === 'parts_checkout') {
          // 1. Double check current stock level from Supabase
          const { data: dbItem, error: fetchErr } = await supabase
            .from('inventory_items')
            .select('quantity')
            .eq('id', item.payload.item_id)
            .single();

          if (fetchErr) {
            error = fetchErr;
          } else {
            const currentQty = dbItem?.quantity ?? 0;
            const checkoutQty = item.payload.quantity;

            // 2. Decrement stock
            const { error: updateErr } = await supabase
              .from('inventory_items')
              .update({ quantity: Math.max(0, currentQty - checkoutQty), updated_at: new Date().toISOString() })
              .eq('id', item.payload.item_id);

            if (updateErr) {
              error = updateErr;
            } else {
              // 3. Log stock transaction
              const { error: txErr } = await supabase
                .from('stock_transactions')
                .insert({
                  item_id: item.payload.item_id,
                  ticket_id: item.payload.ticket_id,
                  technician_id: item.payload.technician_id,
                  type: 'out',
                  quantity: checkoutQty,
                  notes: item.payload.notes
                });

              if (txErr) {
                error = txErr;
              } else {
                // 4. Log checkout event in ticket comment thread
                const { error: commentErr } = await supabase.from('ticket_comments').insert({
                  ticket_id: item.payload.ticket_id,
                  author_id: item.payload.technician_id,
                  content: `🔧 [System DTR Log - Offline Sync]: Technician checked out ${checkoutQty} ${item.payload.unit ?? 'pcs'} of "${item.payload.name}". Memo: ${item.payload.notes}`
                });
                error = commentErr;
              }
            }
          }
        } else if (item.type === 'ticket_submission') {
          const { error: err } = await supabase.from('tickets').insert({
            id: item.payload.id,
            employee_id: item.payload.employee_id,
            title: item.payload.title,
            category: item.payload.category,
            priority: item.payload.priority,
            description: item.payload.description,
            status: item.payload.status || 'open',
            created_at: item.payload.created_at || new Date().toISOString()
          });
          error = err;
        } else if (item.type === 'post_comment') {
          const { error: err } = await supabase.from('ticket_comments').insert({
            ticket_id: item.payload.ticket_id,
            author_id: item.payload.author_id,
            content: item.payload.content,
            created_at: item.payload.created_at || new Date().toISOString()
          });
          error = err;
          if (!err) {
            // Also update the parent ticket's updated_at timestamp on Supabase
            await supabase.from('tickets')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', item.payload.ticket_id);
          }
        } else if (item.type === 'close_ticket') {
          const { error: err } = await supabase.from('tickets')
            .update({ status: 'closed', updated_at: new Date().toISOString() })
            .eq('id', item.payload.ticket_id);
          error = err;
        }

        if (error) {
          const errMessage = error.message || '';
          const status = (error as any).status;
          if (errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500) {
            console.log('Network connection still offline. Stopping sync loop.');
            return { success: false, syncedCount };
          } else {
            console.error('Non-recoverable sync error. Discarding transaction:', error);
            await this.removeFromQueue(item.id);
          }
        } else {
          await this.removeFromQueue(item.id);
          syncedCount++;
          if (onSyncSuccess) onSyncSuccess(item);
        }
      } catch (e: any) {
        console.error('Exception during queue sync:', e);
        return { success: false, syncedCount };
      }
    }

    return { success: true, syncedCount };
  }
};

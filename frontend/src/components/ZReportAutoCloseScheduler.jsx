import React, { useEffect } from 'react';
import { useSettings } from '../store/SettingsContext';
import { performAutoClose } from '../utils/zReportHelper';

export default function ZReportAutoCloseScheduler() {
  const { settings } = useSettings();

  useEffect(() => {
    if (!window.electronAPI?.dbQuery || !settings || !settings.zReportAutoCloseEnabled) {
      return;
    }

    const checkAndAutoClose = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // 1. Check if today is already closed
        const todayClosedRes = await window.electronAPI.dbQuery(
          `SELECT id FROM z_reports WHERE businessDate = ? LIMIT 1`, [todayStr]
        );

        const isTodayClosed = todayClosedRes.success && todayClosedRes.data && todayClosedRes.data.length > 0;

        if (!isTodayClosed) {
          // Compare current time with auto-close time
          const now = new Date();
          const currentHours = String(now.getHours()).padStart(2, '0');
          const currentMinutes = String(now.getMinutes()).padStart(2, '0');
          const currentTimeStr = `${currentHours}:${currentMinutes}`;
          const scheduledTime = settings.zReportAutoCloseTime || '23:59';

          if (currentTimeStr >= scheduledTime) {
            console.log(`Auto-close triggered. Current time: ${currentTimeStr}, Scheduled: ${scheduledTime}`);
            await performAutoClose(window.electronAPI.dbQuery, settings, todayStr);
          }
        }

        // 2. Check for retroactive closing of past days
        const lastReportRes = await window.electronAPI.dbQuery(
          `SELECT businessDate, endTime FROM z_reports ORDER BY endTime DESC LIMIT 1`, []
        );

        if (lastReportRes.success && lastReportRes.data && lastReportRes.data.length > 0) {
          const lastReportDate = lastReportRes.data[0].businessDate;
          if (lastReportDate < todayStr) {
            // Last report was closed on a past date.
            // Check if there are orders created after that report but before today.
            const lastEndTime = lastReportRes.data[0].endTime;
            const yesterdayEnd = new Date();
            yesterdayEnd.setHours(0, 0, 0, 0); // Start of today (which is end of yesterday)
            const yesterdayEndIso = yesterdayEnd.toISOString();

            const pendingOrdersRes = await window.electronAPI.dbQuery(
              `SELECT COUNT(*) as count FROM orders WHERE createdAt > ? AND createdAt < ? AND COALESCE(status, '') NOT IN ('Deleted', 'Cancelled')`,
              [lastEndTime, yesterdayEndIso]
            );

            if (pendingOrdersRes.success && pendingOrdersRes.data[0].count > 0) {
              console.log(`Retroactive auto-close triggered for past date: ${lastReportDate}`);
              // Auto-close for the date of the pending transactions (yesterday or intermediate day)
              const pendingTxnDateRes = await window.electronAPI.dbQuery(
                `SELECT createdAt FROM orders WHERE createdAt > ? AND createdAt < ? ORDER BY createdAt ASC LIMIT 1`,
                [lastEndTime, yesterdayEndIso]
              );
              if (pendingTxnDateRes.success && pendingTxnDateRes.data.length > 0) {
                const pendingDate = pendingTxnDateRes.data[0].createdAt.split('T')[0];
                await performAutoClose(window.electronAPI.dbQuery, settings, pendingDate);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed in auto-close scheduler:", err);
      }
    };

    // Run check on mount and then every 60 seconds
    checkAndAutoClose();
    const interval = setInterval(checkAndAutoClose, 60000);
    return () => clearInterval(interval);
  }, [settings]);

  return null; // This scheduler doesn't render any UI
}

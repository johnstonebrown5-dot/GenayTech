import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  MessageSquare, 
  Filter, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import api from '../api';
import { useNotification } from '../components/NotificationContext';

const AdminCommunicationLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    channel: '',
    status: '',
    search: ''
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCounts, setPendingCounts] = useState({ total: 0, sms: 0, email: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { addNotification } = useNotification();
  const [polling, setPolling] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page_size: 10000, // Fetch all records
        channel: filter.channel,
        status: filter.status,
        search: filter.search
      };
      const res = await api.get('/communications/delivery-logs/', { params });
      
      // Handle paginated or non-paginated response
      if (res.data.results) {
        setLogs(res.data.results);
        setTotalPages(1); // All on one page
      } else {
        setLogs(res.data);
        setTotalPages(1);
      }
      
      // Fetch pending counts
      const countsRes = await api.get('/communications/delivery-logs/pending_count/');
      setPendingCounts(countsRes.data);

      return res.data.results || res.data || [];
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      addNotification('Failed to load communication logs', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const pollUntilSettled = async ({ attempts = 10, delayMs = 1500 } = {}) => {
    if (polling) return;
    setPolling(true);
    try {
      for (let i = 0; i < attempts; i++) {
        const latest = await fetchLogs();
        const stillSending = (latest || []).some(l => l && (l.status === 'queued' || l.status === 'pending'));
        if (!stillSending) break;
        await new Promise(r => setTimeout(r, delayMs));
      }
    } finally {
      setPolling(false);
    }
  };

  const handleRetry = async (id) => {
    // Optimistic UI: mark as queued/sending immediately
    setLogs(prev => (prev || []).map(l => (l.id === id ? { ...l, status: 'queued', error: '' } : l)));
    try {
      await api.post('/communications/delivery-logs/retry/', { id });
      addNotification('Retry started', 'success');
      pollUntilSettled();
    } catch (err) {
      addNotification('Retry failed to start', 'error');
      fetchLogs();
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, filter.channel, filter.status, filter.search]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(logs.map(log => log.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id, checked) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleSendSelected = async () => {
    const failedIds = logs.filter(log => selectedIds.has(log.id) && log.status === 'failed').map(log => log.id);
    if (failedIds.length === 0) {
      addNotification('No failed messages selected', 'warning');
      return;
    }
    try {
      await api.post('/communications/delivery-logs/retry/', { ids: failedIds });
      addNotification('Retry initiated for selected failed messages', 'success');
      setSelectedIds(new Set());
      fetchLogs();
    } catch (err) {
      addNotification('Failed to retry selected messages', 'error');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      addNotification('No messages selected', 'warning');
      return;
    }
    if (!confirm('Delete selected communication logs?')) return;
    try {
      await api.post('/communications/delivery-logs/bulk-delete/', { ids: Array.from(selectedIds) });
      addNotification(`Deleted ${selectedIds.size} logs`, 'success');
      setSelectedIds(new Set());
      fetchLogs();
    } catch (err) {
      addNotification('Failed to delete selected logs', 'error');
    }
  };

  const handleCancelSelected = async () => {
    const queuedIds = logs.filter(log => selectedIds.has(log.id) && (log.status === 'queued' || log.status === 'pending')).map(log => log.id);
    if (queuedIds.length === 0) {
      addNotification('No queued messages selected', 'warning');
      return;
    }
    if (!confirm('Cancel selected queued messages?')) return;
    try {
      await api.post('/communications/delivery-logs/bulk-delete/', { ids: queuedIds });
      addNotification(`Canceled ${queuedIds.length} queued messages`, 'success');
      setSelectedIds(new Set());
      fetchLogs();
    } catch (err) {
      addNotification('Failed to cancel selected messages', 'error');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-600" />;
      case 'queued':
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusLabel = (status) => {
    if (status === 'queued' || status === 'pending') return 'sending';
    return status || '';
  };

  const getChannelIcon = (channel) => {
    return channel === 'sms' ? 
      <MessageSquare className="w-4 h-4 text-blue-500" /> : 
      <Mail className="w-4 h-4 text-purple-500" />;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Communication Logs</h1>
          <p className="text-slate-500 text-sm">Monitor SMS and Email delivery status</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {pendingCounts.total} Pending
            </span>
          </div>
          <button 
            onClick={() => fetchLogs()}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filters:</span>
        </div>

        <select 
          value={filter.channel}
          onChange={(e) => setFilter({ ...filter, channel: e.target.value })}
          className="text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Channels</option>
          <option value="sms">SMS Only</option>
          <option value="email">Email Only</option>
        </select>

        <select 
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
          <option value="pending">Pending</option>
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search recipients or messages..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            className="w-full pl-9 pr-4 py-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
          <button 
            onClick={handleSendSelected}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            Send Selected Failed
          </button>
          <button 
            onClick={handleDeleteSelected}
            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete Selected
          </button>
          <button 
            onClick={handleCancelSelected}
            className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"
          >
            Cancel Selected Queued
          </button>
          <button 
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" checked={selectedIds.size === logs.length && logs.length > 0} onChange={(e)=>handleSelectAll(e.target.checked)} /></th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Message Snippet</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="7" className="px-4 py-4 h-12 bg-slate-50/50"></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate-500">
                    No communication logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${
                    log.status === 'sent' ? 'bg-green-50 border-l-4 border-green-400' : 
                    log.status === 'failed' ? 'bg-red-50 border-l-4 border-red-400' : ''
                  }`}>
                    <td className="px-4 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(log.id)} 
                        onChange={(e)=>handleSelect(log.id, e.target.checked)} 
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {getChannelIcon(log.channel)}
                        <span className="uppercase font-medium text-xs text-slate-600">{log.channel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-900">
                      {log.recipient}
                    </td>
                    <td className="px-4 py-4 text-slate-600 max-w-xs truncate">
                      {log.message_snippet}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className={`capitalize text-xs font-medium ${
                          log.status === 'sent' ? 'text-green-600' : 
                          log.status === 'failed' ? 'text-red-600' : 
                          'text-amber-600'
                        }`}>
                          {getStatusLabel(log.status)}
                        </span>
                      </div>
                      {log.error && (
                        <p className="text-[10px] text-red-400 mt-1 max-w-[150px] truncate" title={log.error}>
                          {log.error}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {log.status === 'failed' && (
                        <button 
                          onClick={() => handleRetry(log.id)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded border border-slate-300 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded border border-slate-300 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCommunicationLogs;

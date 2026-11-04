'use client';

import React, { useState, useMemo } from 'react';
import {
  CampaignType,
  ParsedContactRecord,
  EmailContactRecord,
  WhatsAppContactRecord,
  ContactValidationStatus,
} from '@/types/campaign';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface CsvPreviewTableProps {
  records: ParsedContactRecord[];
  campaignType: CampaignType;
  headers: string[];
}

export default function CsvPreviewTable({
  records,
  campaignType,
  headers,
}: CsvPreviewTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContactValidationStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const isEmail = campaignType === 'email';

  // Secondary columns to display (up to 3 other fields from the CSV)
  const secondaryHeaders = useMemo(() => {
    return headers
      .filter((h) => {
        const lower = h.toLowerCase();
        return (
          !lower.includes('email') &&
          !lower.includes('phone') &&
          !lower.includes('mobile') &&
          !lower.includes('whatsapp')
        );
      })
      .slice(0, 3);
  }, [headers]);

  // Filtered records based on query and status filter
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Status filter
      if (statusFilter !== 'all' && rec.status !== statusFilter) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const targetVal = isEmail
        ? (rec as EmailContactRecord).email || ''
        : (rec as WhatsAppContactRecord).phone || '';

      if (targetVal.toLowerCase().includes(q)) return true;
      if (rec.name && rec.name.toLowerCase().includes(q)) return true;

      // Search raw fields
      for (const val of Object.values(rec.raw)) {
        if (String(val).toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [records, statusFilter, searchQuery, isEmail]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Handle filter changes
  const handleFilterChange = (filter: 'all' | ContactValidationStatus) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const getStatusBadge = (rec: ParsedContactRecord) => {
    switch (rec.status) {
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Valid
          </span>
        );
      case 'invalid':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"
            title={rec.errors.join('; ')}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Invalid
          </span>
        );
      case 'duplicate':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
            title={rec.errors.join('; ')}
          >
            <Copy className="w-3.5 h-3.5 text-amber-600" />
            Duplicate
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Table Controls Header */}
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 text-xs w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({records.length})
          </button>
          <button
            onClick={() => handleFilterChange('valid')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'valid'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            Valid ({records.filter((r) => r.status === 'valid').length})
          </button>
          <button
            onClick={() => handleFilterChange('invalid')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'invalid'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            Invalid ({records.filter((r) => r.status === 'invalid').length})
          </button>
          <button
            onClick={() => handleFilterChange('duplicate')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'duplicate'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            Duplicates ({records.filter((r) => r.status === 'duplicate').length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search records..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 w-16">#</th>
              <th className="py-3 px-4">{isEmail ? 'Email Address' : 'Phone Number'}</th>
              {secondaryHeaders.map((hdr) => (
                <th key={hdr} className="py-3 px-4 capitalize hidden sm:table-cell">
                  {hdr.replace(/_/g, ' ')}
                </th>
              ))}
              <th className="py-3 px-4 w-32">Status</th>
              <th className="py-3 px-4">Validation Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={secondaryHeaders.length + 4}
                  className="py-12 text-center text-slate-400"
                >
                  <Filter className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium">No contacts match your current filter.</p>
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record) => {
                const targetValue = isEmail
                  ? (record as EmailContactRecord).email
                  : (record as WhatsAppContactRecord).phone;

                return (
                  <tr
                    key={record.rowIndex}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      record.status === 'invalid'
                        ? 'bg-rose-50/20'
                        : record.status === 'duplicate'
                        ? 'bg-amber-50/20'
                        : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-400">{record.rowIndex}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div className="font-mono text-xs">{targetValue || '(Empty)'}</div>
                      {!isEmail && (record as WhatsAppContactRecord).formattedPhone && (
                        <div className="text-[10px] text-emerald-600 font-sans mt-0.5">
                          Standardized: {(record as WhatsAppContactRecord).formattedPhone}
                        </div>
                      )}
                    </td>
                    {secondaryHeaders.map((hdr) => (
                      <td key={hdr} className="py-3.5 px-4 text-slate-600 hidden sm:table-cell">
                        {record.raw[hdr] || '—'}
                      </td>
                    ))}
                    <td className="py-3.5 px-4">{getStatusBadge(record)}</td>
                    <td className="py-3.5 px-4">
                      {record.errors.length > 0 ? (
                        <span className="text-[11px] text-rose-600 font-medium">
                          {record.errors.join('; ')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600">Verified format</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredRecords.length)} of{' '}
            {filteredRecords.length} contacts
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


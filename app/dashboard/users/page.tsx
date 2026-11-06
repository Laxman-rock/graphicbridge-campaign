'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Sidebar from '@/components/layout/Sidebar';
import SettingsModal from '@/components/layout/SettingsModal';
import {
  Users,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Mail,
  Phone,
  Briefcase,
  Layers,
  ChevronDown,
  Check,
  User as UserIcon,
} from 'lucide-react';
import { User, UserListParams } from '@/types/auth';
import { listUsers } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function UserManagementPage() {
  const { error: toastError, info: toastInfo } = useToast();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Users data & pagination
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Detail Modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Fetch users from API using canonical employee_category query parameter
  const fetchUsers = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoading(true);

      try {
        const params: UserListParams = {
          page: pagination.page,
          limit: pagination.limit,
        };

        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }

        // Canonical employee_category parameter: single or comma-separated
        if (selectedCategories.length > 0) {
          params.employee_category = selectedCategories.join(',');
        }

        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }

        const res = await listUsers(params);

        if (res.success && res.data) {
          setUsers(res.data);
          if (res.pagination) {
            setPagination(res.pagination);
          } else {
            setPagination((prev) => ({
              ...prev,
              total: res.data?.length || 0,
              pages: Math.ceil((res.data?.length || 0) / prev.limit) || 1,
            }));
          }
        } else if (!isSilent) {
          toastError(res.error || 'Failed to fetch users list.', 'Error');
        }
      } catch {
        if (!isSilent) {
          toastError('Could not load users list. Please check server connectivity.', 'Error');
        }
      } finally {
        if (!isSilent) setIsLoading(false);
      }
    },
    [pagination.page, pagination.limit, statusFilter, selectedCategories, searchQuery, toastError]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Dynamically extract known category values from current user set and standard defaults
  const availableCategories = useMemo(() => {
    const defaultCategories = ['IT', 'Production', 'Marketing', 'Sales', 'Operations', 'Finance', 'HR', 'Support'];
    const dynamicCategories = new Set<string>(defaultCategories);

    users.forEach((u) => {
      if (u.employee_category && typeof u.employee_category === 'string' && u.employee_category.trim()) {
        dynamicCategories.add(u.employee_category.trim());
      }
    });

    return Array.from(dynamicCategories).sort();
  }, [users]);

  // Client-side search filtering fallback for instant responsiveness
  const filteredUsers = useMemo(() => {
    let result = users;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.user_id && u.user_id.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          (u.designation && u.designation.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((u) => {
        const userStatus = (u.status || 'active').toLowerCase();
        return userStatus === statusFilter.toLowerCase();
      });
    }

    if (selectedCategories.length > 0) {
      result = result.filter((u) => {
        if (!u.employee_category) return false;
        return selectedCategories.includes(u.employee_category);
      });
    }

    return result;
  }, [users, searchQuery, statusFilter, selectedCategories]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((c) => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const clearCategoryFilter = () => {
    setSelectedCategories([]);
    setPagination((p) => ({ ...p, page: 1 }));
    toastInfo('Employee Category filter reset.', 'Filter Cleared');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Mobile Drawer */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Header */}
      <DashboardHeader
        title="User & Employee Management"
        subtitle="Manage organization employees, roles, contact details, and employee categories"
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6">
        {/* Controls Bar: Search & Category Filters */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, ID, email, or designation..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Employee Category Multi-Select Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
                    selectedCategories.length > 0
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    Category
                    {selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ''}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isCategoryDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsCategoryDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl z-40 p-2 space-y-1">
                      <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100 mb-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Filter by Category
                        </span>
                        {selectedCategories.length > 0 && (
                          <button
                            type="button"
                            onClick={clearCategoryFilter}
                            className="text-[10px] text-rose-600 hover:underline font-semibold"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-0.5">
                        {availableCategories.map((cat) => {
                          const isSelected = selectedCategories.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => toggleCategory(cat)}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{cat}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 shadow-2xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => fetchUsers()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-2xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Active Category Filter Chips */}
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" />
                Active Category Filters:
              </span>
              {selectedCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                >
                  {cat}
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="hover:text-rose-600 p-0.5 rounded-full"
                    title={`Remove ${cat}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearCategoryFilter}
                className="text-xs text-rose-600 hover:underline font-semibold ml-1"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Loading user records...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-800">No users found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {selectedCategories.length > 0
                  ? 'No users match the selected category filters. Try clearing the filter.'
                  : 'No user accounts are registered or matching your search criteria.'}
              </p>
              {selectedCategories.length > 0 && (
                <button
                  type="button"
                  onClick={clearCategoryFilter}
                  className="mt-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-semibold text-xs hover:bg-indigo-100 transition-colors"
                >
                  Reset Category Filter
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Employee / User</th>
                    <th className="py-3.5 px-4">Contact Info</th>
                    <th className="py-3.5 px-4">Role / Designation</th>
                    <th className="py-3.5 px-4">Employee Category</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user, idx) => {
                    const initials = (user.name || user.user_id || 'U')
                      .slice(0, 2)
                      .toUpperCase();
                    const statusStr = (user.status || 'active').toLowerCase();
                    const isActive = statusStr !== 'inactive';

                    return (
                      <tr
                        key={user.id || user._id || user.user_id || idx}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Name & User ID */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {user.name || user.user_id}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 truncate">
                                ID: {user.user_id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact Info */}
                        <td className="py-4 px-4 text-slate-600">
                          <div className="space-y-0.5">
                            {user.email ? (
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[180px]">{user.email}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                            {(user.phone || user.contact_number) && (
                              <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{user.phone || user.contact_number}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Role & Designation */}
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 capitalize block">
                              {user.role || 'Member'}
                            </span>
                            {user.designation && (
                              <span className="text-[11px] text-slate-500 block">
                                {user.designation}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Employee Category Column */}
                        <td className="py-4 px-4">
                          {user.employee_category && String(user.employee_category).trim() ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                              <Layers className="w-3 h-3 text-violet-500" />
                              {String(user.employee_category).trim()}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium px-2 py-1">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <XCircle className="w-3 h-3 text-slate-400" />
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 hover:border-indigo-200 transition-colors shadow-2xs"
                            title="View Employee Card"
                            aria-label="View Employee Card"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} employees)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Employee Details Modal / Card */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Employee Card</h3>
                  <p className="text-xs text-slate-500">ID: {selectedUser.user_id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Profile Card Header */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {(selectedUser.name || selectedUser.user_id || 'U')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {selectedUser.name || selectedUser.user_id}
                  </h4>
                  <p className="text-xs text-indigo-700 font-semibold mt-0.5">
                    {selectedUser.designation || selectedUser.role || 'Member'}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    User ID: {selectedUser.user_id}
                  </p>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium block">Employee Category</span>
                  <div className="mt-1">
                    {selectedUser.employee_category && String(selectedUser.employee_category).trim() ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200">
                        <Layers className="w-3 h-3 text-violet-600" />
                        {String(selectedUser.employee_category).trim()}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold">—</span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium block">Status</span>
                  <div className="mt-1">
                    {(selectedUser.status || 'active').toLowerCase() !== 'inactive' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <XCircle className="w-3 h-3 text-slate-400" />
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 col-span-2 space-y-1">
                  <span className="text-slate-400 font-medium block">Email Address</span>
                  <p className="text-slate-800 font-medium text-xs break-all">
                    {selectedUser.email || '—'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-400 font-medium block">Phone / Mobile</span>
                  <p className="text-slate-800 font-mono text-xs">
                    {selectedUser.phone || selectedUser.contact_number || '—'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-400 font-medium block">Role</span>
                  <p className="text-slate-800 font-semibold text-xs capitalize">
                    {selectedUser.role || 'Member'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}


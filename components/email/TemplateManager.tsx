'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  Check,
  X,
  Tag,
  AlertCircle,
  Sparkles,
  Layers,
  Wand2,
  ArrowRight,
  Sliders,
  Copy,
} from 'lucide-react';
import { EmailTemplate } from '@/types/email';
import { listEmailTemplates, deleteEmailTemplate, previewEmail } from '@/lib/email-api';
import { useToast } from '@/components/ui/Toast';
import EmailPreviewModal from './EmailPreviewModal';
import ModernTemplateEditor from './ModernTemplateEditor';

export default function TemplateManager() {
  const { error: toastError, success: toastSuccess } = useToast();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Studio Mode State (when active, displays the ModernTemplateEditor)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isPresetSelection, setIsPresetSelection] = useState(false);

  // Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listEmailTemplates();
      if (res.success && res.data) {
        setTemplates(res.data);
      } else {
        toastError(res.error || 'Failed to load templates.', 'Error');
      }
    } catch {
      toastError('Could not connect to templates API.', 'Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setIsPresetSelection(false);
    setIsEditorOpen(true);
  };

  const handleEditTemplate = (tmpl: EmailTemplate) => {
    setEditingTemplate(tmpl);
    setIsPresetSelection(false);
    setIsEditorOpen(true);
  };

  const handleDelete = async (tmpl: EmailTemplate) => {
    if (!confirm(`Are you sure you want to deactivate template "${tmpl.name}"?`)) {
      return;
    }

    try {
      const res = await deleteEmailTemplate(tmpl.template_id || tmpl.id!);
      if (res.success) {
        toastSuccess(res.message || 'Template deactivated successfully.', 'Deleted');
        fetchTemplates();
      } else {
        toastError(res.error || 'Failed to delete template.', 'Error');
      }
    } catch {
      toastError('Delete request failed.', 'Error');
    }
  };

  const handlePreview = async (tmpl: EmailTemplate) => {
    setIsPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);

    const mockVars: Record<string, string> = {
      customer_name: 'Sarah Jenkins',
      company_name: 'Nexus Cloud',
    };
    if (tmpl.variables) {
      tmpl.variables.forEach((v) => {
        if (!mockVars[v]) {
          mockVars[v] = `[${v}]`;
        }
      });
    }

    try {
      const res = await previewEmail({
        mode: 'template',
        template_id: tmpl.template_id,
        subject: tmpl.subject,
        variables: mockVars,
      });

      if (res.success && res.data) {
        setPreviewData(res.data);
      } else {
        // Fallback local renderer
        let renderedHtml = tmpl.content;
        let renderedSubj = tmpl.subject;
        Object.entries(mockVars).forEach(([k, v]) => {
          const rg = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
          renderedHtml = renderedHtml.replace(rg, v);
          renderedSubj = renderedSubj.replace(rg, v);
        });

        setPreviewData({
          subject: renderedSubj,
          html: renderedHtml,
          text: renderedHtml.replace(/<[^>]*>/g, ''),
          content_type: 'HTML',
          attachments: [],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Preview generation failed';
      setPreviewError(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  // If editor is open, render the full ModernTemplateEditor studio view
  if (isEditorOpen) {
    return (
      <ModernTemplateEditor
        initialTemplate={editingTemplate}
        isPreset={isPresetSelection}
        onBack={() => {
          setIsEditorOpen(false);
          setEditingTemplate(null);
          setIsPresetSelection(false);
        }}
        onSaved={() => {
          setIsEditorOpen(false);
          setEditingTemplate(null);
          setIsPresetSelection(false);
          fetchTemplates();
        }}
      />
    );
  }

  // Filter templates
  const categories = ['all', 'marketing', 'onboarding', 'promotions', 'newsletter', 'transactional'];

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.template_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' ||
      (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      {/* Hero Studio Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-500/20 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 border border-blue-400/30 text-blue-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Modern Email Template Studio</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Design High-Conversion Modern Email Templates
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Create responsive, mobile-optimized email templates with dynamic merge tags, custom styled CTA buttons, coupon badges, and live preview rendering.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Launch Modern Studio Builder</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat === 'all' ? 'All Templates' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="w-full sm:w-56 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
          />

          <button
            type="button"
            onClick={fetchTemplates}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh templates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* User's Existing Templates Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Your Custom Saved Templates ({filteredTemplates.length})
          </h3>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400 space-y-3 shadow-xs">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No saved templates match your filter</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You can create a new custom template using our visual builder or jump-start from the modern presets below.
            </p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Template</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((tmpl) => (
              <div
                key={tmpl._id || tmpl.id || tmpl.template_id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    {tmpl.category && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                        {tmpl.category}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {tmpl.name}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Slug: {tmpl.template_id}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="text-slate-400 font-medium">Subject: </span>
                    <span className="text-slate-800 font-semibold">{tmpl.subject}</span>
                  </div>

                  {tmpl.variables && tmpl.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tmpl.variables.map((v) => (
                        <span
                          key={v}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-blue-50 text-blue-700"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handlePreview(tmpl)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditTemplate(tmpl)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Studio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tmpl)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Deactivate template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        isLoading={previewLoading}
        previewData={previewData}
        error={previewError}
      />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { UserPlus, RefreshCw, Loader2, User2, Mail, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { formatDate } from '@/utils';
import axiosInstance from '@/lib/axios';

interface FAFormValues {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}

interface FAUser {
  user_id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

const FACard = ({ fa }: { fa: FAUser }) => (
  <div className="card p-4 flex items-start gap-3">
    <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
      <span className="text-white text-sm font-bold font-display">
        {fa.name.charAt(0).toUpperCase()}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-surface-900 truncate">{fa.name}</p>
      <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5 truncate">
        <Mail size={11} /> {fa.email}
      </p>
      <p className="text-xs text-surface-400 flex items-center gap-1 mt-0.5">
        <Calendar size={11} /> Joined {formatDate(fa.created_at)}
      </p>
    </div>
    <span className="shrink-0 text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
      Active
    </span>
  </div>
);

const AddFinanceAssociatePage = () => {
  const [faList, setFaList]       = useState<FAUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FAFormValues>();

  const loadFAs = useCallback(async () => {
    setListLoading(true);
    try {
      const { data } = await axiosInstance.get('/auth/api/v1/auth/finance-associates');
      setFaList(data.items ?? []);
    } catch {
      toast.error('Failed to load finance associates');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadFAs(); }, [loadFAs]);

  const onSubmit = async (values: FAFormValues) => {
    setSubmitting(true);
    try {
      await axiosInstance.post('/auth/api/v1/auth/create-fa', values);
      toast.success(`Finance Associate ${values.name} created!`);
      reset();
      await loadFAs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Failed to create finance associate';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <PageHeader
        title="Finance Associates"
        subtitle="Create new finance associate accounts and manage your team."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">

        {/* ── Left: Create form ── */}
        <div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
                <UserPlus size={18} className="text-white" />
              </div>
              <div>
                <h2 className="font-display font-bold text-surface-900">Create Account</h2>
                <p className="text-xs text-surface-500 mt-0.5">New finance associate login</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Input
                label="Full Name"
                placeholder="Jane Doe"
                error={errors.name?.message}
                {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } })}
              />
              <Input
                label="Email"
                type="email"
                placeholder="jane@company.com"
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                })}
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Minimum 8 characters' },
                })}
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                error={errors.confirm_password?.message}
                {...register('confirm_password', {
                  required: 'Please confirm password',
                  validate: (val, formValues) =>
                    val === formValues.password || 'Passwords do not match',
                })}
              />

              {/* Role badge */}
              <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                <User2 size={14} className="text-brand-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-brand-700">Finance Associate role</p>
                  <p className="text-xs text-brand-500">Access to incidents dashboard and documents</p>
                </div>
              </div>

              <Button type="submit" className="w-full" isLoading={submitting}>
                <UserPlus size={15} />
                Create Finance Associate
              </Button>
            </form>
          </div>
        </div>

        {/* ── Right: FA list ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-surface-900">Team Members</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                {faList.length} finance associate{faList.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={loadFAs}
              className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={listLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {listLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-surface-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading team…</span>
            </div>
          ) : faList.length === 0 ? (
            <div className="card p-10 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center">
                <User2 size={22} className="text-surface-400" />
              </div>
              <p className="text-sm font-medium text-surface-700">No finance associates yet</p>
              <p className="text-xs text-surface-400">Create your first one using the form.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {faList.map(fa => <FACard key={fa.user_id} fa={fa} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddFinanceAssociatePage;

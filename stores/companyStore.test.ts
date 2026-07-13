import { describe, it, expect, beforeEach } from 'vitest';
import { useCompanyStore } from './companyStore';
import type { Company } from '@/lib/types';

const MOCK_A: Company = { id: 'c1', name: 'Company A' } as Company;
const MOCK_B: Company = { id: 'c2', name: 'Company B' } as Company;
const ALL_MOCK: Company[] = [MOCK_A, MOCK_B];

describe('companyStore', () => {
  // Reset store between tests
  beforeEach(() => {
    useCompanyStore.setState({
      selectedCompany: null,
      companies: [],
      userRole: null,
      roleLoading: false,
      mode: 'individual',
      isConjunto: false,
    });
  });

  describe('initial state', () => {
    it('initializes with defaults', () => {
      const state = useCompanyStore.getState();
      expect(state.selectedCompany).toBeNull();
      expect(state.companies).toEqual([]);
      expect(state.userRole).toBeNull();
      expect(state.roleLoading).toBe(false);
      expect(state.mode).toBe('individual');
      expect(state.isConjunto).toBe(false);
    });
  });

  describe('setSelectedCompany', () => {
    it('sets selected company and clears conjunto flag', () => {
      useCompanyStore.getState().setSelectedCompany(MOCK_A);
      const state = useCompanyStore.getState();
      expect(state.selectedCompany).toEqual(MOCK_A);
      expect(state.isConjunto).toBe(false);
    });

    it('sets null without error', () => {
      useCompanyStore.getState().setSelectedCompany(null);
      expect(useCompanyStore.getState().selectedCompany).toBeNull();
    });
  });

  describe('setCompanies', () => {
    it('replaces the companies array', () => {
      useCompanyStore.getState().setCompanies(ALL_MOCK);
      expect(useCompanyStore.getState().companies).toEqual(ALL_MOCK);
    });

    it('accepts empty array', () => {
      useCompanyStore.getState().setCompanies([]);
      expect(useCompanyStore.getState().companies).toEqual([]);
    });
  });

  describe('setMode', () => {
    it('sets mode to conjunto and isConjunto to true', () => {
      useCompanyStore.getState().setMode('conjunto');
      const state = useCompanyStore.getState();
      expect(state.mode).toBe('conjunto');
      expect(state.isConjunto).toBe(true);
    });

    it('sets mode to individual and isConjunto to false', () => {
      useCompanyStore.setState({ mode: 'conjunto', isConjunto: true });
      useCompanyStore.getState().setMode('individual');
      const state = useCompanyStore.getState();
      expect(state.mode).toBe('individual');
      expect(state.isConjunto).toBe(false);
    });
  });

  describe('setCompany', () => {
    it('finds company by id and sets it as selected with individual mode', () => {
      useCompanyStore.getState().setCompanies(ALL_MOCK);
      useCompanyStore.getState().setCompany('c2');
      const state = useCompanyStore.getState();
      expect(state.selectedCompany).toEqual(MOCK_B);
      expect(state.mode).toBe('individual');
      expect(state.isConjunto).toBe(false);
    });

    it('does nothing when id does not match any company', () => {
      useCompanyStore.getState().setCompanies(ALL_MOCK);
      useCompanyStore.setState({ selectedCompany: MOCK_A });
      useCompanyStore.getState().setCompany('non-existent');
      const state = useCompanyStore.getState();
      // selectedCompany should remain unchanged
      expect(state.selectedCompany).toEqual(MOCK_A);
    });

    it('does nothing when companies array is empty', () => {
      useCompanyStore.getState().setCompany('c1');
      expect(useCompanyStore.getState().selectedCompany).toBeNull();
    });
  });

  describe('setModeWithFallback', () => {
    it('conjunto mode: sets mode conjunto and clears selectedCompany', () => {
      useCompanyStore.getState().setModeWithFallback('conjunto', ALL_MOCK, MOCK_A);
      const state = useCompanyStore.getState();
      expect(state.mode).toBe('conjunto');
      expect(state.selectedCompany).toBeNull();
      expect(state.isConjunto).toBe(true);
    });

    it('individual mode with no selectedCompany: falls back to first company', () => {
      useCompanyStore.getState().setModeWithFallback('individual', ALL_MOCK, null);
      const state = useCompanyStore.getState();
      expect(state.mode).toBe('individual');
      expect(state.selectedCompany).toEqual(MOCK_A);
      expect(state.isConjunto).toBe(false);
    });

    it('individual mode with selectedCompany: keeps it', () => {
      // Pre-set selectedCompany — else branch preserves existing state
      useCompanyStore.setState({ selectedCompany: MOCK_B });
      useCompanyStore.getState().setModeWithFallback('individual', ALL_MOCK, MOCK_B);
      const state = useCompanyStore.getState();
      expect(state.mode).toBe('individual');
      expect(state.selectedCompany).toEqual(MOCK_B);
      expect(state.isConjunto).toBe(false);
    });

    it('individual mode with empty companies and no selectedCompany: sets mode only', () => {
      useCompanyStore.getState().setModeWithFallback('individual', [], null);
      const state = useCompanyStore.getState();
      expect(state.mode).toBe('individual');
      expect(state.selectedCompany).toBeNull();
      expect(state.isConjunto).toBe(false);
    });
  });

  describe('setUserRole and setRoleLoading', () => {
    it('setUserRole stores the role', () => {
      useCompanyStore.getState().setUserRole('admin');
      expect(useCompanyStore.getState().userRole).toBe('admin');
    });

    it('setUserRole accepts null', () => {
      useCompanyStore.getState().setUserRole(null);
      expect(useCompanyStore.getState().userRole).toBeNull();
    });

    it('setRoleLoading stores loading flag', () => {
      useCompanyStore.getState().setRoleLoading(true);
      expect(useCompanyStore.getState().roleLoading).toBe(true);
    });
  });
});

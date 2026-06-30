import { DepartmentTreeNode } from '../../core/models';
import { resolveDescription, resolveName } from './department.service';

function node(partial: Partial<DepartmentTreeNode>): DepartmentTreeNode {
  return {
    id: '1',
    name: 'Engineering',
    description: null,
    sortOrder: 0,
    children: [],
    translations: [],
    ...partial,
  };
}

describe('department translation resolution', () => {
  describe('resolveName', () => {
    it('returns the base name when no translation matches the culture', () => {
      expect(resolveName(node({ name: 'Engineering' }), 'ar')).toBe('Engineering');
    });

    it('prefers the matching culture translation', () => {
      const n = node({ name: 'Engineering', translations: [{ lang: 'ar', name: 'الهندسة' }] });
      expect(resolveName(n, 'ar')).toBe('الهندسة');
      expect(resolveName(n, 'en')).toBe('Engineering');
    });

    it('falls back to the base name when the translation name is blank', () => {
      const n = node({ name: 'Engineering', translations: [{ lang: 'ar', name: '   ' }] });
      expect(resolveName(n, 'ar')).toBe('Engineering');
    });
  });

  describe('resolveDescription', () => {
    it('returns null when neither the translation nor the base has a description', () => {
      expect(resolveDescription(node({ description: null }), 'ar')).toBeNull();
    });

    it('prefers the matching culture description, then the base', () => {
      const n = node({
        description: 'Builds the product',
        translations: [{ lang: 'ar', description: 'تبني المنتج' }],
      });
      expect(resolveDescription(n, 'ar')).toBe('تبني المنتج');
      expect(resolveDescription(n, 'en')).toBe('Builds the product');
    });
  });
});

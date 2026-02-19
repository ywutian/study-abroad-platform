import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthorizationService, Ownable } from './authorization.service';

describe('AuthorizationService', () => {
  let service: AuthorizationService;

  beforeEach(() => {
    service = new AuthorizationService();
  });

  // =====================================================================
  // verifyOwnership
  // =====================================================================
  describe('verifyOwnership', () => {
    it('should return the entity when the owner matches', () => {
      const entity: Ownable = { userId: 'user-1', name: 'My Item' };
      const result = service.verifyOwnership(entity, 'user-1');
      expect(result).toBe(entity);
    });

    it('should throw NotFoundException when entity is null', () => {
      expect(() => service.verifyOwnership(null, 'user-1')).toThrow(
        NotFoundException,
      );
    });

    it('should return null when throwOnNotFound is false and entity is null', () => {
      const result = service.verifyOwnership(null, 'user-1', {
        throwOnNotFound: false,
      });
      expect(result).toBeNull();
    });

    it('should throw ForbiddenException when userId does not match', () => {
      const entity: Ownable = { userId: 'user-1' };
      expect(() => service.verifyOwnership(entity, 'user-999')).toThrow(
        ForbiddenException,
      );
    });

    it('should use a custom ownerField', () => {
      const entity: Ownable = { authorId: 'author-5' };
      const result = service.verifyOwnership(entity, 'author-5', {
        ownerField: 'authorId',
      });
      expect(result).toBe(entity);
    });

    it('should throw ForbiddenException when custom ownerField does not match', () => {
      const entity: Ownable = { authorId: 'author-5' };
      expect(() =>
        service.verifyOwnership(entity, 'wrong-user', {
          ownerField: 'authorId',
        }),
      ).toThrow(ForbiddenException);
    });

    it('should include entityName in NotFoundException message', () => {
      try {
        service.verifyOwnership(null, 'u1', { entityName: 'Post' });
        fail('Expected NotFoundException');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).message).toContain('Post');
      }
    });
  });

  // =====================================================================
  // verifyExists
  // =====================================================================
  describe('verifyExists', () => {
    it('should return the entity when it exists', () => {
      const entity = { id: '1', title: 'Test' };
      expect(service.verifyExists(entity, 'School')).toBe(entity);
    });

    it('should throw NotFoundException when entity is null', () => {
      expect(() => service.verifyExists(null, 'School')).toThrow(
        NotFoundException,
      );
    });

    it('should include entityName in NotFoundException message', () => {
      try {
        service.verifyExists(null, 'School');
        fail('Expected NotFoundException');
      } catch (error) {
        expect((error as NotFoundException).message).toContain('School');
      }
    });
  });

  // =====================================================================
  // verifyRole
  // =====================================================================
  describe('verifyRole', () => {
    it('should succeed when the user role is in requiredRoles', () => {
      expect(() =>
        service.verifyRole('ADMIN', ['ADMIN', 'VERIFIED']),
      ).not.toThrow();
    });

    it('should throw ForbiddenException with default message when role not allowed', () => {
      try {
        service.verifyRole('USER', ['ADMIN']);
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe(
          "You don't have permission to perform this action",
        );
      }
    });

    it('should throw ForbiddenException with a custom message', () => {
      try {
        service.verifyRole('USER', ['ADMIN'], 'Admins only');
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe('Admins only');
      }
    });
  });

  // =====================================================================
  // verifyAdminOrOwner
  // =====================================================================
  describe('verifyAdminOrOwner', () => {
    it('should allow an ADMIN regardless of ownership', () => {
      const entity: Ownable = { userId: 'other-user' };
      const result = service.verifyAdminOrOwner(entity, 'admin-user', 'ADMIN');
      expect(result).toBe(entity);
    });

    it('should allow the owner when role is not ADMIN', () => {
      const entity: Ownable = { userId: 'user-1' };
      const result = service.verifyAdminOrOwner(entity, 'user-1', 'USER');
      expect(result).toBe(entity);
    });

    it('should throw ForbiddenException when neither admin nor owner', () => {
      const entity: Ownable = { userId: 'user-1' };
      expect(() =>
        service.verifyAdminOrOwner(entity, 'user-999', 'USER'),
      ).toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when entity is null', () => {
      expect(() => service.verifyAdminOrOwner(null, 'user-1', 'ADMIN')).toThrow(
        NotFoundException,
      );
    });

    it('should use a custom ownerField', () => {
      const entity: Ownable = { authorId: 'user-1' };
      const result = service.verifyAdminOrOwner(entity, 'user-1', 'USER', {
        ownerField: 'authorId',
      });
      expect(result).toBe(entity);
    });
  });

  // =====================================================================
  // verifyNestedOwnership
  // =====================================================================
  describe('verifyNestedOwnership', () => {
    it('should return the entity when the nested owner matches', () => {
      const entity = { id: '1', profile: { userId: 'user-1' } };
      const result = service.verifyNestedOwnership(
        entity,
        'user-1',
        (e) => e.profile?.userId,
      );
      expect(result).toBe(entity);
    });

    it('should throw ForbiddenException when nested owner does not match', () => {
      const entity = { id: '1', profile: { userId: 'user-1' } };
      expect(() =>
        service.verifyNestedOwnership(
          entity,
          'user-999',
          (e) => e.profile?.userId,
        ),
      ).toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when entity is null', () => {
      expect(() =>
        service.verifyNestedOwnership(null, 'user-1', () => undefined),
      ).toThrow(NotFoundException);
    });

    it('should return null when throwOnNotFound is false and entity is null', () => {
      const result = service.verifyNestedOwnership(
        null,
        'user-1',
        () => undefined,
        { throwOnNotFound: false },
      );
      expect(result).toBeNull();
    });

    it('should include entityName in error messages', () => {
      const entity = { id: '1', profile: { userId: 'other' } };
      try {
        service.verifyNestedOwnership(
          entity,
          'user-1',
          (e) => e.profile?.userId,
          { entityName: 'Activity' },
        );
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toContain('activity');
      }
    });
  });
});
